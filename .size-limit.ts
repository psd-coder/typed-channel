import type { SizeLimitConfig } from "size-limit";

module.exports = [
  {
    name: "createTypedChannel",
    path: "dist/index.js",
    import: "{ createTypedChannel }",
    limit: "254 B",
  },
  {
    name: "createPostMessageTransport",
    path: "dist/index.js",
    import: "{ createPostMessageTransport }",
    limit: "86 B",
  },
  {
    name: "createEventTargetTransport",
    path: "dist/index.js",
    import: "{ createEventTargetTransport }",
    limit: "109 B",
  },
] satisfies SizeLimitConfig;
