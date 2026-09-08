# Changelog

## 0.11.0

### Features

- Add `createTypedRpcChannel` and `requests` to the main entry: a channel that sends requests and answers them, next to the messages it already carries
- Add `request(type, params, { signal })`, which waits for one response, and `handle(type, handler)`, which answers one request name
- A request handler receives a context object as its last argument, `{ signal }` today, so a later version can add a field without changing every handler
- Abort propagates: the caller's `signal` aborts the handler's `signal` on the other side, and the handler side then sends nothing back
- An abort goes out whenever a request stops waiting, the first response included, so a peer that lost the race stops running its handler
- Traffic that is not a valid `RpcMessage` is dropped instead of throwing. A transport can hand over anything, `null` included, and a malformed error reply no longer breaks the caller
- `createTypedRpcChannel` takes one transport, not a list: a request goes to one place and its answer comes back from there. A transport that reaches several peers, such as a `BroadcastChannel`, still works, and the first response wins
- `unlisten()` rejects every pending request with an `AbortError` `DOMException` and aborts every running handler
- `request()` between an `unlisten()` and the next `listen()` rejects at once with the same `AbortError` `DOMException`, and sends nothing
- A transport that throws while sending the request rejects `request()` with that error and leaves nothing pending behind

### Changes

- `createTypedChannel` ignores incoming messages that carry an `rpc` field, so request traffic never reaches a handler registered with `on`
- `AnyMessageOf<T>` now includes `RpcMessage`, the wire shape of request traffic, on top of the typed messages of `T`
- `RpcMessage` gives all four kinds of request traffic the same four fields: `rpc`, `id`, `type` and an optional `payload` of `unknown`. One check then tells real request traffic from anything else a transport hands over

### Note for custom transports

A transport that forwards the message object as-is keeps working. A transport that spells the message union by hand must switch to `AnyMessageOf`, and one that inspects messages must narrow with `"rpc" in message` before it reads `type` as a message name.

## 0.10.1

- Add documentation site
- Add documentation link to README and package.json homepage

## 0.10.0

### Breaking Changes

- Output file extensions changed from `.js`/`.d.ts` to `.mjs`/`.d.mts`
- Consumers using deep imports must update paths (or use the new `exports` map), otherwise everything must work as before.

### Features

- Add `exports` field to package.json for proper subpath imports (`typed-channel/transports/eventTarget`, `typed-channel/transports/postMessage`)
- Update dependencies and tooling
