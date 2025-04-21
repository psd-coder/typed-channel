import { createTypedChannel } from "../../src/index";
import { createPostMessageTransport } from "../../src/transports/postMessage";
import type { ClientMessages, WorkerMessages } from "./types";

// Setup channel
const worker = new Worker(new URL("./worker.ts", import.meta.url), {
  type: "module",
});

const workerTransport = createPostMessageTransport<WorkerMessages, ClientMessages>(worker);
const channel = createTypedChannel(workerTransport);

// Listen for or trigger events
document.getElementById("start")!.addEventListener("click", () => channel.emit("startTimer"));
document.getElementById("stop")!.addEventListener("click", () => channel.emit("stopTimer"));
channel.on("notify", ({ message }) => log("Notification received: " + message));

// Utils
function log(message: string) {
  const messageElement = document.createElement("p");
  messageElement.textContent = message;

  document.getElementById("log")!.appendChild(messageElement);
}
