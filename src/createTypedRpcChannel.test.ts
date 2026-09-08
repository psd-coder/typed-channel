import { describe, expect, test, vi } from "vitest";
import { createTypedRpcChannel, requests } from "./createTypedRpcChannel";
import { createEventTargetTransport } from "./transports/eventTarget";
import { createPostMessageTransport } from "./transports/postMessage";
import type { PostMessageTarget } from "./transports/postMessage";
import type { AnyMessageOf, RequestContext } from "./types";

type User = { id: string; login: string };

type TestMessages = {
  sync: { at: number };
};

type TestRequests = {
  fetchUser: (id: string) => User;
  ping: () => void;
  now: () => number;
  sync: () => number;
  slow: () => number;
  fail: () => number;
};

class HttpError extends Error {
  readonly code = 404;

  constructor(message: string) {
    super(message);
    this.name = "HttpError";
  }
}

function readRequestId(message: unknown): string {
  if (typeof message === "object" && message !== null && "id" in message) {
    return String(message.id);
  }

  throw new Error("Expected an rpc message with an id");
}

async function catchRejection(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof Error) {
      return error;
    }

    throw error;
  }

  throw new Error("Expected the promise to reject");
}

// jsdom's DOMException does not extend Error, so `catchRejection` cannot narrow an abort reason.
async function catchAbort(promise: Promise<unknown>): Promise<DOMException> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof DOMException) {
      return error;
    }

    throw error;
  }

  throw new Error("Expected the promise to reject");
}

type MessageListener = (event: MessageEvent) => void;

function createPostMessagePair(): [PostMessageTarget, PostMessageTarget] {
  const listeners: [MessageListener[], MessageListener[]] = [[], []];

  function createTarget(own: MessageListener[], peer: MessageListener[]): PostMessageTarget {
    return {
      postMessage: (message: unknown) => {
        peer.slice().forEach((listener) => listener({ data: message } as MessageEvent));
      },
      addEventListener: (_type, listener) => {
        own.push(listener);
      },
      removeEventListener: (_type, listener) => {
        own.splice(own.indexOf(listener), 1);
      },
    };
  }

  return [createTarget(listeners[0], listeners[1]), createTarget(listeners[1], listeners[0])];
}

function createPostMessageChannels() {
  const [callerTarget, responderTarget] = createPostMessagePair();

  return [
    createTypedRpcChannel(
      createPostMessageTransport<TestMessages>(callerTarget),
      requests<TestRequests>(),
    ),
    createTypedRpcChannel(
      createPostMessageTransport<TestMessages>(responderTarget),
      requests<TestRequests>(),
    ),
  ] as const;
}

function createEventTargetChannels() {
  const target = new EventTarget();

  return [
    createTypedRpcChannel(
      createEventTargetTransport<TestMessages>(target),
      requests<TestRequests>(),
    ),
    createTypedRpcChannel(
      createEventTargetTransport<TestMessages>(target),
      requests<TestRequests>(),
    ),
  ] as const;
}

function createSpiedChannels() {
  const [callerTarget, responderTarget] = createPostMessagePair();
  const toCaller = vi.fn();
  const toResponder = vi.fn();

  createPostMessageTransport<TestMessages>(callerTarget).on(toCaller);
  createPostMessageTransport<TestMessages>(responderTarget).on(toResponder);

  const caller = createTypedRpcChannel(
    createPostMessageTransport<TestMessages>(callerTarget),
    requests<TestRequests>(),
  );
  const responder = createTypedRpcChannel(
    createPostMessageTransport<TestMessages>(responderTarget),
    requests<TestRequests>(),
  );

  return { caller, responder, toCaller, toResponder, responderTarget };
}

