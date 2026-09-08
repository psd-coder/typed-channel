import { defineDocsCollections, defineMenuCollection } from "astro-pigment/content";

export const collections = {
  ...defineDocsCollections(),
  ...defineMenuCollection(),
};
