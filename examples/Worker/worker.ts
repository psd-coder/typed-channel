import { createTypedChannel } from "../../src/index";
import { createPostMessageTransport } from "../../src/transports/postMessage";
import type { ClientMessages, WorkerMessages } from "./types";

// Setup channel
const postMessageTransport = createPostMessageTransport<ClientMessages, WorkerMessages>(globalThis);
const channel = createTypedChannel(postMessageTransport);

// Listen for or trigger events
let timer: ReturnType<typeof setTimeout> | null = null;
channel.on("startTimer", () => {
  if (timer) {
    return;
  }

  timer = setInterval(() => {
    channel.emit("notify", { message: `Timer tick: ${Date.now()}` });
  }, 1000);
});
channel.on("stopTimer", () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
});
