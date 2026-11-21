// PayPal Instant Payment Notification: PayPal tells the site when a client pays.
// The site checks the message with PayPal, matches it to the order (by the order id
// sent as `custom`), marks it paid and sends Nancy's "Received Payment" email.
import { paidEmail } from "./client-mail";
import { send, type Email, type SendConfig } from "./mail";
import { money } from "./order";
import { markPaid, orderKey, type OrderRecord } from "./records";
import type { Store } from "./store";

export const ipnVerifyUrl = "https://ipnpb.paypal.com/cgi-bin/webscr";

/** Asks PayPal whether this message really came from PayPal. */
export async function verifyIpn(raw: string, fetcher: typeof fetch = fetch): Promise<boolean> {
  const res = await fetcher(ipnVerifyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "ResumeProNC-IPN" },
    body: `cmd=_notify-validate&${raw}`,
  });
  return (await res.text()).trim() === "VERIFIED";
}

type Deps = {
  store: Store;
  verify: (raw: string) => Promise<boolean>;
  mail: SendConfig;
  sendMail?: (e: Email, cfg: SendConfig, to?: string) => Promise<void>;
  paypalEmail: string;
  draftDays: number;
  now: Date;
};

export type IpnResult = "ignored" | "unverified" | "not-found" | "duplicate" | "mismatch" | "paid";

export async function handleIpn(raw: string, d: Deps): Promise<IpnResult> {
  const sendMail = d.sendMail ?? send;
  const p = new URLSearchParams(raw);
  if (!(await d.verify(raw))) return "unverified";
  if (p.get("payment_status") !== "Completed") return "ignored";

  const receiver = (p.get("receiver_email") || p.get("business") || "").toLowerCase();
  if (!d.paypalEmail || receiver !== d.paypalEmail.toLowerCase()) return "ignored";

  const id = p.get("custom") || p.get("invoice") || "";
  const o = id ? await d.store.getJSON<OrderRecord>(orderKey(id)) : null;
  if (!o) return "not-found";

  const txn = p.get("txn_id") ?? "";
  if (o.paypalTxn === txn || o.paidAt) return "duplicate";

  const gross = Number(p.get("mc_gross") ?? 0);
  const at = d.now.toISOString();
  if (p.get("mc_currency") !== "USD" || gross + 0.005 < o.total) {
    o.log.push({ at, what: `PayPal payment of ${money(gross)} ${p.get("mc_currency") ?? ""} doesn't match the ${money(o.total)} total. Check PayPal, then mark paid by hand.` });
    await d.store.setJSON(orderKey(o.id), o);
    return "mismatch";
  }

  o.paypalTxn = txn;
  markPaid(o, d.now, d.draftDays);
  o.log.push({ at, what: `PayPal payment of ${money(gross)} received (transaction ${txn})` });
  await d.store.setJSON(orderKey(o.id), o);

  if (d.mail.apiKey) {
    try {
      await sendMail(paidEmail(o, d.mail.to), d.mail, o.email);
      o.log.push({ at, what: 'Emailed: "Received Payment"' });
      await sendMail(
        { subject: `Paid: ${o.name}, ${money(gross)}`, replyTo: o.email, text: `${o.name} paid ${money(gross)} through PayPal and is now on your writing schedule.\n\nThey got your "Received Payment" email automatically.` },
        d.mail,
      );
    } catch (err) {
      console.error("IPN: email failed", err);
      o.log.push({ at, what: 'The "Received Payment" email didn\'t send. Send it by hand.' });
    }
    await d.store.setJSON(orderKey(o.id), o);
  }
  return "paid";
}
