import type { AnyMessageOf, AnyMessages, TypedChannelTransport } from "../types";

export type PostMessageTarget = {
  postMessage: (message: any) => void;
  addEventListener: (type: "message", listener: (event: MessageEvent) => void) => void;
  removeEventListener: (type: "message", listener: (event: MessageEvent) => void) => void;
};

export function createPostMessageTransport<
  InboundMessages extends AnyMessages,
  OutboundMessages extends AnyMessages = InboundMessages,
>(target: PostMessageTarget): TypedChannelTransport<InboundMessages, OutboundMessages> {
  function on(handler: (message: AnyMessageOf<InboundMessages>) => void) {
    const handleMessage = (e: MessageEvent<AnyMessageOf<InboundMessages>>) => {
      handler(e.data);
    };

    target.addEventListener("message", handleMessage);

    return () => {
      target.removeEventListener("message", handleMessage);
    };
  }

  function emit(message: AnyMessageOf<OutboundMessages>) {
    target.postMessage(message);
  }

  return { on, emit };
}
