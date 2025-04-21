/**
 * A type-safe communication channel for sending and receiving messages between different contexts in a TypeScript environment.
 *
 * This library provides strongly-typed message passing between different parts of your application:
 * - Communication between main thread and Web Workers
 * - Cross-frame communication using postMessage
 * - Communication between different components via events
 *
 * @example
 * ```typescript
 * // Define your message types
 * type Messages = {
 *   notify: { message: string };
 *   clear: never;
 * };
 *
 * // Create a transport and channel
 * const transport = createEventTargetTransport<Messages>();
 * const eventEmitter = createTypedChannel<Messages, Messages>(transport);
 *
 * // Type-safe event handling
 * const unsubscribe = eventEmitter.on("notify", ({ message }) => {
 *   console.log(`Notification: ${message}`);
 * });
 *
 * // Type-safe event emission
 * eventEmitter.emit("notify", { message: "Hello world" });
 * ```
 * @module typed-channel
 */
export { createTypedChannel } from "./createTypedChannel";
export { createEventTargetTransport } from "./transports/eventTarget";
export { createPostMessageTransport } from "./transports/postMessage";
export * from "./types";
