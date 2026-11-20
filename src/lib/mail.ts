// Turns each form into a plain-text email to Nancy and sends it through Resend.
// Reply-To is the visitor, so hitting Reply answers them.
import { buildCallIcs, formatDate, formatTime, type Availability } from "./schedule";
import { money } from "./order";
import { questionnaire, toAttachment, type ContactValue, type OrderValue, type ReviewValue } from "./forms";

export type SendConfig = { apiKey: string; to: string; from: string };
type Attachment = { filename: string; content: string };
export type Email = { subject: string; text: string; replyTo: string; attachments?: Attachment[] };

const section = (title: string, body: string) => (body ? `${title}\n${body}\n` : "");

export const callLabel = (v: Pick<ContactValue, "callDate" | "callTime">) =>
  v.callDate ? `${formatDate(v.callDate)} at ${formatTime(v.callTime)} Eastern` : "";

export function contactEmail(v: ContactValue, availability: Availability, now: Date): Email {
  const call = callLabel(v);
  const lines = [
    `Name: ${v.name}`,
    `Email: ${v.email}`,
    `Phone: ${v.phone || "Not given"}`,
    `Free phone consultation: ${call || "Not requested"}`,
    ...(v.subject ? [`Subject: ${v.subject}`] : []),
    "",
    v.message || "(No message)",
    ...(call ? ["", "The call isn't confirmed until you reply. The attached file adds it to your calendar."] : []),
  ];
  return {
    subject: call ? `Phone consultation request: ${v.name}, ${call}` : `Website message: ${v.subject || v.name}`,
    text: lines.join("\n"),
    replyTo: v.email,
    attachments: call
      ? [
          {
            filename: "consultation.ics",
            content: Buffer.from(
              buildCallIcs(
                {
                  uid: `${now.getTime()}-${v.email}@resumepronc.com`,
                  date: v.callDate,
                  time: v.callTime,
                  summary: `Free phone consultation: ${v.name}`,
                  description: `Call ${v.phone}\n${v.email}\n\n${v.message}`,
                },
                availability,
                now,
              ),
            ).toString("base64"),
          },
        ]
      : undefined,
  };
}

export async function reviewEmail(v: ReviewValue): Promise<Email> {
  const file = await toAttachment(v.resume);
  return {
    subject: `Free resume review: ${v.name}`,
    replyTo: v.email,
    text: [
      `Name: ${v.name}`,
      `Email: ${v.email}`,
      `Phone: ${v.phone || "Not given"}`,
      `Target job: ${v.target || "Not given"}`,
      "",
      v.notes,
      "",
      "Their resume is attached.",
    ].join("\n"),
    attachments: file ? [file] : undefined,
  };
}

export async function orderEmail(v: OrderValue): Promise<Email> {
  const file = await toAttachment(v.resume);
  const order = v.priced.lines.map((l) => `  ${l.name}: ${money(l.price)}`).join("\n");
  const answers = questionnaire
    .map((q) => section(`${q.label}:`, v.answers[q.id]))
    .filter(Boolean)
    .join("\n");
  const jobs = v.jobs.map((j, i) => section(`Job ${i + 1}${i === 0 ? " (most recent)" : ""}:`, j)).join("\n");
  const address = [v.street, [v.city, v.state].filter(Boolean).join(", "), v.zip].filter(Boolean).join(" ");
  return {
    subject: `New order: ${v.name}, ${money(v.priced.total)}`,
    replyTo: v.email,
    text: [
      "ORDER",
      order,
      `  Total: ${money(v.priced.total)}`,
      v.rush ? `  Deadline or rush request: ${v.rush}` : "",
      "",
      "Send the invoice, then start writing once it's paid.",
      "",
      "CONTACT",
      `Name: ${v.name}`,
      `Email: ${v.email}`,
      `Phone: ${v.phone || "Not given"}`,
      `Address: ${address}`,
      `LinkedIn: ${v.linkedin || "Not given"}`,
      `Career change: ${v.careerChange || "Not answered"}`,
      "",
      "QUESTIONNAIRE",
      answers,
      jobs ? `EMPLOYMENT HISTORY\n${jobs}` : "",
      file ? "Their current resume is attached." : "No resume attached.",
    ].join("\n"),
    attachments: file ? [file] : undefined,
  };
}

/** A short receipt to the visitor so they know it arrived. Reply-To is Nancy. */
export function orderReceipt(v: OrderValue, nancyEmail: string, payLink: string): Email {
  const order = v.priced.lines.map((l) => `  ${l.name}: ${money(l.price)}`).join("\n");
  return {
    subject: "Your Resume Pro NC order",
    replyTo: nancyEmail,
    text: [
      `Hi ${v.name.split(" ")[0]},`,
      "",
      "Thank you for your order. Here's what you picked:",
      "",
      order,
      `  Total: ${money(v.priced.total)}`,
      "",
      payLink
        ? `You can pay here: ${payLink}\nI start writing once payment is received.`
        : "I'll email you an invoice you can pay by credit card, debit card or PayPal. I start writing once it's paid.",
      "",
      "If you think of anything else to add, just reply to this email.",
      "",
      "Nancy Turner",
      "Resume Pro NC",
    ].join("\n"),
  };
}

export async function send(email: Email, cfg: SendConfig, to = cfg.to, fetcher: typeof fetch = fetch) {
  const res = await fetcher("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: cfg.from,
      to: [to],
      reply_to: email.replyTo,
      subject: email.subject,
      text: email.text,
      attachments: email.attachments,
    }),
  });
  if (!res.ok) throw new Error(`Resend responded ${res.status}: ${await res.text()}`);
}

export const mailConfig = (): SendConfig => ({
  apiKey: process.env.RESEND_API_KEY ?? "",
  to: process.env.CONTACT_TO_EMAIL ?? "",
  from: process.env.CONTACT_FROM_EMAIL || "Resume Pro NC website <onboarding@resend.dev>",
});
