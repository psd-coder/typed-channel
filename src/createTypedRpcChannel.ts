import { createChannel } from "./channel";
import type {
  AnyMessageOf,
  AnyMessages,
  AnyRequests,
  CleanupFunction,
  RequestArgs,
  RequestContext,
  RequestHandler,
  Requests,
  RpcMessage,
  TypedChannelTransport,
  TypedRpcChannel,
  ValidRequests,
} from "./types";

const STOPPED_LISTENING = "Channel stopped listening";

// A value read off the wire is `unknown`, so a function that takes it is widened to this shape
// before it is called. The narrow type it came from is the one the user declared.
type RawPayloadConsumer = (payload: unknown) => void;

type RawRequestHandler = (...args: [RequestContext] | [unknown, RequestContext]) => unknown;

// A thrown value that is not an `Error` travels as an `Error` with that value as its message,
// so the caller always gets the same two fields.
function toErrorPayload(error: unknown) {
  const { name, message } = error instanceof Error ? error : new Error(String(error));

  return { name, message };
}

// The peer decides this payload, so nothing here trusts its shape. `Object()` turns null,
// undefined and every primitive into an object, so the cast below states a fact. A payload
// without a string name leaves the built-in `"Error"` in place rather than overwriting it.
function toError(payload: unknown) {
  const { name, message } = Object(payload) as Record<string, unknown>;
  const error = new Error(typeof message === "string" ? message : undefined);

  return typeof name === "string" ? Object.assign(error, { name }) : error;
}

type RpcReply = Extract<RpcMessage, { rpc: "response" | "error" }>;

// Called with a reply from the peer, or with nothing when `unlisten()` stops the request.
type PendingRequest = (message?: RpcReply) => void;

// A transport can hand over anything, so the three fields the code below reads are checked
// here. Every kind of rpc message carries the same fields, so one check covers all four.
function isRpcMessage(message: unknown): message is RpcMessage {
  if (typeof message !== "object" || message === null) {
    return false;
  }

  // Reading any string key off a non-null object gives `unknown`, so this cast states a fact
  // the check above already proved.
  const { rpc, id, type } = message as Record<string, unknown>;

  return (
    typeof id === "string" &&
    typeof type === "string" &&
    (rpc === "request" || rpc === "response" || rpc === "error" || rpc === "abort")
  );
}

/**
 * Type witness for `createTypedRpcChannel`. It returns nothing at runtime: only its type is
 * read, so both request maps come from a single argument. A map whose request may be called
 * without params, because its parameter is optional or may be `undefined`, is rejected here.
 *
 * @template HandledRequests - The requests the channel answers
 * @template CalledRequests - The requests the channel can call on the peer (defaults to the handled ones)
 */
export function requests<
  HandledRequests extends AnyRequests & ValidRequests<HandledRequests>,
  CalledRequests extends AnyRequests & ValidRequests<CalledRequests> = HandledRequests,
>(): Requests<HandledRequests, CalledRequests> {
  // The witness carries types only, so the cast stands in for a value that never exists.
  return undefined as never;
}

/**
 * Creates a typed channel that, on top of messages, can send requests and answer them.
 * A request travels as `{ rpc: "request", id, type, payload }` and the response comes back as
 * `{ rpc: "response", id, type, payload }` with the same id. The first response for an id
 * resolves the promise; later responses and responses for unknown ids are dropped.
 *
 * A request goes to one transport. A transport may still reach several peers, and then the
 * first response wins.
 *
 * @template InboundMessages - The message types this channel can receive
 * @template OutboundMessages - The message types this channel can send
 * @template HandledRequests - The requests this channel answers
 * @template CalledRequests - The requests this channel can call on the peer
 * @param transport - The transport interface to use for message passing
 * @param _requests - The type witness built by `requests()`
 * @returns A typed channel instance with `request` and `handle` next to `emit` and `on`
 */
export function createTypedRpcChannel<
  InboundMessages extends AnyMessages,
  OutboundMessages extends AnyMessages,
  HandledRequests extends AnyRequests,
  CalledRequests extends AnyRequests,
