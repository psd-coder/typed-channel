import { createTypedRpcChannel, requests } from "../../src/index";
import { createPostMessageTransport } from "../../src/transports/postMessage";
import type { MainRequests, NoMessages, WorkerRequests } from "./types";

const REQUEST_TIMEOUT = 5000;

// Setup channel
const worker = new Worker(new URL("./worker.ts", import.meta.url), {
  type: "module",
});

const transport = createPostMessageTransport<NoMessages>(worker);
const channel = createTypedRpcChannel(transport, requests<MainRequests, WorkerRequests>());

// Handle the request the worker sends back to the page
channel.handle("confirm", (question) => window.confirm(question));

// Send requests to the worker
let running: AbortController | null = null;

document.getElementById("compute")!.addEventListener("click", async () => {
  if (running) {
    log("Already running");

    return;
  }

  const controller = new AbortController();
  const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(REQUEST_TIMEOUT)]);

  running = controller;
  log("Compute requested");

  try {
    const result = await channel.request("compute", { steps: 6 }, { signal });

    log(`Compute result: ${result}`);
  } catch (error) {
    log(`Compute failed: ${describeError(error)}`);
  } finally {
    running = null;
  }
});

document.getElementById("abort")!.addEventListener("click", () => {
  if (!running) {
    log("Nothing to abort");

    return;
  }

  running.abort();
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
