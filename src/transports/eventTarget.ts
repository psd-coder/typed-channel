import type { AnyMessageOf, AnyMessages, TypedChannelTransport } from "../types";

/**
 * Creates a transport that uses the DOM EventTarget interface for communication.
 * This transport can be used with any object that implements the EventTarget interface.
 * The most common use case is creating event channels in a web application (event emitters)
 *
 * @template InboundMessages - The message types this transport can receive
 * @template OutboundMessages - The message types this transport can send (defaults to InboundMessages)
 * @param target - The EventTarget instance to use for event dispatching (defaults to a new EventTarget)
 * @returns A typed channel transport for use with createTypedChannel
 */
export function createEventTargetTransport<
  InboundMessages extends AnyMessages,
  OutboundMessages extends AnyMessages = InboundMessages,
>(
  target: EventTarget = new EventTarget(),
): TypedChannelTransport<InboundMessages, OutboundMessages> {
  /**
   * Registers a handler for incoming messages
   *
   * @param handler - The function to call when a message is received
   * @returns A function that, when called, will unregister the handler
   */
  function on(handler: (message: AnyMessageOf<InboundMessages>) => void) {
    const handleMessage = (e: Event) => {
      handler((e as CustomEvent<AnyMessageOf<InboundMessages>>).detail);
    };

    target.addEventListener("message", handleMessage);

    return () => {
      target.removeEventListener("message", handleMessage);
    };
  }

  /**
   * Sends a message through the event target
   *
   * @param message - The message to send
   */
  function emit(message: AnyMessageOf<OutboundMessages>) {
    const event = new CustomEvent("message", { detail: message });
    target.dispatchEvent(event);
  }

  return { on, emit };
}
