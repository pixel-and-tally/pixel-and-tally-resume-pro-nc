import { formEndpoint } from "../../lib/endpoint";
import { parseOrder } from "../../lib/forms";
import { orderEmail, orderReceipt } from "../../lib/mail";
import { paypalLink } from "../../lib/order";
import { services, site } from "../../site";

export const prerender = false;

export const POST = formEndpoint({
  page: "/order/",
  parse: (form) => parseOrder(form, services),
  emails: async (v, cfg) => {
    const item = `Resume Pro NC: ${v.priced.lines.map((l) => l.name).join(", ")}`;
    return [
      { email: await orderEmail(v) },
      // The visitor's copy. If it fails, Nancy still has the order.
      { email: orderReceipt(v, cfg.to, paypalLink(site.paypalEmail, v.priced.total, item)), to: v.email, optional: true },
    ];
  },
  thanks: (v) => {
    const q = new URLSearchParams({ form: "order", total: String(v.priced.total) });
    v.priced.lines.forEach((l) => q.append("item", l.name));
    return `/thanks/?${q}`;
  },
});
