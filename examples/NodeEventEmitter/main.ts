import EventEmitter from "node:events";
import {
  createTypedChannel,
  type AnyMessageOf,
  type AnyMessages,
  type TypedChannelTransport,
} from "typed-channel";

// This is just a DEMO of ability working with Node.js EventEmitter.
// EventEmitter supports specifying types out of the box, so there isn't much sense in using
// TypedChannel for this. But it is possible to use typed-channel with EventEmitter if you want
// to have the same API across your application

// Create custom Node EventEmitter transport
function createEventEmitterTransport<Messages extends AnyMessages>(
  ee: EventEmitter = new EventEmitter(),
): TypedChannelTransport<Messages, Messages> {
  function on(handler: (message: AnyMessageOf<Messages>) => void) {
    const workerMessageHandler = (message: AnyMessageOf<Messages>) => {
      handler(message);
    };

    ee.addListener("message", workerMessageHandler);
    return () => ee.removeListener("message", workerMessageHandler);
  }

  function emit(message: AnyMessageOf<Messages>) {
    ee.emit("message", message);
  }

  return { on, emit };
}

// Setup channel
type Events = {
  ready: never;
  notify: { message: string };
};

const eventEmitterTransport = createEventEmitterTransport<Events>();
const channel = createTypedChannel(eventEmitterTransport);

// Listen for events
channel.on("ready", () => console.log("Ready event received"));
channel.on("notify", ({ message }) => console.log(`Notify event received: ${message}`));

// Emit events
channel.emit("ready");
let n = 1;
const interval = setInterval(() => {
  channel.emit("notify", { message: `Hello, world! ${n++}` });
  if (n > 5) {
    clearInterval(interval);
  }
}, 1000);
