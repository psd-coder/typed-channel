import type {
  AnyMessageOf,
  AnyMessages,
  CleanupFunction,
  Message,
  TypedChannel,
  TypedChannelTransport,
} from "./types";

/**
 * Creates a typed communication channel that can send and receive strongly-typed messages.
 * This is useful for creating a strongly-typed API for communication between different parts of an application, such as between a main thread and a web worker, or between different components in a framework.
 * Can be unidirectional or bidirectional, depending on the transport interfaces used. To make it unidirectional, just pass the same message types for both inbound and outbound messages.
 * Can work either one or multiple transports. If multiple transports are passed, the channel will send messages to all of them and listen for incoming messages from all of them.
 * Incoming messages that carry an `rpc` field belong to the request protocol, so they never
 * reach a handler registered with `on`.
 *
 * @template InboundMessages - The message types this channel can receive
 * @template OutboundMessages - The message types this channel can send
 * @param transport - One or more transport interfaces to use for message passing
 * @returns A typed channel instance with methods to send and receive messages
 */
export function createChannel<
  InboundMessages extends AnyMessages,
  OutboundMessages extends AnyMessages,
>(
  transport:
    | TypedChannelTransport<InboundMessages, OutboundMessages>
    | TypedChannelTransport<InboundMessages, OutboundMessages>[],
): TypedChannel<InboundMessages, OutboundMessages> {
  const transports = Array.isArray(transport) ? transport : [transport];
  const handlersByMessageType = {} as {
    [K in keyof InboundMessages]?: ((payload: InboundMessages[K]) => void)[];
  };
  let unsubscribeIncomingMessages: CleanupFunction[] = [];

  function handleIncomingMessage(message: AnyMessageOf<InboundMessages>) {
    // The object check comes first: a transport can hand over anything, and `in` throws on a
    // value that is not an object. Request traffic carries `rpc` and belongs to the rpc channel.
    if (typeof message !== "object" || message === null || "rpc" in message) {
      return;
    }

    const typeHandlers = handlersByMessageType[message.type];

    if (!typeHandlers) {
      return;
    }

    // The map says what a payload looks like for this message name. The wire cannot be checked
    // against it without a schema, so this is where the library trusts the sender.
    for (const handler of typeHandlers) {
      handler(message.payload as InboundMessages[typeof message.type]);
    }
  }

  function listen() {
    if (unsubscribeIncomingMessages.length === 0) {
      unsubscribeIncomingMessages = transports.map((t) => t.on(handleIncomingMessage));
    }
  }

  function unlisten() {
    unsubscribeIncomingMessages.forEach((unsubscribe) => unsubscribe?.());
    unsubscribeIncomingMessages = [];
  }

  function emit<Type extends keyof OutboundMessages & string>(
    ...[type, payload]: OutboundMessages[Type] extends never
      ? [Type]
      : [Type, OutboundMessages[Type]]
  ) {
    const message = { type, payload } as Message<Type, OutboundMessages[Type]>;
    transports.forEach((t) => t.emit(message));
  }

  function on<Type extends keyof InboundMessages>(
    type: Type,
    handler: (payload: InboundMessages[Type]) => void,
  ): CleanupFunction {
    const typeHandlers = (handlersByMessageType[type] ??= []);

    typeHandlers.push(handler);

    return () => {
      const handlerIndex = typeHandlers.indexOf(handler);

      if (handlerIndex !== -1) {
        typeHandlers.splice(handlerIndex, 1);
      }
    };
  }

  listen();

  return {
    listen,
    unlisten,
    emit,
    on,
  };
}
