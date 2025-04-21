import { createTypedChannel, createEventTargetTransport } from "typed-channel";

// Setup channel
type Events = {
  ready: never;
  notify: { message: string };
};

const transport = createEventTargetTransport<Events>();
const channel = createTypedChannel(transport);

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
