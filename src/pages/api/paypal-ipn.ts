import type { APIRoute } from "astro";
import { mailConfig } from "../../lib/mail";
import { handleIpn, verifyIpn } from "../../lib/paypal";
import { store } from "../../lib/store";
import { site } from "../../site";

export const prerender = false;

// PayPal posts here after a client pays. Always answer 200 so PayPal stops retrying
// once we've seen it; problems are logged and shown on the order in the dashboard.
export const POST: APIRoute = async ({ request }) => {
  const raw = await request.text();
  try {
    const result = await handleIpn(raw, {
      store: store(),
      verify: (r) => verifyIpn(r),
      mail: mailConfig(),
      paypalEmail: site.paypalEmail,
      draftDays: site.draftDays,
      now: new Date(),
    });
    console.log("IPN:", result);
  } catch (err) {
    console.error("IPN failed", err);
    return new Response("error", { status: 500 }); // PayPal retries later
  }
  return new Response("ok");
};
