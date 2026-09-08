import { describe, expectTypeOf, test } from "vitest";
import { createTypedChannel } from "./createTypedChannel";
import type { AnyMessageOf, AnyMessages, RpcMessage, TypedChannelTransport } from "./types";

type TestMessages = {
  notify: { message: string };
  clear: never;
};

function createTestTransport<
  InboundMessages extends AnyMessages,
  OutboundMessages extends AnyMessages = InboundMessages,
>(): TypedChannelTransport<InboundMessages, OutboundMessages> {
  const handlers: ((message: AnyMessageOf<InboundMessages>) => void)[] = [];
  const sent: AnyMessageOf<OutboundMessages>[] = [];

  function on(handler: (message: AnyMessageOf<InboundMessages>) => void) {
    handlers.push(handler);

    return () => {
      handlers.splice(handlers.indexOf(handler), 1);
    };
  }

  function emit(message: AnyMessageOf<OutboundMessages>) {
    sent.push(message);
  }

  return { on, emit };
}

describe("AnyMessageOf", () => {
  test("Should give a literal message type only after the rpc traffic is narrowed away", () => {
    createTestTransport<TestMessages>().on((message) => {
      expectTypeOf(message.type).toEqualTypeOf<string>();

      if ("rpc" in message) {
        expectTypeOf(message).toEqualTypeOf<RpcMessage>();

        return;
      }

      expectTypeOf(message.type).toEqualTypeOf<"notify" | "clear">();

      if (message.type === "notify") {
        expectTypeOf(message.payload).toEqualTypeOf<{ message: string }>();
      }
    });
  });

  test("Should keep a custom transport usable with createTypedChannel", () => {
    const channel = createTypedChannel(createTestTransport<TestMessages>());

    channel.on("notify", (payload) => {
      expectTypeOf(payload).toEqualTypeOf<{ message: string }>();
    });

    channel.emit("notify", { message: "hello" });
    channel.emit("clear");
  });
});
