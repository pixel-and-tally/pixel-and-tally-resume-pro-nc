// Shared request handling for the form endpoints. The browser script sends
// Accept: application/json and gets JSON back; a plain form post (no
// JavaScript) gets a redirect instead.
import type { APIContext } from "astro";
import { mailConfig, send, type Email, type SendConfig } from "./mail";
import type { Result } from "./forms";

type Handler<T> = {
  page: string; // where the form lives, for no-JS error redirects
  parse: (form: FormData) => Result<T>;
  /** Keeps the submission for Nancy's dashboard; returns its id and dashboard path. */
  save?: (value: T, now: Date) => Promise<{ id: string; path: string }>;
  emails: (value: T, cfg: SendConfig, dashboardUrl: string) => Promise<{ email: Email; to?: string; optional?: boolean }[]>;
  /** Where the visitor goes next (the thank-you page, or PayPal checkout). */
  thanks: (value: T, id: string) => string;
};

export function formEndpoint<T>(h: Handler<T>) {
  return async ({ request, redirect }: APIContext) => {
    const json = request.headers.get("accept")?.includes("application/json") ?? false;
    const reply = (status: number, body: Record<string, unknown>, to: string) => (json ? Response.json(body, { status }) : redirect(to, 303));
    const back = `${h.page}?error=1`;

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return reply(400, { ok: false, error: "bad_request" }, back);
    }

    const result = h.parse(form);
    if (!result.ok && result.spam) return reply(200, { ok: true }, "/thanks/");
    if (!result.ok) return reply(422, { ok: false, invalid: result.invalid }, back);

    const cfg = mailConfig();
    if (!cfg.apiKey || !cfg.to) {
      console.error("Form: RESEND_API_KEY or CONTACT_TO_EMAIL is not set");
      return reply(503, { ok: false, error: "not_configured" }, back);
    }

    // Save first, but never lose a submission over it: the email to Nancy has everything too.
    let dashboardUrl = "";
    let id = "";
    if (h.save) {
      try {
        const saved = await h.save(result.value, new Date());
        id = saved.id;
        dashboardUrl = new URL(saved.path, request.url).href;
      } catch (err) {
        console.error("Form: could not save to the dashboard", err);
      }
    }

    try {
      for (const m of await h.emails(result.value, cfg, dashboardUrl)) {
        try {
          await send(m.email, cfg, m.to);
        } catch (err) {
          if (!m.optional) throw err;
          console.error("Form: optional email failed", err);
        }
      }
    } catch (err) {
      console.error("Form: send failed", err);
      return reply(502, { ok: false, error: "send_failed" }, back);
    }
    const next = h.thanks(result.value, id);
    return reply(200, { ok: true, next }, next);
  };
}
