// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import netlify from "@astrojs/netlify";
import sitemap from "@astrojs/sitemap";

// Pages are prerendered to static HTML. Only routes that set `prerender = false`
// (the three form endpoints under /api) run as Netlify functions.
export default defineConfig({
  site: "https://www.resumepronc.com",
  output: "static",
  adapter: netlify(),
  integrations: [sitemap({ filter: (page) => !/\/(thanks|404)\/?$/.test(page) })],
  trailingSlash: "ignore",
  build: { format: "directory" },
  image: { domains: ["static.wixstatic.com"] },
  vite: { plugins: [tailwindcss()] },
});
