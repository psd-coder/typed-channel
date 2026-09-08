import { describe, expectTypeOf, test } from "vitest";
import { createTypedRpcChannel, requests } from "./createTypedRpcChannel";
import { createEventTargetTransport } from "./transports/eventTarget";
import type { RequestContext } from "./types";

type User = { id: string; login: string };

type TestMessages = {
  notify: { message: string };
  clear: never;
};

type TestRequests = {
  fetchUser: (id: string) => User;
  ping: () => void;
  now: () => number;
};

const channel = createTypedRpcChannel(
  createEventTargetTransport<TestMessages>(),
  requests<TestRequests>(),
);

describe("request()", () => {
  test("Should resolve with the declared return type", () => {
    expectTypeOf(channel.request("fetchUser", "42")).toEqualTypeOf<Promise<User>>();
    expectTypeOf(channel.request("ping")).toEqualTypeOf<Promise<void>>();
    expectTypeOf(
      channel.request("now", undefined, { signal: AbortSignal.timeout(1000) }),
    ).toEqualTypeOf<Promise<number>>();
  });

  test("Should reject calls that do not match the request map", () => {
    // @ts-expect-error wrong params type
    channel.request("fetchUser", 42);
    // @ts-expect-error params given for a request without params
    channel.request("ping", "x");
    // @ts-expect-error unknown request name
    channel.request("nope");
    // @ts-expect-error a message name is not a request name
    channel.request("notify", { message: "x" });
    // @ts-expect-error an options object is not `undefined`: options go in the third slot
    channel.request("ping", { signal: undefined });
  });
});

describe("handle()", () => {
  test("Should type the handler params and its return value", () => {
    channel.handle("fetchUser", (id, context) => {
      expectTypeOf(id).toEqualTypeOf<string>();
      expectTypeOf(context).toEqualTypeOf<RequestContext>();

      return { id, login: "x" };
    });
    channel.handle("now", (context) => {
      expectTypeOf(context).toEqualTypeOf<RequestContext>();

      return 1;
    });
  });

  test("Should reject a handler that returns the wrong type", () => {
    // @ts-expect-error handler returns the wrong type
    channel.handle("fetchUser", (id) => id);
  });
});

describe("requests()", () => {
  test("Should split the two directions when both maps are named", () => {
    type WorkerRequests = { compute: (n: number) => number };
    type ClientRequests = { confirm: (text: string) => boolean };
    const bidirectional = createTypedRpcChannel(
      createEventTargetTransport<TestMessages>(),
      requests<ClientRequests, WorkerRequests>(),
    );

    expectTypeOf(bidirectional.request("compute", 2)).toEqualTypeOf<Promise<number>>();
    bidirectional.handle("confirm", (text) => text.length > 0);
    // @ts-expect-error a channel can call only the requests of the other side
    bidirectional.request("confirm", "x");
    // @ts-expect-error a channel can handle only its own requests
    bidirectional.handle("compute", (n) => n);
  });

  test("Should reject a request declared with two parameters", () => {
    type TwoParams = { move: (x: number, y: number) => void };

    // @ts-expect-error a request takes at most one parameter
    requests<TwoParams>();
  });

  test("Should accept an empty map for a side that answers nothing", () => {
    type NoRequests = Record<never, never>;
    const callerOnly = createTypedRpcChannel(
      createEventTargetTransport<TestMessages>(),
      requests<NoRequests, TestRequests>(),
    );

    expectTypeOf(callerOnly.request("now")).toEqualTypeOf<Promise<number>>();
    // @ts-expect-error an empty map answers no request name
    callerOnly.handle("now", () => 1);
  });

  test("Should reject a request declared with an optional parameter", () => {
    type OptionalParam = { resize: (width?: number) => void };

    // @ts-expect-error a request parameter must be required
    requests<OptionalParam>();
  });

  test("Should reject a request whose parameter may be undefined", () => {
    type UndefinedParam = { resize: (width: number | undefined) => void };

    // @ts-expect-error a request parameter must not include undefined
    requests<UndefinedParam>();
  });

  test("Should reject an optional parameter in the called map too", () => {
    type OptionalParam = { resize: (width?: number) => void };

    // @ts-expect-error a request parameter must be required
    requests<TestRequests, OptionalParam>();
  });
});

describe("a message and a request with the same name", () => {
  test("Should keep both usable on one channel", () => {
    type SharedMessages = { sync: { at: number } };
    type SharedRequests = { sync: () => number };
    const shared = createTypedRpcChannel(
      createEventTargetTransport<SharedMessages>(),
      requests<SharedRequests>(),
    );

    shared.emit("sync", { at: 1 });
    shared.on("sync", (payload) => {
      expectTypeOf(payload).toEqualTypeOf<{ at: number }>();
    });
    expectTypeOf(shared.request("sync")).toEqualTypeOf<Promise<number>>();
  });
});
