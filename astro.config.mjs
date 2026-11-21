// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import netlify from "@astrojs/netlify";
import sitemap from "@astrojs/sitemap";

// Pages are prerendered to static HTML. Only routes that set `prerender = false`
// (the form endpoints under /api and Nancy's dashboard under /admin) run as Netlify functions.
export default defineConfig({
  site: "https://www.resumepronc.com",
  output: "static",
  adapter: netlify(),
  integrations: [sitemap({ filter: (page) => !/\/(thanks|404)\/?$/.test(page) && !page.includes("/admin") })],
  trailingSlash: "ignore",
  build: { format: "directory" },
  image: { domains: ["static.wixstatic.com"] },
  vite: { plugins: [tailwindcss()] },
});
