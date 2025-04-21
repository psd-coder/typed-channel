import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createTypedChannel } from "./createTypedChannel";
import type { Message, TypedChannelTransport } from "./types";

type TestInboundMessages = {
  ready: never;
  configLoading: Record<string, unknown>;
};

type TestOutboundMessages = {
  "window:resize": { width: number; height: number };
  "ctaButton:click": never;
};

function createMockTransport() {
  const unlisten = vi.fn();
  let messageHandler: ((message: Message<any, any>) => void) | null = null;

  return {
    on: vi.fn((handler) => {
      messageHandler = handler;
      return unlisten;
    }),
    emit: vi.fn(),
    simulateMessageFromTransport: (message: Message<any, any>) => {
      messageHandler?.(message);
    },
    unlisten,
  } as TypedChannelTransport<TestInboundMessages, TestOutboundMessages> & {
    simulateMessageFromTransport: (message: Message<any, any>) => void;
    unlisten: ReturnType<typeof vi.fn>;
  };
}

describe("createTypedChannel", () => {
  let mockTransport: ReturnType<typeof createMockTransport>;

  beforeEach(() => {
    mockTransport = createMockTransport();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("listen()", () => {
    test("Should start listening on creation", () => {
      const mockTransport = createMockTransport();
      createTypedChannel(mockTransport);
      expect(mockTransport.on).toHaveBeenCalledTimes(1);
    });

    test("Should not register multiple handlers if already listening", () => {
      const mockTransport = createMockTransport();
      const channel = createTypedChannel(mockTransport);

      channel.listen();
      channel.listen();
      channel.listen();

      expect(mockTransport.on).toHaveBeenCalledTimes(1);
    });

    test("Should register handler with transport if not already listening", () => {
      const channel = createTypedChannel(mockTransport);

      channel.unlisten();
      channel.listen();

      expect(mockTransport.on).toHaveBeenCalledTimes(2);
    });
  });

  describe("unlisten()", () => {
    test("Should call cleanup function when unlistening", () => {
      const channel = createTypedChannel(mockTransport);
      channel.unlisten();
      expect(mockTransport.unlisten).toHaveBeenCalledTimes(1);
    });

    test("Should not call cleanup function if already unlistened", () => {
      const channel = createTypedChannel(mockTransport);
      channel.unlisten();
      channel.unlisten();
      expect(mockTransport.unlisten).toHaveBeenCalledTimes(1);
    });
  });

  describe("emit()", () => {
    test("Should send message through transport with correct format", () => {
      const channel = createTypedChannel(mockTransport);

      channel.emit("window:resize", { width: 800, height: 600 });
      expect(mockTransport.emit).toHaveBeenCalledWith({
        type: "window:resize",
        payload: { width: 800, height: 600 },
      });
    });

    test("Should send message through transport with no payload", () => {
      const channel = createTypedChannel(mockTransport);

      channel.emit("ctaButton:click");
      expect(mockTransport.emit).toHaveBeenCalledWith({ type: "ctaButton:click" });
    });

    test("Should not allow sending unknown message types", () => {
      const channel = createTypedChannel(mockTransport);

      // @ts-expect-error
      channel.emit("unknownMessageType", { some: "data" });
    });
  });

  describe("on()", () => {
    test("Should register handler for specific message type", () => {
      const channel = createTypedChannel(mockTransport);
      const handler = vi.fn();

      channel.on("ready", handler);
      mockTransport.simulateMessageFromTransport({
        type: "ready",
        payload: undefined,
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(undefined);
    });

    test("Should call handler only for the specified message type", () => {
      const channel = createTypedChannel(mockTransport);
      const handler = vi.fn();

      channel.on("configLoading", handler);
      mockTransport.simulateMessageFromTransport({ type: "ready", payload: undefined });

      expect(handler).not.toHaveBeenCalled();
    });

    test("Should call multiple handlers for the same message type", () => {
      const channel = createTypedChannel(mockTransport);
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const mockConfig = {};

      channel.on("configLoading", handler1);
      channel.on("configLoading", handler2);
      mockTransport.simulateMessageFromTransport({ type: "configLoading", payload: mockConfig });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler1).toHaveBeenCalledWith(mockConfig);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledWith(mockConfig);
    });

    test("Should return cleanup function that removes handler", () => {
      const channel = createTypedChannel(mockTransport);
      const handler = vi.fn();

      const cleanup = channel.on("ready", handler);
      cleanup();
      mockTransport.simulateMessageFromTransport({ type: "ready", payload: undefined });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("Multiple transports support", () => {
    test("Should receive messages from all transports", () => {
      const mockTransport2 = createMockTransport();
      const channel = createTypedChannel([mockTransport, mockTransport2]);
      const handler = vi.fn();

      channel.on("configLoading", handler);
      mockTransport.simulateMessageFromTransport({
        type: "configLoading",
        payload: { data: "from transport 1" },
      });
      mockTransport2.simulateMessageFromTransport({
        type: "configLoading",
        payload: { data: "from transport 2" },
      });

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenCalledWith({ data: "from transport 1" });
      expect(handler).toHaveBeenCalledWith({ data: "from transport 2" });
    });

    test("Should emit messages to all transports", () => {
      const mockTransport2 = createMockTransport();
      const channel = createTypedChannel([mockTransport, mockTransport2]);
      channel.emit("window:resize", { width: 1024, height: 768 });

      expect(mockTransport.emit).toHaveBeenCalledWith({
        type: "window:resize",
        payload: { width: 1024, height: 768 },
      });
      expect(mockTransport2.emit).toHaveBeenCalledWith({
        type: "window:resize",
        payload: { width: 1024, height: 768 },
      });
    });

    test("Should unlisten from all transports", () => {
      const mockTransport2 = createMockTransport();
      const channel = createTypedChannel([mockTransport, mockTransport2]);

      channel.unlisten();
      expect(mockTransport.unlisten).toHaveBeenCalled();
      expect(mockTransport2.unlisten).toHaveBeenCalled();
    });
  });
});
