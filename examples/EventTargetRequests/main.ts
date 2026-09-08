import { createTypedRpcChannel, requests } from "../../src/index";
import { createEventTargetTransport } from "../../src/transports/eventTarget";
import { sharedTarget } from "./shared";
import type { NoMessages, UserRequests } from "./shared";
import "./userModule";

// Setup channel
const transport = createEventTargetTransport<NoMessages>(sharedTarget);
const channel = createTypedRpcChannel(transport, requests<UserRequests>());

// Send requests to the user module
let running: AbortController | null = null;

document.getElementById("load")!.addEventListener("click", async () => {
  if (running) {
    log("Aborting the running request");
    running.abort();

    return;
  }

  const controller = new AbortController();

  running = controller;
  log("loadUser requested");

  try {
    const user = await channel.request("loadUser", "42", { signal: controller.signal });

    log(`Loaded: ${user.name}`);
  } catch (error) {
    log(`loadUser failed: ${describeError(error)}`);
  } finally {
    running = null;
  }
});

document.getElementById("unlisten")!.addEventListener("click", () => {
  log("Channel stops listening");
  channel.unlisten();
});

document.getElementById("listen")!.addEventListener("click", () => {
  log("Channel listens again");
  channel.listen();
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
