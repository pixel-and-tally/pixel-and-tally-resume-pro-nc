import { defineMiddleware } from "astro:middleware";
import { loadSettings } from "./lib/settings";

// Every page runs in the Worker so what Nancy saves in Settings (phones, prices,
// hours...) shows up right away. public/_headers only covers files, so pages get
// the same safety headers here.
const safety = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

export const onRequest = defineMiddleware(async (ctx, next) => {
  if (ctx.isPrerendered) return next();
  await loadSettings();
  const res = await next();
  try {
    for (const [k, v] of Object.entries(safety)) if (!res.headers.has(k)) res.headers.set(k, v);
    if (ctx.url.pathname.startsWith("/admin")) {
      res.headers.set("Cache-Control", "private, no-store");
      res.headers.set("X-Robots-Tag", "noindex, nofollow");
    }
  } catch {
    // Some responses (file downloads) have fixed headers; leave them be.
  }
  return res;
});