// One transport that reaches two peers, the way a BroadcastChannel does. A message from the
// caller reaches both peers; a message from a peer reaches the caller alone.
function createFanoutTargets(): [PostMessageTarget, PostMessageTarget, PostMessageTarget] {
  const callerListeners: MessageListener[] = [];
  const peerListeners: [MessageListener[], MessageListener[]] = [[], []];

  function createTarget(own: MessageListener[], peers: MessageListener[][]): PostMessageTarget {
    return {
      postMessage: (message: unknown) => {
        peers.forEach((listeners) =>
          listeners.slice().forEach((listener) => listener({ data: message } as MessageEvent)),
        );
      },
      addEventListener: (_type, listener) => {
        own.push(listener);
      },
      removeEventListener: (_type, listener) => {
        own.splice(own.indexOf(listener), 1);
      },
    };
  }

  return [
    createTarget(callerListeners, peerListeners),
    createTarget(peerListeners[0], [callerListeners]),
    createTarget(peerListeners[1], [callerListeners]),
  ];
}

// One caller whose transport reaches two responders. The two responders race, so a test can
// watch what happens to the one that does not answer first.
function createTwoPeerCaller() {
  const [callerTarget, firstPeerTarget, secondPeerTarget] = createFanoutTargets();

  const caller = createTypedRpcChannel(
    createPostMessageTransport<TestMessages>(callerTarget),
    requests<TestRequests>(),
  );
  const firstResponder = createTypedRpcChannel(
    createPostMessageTransport<TestMessages>(firstPeerTarget),
    requests<TestRequests>(),
  );
  const secondResponder = createTypedRpcChannel(
    createPostMessageTransport<TestMessages>(secondPeerTarget),
    requests<TestRequests>(),
  );

  return { caller, firstResponder, secondResponder };
}

