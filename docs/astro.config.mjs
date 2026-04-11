// @ts-check
import { defineConfig } from "astro/config";
import docsTheme from "astro-pigment";

export default defineConfig({
  integrations: [
    docsTheme({
      project: {
        name: "typed-channel",
        description:
          "A type-safe communication channel for sending and receiving messages between different contexts in a TypeScript environment.",
        license: {
          name: "MIT",
          url: "https://github.com/psd-coder/typed-channel/blob/main/LICENSE.md",
        },
        github: { user: "psd-coder", repository: "typed-channel" },
      },
      author: { name: "Pavel Grinchenko", url: "https://x.com/psd_coder" },
      credits: [{ name: "Evil Martians", url: "https://evilmartians.com/" }],
    }),
  ],
});
