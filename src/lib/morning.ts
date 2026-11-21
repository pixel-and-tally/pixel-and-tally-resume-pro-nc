// The morning run (weekdays, from netlify/functions/morning.mts):
// 1. One friendly payment reminder, in Nancy's own wording, to anyone whose
//    questionnaire has sat unpaid for `autoReminderDays`. It only ever goes once;
//    after that, the Today list suggests a call or text instead.
// 2. Nancy's morning email: what's overdue, what's due today, what's coming up.
import { paymentReminder } from "./client-mail";
import { agenda, deskTimeZone, morningDigest, numbers } from "./desk";
import { send as resendSend, type Email, type SendConfig } from "./mail";
import { paypalLink } from "./order";
import { listMessages, listOrders, orderKey } from "./records";
import { localDateString } from "./schedule";
import type { Store } from "./store";

export type MorningOptions = {
  store: Store;
  mail: SendConfig;
  now: Date;
  siteUrl: string;
  /** Where the dashboard lives right now (Netlify's URL until the domain moves). */
  dashboardUrl: string;
  paypalEmail: string;
  nancy: string;
  /** Calendar days before the automatic payment reminder. 0 turns it off. */
  autoReminderDays: number;
  send?: (email: Email, cfg: SendConfig, to: string) => Promise<void>;
};

export async function runMorning(opts: MorningOptions) {
  const { store, mail, now } = opts;
  const send = opts.send ?? ((e, c, to) => resendSend(e, c, to));
  if (!mail.apiKey) return { reminders: 0, digest: false, skipped: "RESEND_API_KEY is not set" };

  const today = localDateString(now, deskTimeZone);
  const orders = await listOrders(store);
  let reminders = 0;

  if (opts.autoReminderDays > 0) {
    for (const o of orders) {
      if (o.status !== "awaiting-payment" || o.autoReminderAt) continue;
      const created = localDateString(new Date(o.createdAt), deskTimeZone);
      const age = Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${created}T12:00:00Z`)) / 86_400_000);
      if (age < opts.autoReminderDays) continue;
      const item = `Resume Pro NC: ${o.lines.map((l) => l.name).join(", ")}`;
      const link = paypalLink(opts.paypalEmail, o.total, item, { orderId: o.id, siteUrl: opts.siteUrl });
      try {
        await send(paymentReminder(o, opts.nancy, link), mail, o.email);
        o.autoReminderAt = now.toISOString();
        o.log.push({ at: now.toISOString(), what: "Automatic payment reminder emailed" });
        await store.setJSON(orderKey(o.id), o);
        reminders++;
      } catch (err) {
        console.error(`Morning: reminder to order ${o.id} failed`, err);
      }
    }
  }

  const messages = await listMessages(store);
  const tasks = agenda(orders, messages, now);
  const digest = morningDigest(tasks, numbers(orders, now), opts.dashboardUrl, now);
  const recap = reminders ? `\n\nAlso: I sent ${reminders} automatic payment reminder${reminders === 1 ? "" : "s"} this morning (you'll see it in each order's history).` : "";
  await send({ subject: digest.subject, text: digest.text + recap, replyTo: opts.nancy }, mail, mail.to || opts.nancy);
  return { reminders, digest: true, tasks: tasks.length };
}
