// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";
import sitemap from "@astrojs/sitemap";
import { readdirSync } from "node:fs";
import { blogCategories } from "./src/site.ts";

const url = "https://www.resumepronc.com";
const slugify = (/** @type {string} */ s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
// Pages run in the Worker, so the sitemap gets its list here: every public page,
// every Career Tips post and category.
const pages = readdirSync("./src/pages")
  .filter((f) => f.endsWith(".astro") && !/^(404|thanks)\.astro$/.test(f))
  .map((f) => (f === "index.astro" ? "/" : `/${f.replace(/\.astro$/, "")}/`));
const posts = readdirSync("./src/content/blog")
  .filter((f) => f.endsWith(".md"))
  .map((f) => `/career-tips/${f.replace(/\.md$/, "")}/`);
const categories = blogCategories.map((c) => `/career-tips/category/${slugify(c)}/`);
const customPages = [...pages, "/career-tips/", ...categories, ...posts].map((p) => new URL(p, url).href);

// Every page runs in the Cloudflare Worker (src/worker.ts, wrangler.jsonc), so what
// Nancy saves in her dashboard's Settings (phones, prices, hours...) shows up right away.
// Only the 404 page is prerendered.
export default defineConfig({
  site: url,
  output: "server",
  adapter: cloudflare({
    imageService: "compile",
    platformProxy: { enabled: false },
    workerEntryPoint: { path: "src/worker.ts" },
  }),
  integrations: [sitemap({ customPages, filter: (page) => !/\/(thanks|404)\/?$/.test(page) && !page.includes("/admin") })],
  trailingSlash: "ignore",
  build: { format: "directory" },
  image: { domains: ["static.wixstatic.com"] },
  vite: { plugins: [tailwindcss()] },
});
