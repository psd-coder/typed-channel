import type { SizeLimitConfig } from "size-limit";

module.exports = [
  {
    name: "createTypedChannel",
    path: "dist/index.mjs",
    import: "{ createTypedChannel }",
    limit: "254 B",
  },
  {
    name: "createPostMessageTransport",
    path: "dist/index.mjs",
    import: "{ createPostMessageTransport }",
    limit: "86 B",
  },
  {
    name: "createEventTargetTransport",
    path: "dist/index.mjs",
    import: "{ createEventTargetTransport }",
    limit: "109 B",
  },
] satisfies SizeLimitConfig;