>(
  transport: TypedChannelTransport<InboundMessages, OutboundMessages>,
  _requests: Requests<HandledRequests, CalledRequests>,
): TypedRpcChannel<InboundMessages, OutboundMessages, HandledRequests, CalledRequests> {
  const channel = createChannel(transport);
  const handlersByRequestType = new Map<string, RawRequestHandler>();
  const pendingRequests = new Map<string, PendingRequest>();
  const runningHandlers = new Map<string, AbortController>();
  let unsubscribeRpcTraffic: CleanupFunction | undefined;

  function handleRpcMessage(message: AnyMessageOf<InboundMessages>) {
    if (!isRpcMessage(message)) {
      return;
    }

    if (message.rpc === "request") {
      const handler = handlersByRequestType.get(message.type);

      if (!handler) {
        return;
      }

      const { id, type, payload } = message;
      const controller = new AbortController();

      runningHandlers.set(id, controller);

      // Nothing is sent once the caller aborted.
      function reply(replyMessage: RpcMessage) {
        runningHandlers.delete(id);

        if (!controller.signal.aborted) {
          transport.emit(replyMessage);
        }
      }

      // The executor turns a synchronous throw into a rejection. The payload is the only
      // runtime hint about the request shape: a request without params sends `undefined`,
      // and its handler takes the context alone.
      const context: RequestContext = { signal: controller.signal };

      new Promise((resolve) => {
        resolve(payload === undefined ? handler(context) : handler(payload, context));
      }).then(
        (responsePayload) => reply({ rpc: "response", id, type, payload: responsePayload }),
        (error: unknown) => reply({ rpc: "error", id, type, payload: toErrorPayload(error) }),
      );

      return;
    }

    if (message.rpc === "abort") {
      runningHandlers.get(message.id)?.abort();
      runningHandlers.delete(message.id);

      return;
    }

    pendingRequests.get(message.id)?.(message);
  }

  function listen() {
    channel.listen();

    unsubscribeRpcTraffic ??= transport.on(handleRpcMessage);
  }

  function unlisten() {
    // Pending requests are stopped before the unsubscribe, so their abort messages still go out
    // on a transport that closes itself when its last listener leaves.
    pendingRequests.forEach((stop) => stop());
    runningHandlers.forEach((controller) => controller.abort());
    runningHandlers.clear();
    channel.unlisten();
    unsubscribeRpcTraffic?.();
    unsubscribeRpcTraffic = undefined;
  }

  function request<Type extends keyof CalledRequests & string>(
    type: Type,
    ...[payload, options]: RequestArgs<CalledRequests[Type]>
  ): Promise<Awaited<ReturnType<CalledRequests[Type]>>> {
    const id = Math.random().toString(36).slice(2);
    const signal = options?.signal;

    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(signal.reason);

        return;
      }

      // Nothing is subscribed, so no response could ever reach this request. Rejecting here
      // keeps the pending map empty instead of holding an entry that nothing can settle.
      if (!unsubscribeRpcTraffic) {
        reject(new DOMException(STOPPED_LISTENING, "AbortError"));

        return;
      }

      function stopWaiting() {
        pendingRequests.delete(id);
        signal?.removeEventListener("abort", onAbort);
      }

      // The abort goes out however the request stopped waiting, a first reply included. On a
      // transport that reaches several peers only one of them wins, and the others would keep
      // running a handler whose answer nobody reads.
      function settle() {
        stopWaiting();
        transport.emit({ rpc: "abort", id, type });
      }

      function abort(reason: unknown) {
        settle();
        reject(reason);
      }

      function onAbort() {
        abort(signal?.reason);
      }

      const resolveWithPayload = resolve as RawPayloadConsumer;

      pendingRequests.set(id, (message) => {
        if (!message) {
          abort(new DOMException(STOPPED_LISTENING, "AbortError"));

          return;
        }

        settle();

        if (message.rpc === "error") {
          reject(toError(message.payload));

          return;
        }

        resolveWithPayload(message.payload);
      });
      signal?.addEventListener("abort", onAbort);

      // A transport can throw right away, and then nothing will ever settle this request. The
      // abort is not sent back: the same transport just failed to carry the request.
      try {
        transport.emit({ rpc: "request", id, type, payload });
      } catch (error) {
        stopWaiting();
        reject(error);
      }
    });
  }

  function handle<Type extends keyof HandledRequests & string>(
    type: Type,
    handler: RequestHandler<HandledRequests[Type]>,
  ): CleanupFunction {
    if (handlersByRequestType.has(type)) {
      throw new Error(`Request handler for "${type}" is already registered`);
    }

    // The stored handler is called with values read off the wire, so its params widen here.
    const rawHandler = handler as RawRequestHandler;

    handlersByRequestType.set(type, rawHandler);

    return () => {
      if (handlersByRequestType.get(type) === rawHandler) {
        handlersByRequestType.delete(type);
      }
    };
  }

  listen();

  return { ...channel, listen, unlisten, request, handle };
}
