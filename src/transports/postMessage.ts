import type { AnyMessageOf, AnyMessages, TypedChannelTransport } from "../types";

/**
 * Interface for objects that support PostMessage interface.
 * This includes Web Workers, iframe contentWindow objects, and other objects that implement
 * postMessage, addEventListener, and removeEventListener methods.
 */
export type PostMessageTarget = {
  postMessage: (message: any) => void;
  addEventListener: (type: "message", listener: (event: MessageEvent) => void) => void;
  removeEventListener: (type: "message", listener: (event: MessageEvent) => void) => void;
};

/**
 * Creates a transport that uses the PostMessage interface for communication.
 * This transport can be used with Web Workers, iframes, or any object that supports
 * the PostMessage interface.
 *
 * @template InboundMessages - The message types this transport can receive
 * @template OutboundMessages - The message types this transport can send (defaults to InboundMessages)
 * @param target - The object implementing the PostMessageTarget interface
 * @returns A typed channel transport for use with createTypedChannel
 */
export function createPostMessageTransport<
  InboundMessages extends AnyMessages,
  OutboundMessages extends AnyMessages = InboundMessages,
>(target: PostMessageTarget): TypedChannelTransport<InboundMessages, OutboundMessages> {
  /**
   * Registers a handler for incoming messages
   *
   * @param handler - The function to call when a message is received
   * @returns A function that, when called, will unregister the handler
   */
  function on(handler: (message: AnyMessageOf<InboundMessages>) => void) {
    const handleMessage = (e: MessageEvent<AnyMessageOf<InboundMessages>>) => {
      handler(e.data);
    };

    target.addEventListener("message", handleMessage);

    return () => {
      target.removeEventListener("message", handleMessage);
    };
  }

  /**
   * Sends a message through the postMessage API
   *
   * @param message - The message to send
   */
  function emit(message: AnyMessageOf<OutboundMessages>) {
    target.postMessage(message);
  }

  return { on, emit };
}
