import type { CleanupFunction, AnyMessages, TypedChannelTransport, Message } from "./types";

export function createTypedChannel<
  InboundMessages extends AnyMessages,
  OutboundMessages extends AnyMessages,
>(
  transport:
    | TypedChannelTransport<InboundMessages, OutboundMessages>
    | TypedChannelTransport<InboundMessages, OutboundMessages>[],
) {
  const transports = Array.isArray(transport) ? transport : [transport];
  const handlersByMessageType = {} as {
    [K in keyof InboundMessages]?: ((payload: InboundMessages[K]) => void)[];
  };
  let unsubscribeIncomingMessages: CleanupFunction[] = [];

  function handleIncomingMessage<Type extends keyof InboundMessages & string>(
    message: Message<Type, InboundMessages[Type]>,
  ) {
    if (handlersByMessageType[message.type]) {
      const typeHandlers = handlersByMessageType[message.type];

      if (!typeHandlers) {
        return;
      }

      for (const handler of typeHandlers) {
        handler(message.payload as InboundMessages[Type]);
      }
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
    handlersByMessageType[type] ??= [];
    handlersByMessageType[type].push(handler);

    return () => {
      if (!handlersByMessageType[type]) {
        return;
      }

      const handlerIndex = handlersByMessageType[type].indexOf(handler);

      if (handlerIndex !== -1) {
        handlersByMessageType[type].splice(handlerIndex, 1);
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
