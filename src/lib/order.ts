// Order math, shared by the order page (live total) and the server (re-check).
import type { Service } from "../site";

export type Selection = { resume: string; addons: string[] };
export type Priced = { lines: { name: string; price: number }[]; total: number; problems: string[] };

export const money = (n: number) => `$${n.toLocaleString("en-US")}`;

/**
 * Prices a selection against the service list. Unknown ids are ignored.
 * A cover letter needs a resume in the same order.
 */
export function priceOrder(sel: Selection, services: Service[]): Priced {
  const byId = new Map(services.map((s) => [s.id, s]));
  const resume = byId.get(sel.resume);
  const picked: Service[] = [];
  if (resume?.kind === "resume") picked.push(resume);
  for (const id of new Set(sel.addons)) {
    const s = byId.get(id);
    if (s && s.kind !== "resume") picked.push(s);
  }

  const problems: string[] = [];
  if (picked.length === 0) problems.push("empty");
  if (picked.some((s) => s.id === "cover-letter") && !picked.some((s) => s.kind === "resume")) {
    problems.push("cover-letter-needs-resume");
  }

  const lines = picked.map((s) => ({ name: s.name, price: s.price }));
  return { lines, total: lines.reduce((sum, l) => sum + l.price, 0), problems };
}

export type PayOptions = {
  /** Order id: PayPal sends it back so the site can match the payment. */
  orderId?: string;
  /** Full site address, e.g. https://www.resumepronc.com, for the return and notify URLs. */
  siteUrl?: string;
};

/** PayPal "Buy Now" link for the exact total, or "" when no PayPal account is set. */
export function paypalLink(business: string, total: number, item: string, opts: PayOptions = {}): string {
  if (!business || total <= 0) return "";
  const q = new URLSearchParams({
    cmd: "_xclick",
    business,
    item_name: item,
    amount: total.toFixed(2),
    currency_code: "USD",
    no_shipping: "1",
  });
  if (opts.orderId) {
    q.set("custom", opts.orderId);
    q.set("invoice", opts.orderId);
  }
  if (opts.siteUrl) {
    q.set("notify_url", `${opts.siteUrl}/api/paypal-ipn`);
    q.set("return", `${opts.siteUrl}/thanks/?form=paid`);
    q.set("rm", "1");
    q.set("cancel_return", `${opts.siteUrl}/thanks/?form=unpaid`);
  }
  return `https://www.paypal.com/cgi-bin/webscr?${q}`;
}
