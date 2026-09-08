import { createTypedRpcChannel, requests } from "../../src/index";
import { createPostMessageTransport } from "../../src/transports/postMessage";

const REQUEST_TIMEOUT = 2000;

type NoMessages = Record<never, never>;

type TabRequests = {
  whoAmI: (params: { from: string }) => string;
};

// Setup channel
// One BroadcastChannel transport carries every request, and that single transport is the fix
// this example needs. BroadcastChannel does not deliver a message to the tab that posted it, so
// a tab never receives its own request, and every handler run here returns a value at once. The
// channel is left with nothing running after a click.
//
// Why one transport and not two: a responder replies on the transport the request arrived on.
// So a second, tab-local transport would hand this tab its own id as the first response, the
// promise would settle on it, and no other tab would ever be heard.
const broadcastChannel = new BroadcastChannel("requests-example-channel");
const transport = createPostMessageTransport<NoMessages>(broadcastChannel);
const channel = createTypedRpcChannel(transport, requests<TabRequests>());

const tabId = crypto.randomUUID().slice(0, 8);

log(`Tab id: ${tabId}`);

// Handle the request other tabs send
channel.handle("whoAmI", ({ from }) => {
  log(`Tab ${from} asked who is there`);

  return tabId;
});

// Send the request to every other tab
document.getElementById("ask")!.addEventListener("click", async () => {
  log("Asking every tab");

  try {
    const responder = await channel.request(
      "whoAmI",
      { from: tabId },
      { signal: AbortSignal.timeout(REQUEST_TIMEOUT) },
    );

    log(`Tab ${responder} responded first`);
  } catch (error) {
    log(`No tab responded: ${describeError(error)}`);
  }
});

// Utils
function describeError(error: unknown) {
  const { name, message } = error instanceof Error ? error : new Error(String(error));

  return `${name}: ${message}`;
}

function log(message: string) {
  const messageElement = document.createElement("p");
  messageElement.textContent = message;

  document.getElementById("log")!.appendChild(messageElement);
}
