import { formEndpoint } from "../../lib/endpoint";
import { parseOrder, type OrderValue } from "../../lib/forms";
import { questionnaireReceived } from "../../lib/client-mail";
import { orderEmail } from "../../lib/mail";
import { paypalLink } from "../../lib/order";
import { newId, orderFromForm, orderKey, saveFile } from "../../lib/records";
import { store } from "../../lib/store";
import { services, site } from "../../site";

export const prerender = false;

const itemName = (v: OrderValue) => `Resume Pro NC: ${v.priced.lines.map((l) => l.name).join(", ")}`;

export const POST = formEndpoint({
  page: "/order/",
  parse: (form) => parseOrder(form, services),
  save: async (v, now) => {
    const s = store();
    const id = newId(now);
    const resume = v.resume ? await saveFile(s, id, v.resume, "Their current resume", now) : null;
    await s.setJSON(orderKey(id), orderFromForm(v, id, now, resume));
    return { id, path: `/admin/orders/${id}/` };
  },
  emails: async (v, cfg, link) => {
    const id = link.match(/orders\/([^/]+)\//)?.[1] ?? "";
    const item = itemName(v);
    return [
      { email: await orderEmail(v, link) },
      // Nancy's "questionnaire received" email with the payment link. If it fails, Nancy still has the order.
      {
        email: questionnaireReceived(v.name, v.priced.total, v.priced.lines.map((l) => l.name), cfg.to, paypalLink(site.paypalEmail, v.priced.total, item, { orderId: id, siteUrl: site.url })),
        to: v.email,
        optional: true,
      },
    ];
  },
  // Check out: straight to PayPal for the exact total. Without PayPal, the thank-you page.
  thanks: (v, id) => {
    const pay = paypalLink(site.paypalEmail, v.priced.total, itemName(v), { orderId: id, siteUrl: site.url });
    if (pay) return pay;
    const q = new URLSearchParams({ form: "order", total: String(v.priced.total) });
    v.priced.lines.forEach((l) => q.append("item", l.name));
    return `/thanks/?${q}`;
  },
});
