/**
 * Function that will be called on unsubscribing from a message type.
 */
export type CleanupFunction = VoidFunction;

/**
 * Represents a typed message with a payload.
 * @template Type - The string literal type of the message.
 * @template Payload - The type of the payload data.
 */
export type Message<Type extends string, Payload> = {
  type: Type;
  payload: [Payload] extends [never] ? undefined : Payload;
};

/**
 * Utility type for extending real messages map from it in generics.
 */
export type AnyMessages = Record<string, unknown>;

/**
 * Utility type that extracts all possible message types from a message map.
 * @template T - The message map type.
 */
export type MessageOf<T extends AnyMessages> = {
  [K in keyof T & string]: Message<K, T[K]>;
}[keyof T & string];

/**
 * One kind of request traffic on the wire. Every kind carries the same four fields, so a value
 * off the wire is valid request traffic as soon as `rpc`, `id` and `type` check out.
 * @template Kind - Which kind of traffic this is.
 */
type RpcMessageOf<Kind extends string> = { rpc: Kind; id: string; type: string; payload?: unknown };

/**
 * The wire shape of request traffic. Every variant carries an `rpc` field, which tells it apart
 * from a plain message: a message and a request may share a `type`.
 */
export type RpcMessage =
  | RpcMessageOf<"request">
  | RpcMessageOf<"response">
  | RpcMessageOf<"error">
  | RpcMessageOf<"abort">;

/**
 * Everything a transport can carry: the typed messages of a map plus the request traffic.
 * A transport can also hand over a value that is not an object at all, so check that first:
 * `in` throws on `null`. Then narrow with `"rpc" in message` before reading `type` as one of
 * the message names.
 * @template T - The message map type.
 */
export type AnyMessageOf<T extends AnyMessages> = MessageOf<T> | RpcMessage;

/**
 * The main TypedChannel interface for communication between components.
 * @template InboundMessages - The message types this channel can receive.
 * @template OutboundMessages - The message types this channel can send.
 */
export type TypedChannel<
  InboundMessages extends AnyMessages,
  OutboundMessages extends AnyMessages,
> = {
  /**
   * Starts listening for incoming messages on every transport of this channel
   */
  listen: () => void;
  /**
   * Stops listening for incoming messages and cleans up every transport subscription
   */
  unlisten: () => void;
  /**
   * Sends a message through every transport of this channel
   *
   * @param type - The message type identifier
   * @param payload - The optional payload (omitted if the message type has no payload)
   */
  emit: <Type extends keyof OutboundMessages & string>(
    ...[type, payload]: OutboundMessages[Type] extends never
      ? [Type]
      : [Type, OutboundMessages[Type]]
  ) => void;
  /**
   * Registers a handler for a specific message type
   *
   * @param type - The message type identifier
   * @param handler - The function to call when a message of this type is received
   * @returns A cleanup function that, when called, will unregister the handler
   */
  on: <Type extends keyof InboundMessages>(
    type: Type,
    handler: (payload: InboundMessages[Type]) => void,
  ) => CleanupFunction;
};

/**
 * Interface for a transport mechanism that can send and receive messages.
 * @template InboundMessages - The message types this transport can receive.
 * @template OutboundMessages - The message types this transport can send.
 */
export type TypedChannelTransport<
  InboundMessages extends AnyMessages,
  OutboundMessages extends AnyMessages,
> = {
  /**
   * Register a handler for incoming messages.
   * @param handler - The function to call when a message is received.
   * @returns A function that, when called, will unregister the handler.
   */
  on: (handler: (message: AnyMessageOf<InboundMessages>) => void) => CleanupFunction;
  /**
   * Send a message through the transport.
   * @param message - The message to send.
   */
  emit: (message: AnyMessageOf<OutboundMessages>) => void;
};

/**
 * A single request in a request map: at most one parameter, any return type.
 */
export type AnyRequest = (() => unknown) | ((params: never) => unknown);

/**
 * Utility type for extending real request maps from it in generics.
 */
export type AnyRequests = Record<string, AnyRequest>;

/**
 * Turns every request that may be called without params into an error message, so a map with
 * such a request fails to compile. `RequestHandler` gives a request without params a handler
 * that takes the context alone, so a request that may be called either way has no handler shape.
 * @template Requests - The request map to check.
 */
export type ValidRequests<Requests extends AnyRequests> = {
  [Type in keyof Requests]: Parameters<Requests[Type]> extends []
    ? Requests[Type]
    : undefined extends Parameters<Requests[Type]>[0]
      ? "A request parameter must be required and must not include undefined"
      : Requests[Type];
};

/**
 * Type witness produced by `requests()`. It has no runtime value: it carries the two request
 * maps so `createTypedRpcChannel` infers both from a single argument.
 * @template HandledRequests - The requests this channel answers.
 * @template CalledRequests - The requests this channel can call on the peer.
 */
export type Requests<HandledRequests extends AnyRequests, CalledRequests extends AnyRequests> = {
  readonly handled?: HandledRequests;
  readonly called?: CalledRequests;
};

/**
 * Per-call options of `request`.
 */
export type RequestOptions = { signal?: AbortSignal | undefined };

/**
 * Arguments of `request` after the request name. The params slot is always there, so a request
 * without params reads as `request("ping")` or `request("ping", undefined, { signal })`.
 * @template Request - The request signature from the request map.
 */
export type RequestArgs<Request extends AnyRequest> =
  Parameters<Request> extends []
    ? [params?: undefined, options?: RequestOptions]
    : [params: Parameters<Request>[0], options?: RequestOptions];

/**
 * What the channel hands a request handler on every call. `RequestOptions` travels the other
 * way, from the caller into `request`, so the two stay separate types.
 */
export type RequestContext = { signal: AbortSignal };

/**
 * The handler `handle` takes. It always receives the context last, and the request params
 * first when the request declares them.
 * @template Request - The request signature from the request map.
 */
export type RequestHandler<Request extends AnyRequest> = (
  ...args: Parameters<Request> extends []
    ? [context: RequestContext]
    : [params: Parameters<Request>[0], context: RequestContext]
) => ReturnType<Request> | Promise<ReturnType<Request>>;

/**
 * A typed channel that also speaks the request protocol.
 * @template InboundMessages - The message types this channel can receive.
 * @template OutboundMessages - The message types this channel can send.
 * @template HandledRequests - The requests this channel answers.
 * @template CalledRequests - The requests this channel can call on the peer.
 */
export type TypedRpcChannel<
  InboundMessages extends AnyMessages,
  OutboundMessages extends AnyMessages,
  HandledRequests extends AnyRequests,
  CalledRequests extends AnyRequests,
> = TypedChannel<InboundMessages, OutboundMessages> & {
  /**
   * Sends a request and waits for the peer's response.
   *
   * @param type - The request name
   * @param args - The request params, then the per-call options
   * @returns A promise that resolves with the value the peer's handler returned
   */
  request: <Type extends keyof CalledRequests & string>(
    type: Type,
    ...args: RequestArgs<CalledRequests[Type]>
  ) => Promise<Awaited<ReturnType<CalledRequests[Type]>>>;
  /**
   * Registers the handler that answers one request name. Only one handler per name is allowed.
   *
   * @param type - The request name
   * @param handler - The function that produces the response
   * @returns A cleanup function that, when called, will unregister the handler
   */
  handle: <Type extends keyof HandledRequests & string>(
    type: Type,
    handler: RequestHandler<HandledRequests[Type]>,
  ) => CleanupFunction;
};
