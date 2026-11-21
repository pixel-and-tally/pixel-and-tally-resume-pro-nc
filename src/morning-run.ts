// Weekday mornings (7 AM Eastern in winter, 8 AM in summer): sends Nancy her
// "your day" email and the one-time automatic payment reminders.
// Called by the Cloudflare cron trigger in wrangler.jsonc (free plan), via src/worker.ts.
import { mailConfig } from "./lib/mail";
import { runMorning } from "./lib/morning";
import { store } from "./lib/store";
import { site } from "./site";

export async function morningRun(now = new Date()) {
  if (!site.morningEmail) return "off";
  const mail = mailConfig();
  const result = await runMorning({
    store: store(),
    mail,
    now,
    siteUrl: site.url,
    // SITE_URL points the email's dashboard link somewhere else until the domain moves.
    dashboardUrl: `${process.env.SITE_URL || site.url}/admin/`,
    paypalEmail: site.paypalEmail,
    nancy: mail.to || site.email,
    autoReminderDays: site.autoPaymentReminderDays,
  });
  console.log("Morning run:", result);
  return "ok";
}
