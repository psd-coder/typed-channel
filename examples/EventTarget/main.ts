import { createTypedChannel } from "../../src/index";
import { createEventTargetTransport } from "../../src/transports/eventTarget";

// Setup channel
type Events = {
  ready: never;
  notify: { message: string };
  reset: never;
};

const transport = createEventTargetTransport<Events>();
const channel = createTypedChannel(transport);

// Listen for events
channel.on("ready", () => log("Ready event received"));
channel.on("notify", ({ message }) => log(`Notify event received: ${message}`));
channel.on("reset", () => (document.getElementById("log")!.innerHTML = ""));

// Emit events
channel.emit("ready");
setTimeout(() => {
  channel.emit("notify", { message: "Hello, world!" });
}, 1000);
document
  .getElementById("trigger")!
  .addEventListener("click", () => channel.emit("notify", { message: "Hello, again!" }));
document.getElementById("reset")!.addEventListener("click", () => channel.emit("reset"));

// Utils
function log(message: string) {
  const messageElement = document.createElement("p");
  messageElement.textContent = message;

  document.getElementById("log")!.appendChild(messageElement);
}
