import { createTypedRpcChannel, requests } from "../../src/index";
import { createEventTargetTransport } from "../../src/transports/eventTarget";
import { sharedTarget } from "./shared";
import type { NoMessages, UserRequests } from "./shared";

const LOAD_DURATION = 3000;

// Setup channel
const transport = createEventTargetTransport<NoMessages>(sharedTarget);
const channel = createTypedRpcChannel(transport, requests<UserRequests>());

// Handle the request the other module sends
channel.handle("loadUser", async (id, { signal }) => {
  await delay(LOAD_DURATION, signal);

  return { id, name: `User ${id}` };
});

// Utils
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
