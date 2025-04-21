import type { AnyMessageOf, AnyMessages, TypedChannelTransport } from "../types";

export function createEventTargetTransport<
  InboundMessages extends AnyMessages,
  OutboundMessages extends AnyMessages = InboundMessages,
>(target = new EventTarget()): TypedChannelTransport<InboundMessages, OutboundMessages> {
  function on(handler: (message: AnyMessageOf<InboundMessages>) => void) {
    const handleMessage = (e: Event) => {
      handler((e as CustomEvent<AnyMessageOf<InboundMessages>>).detail);
    };

    target.addEventListener("message", handleMessage);

    return () => {
      target.removeEventListener("message", handleMessage);
    };
  }

  function emit(message: AnyMessageOf<OutboundMessages>) {
    const event = new CustomEvent("message", { detail: message });
    target.dispatchEvent(event);
  }

  return { on, emit };
}
