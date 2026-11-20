// Emails Nancy sends to a client from her dashboard. Reply-To is Nancy, so the
// client's answer lands in her inbox.
import { money } from "./order";
import { formatDay, type OrderRecord } from "./records";
import type { Email } from "./mail";

type Attachment = { filename: string; content: string };

const first = (name: string) => name.split(" ")[0] || name;
const sign = ["Nancy Turner", "Resume Pro NC"];
const extra = (note: string) => (note.trim() ? [note.trim(), ""] : []);

export function paidEmail(o: OrderRecord, nancy: string): Email {
  return {
    subject: "Payment received: you're on my writing schedule",
    replyTo: nancy,
    text: [
      `Hi ${first(o.name)},`,
      "",
      `Thank you! Your payment of ${money(o.total)} is received and I have your questionnaire, so you're officially on my writing schedule.`,
      "",
      o.dueDate ? `You'll have your first draft by ${formatDay(o.dueDate)}.` : "I'll have your first draft to you soon.",
      "",
      "If you think of anything to add, or your plans change, just reply to this email.",
      "",
      ...sign,
    ].join("\n"),
  };
}

export function paymentReminder(o: OrderRecord, nancy: string, payLink: string): Email {
  return {
    subject: "Your Resume Pro NC order: payment link",
    replyTo: nancy,
    text: [
      `Hi ${first(o.name)},`,
      "",
      `I have your questionnaire. As soon as your payment of ${money(o.total)} comes in, you go on my writing schedule.`,
      "",
      payLink ? `You can pay here by card or PayPal: ${payLink}` : "Reply to this email and I'll send an invoice you can pay by card or PayPal.",
      "",
      ...sign,
    ].join("\n"),
  };
}

export function draftEmail(o: OrderRecord, nancy: string, note: string, files: Attachment[], revision: number): Email {
  return {
    subject: revision > 1 ? "Your revised resume draft" : "Your resume draft is ready",
    replyTo: nancy,
    text: [
      `Hi ${first(o.name)},`,
      "",
      revision > 1 ? "Your revised draft is attached." : "Your first draft is attached.",
      "",
      ...extra(note),
      "Please read it closely and check every name, date, number and your contact details.",
      "Reply with any changes you'd like. When you're happy with it, reply \"approved\" and I'll send your final files in Word and PDF.",
      "",
      ...sign,
    ].join("\n"),
    attachments: files,
  };
}

export const whichFile = [
  "Which file to use:",
  "",
  "PDF: use it when you email your resume to a person, attach it to a message on LinkedIn, or print it. It looks the same on every screen and can't be changed by accident.",
  "",
  "Word (.docx): use it when an online application or job site asks you to upload a resume, unless it says PDF is welcome. The systems that scan applications read Word files most reliably. Keep it for your own updates later, too.",
];

export function finalEmail(o: OrderRecord, nancy: string, note: string, files: Attachment[], reviewUrl: string, revisionDays: number): Email {
  return {
    subject: "Your final resume files",
    replyTo: nancy,
    text: [
      `Hi ${first(o.name)},`,
      "",
      "Your final files are attached in Word and PDF.",
      "",
      ...extra(note),
      ...whichFile,
      "",
      `You have ${revisionDays} days of free changes from today, so reply any time you need an update.`,
      "",
      ...(reviewUrl
        ? ["If you're happy with my work, would you leave me a quick review? It helps other job seekers find me:", reviewUrl, ""]
        : []),
      "Good luck with your search. I'm rooting for you!",
      "",
      ...sign,
    ].join("\n"),
    attachments: files,
  };
}
