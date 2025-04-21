import { createTypedChannel } from "../../src/index";
import { createPostMessageTransport } from "../../src/transports/postMessage";
import { createEventTargetTransport } from "../../src/transports/eventTarget";

// Setup channel
type Events = {
  "new-leader-elected": { id: string };
  message: { message: string };
};

const broadcastChannel = new BroadcastChannel("example-channel");
// We setup both EventTarget and BroadcastChannel transports to receive messages in all tabs, including the current one.
// This is important because BroadcastChannel does not trigger event handlers in the current tab.
// The EventTarget transport is used to receive messages in the current tab.
// The BroadcastChannel transport is used to receive messages in other tabs.
const eventTargetTransport = createEventTargetTransport<Events>();
const broadcastChannelTransport = createPostMessageTransport<Events>(broadcastChannel);
const typedChannel = createTypedChannel([eventTargetTransport, broadcastChannelTransport]);

const tabId = crypto.randomUUID();

log(`Tab ID: ${tabId}`);

awaitLeadership().then(() => {
  typedChannel.emit("new-leader-elected", { id: tabId });
});

typedChannel.on("new-leader-elected", ({ id }) => {
  log(`New leader elected: ${id}`);

  if (id === tabId) {
    log("Mama, I am a leader!");
  }
});

typedChannel.on("message", (event) => {
  log(`Broadcast message: ${event.message}`);
});

document
  .getElementById("broadcast")!
  .addEventListener("click", () =>
    typedChannel.emit("message", { message: `Hello from tab: ${tabId}` }),
  );

// Utils
async function awaitLeadership() {
  const NEVER = new Promise(() => {});

  return new Promise<void>((resolve) => {
    window.navigator.locks.request("leader-tab", () => {
      resolve();
      return NEVER;
    });
  });
}

function log(message: string) {
  const messageElement = document.createElement("p");
  messageElement.textContent = message;

  document.getElementById("log")!.appendChild(messageElement);
}
