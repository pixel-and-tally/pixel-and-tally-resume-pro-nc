// The Cloudflare Worker's entry point. Pages and form endpoints go through
// Astro as usual; the weekday cron trigger (wrangler.jsonc) runs the morning job.
// Both hand the STORE KV binding to src/lib/store.ts first.
import type { SSRManifest } from "astro";
import { App } from "astro/app";
import { handle } from "@astrojs/cloudflare/handler";
import { loadSettings } from "./lib/settings";
import { store, useBinding, type KVNamespace } from "./lib/store";
import { morningRun } from "./morning-run";

type Env = { ASSETS: { fetch: (req: Request | string) => Promise<Response> }; STORE?: KVNamespace; [key: string]: unknown };
type Ctx = Parameters<typeof handle>[4];

export function createExports(manifest: SSRManifest) {
  const app = new App(manifest);
  return {
    default: {
      async fetch(request: Parameters<typeof handle>[2], env: Env, ctx: Ctx) {
        useBinding(env.STORE);
        return handle(manifest, app, request, env, ctx);
      },
      async scheduled(_controller: unknown, env: Env, ctx: Ctx) {
        useBinding(env.STORE);
        // Nancy's saved Settings (inbox, reminder days, morning email on/off) first.
        ctx.waitUntil(loadSettings(store(), Date.now(), true).then(() => morningRun()));
      },
    },
  };
}
