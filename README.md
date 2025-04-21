# typed-channel

A type-safe communication channel for sending and receiving messages between different contexts in a TypeScript environment.

[![npm version](https://img.shields.io/npm/v/typed-channel.svg)](https://www.npmjs.com/package/typed-channel)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Features

- ✅ Full TypeScript support with type checking for messages
- ✅ Multiple transport implementations (EventTarget, PostMessage, your own custom implementation)
- ✅ Simple, lightweight API
- ✅ Zero dependencies

## Installation

```bash
# npm
npm install typed-channel

# pnpm
pnpm add typed-channel

# yarn
yarn add typed-channel
```

## Core Concepts

`typed-channel` provides a simple API for creating type-safe communication channels between different contexts in your application. This is particularly useful for:

- Communication between main thread and Web Workers
- Cross-frame communication using postMessage
- Communication between different parts of your application via events
- Any other event-based communication

## Usage

Here we are using the `EventTarget` transport to create a simple typed event emitter:

### Step 1: Define your message types

```typescript
// Define the messages that can be sent through the channel
type Messages = {
  // Message name : payload type
  notify: { message: string };
  clear: never; // Use 'never' for messages with no payload
};
```

### Step 2: Choose a transport

```typescript
import { createTypedChannel } from "typed-channel";
import { createEventTargetTransport } from "typed-channel/transports/eventTarget";

// Create a transport appropriate for your use case
const transport = createEventTargetTransport<Messages>();
// Create the channel with your type definitions
const channel = createTypedChannel(transport);
```

### Step 3: Send and receive messages

```typescript
// Type-safe event handling
const unsubscribeNotify = eventEmitter.on("notify", ({ message }) => {
  console.log(`Received notification with message: ${message}`);
});
const unsubscribeClear = eventEmitter.on("clear", () => {
  console.clear();
});

// Type-safe event emission
eventEmitter.emit("notify", { message: "Application is ready" });
setTimeout(() => {
  eventEmitter.emit("clear");
  // Remove all listeners
  unsubscribeNotify();
  unsubscribeClear();
}, 1000);
```

## Unidirectional vs Bidirectional Transports

Transports can be configured in two ways:

- **Unidirectional**: Same message types in both directions
- **Bidirectional**: Different message types for incoming and outgoing communications

Unidirectional transports are ideal for event buses within the same context, while bidirectional transports excel when communicating between different contexts (like main thread and worker).

Here's how to use both approaches:

```typescript
// Unidirectional: Same message types for both directions (default)
const uniTransport = createEventTargetTransport<{ start: never; stop: never }>();

// Can receive and emit the same set of messages
uniTransport.on("start", () => {});
uniTransport.on("stop", () => {});
uniTransport.emit("start");
uniTransport.emit("stop");

// Bidirectional: Different message types for inbound and outbound
type InboundMessages = {
  status: { code: number; message: string };
  data: { items: unknown[] };
};

type OutboundMessages = {
  fetch: { id: string };
  cancel: never;
};

// Explicitly defining different types for incoming and outgoing messages
const biTransport = createPostMessageTransport<InboundMessages, OutboundMessages>(worker);

// Can receive only inbound messages
biTransport.on("status", ({ code, message }) => {});
biTransport.on("data", ({ items }) => {});

// Can emit only outbound messages
biTransport.emit("fetch", { id: "123" });
biTransport.emit("cancel");
```

## Multiple Transports

You can combine multiple transports to send messages to different targets:

```typescript
import { createTypedChannel } from "typed-channel";
import { createEventTargetTransport } from "typed-channel/transports/eventTarget";
import { createPostMessageTransport } from "typed-channel/transports/postMessage";

const broadcastChannel = new BroadcastChannel("example-channel");
const broadcastTransport = createPostMessageTransport<Messages>(broadcastChannel);
const localTransport = createEventTargetTransport<Messages>();

// Messages will be sent to all tabs, including current one
const channel = createTypedChannel([localTransport, broadcastTransport]);
```

## Available Transports

### EventTarget Transport

Uses the standard DOM `EventTarget` interface for communication.

```typescript
import { createEventTargetTransport } from "typed-channel/transports/eventTarget";

// Uses a new EventTarget instance by default
const transport = createEventTargetTransport();

// Or provide your own EventTarget
const customTarget = new EventTarget();
const transport = createEventTargetTransport(customTarget);
```

### PostMessage Transport

For communication with Workers, iframes, or other such contexts.

```typescript
import { createPostMessageTransport } from "typed-channel/transports/postMessage";

// With a Worker
const worker = new Worker("./worker.js");
const transport = createPostMessageTransport(worker);

// With an iframe
const iframe = document.querySelector("iframe");
const transport = createPostMessageTransport(iframe.contentWindow);
```

### BroadcastChannel Transport

For communication between different tabs/windows of the same origin.

```typescript
import { createPostMessageTransport } from "typed-channel/transports/postMessage";

const broadcastChannel = new BroadcastChannel("example-channel");
const transport = createPostMessageTransport(broadcastChannel);
```

## Custom Transports

You can create custom transports by implementing the `TypedChannelTransport` interface. This gives you flexibility to adapt typed-channel to any messaging system.

Here's a simple example of a custom transport structure:

```typescript
import { type AnyMessageOf, type AnyMessages, type TypedChannelTransport } from "typed-channel";

function createNewTransport<Messages extends AnyMessages>(): TypedChannelTransport<Messages> {
  // implementation details
  function on(handler: (message: AnyMessageOf<InboundMessages>) => void) {
    handler(messageFromSomeSource); // call handler with message data coming from transport
    return () => {}; // return cleanup function
  }

  function emit(message: AnyMessageOf<Messages>) {
    // pass emitted message to the transport
  }

  return { on, emit };
}
```

### Advanced Example: Figma Plugin Communication

Here's a real-world example of custom transport for Figma plugin UI communication:

```typescript
import type { PluginMessages, UIMessages } from "./types";
import {
  type AnyMessageOf,
  type AnyMessages,
  createTypedChannel,
  type TypedChannelTransport,
} from "typed-channel";

export type PluginMessages = {
  ready: never;
};

export type UIMessages = {
  "window:resize": { width: number; height: number };
};

function createFigmaUiTransport<
  InboundMessages extends AnyMessages,
  OutboundMessages extends AnyMessages,
>(): TypedChannelTransport<InboundMessages, OutboundMessages> {
  function on(handler: (message: AnyMessageOf<InboundMessages>) => void) {
    const workerMessageHandler = (
      e: MessageEvent<{ pluginMessage: AnyMessageOf<InboundMessages> }>,
    ) => {
      handler(e.data.pluginMessage);
    };

    globalThis.onmessage = workerMessageHandler;

    return () => (globalThis.onmessage = null);
  }

  function emit(message: AnyMessageOf<OutboundMessages>) {
    parent.postMessage({ pluginMessage: message }, "*");
  }

  return { on, emit };
}

// Create the transport with appropriate type parameters
const transport = createFigmaUiTransport<PluginMessages, UIMessages>();

// Create a typed communication channel using our custom transport
export const pluginChannel = createTypedChannel(transport);
```

This advanced example shows how to create a custom transport for Figma plugins, where:

1. The `on` method wraps Figma's message handling convention (where messages arrive via `pluginMessage` property)
2. The `emit` method sends messages to the parent frame with the proper Figma message format
3. The transport specifies different types for inbound vs outbound messages

By following these patterns, you can adapt typed-channel to work with any messaging API.

## Examples

You can find more examples in the [examples directory](./examples):

- [EventTarget Example](./examples/EventTarget)
- [Worker Example](./examples/Worker)
- [BroadcastChannel Example](./examples/BroadcastChannel)

## License

[MIT](./LICENSE.md)