describe("createTypedRpcChannel", () => {
  describe("request()", () => {
    test("Should resolve with the handler result over a postMessage transport", async () => {
      const [caller, responder] = createPostMessageChannels();

      responder.handle("fetchUser", (id) => ({ id, login: `user-${id}` }));

      await expect(caller.request("fetchUser", "42")).resolves.toEqual({
        id: "42",
        login: "user-42",
      });
    });

    test("Should resolve with the handler result over an EventTarget transport", async () => {
      const [caller, responder] = createEventTargetChannels();

      responder.handle("fetchUser", (id) => ({ id, login: `user-${id}` }));

      await expect(caller.request("fetchUser", "42")).resolves.toEqual({
        id: "42",
        login: "user-42",
      });
    });

    test("Should accept a handler that returns a promise", async () => {
      const [caller, responder] = createPostMessageChannels();

      responder.handle("fetchUser", async (id) => ({ id, login: `async-${id}` }));

      await expect(caller.request("fetchUser", "7")).resolves.toEqual({
        id: "7",
        login: "async-7",
      });
    });

    test("Should call a handler of a request without params with the context only", async () => {
      const [caller, responder] = createPostMessageChannels();
      const handler = vi.fn();

      responder.handle("ping", handler);

      await caller.request("ping");

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0]).toHaveLength(1);
      expect(handler.mock.calls[0]?.[0]?.signal).toBeInstanceOf(AbortSignal);
    });

    test("Should call a handler of a request with params with the value and the context", async () => {
      const [caller, responder] = createPostMessageChannels();
      const handler = vi.fn((id: string, _context: RequestContext) => ({
        id,
        login: `user-${id}`,
      }));

      responder.handle("fetchUser", handler);

      await caller.request("fetchUser", "1");

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0]).toHaveLength(2);
      expect(handler.mock.calls[0]?.[0]).toBe("1");
      expect(handler.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
    });

    test("Should resolve with the first response and drop the second one", async () => {
      const { caller, firstResponder, secondResponder } = createTwoPeerCaller();

      firstResponder.handle("now", () => 1);
      secondResponder.handle("now", () => 2);

      await expect(caller.request("now")).resolves.toBe(1);
    });

    test("Should drop a response whose id matches no pending request", () => {
      const target = new EventTarget();

      createTypedRpcChannel(
        createEventTargetTransport<TestMessages>(target),
        requests<TestRequests>(),
      );

      const message: AnyMessageOf<TestMessages> = {
        rpc: "response",
        id: "unknown",
        type: "now",
        payload: 1,
      };

      expect(() => {
        target.dispatchEvent(new CustomEvent("message", { detail: message }));
      }).not.toThrow();
    });

    test("Should keep a message and a request with the same name apart", async () => {
      const [caller, responder] = createEventTargetChannels();
      const onSync = vi.fn();

      responder.on("sync", onSync);
      responder.handle("sync", () => 42);

      await expect(caller.request("sync")).resolves.toBe(42);
      expect(onSync).not.toHaveBeenCalled();

      caller.emit("sync", { at: 1 });

      expect(onSync).toHaveBeenCalledWith({ at: 1 });
    });
  });

  describe("handle()", () => {
    test("Should throw when a second handler is registered for the same request", () => {
      const [, responder] = createPostMessageChannels();

      responder.handle("now", () => 1);

      expect(() => responder.handle("now", () => 2)).toThrow(
        'Request handler for "now" is already registered',
      );
    });

    test("Should remove the handler on cleanup", async () => {
      const [caller, responder] = createPostMessageChannels();
      const removed = vi.fn(() => 1);
      const cleanup = responder.handle("now", removed);

      cleanup();
      responder.handle("now", () => 2);

      await expect(caller.request("now")).resolves.toBe(2);
      expect(removed).not.toHaveBeenCalled();
    });
  });

  describe("handler errors", () => {
    test("Should reject with a plain Error carrying the name and message of a thrown subclass", async () => {
      const [caller, responder] = createPostMessageChannels();

      responder.handle("fail", () => {
        throw new HttpError("user not found");
      });

      const error = await catchRejection(caller.request("fail"));

      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(HttpError);
      expect(error.name).toBe("HttpError");
      expect(error.message).toBe("user not found");
      expect(error).not.toHaveProperty("code");
    });

    test("Should reject with an Error whose message is the thrown string", async () => {
      const [caller, responder] = createPostMessageChannels();

      responder.handle("fail", () => {
        throw "broken";
      });

      const error = await catchRejection(caller.request("fail"));

      expect(error.name).toBe("Error");
      expect(error.message).toBe("broken");
    });

    test("Should reject when an async handler rejects", async () => {
      const [caller, responder] = createPostMessageChannels();

      responder.handle("fail", async () => {
        throw new Error("later");
      });

      const error = await catchRejection(caller.request("fail"));

      expect(error.message).toBe("later");
    });
  });

  describe("abort", () => {
    test("Should reject with a TimeoutError when the handler is slower than the timeout", async () => {
      const [caller, responder] = createPostMessageChannels();

      responder.handle("slow", () => new Promise<number>(() => {}));

      const error = await catchRejection(
        caller.request("slow", undefined, { signal: AbortSignal.timeout(10) }),
      );

      expect(error.name).toBe("TimeoutError");
    });

    test("Should reject with the controller reason and abort the handler signal", async () => {
      const [caller, responder] = createPostMessageChannels();
      const controller = new AbortController();
      const reason = new Error("stop it");
      let handlerSignal: AbortSignal | undefined;

      responder.handle("slow", ({ signal }) => {
        handlerSignal = signal;

        return new Promise<number>(() => {});
      });

      const promise = caller.request("slow", undefined, { signal: controller.signal });

      controller.abort(reason);

      await expect(promise).rejects.toBe(reason);
      expect(handlerSignal?.aborted).toBe(true);
    });

    test("Should reject an already aborted request before anything is sent", async () => {
      const { caller, toResponder } = createSpiedChannels();
      const controller = new AbortController();
      const reason = new Error("too late");

      controller.abort(reason);

      await expect(caller.request("slow", undefined, { signal: controller.signal })).rejects.toBe(
        reason,
      );
      expect(toResponder).not.toHaveBeenCalled();
    });

    test("Should send an abort message to the responder", async () => {
      const { caller, responder, toResponder } = createSpiedChannels();
      const controller = new AbortController();

      responder.handle("slow", () => new Promise<number>(() => {}));

      const promise = caller.request("slow", undefined, { signal: controller.signal });

      controller.abort();

      await expect(promise).rejects.toThrow();
      expect(toResponder).toHaveBeenLastCalledWith(
        expect.objectContaining({ rpc: "abort", type: "slow" }),
      );
    });

    test("Should send nothing after an abort and drop a late response", async () => {
      const { caller, responder, toCaller, toResponder, responderTarget } = createSpiedChannels();
      const controller = new AbortController();
      let finishHandler: ((value: number) => void) | undefined;

      responder.handle(
        "slow",
        () =>
          new Promise<number>((resolve) => {
            finishHandler = resolve;
          }),
      );

      const promise = caller.request("slow", undefined, { signal: controller.signal });
      const requestId = readRequestId(toResponder.mock.calls[0]?.[0]);

      controller.abort();

      await expect(promise).rejects.toThrow();

      toCaller.mockClear();
      finishHandler?.(1);
      await new Promise((resolve) => setTimeout(resolve));

      expect(toCaller).not.toHaveBeenCalled();

      expect(() => {
        responderTarget.postMessage({
          rpc: "response",
          id: requestId,
          type: "slow",
          payload: 1,
        });
      }).not.toThrow();
    });

    test("Should end through the signal when the peer has no handler", async () => {
      const [caller] = createPostMessageChannels();

      const error = await catchRejection(
        caller.request("slow", undefined, { signal: AbortSignal.timeout(10) }),
      );

      expect(error.name).toBe("TimeoutError");
    });

    test("Should ignore a handler registered after the request arrived", async () => {
      const [caller, responder] = createPostMessageChannels();
      const promise = caller.request("slow", undefined, { signal: AbortSignal.timeout(10) });

      responder.handle("slow", () => 1);

      const error = await catchRejection(promise);

      expect(error.name).toBe("TimeoutError");
    });

    test("Should remove the abort listener on resolve, reject and abort", async () => {
      const [caller, responder] = createPostMessageChannels();
      const controller = new AbortController();
      const removeListener = vi.spyOn(controller.signal, "removeEventListener");
      const cleanup = responder.handle("now", () => 1);

      await caller.request("now", undefined, { signal: controller.signal });

      expect(removeListener).toHaveBeenCalledTimes(1);

      cleanup();
      responder.handle("fail", () => {
        throw new Error("no");
      });

      await catchRejection(caller.request("fail", undefined, { signal: controller.signal }));

      expect(removeListener).toHaveBeenCalledTimes(2);

      responder.handle("slow", () => new Promise<number>(() => {}));

      const promise = caller.request("slow", undefined, { signal: controller.signal });

      controller.abort();

      await expect(promise).rejects.toThrow();
      expect(removeListener).toHaveBeenCalledTimes(3);
    });
  });

  describe("several peers on one transport", () => {
    test("Should abort the losing handler once the first response arrives", async () => {
      const { caller, firstResponder, secondResponder } = createTwoPeerCaller();
      let losingSignal: AbortSignal | undefined;
      let winningSignal: AbortSignal | undefined;

      firstResponder.handle("slow", ({ signal }) => {
        winningSignal = signal;

        return 1;
      });
      secondResponder.handle("slow", ({ signal }) => {
        losingSignal = signal;

        return new Promise<number>(() => {});
      });

      await expect(caller.request("slow")).resolves.toBe(1);

      expect(losingSignal?.aborted).toBe(true);
      expect(winningSignal?.aborted).toBe(false);
    });

    test("Should abort the losing handler once the first error arrives", async () => {
      const { caller, firstResponder, secondResponder } = createTwoPeerCaller();
      let losingSignal: AbortSignal | undefined;

      firstResponder.handle("fail", () => {
        throw new Error("boom");
      });
      secondResponder.handle("fail", ({ signal }) => {
        losingSignal = signal;

        return new Promise<number>(() => {});
      });

      const error = await catchRejection(caller.request("fail"));

      expect(error.message).toBe("boom");
      expect(losingSignal?.aborted).toBe(true);
    });
  });

  describe("unlisten()", () => {
    test("Should reject every pending request with an AbortError and send an abort for each", async () => {
      const { caller, responder, toResponder } = createSpiedChannels();

      responder.handle("slow", () => new Promise<number>(() => {}));
      responder.handle("now", () => new Promise<number>(() => {}));

      const slowPromise = caller.request("slow");
      const nowPromise = caller.request("now");

      const slowResult = catchAbort(slowPromise);
      const nowResult = catchAbort(nowPromise);

      toResponder.mockClear();
      caller.unlisten();

      const error = await slowResult;

      expect(error).toBeInstanceOf(DOMException);
      expect(error.name).toBe("AbortError");
      expect(error.message).toBe("Channel stopped listening");
      expect((await nowResult).name).toBe("AbortError");
      expect(toResponder.mock.calls.map(([message]) => message)).toEqual([
        expect.objectContaining({ rpc: "abort", type: "slow" }),
        expect.objectContaining({ rpc: "abort", type: "now" }),
      ]);
    });

    test("Should abort a running handler and send nothing back", async () => {
      const { caller, responder, toCaller } = createSpiedChannels();
      let handlerSignal: AbortSignal | undefined;
      let finishHandler: ((value: number) => void) | undefined;

      responder.handle("slow", ({ signal }) => {
        handlerSignal = signal;

        return new Promise<number>((resolve) => {
          finishHandler = resolve;
        });
      });

      caller.request("slow").catch(() => {});
      await new Promise((resolve) => setTimeout(resolve));

      responder.unlisten();

      expect(handlerSignal?.aborted).toBe(true);

      toCaller.mockClear();
      finishHandler?.(1);
      await new Promise((resolve) => setTimeout(resolve));

      expect(toCaller).not.toHaveBeenCalled();
    });

    test("Should keep handle and on registrations after listen()", async () => {
      const [caller, responder] = createPostMessageChannels();
      const onSync = vi.fn();

      responder.on("sync", onSync);
      responder.handle("now", () => 42);

      responder.unlisten();
      responder.listen();

      await expect(caller.request("now")).resolves.toBe(42);

      caller.emit("sync", { at: 1 });

      expect(onSync).toHaveBeenCalledWith({ at: 1 });
    });

    test("Should keep a stopped request rejected when a late response arrives", async () => {
      const { caller, responder, responderTarget, toResponder } = createSpiedChannels();
      let finishHandler: ((value: number) => void) | undefined;

      responder.handle(
        "slow",
        () =>
          new Promise<number>((resolve) => {
            finishHandler = resolve;
          }),
      );

      const promise = caller.request("slow");
      const requestId = readRequestId(toResponder.mock.calls[0]?.[0]);
      const onSettled = vi.fn();

      promise.then(onSettled, onSettled);
      caller.unlisten();

      caller.listen();
      finishHandler?.(1);
      responderTarget.postMessage({ rpc: "response", id: requestId, type: "slow", payload: 1 });
      await new Promise((resolve) => setTimeout(resolve));

      expect(onSettled).toHaveBeenCalledTimes(1);
      expect(onSettled.mock.calls[0]?.[0]).toBeInstanceOf(DOMException);
    });
  });

  describe("request() while not listening", () => {
    test("Should reject at once with an AbortError and send nothing", async () => {
      const { caller, toResponder } = createSpiedChannels();

      caller.unlisten();
      toResponder.mockClear();

      const error = await catchAbort(caller.request("now"));

      expect(error).toBeInstanceOf(DOMException);
      expect(error.name).toBe("AbortError");
      expect(error.message).toBe("Channel stopped listening");
      expect(toResponder).not.toHaveBeenCalled();
    });

    // The factory listens on its own, so both cases start after unlisten().
    test("Should reject the same way whether or not a request went through first", async () => {
      const [untouched] = createPostMessageChannels();
      const { caller, responder } = createSpiedChannels();

      responder.handle("now", () => 42);
      untouched.unlisten();

      const withoutTraffic = await catchAbort(untouched.request("now"));

      await expect(caller.request("now")).resolves.toBe(42);
      caller.unlisten();

      const withTraffic = await catchAbort(caller.request("now"));

      expect(withoutTraffic.name).toBe(withTraffic.name);
      expect(withoutTraffic.message).toBe(withTraffic.message);
    });

    test("Should keep the pending map empty, so a later unlisten sends no abort", async () => {
      const { caller, responder, toResponder } = createSpiedChannels();

      responder.handle("now", () => 42);
      caller.unlisten();

      await catchAbort(caller.request("now"));

      caller.listen();
      toResponder.mockClear();
      caller.unlisten();

      expect(toResponder).not.toHaveBeenCalled();

      caller.listen();

      await expect(caller.request("now")).resolves.toBe(42);
    });
  });

  describe("a transport that throws on emit", () => {
    function createThrowingChannel() {
      const emit = vi.fn<(message: AnyMessageOf<TestMessages>) => void>(() => {
        throw new Error("Transport is closed");
      });
      const channel = createTypedRpcChannel<TestMessages, TestMessages, TestRequests, TestRequests>(
        { on: () => () => {}, emit },
        requests<TestRequests>(),
      );

      return { channel, emit };
    }

    test("Should reject the request with the transport error", async () => {
      const { channel } = createThrowingChannel();

      const error = await catchRejection(channel.request("now"));

      expect(error.message).toBe("Transport is closed");
    });

    test("Should drop the pending request, so unlisten sends no abort", async () => {
      const { channel, emit } = createThrowingChannel();

      await catchRejection(channel.request("now"));
      emit.mockClear();
      channel.unlisten();

      expect(emit).not.toHaveBeenCalled();
    });

    test("Should remove the abort listener from the caller's signal", async () => {
      const { channel, emit } = createThrowingChannel();
      const controller = new AbortController();

      await catchRejection(channel.request("now", undefined, { signal: controller.signal }));
      emit.mockClear();
      controller.abort();

      expect(emit).not.toHaveBeenCalled();
    });
  });

  describe("traffic that is not a valid rpc message", () => {
    // A transport reads whatever the peer sent. `null` used to reach a property read and throw,
    // and a malformed error payload used to be destructured by the caller.
    const junk = [null, undefined, "text", 5, 0, "", true, false, NaN, [], () => {}, Symbol("s")];

    test("Should drop it instead of throwing", () => {
      const { responderTarget } = createSpiedChannels();

      for (const value of junk) {
        expect(() => responderTarget.postMessage(value), String(value)).not.toThrow();
      }
    });

    test("Should drop an rpc message whose id or type is not a string", () => {
      const { responderTarget } = createSpiedChannels();

      expect(() =>
        responderTarget.postMessage({ rpc: "request", id: 1, type: "now", payload: undefined }),
      ).not.toThrow();
      expect(() =>
        responderTarget.postMessage({ rpc: "request", id: "a", type: 2, payload: undefined }),
      ).not.toThrow();
    });

    // The peer said the request failed, so it ends. Only the two fields are missing, and the
    // built-in name stays rather than becoming undefined.
    test("Should still reject a request whose error reply has a broken payload", async () => {
      const { caller, responderTarget } = createSpiedChannels();
      const spyOnRequest = vi.fn(readRequestId);

      createPostMessageTransport<TestMessages>(responderTarget).on((message) => {
        spyOnRequest(message);
      });

      const promise = caller.request("slow", undefined, { signal: AbortSignal.timeout(50) });
      const requestId = spyOnRequest.mock.results[0]?.value as string;

      expect(() =>
        responderTarget.postMessage({ rpc: "error", id: requestId, type: "slow", payload: null }),
      ).not.toThrow();

      const error = await catchRejection(promise);

      expect(error.name).toBe("Error");
      expect(error.message).toBe("");
    });

    test("Should ignore an error reply whose name and message are not strings", async () => {
      const { caller, responderTarget } = createSpiedChannels();
      const spyOnRequest = vi.fn(readRequestId);

      createPostMessageTransport<TestMessages>(responderTarget).on((message) => {
        spyOnRequest(message);
      });

      const promise = caller.request("slow", undefined, { signal: AbortSignal.timeout(50) });
      const requestId = spyOnRequest.mock.results[0]?.value as string;

      responderTarget.postMessage({
        rpc: "error",
        id: requestId,
        type: "slow",
        payload: { name: 5, message: {} },
      });

      const error = await catchRejection(promise);

      expect(error.name).toBe("Error");
      expect(error.message).toBe("");
    });
  });
});
