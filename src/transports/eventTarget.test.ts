import type { MockInstance } from "vitest";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { AnyMessageOf } from "../types";
import { createEventTargetTransport } from "./eventTarget";

type TestMessages = {
  notify: { message: string };
  update: { id: number; value: string };
  clear: never;
};

describe("createEventTargetTransport", () => {
  let mockTarget: EventTarget;
  let dispatchSpy: MockInstance;
  let addListenerSpy: MockInstance;
  let removeListenerSpy: MockInstance;

  beforeEach(() => {
    mockTarget = new EventTarget();
    dispatchSpy = vi.spyOn(mockTarget, "dispatchEvent");
    addListenerSpy = vi.spyOn(mockTarget, "addEventListener");
    removeListenerSpy = vi.spyOn(mockTarget, "removeEventListener");
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test("Should create transport with default target when none provided", () => {
    const transport = createEventTargetTransport();
    expect(transport).toHaveProperty("on");
    expect(transport).toHaveProperty("emit");
  });

  test("Should create transport with provided target", () => {
    const transport = createEventTargetTransport(mockTarget);
    expect(transport).toHaveProperty("on");
    expect(transport).toHaveProperty("emit");
  });

  describe("on()", () => {
    test("Should register message handler", () => {
      const transport = createEventTargetTransport<TestMessages>(mockTarget);
      const handler = vi.fn();

      transport.on(handler);

      expect(addListenerSpy).toHaveBeenCalledTimes(1);
      expect(addListenerSpy).toHaveBeenCalledWith("message", expect.any(Function));
    });

    test("Should call handler with message detail when event is dispatched", () => {
      const transport = createEventTargetTransport<TestMessages>(mockTarget);
      const handler = vi.fn();
      const message: AnyMessageOf<TestMessages> = {
        type: "notify",
        payload: { message: "Hello" },
      };

      transport.on(handler);
      mockTarget.dispatchEvent(new CustomEvent("message", { detail: message }));
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(message);
    });

    test("Should return cleanup function that removes event listener", () => {
      const transport = createEventTargetTransport<TestMessages>(mockTarget);
      const handler = vi.fn();

      const cleanup = transport.on(handler);
      expect(addListenerSpy).toHaveBeenCalledTimes(1);

      cleanup();
      expect(removeListenerSpy).toHaveBeenCalledTimes(1);
      expect(removeListenerSpy).toHaveBeenCalledWith("message", expect.any(Function));
    });
  });

  describe("emit()", () => {
    test("Should dispatch custom event with message as detail", () => {
      const transport = createEventTargetTransport<TestMessages>(mockTarget);
      const message: AnyMessageOf<TestMessages> = {
        type: "update",
        payload: { id: 123, value: "test" },
      };

      transport.emit(message);

      expect(dispatchSpy).toHaveBeenCalledTimes(1);
      expect(dispatchSpy).toHaveBeenCalledWith(expect.any(CustomEvent));

      const eventArg = dispatchSpy.mock.calls[0]?.[0] as CustomEvent;
      expect(eventArg.type).toBe("message");
      expect(eventArg.detail).toEqual(message);
    });

    test("Should handle messages with no payload", () => {
      const transport = createEventTargetTransport<TestMessages>(mockTarget);
      const message: AnyMessageOf<TestMessages> = {
        type: "clear",
        payload: undefined,
      };

      transport.emit(message);

      expect(dispatchSpy).toHaveBeenCalledTimes(1);

      const eventArg = dispatchSpy.mock.calls[0]?.[0] as CustomEvent;
      expect(eventArg.detail).toEqual(message);
    });
  });
});
