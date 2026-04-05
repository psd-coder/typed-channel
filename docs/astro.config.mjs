// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import docsTheme, { fonts } from "@psd-coder/astro-docs-theme";

export default defineConfig({
  integrations: [
    mdx(),
    docsTheme({
      github: { user: "psd-coder", repository: "typed-channel" },
      project: {
        name: "typed-channel",
        description:
          "A type-safe communication channel for sending and receiving messages between different contexts in a TypeScript environment.",
        license: {
          name: "MIT",
          url: "https://github.com/psd-coder/typed-channel/blob/main/LICENSE.md",
        },
      },
      author: { name: "Pavel Grinchenko", url: "https://x.com/psd_coder" },
      credits: [{ name: "Evil Martians", url: "https://evilmartians.com/" }],
      docs: { directory: "src/content/docs" },
    }),
  ],
  fonts: fonts(),
});
