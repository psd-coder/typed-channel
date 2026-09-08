/**
 * # typed-channel
 *
 * A type-safe communication channel for sending and receiving messages between different contexts in TypeScript.
 *
 * ## Features
 *
 * - Full TypeScript support with type checking for messages
 * - Multiple transport implementations (EventTarget, PostMessage, your custom transport)
 * - Request/response with abort and timeout
 * - Simple, lightweight API
 * - Zero dependencies
 *
 * ## Core Concepts
 *
 * This library provides strongly-typed message passing for:
 * - Communication between main thread and Web Workers
 * - Cross-frame communication using postMessage
 * - Communication between different parts of your application via events
 * - Any other event-based communication
 *
 * ## Basic Usage
 *
 * ```typescript
 * // 1. Define your message types
 * type Messages = {
 *   notify: { message: string };
 *   clear: never; // Use 'never' for messages with no payload
 * };
 *
 * // 2. Choose a transport
 * const transport = createEventTargetTransport<Messages>();
 * const channel = createTypedChannel(transport);
 *
 * // 3. Send and receive messages
 * const unsubscribe = channel.on("notify", ({ message }) => {
 *   console.log(`Notification: ${message}`);
 * });
 *
 * channel.emit("notify", { message: "Hello world" });
 * ```
 *
 * ## Transport Types
 *
 * - **EventTarget**: Uses the standard DOM `EventTarget` interface for communication.
 * - **PostMessage**: For communication with Workers, iframes, or other such contexts.
 *
 * ## Bidirectional Communication
 *
 * You can specify different message types for inbound and outbound communication:
 *
 * ```typescript
 * type InboundMessages = { status: { code: number } };
 * type OutboundMessages = { fetch: { id: string } };
 *
 * // Different types for incoming and outgoing messages
 * const transport = createPostMessageTransport<InboundMessages, OutboundMessages>(worker);
 * const channel = createTypedChannel(transport);
 * ```
 *
 * ## Multiple Transports
 *
 * You can combine multiple transports to send messages to different targets:
 *
 * ```typescript
 * import { createTypedChannel } from "typed-channel";
 * import { createEventTargetTransport } from "typed-channel/transports/eventTarget";
 * import { createPostMessageTransport } from "typed-channel/transports/postMessage";
 *
 * const broadcastChannel = new BroadcastChannel("example-channel");
 * const broadcastTransport = createPostMessageTransport<Messages>(broadcastChannel);
 * const localTransport = createEventTargetTransport<Messages>();
 *
 * // Messages will be sent to all tabs, including current one
 * const channel = createTypedChannel([localTransport, broadcastTransport]);
 * ```
 *
 * ## Requests
 *
 * A request is a message the sender waits on: exactly one response, or a failure, comes back
 * for it. `createTypedRpcChannel` adds `request` and `handle` next to `emit` and `on`:
 *
 * ```typescript
 * import { createTypedRpcChannel, requests } from "typed-channel";
 * import { createPostMessageTransport } from "typed-channel/transports/postMessage";
 *
 * // Requests the worker answers, and nothing in the other direction
 * type WorkerRequests = { compute: (params: { steps: number }) => number };
 * type NoRequests = Record<never, never>;
 *
 * const transport = createPostMessageTransport<Messages>(worker);
 * // First map: what this side handles. Second map: what it calls on the peer.
 * const channel = createTypedRpcChannel(transport, requests<NoRequests, WorkerRequests>());
 *
 * // Wait for the response, and stop waiting after 5 seconds
 * const total = await channel.request(
 *   "compute",
 *   { steps: 6 },
 *   { signal: AbortSignal.timeout(5000) },
 * );
 * ```
 *
 * The worker side swaps the two maps and answers the request:
 *
 * ```typescript
 * const channel = createTypedRpcChannel(transport, requests<WorkerRequests, NoRequests>());
 *
 * channel.handle("compute", ({ steps }, { signal }) => runSteps(steps, signal));
 * ```
 *
 * A request with no handler on the other side ends only through its `signal`, so pass a
 * timeout signal when the peer may be missing.
 *
 * @module typed-channel
 */

export { createTypedChannel } from "./createTypedChannel";
export { createTypedRpcChannel, requests } from "./createTypedRpcChannel";
export { createEventTargetTransport } from "./transports/eventTarget";
export { createPostMessageTransport } from "./transports/postMessage";
export * from "./types";
