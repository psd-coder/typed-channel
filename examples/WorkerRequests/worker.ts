import { createTypedRpcChannel, requests } from "../../src/index";
import { createPostMessageTransport } from "../../src/transports/postMessage";
import type { MainRequests, NoMessages, WorkerRequests } from "./types";

const STEP_DURATION = 400;

// Setup channel
const transport = createPostMessageTransport<NoMessages>(globalThis);
const channel = createTypedRpcChannel(transport, requests<WorkerRequests, MainRequests>());

// Handle the request the page sends
channel.handle("compute", async ({ steps }, { signal }) => {
  const approved = await channel.request("confirm", `Run ${steps} steps?`);

  if (!approved) {
    throw new DeclinedError(`The page declined ${steps} steps`);
  }

  let total = 0;

  for (let step = 1; step <= steps; step++) {
    await delay(STEP_DURATION, signal);
    total += step;
  }

  return total;
});

// Utils
class DeclinedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeclinedError";
  }
}

function delay(duration: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);

      return;
    }

    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, duration);

    function onAbort() {
      clearTimeout(timer);
      reject(signal.reason);
    }

    signal.addEventListener("abort", onAbort, { once: true });
  });
}
