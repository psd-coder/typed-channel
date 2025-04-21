import type { MockInstance } from "vitest";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { AnyMessageOf } from "../types";
import { createPostMessageTransport } from "./postMessage";
import type { PostMessageTarget } from "./postMessage";

type TestMessages = {
  notify: { message: string };
  update: { id: number; value: string };
  clear: never;
};

describe("createPostMessageTransport", () => {
  let mockTarget: PostMessageTarget;
  let postMessageSpy: MockInstance;
  let addListenerSpy: MockInstance;
  let removeListenerSpy: MockInstance;

  beforeEach(() => {
    mockTarget = {
      postMessage: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    postMessageSpy = vi.spyOn(mockTarget, "postMessage");
    addListenerSpy = vi.spyOn(mockTarget, "addEventListener");
    removeListenerSpy = vi.spyOn(mockTarget, "removeEventListener");
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test("Should create transport with provided target", () => {
    const transport = createPostMessageTransport(mockTarget);
    expect(transport).toHaveProperty("on");
    expect(transport).toHaveProperty("emit");
  });

  describe("on()", () => {
    test("Should register message handler", () => {
      const transport = createPostMessageTransport<TestMessages>(mockTarget);
      const handler = vi.fn();

      transport.on(handler);

      expect(addListenerSpy).toHaveBeenCalledTimes(1);
      expect(addListenerSpy).toHaveBeenCalledWith("message", expect.any(Function));
    });

    test("Should call handler with message data when message event is received", () => {
      const transport = createPostMessageTransport<TestMessages>(mockTarget);
      const handler = vi.fn();
      const message: AnyMessageOf<TestMessages> = {
        type: "notify",
        payload: { message: "Hello" },
      };

      transport.on(handler);

      // Simulate message event
      const listener = addListenerSpy.mock.calls[0]?.[1];
      listener?.({ data: message } as MessageEvent);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(message);
    });

    test("Should return cleanup function that removes event listener", () => {
      const transport = createPostMessageTransport<TestMessages>(mockTarget);
      const handler = vi.fn();

      const cleanup = transport.on(handler);
      expect(addListenerSpy).toHaveBeenCalledTimes(1);

      cleanup();
      expect(removeListenerSpy).toHaveBeenCalledTimes(1);
      expect(removeListenerSpy).toHaveBeenCalledWith("message", expect.any(Function));
    });
  });

  describe("emit()", () => {
    test("Should call postMessage with message", () => {
      const transport = createPostMessageTransport<TestMessages>(mockTarget);
      const message: AnyMessageOf<TestMessages> = {
        type: "update",
        payload: { id: 123, value: "test" },
      };

      transport.emit(message);

      expect(postMessageSpy).toHaveBeenCalledTimes(1);
      expect(postMessageSpy).toHaveBeenCalledWith(message);
    });

    test("Should handle messages with no payload", () => {
      const transport = createPostMessageTransport<TestMessages>(mockTarget);
      const message: AnyMessageOf<TestMessages> = {
        type: "clear",
        payload: undefined,
      };

      transport.emit(message);

      expect(postMessageSpy).toHaveBeenCalledTimes(1);
      expect(postMessageSpy).toHaveBeenCalledWith(message);
    });
  });
});
