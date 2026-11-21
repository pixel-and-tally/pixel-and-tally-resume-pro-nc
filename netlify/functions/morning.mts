// Weekday mornings (7 AM Eastern in winter, 8 AM in summer): sends Nancy her
// "your day" email and the one-time automatic payment reminders.
// Netlify scheduled functions are free on the starter plan.
import { mailConfig } from "../../src/lib/mail";
import { runMorning } from "../../src/lib/morning";
import { store } from "../../src/lib/store";
import { site } from "../../src/site";

export default async () => {
  if (!site.morningEmail) return new Response("off");
  const mail = mailConfig();
  const result = await runMorning({
    store: store(),
    mail,
    now: new Date(),
    siteUrl: site.url,
    dashboardUrl: `${process.env.URL || site.url}/admin/`,
    paypalEmail: site.paypalEmail,
    nancy: mail.to || site.email,
    autoReminderDays: site.autoPaymentReminderDays,
  });
  console.log("Morning run:", result);
  return new Response("ok");
};

export const config = { schedule: "0 12 * * 1-5" };
