// Emails Nancy sends to clients, in her own words (from her real emails, 2026-11-20).
// Each one goes out as plain text and simple HTML with her signature. Reply-To is
// Nancy, so the client's answer lands in her inbox.
import { money } from "./order";
import { timeZone, type OrderRecord } from "./records";
import type { Email } from "./mail";
import { services, site } from "../site";

const phones = site.phones;

type Attachment = { filename: string; content: string };
type Link = { text: string; href: string };
/** A paragraph: plain text, or text with one link in it. */
type Para = string | { before: string; link: Link; after?: string };

const first = (name: string) => name.trim().split(/\s+/)[0] || name;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const domain = site.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

const signature = ["Nancy Turner", `${site.name} - Professional Resume Service`, ...phones.map((p) => p.number), domain];

/** "Good morning", "Good afternoon" or "Good evening", Eastern time. */
export function greeting(now: Date): string {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(now));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export function letter(subject: string, replyTo: string, paras: Para[], attachments?: Attachment[]): Email {
  const text = [
    ...paras.map((p) => (typeof p === "string" ? p : `${p.before}${p.link.text}: ${p.link.href}${p.after ?? ""}`)),
    signature.join("\n"),
  ].join("\n\n");
  const link = (l: Link) => `<a href="${esc(l.href)}">${esc(l.text)}</a>`;
  const body = paras
    .map((p) => `<p style="margin:0 0 14px">${typeof p === "string" ? esc(p).replace(/\n/g, "<br>") : `${esc(p.before)}${link(p.link)}${esc(p.after ?? "")}`}</p>`)
    .join("");
  const sig = [
    `<strong>${esc(signature[0])}</strong>`,
    `<strong>${esc(signature[1])}</strong>`,
    ...phones.map((p) => `<a href="tel:${p.number.replace(/\D/g, "")}">${esc(p.number)}</a>`),
    `<a href="${esc(site.url)}">${esc(domain)}</a>`,
  ].join("<br>");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5">${body}<p style="margin:22px 0 0">${sig}</p></div>`;
  return { subject, replyTo, text, html, attachments };
}

const price = (id: string) => money(services.find((s) => s.id === id)?.price ?? 0);

/** Reply to someone who reached out (contact form, text or call). Nancy can edit it before sending. */
export function inquiryText(name: string, now: Date): string {
  return [
    `${greeting(now)} ${first(name)},`,
    "Thank you for reaching out! I received your request for information regarding resume writing services and would be happy to assist you. Are you available this afternoon or tomorrow morning for a brief phone call to discuss your resume needs?",
    `Please note that my current turnaround time for resume drafts is approximately ${site.turnaround}. My resume writing fee is based on your level of experience: ${price("management")} for individuals with management experience and ${price("professional")} for those without management experience.`,
    "I look forward to speaking with you. Please let me know which day and time works best for you.",
    "Thank you!",
  ].join("\n\n");
}

export function inquiryEmail(body: string, nancy: string): Email {
  return letter("Resume Information", nancy, body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean));
}

/** Sent automatically when the questionnaire comes in, with the payment link. */
export function questionnaireReceived(name: string, total: number, items: string[], nancy: string, payLink: string): Email {
  return letter("Resume Questionnaire Received", nancy, [
    `Hi ${first(name)},`,
    `I am in receipt of your online questionnaire form. Thank you for providing me with a lot of great information. My current turnaround time for drafts is running between ${site.turnaround}.`,
    `Your order: ${items.join(", ")}. Total: ${money(total)}.`,
    payLink
      ? { before: "Please note that payment must be received prior to being placed into my resume writing schedule and starting the writing process. You may simply click on the following link to submit payment: ", link: { text: "Pay with PayPal or card", href: payLink }, after: "." }
      : "Please note that payment must be received prior to being placed into my resume writing schedule and starting the writing process. I'll email you an invoice you can pay by credit card, debit card or PayPal.",
    "I look forward to working with you to produce a powerful, professional resume that captures and highlights \"you,\" your work ethics, qualifications, accomplishments, educational credentials, and most importantly, how you can be an asset to potential employers.",
    "Do not hesitate to call if you have any questions or require additional information from me.",
    "Thank you!",
  ]);
}

/** The order page, with the package Nancy suggested on the call already picked. */
export const orderLink = (level = "") => `${site.url}/order/${level ? `?resume=${encodeURIComponent(level)}` : ""}`;

/** After the phone call: where to pick services, fill out the questionnaire and check out. Nancy can edit it. */
export function orderLinkText(name: string): string {
  return [
    `Hi ${first(name)},`,
    "Thank you for taking the time to speak with me today! As promised, here is the link where you can choose your services, complete my resume questionnaire, upload your existing resume, and check out.",
    "Please note that payment must be received prior to being placed into my resume writing schedule and starting the writing process.",
    "Do not hesitate to call if you have any questions or require additional information from me.",
    "Thank you!",
  ].join("\n\n");
}

export function orderLinkEmail(body: string, link: string, nancy: string): Email {
  const paras: Para[] = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  // The link goes right after the paragraph that mentions it (or after the greeting).
  const at = Math.max(paras.findIndex((p) => typeof p === "string" && /check out|link/i.test(p)), 0) + 1;
  paras.splice(at, 0, { before: "", link: { text: "Click here to choose your services and get started", href: link } });
  return letter("Your Resume Pro NC Order Link", nancy, paras);
}

export const paymentReminder = (o: OrderRecord, nancy: string, payLink: string) =>
  questionnaireReceived(o.name, o.total, o.lines.map((l) => l.name), nancy, payLink);

export function paidEmail(o: OrderRecord, nancy: string): Email {
  return letter("Received Payment", nancy, [
    `${first(o.name)},`,
    "I've received your payment and you have been added to my writing schedule. I will contact you if any additional information is needed during the writing process.",
    "Thank you!",
  ]);
}

export function draftEmail(o: OrderRecord, nancy: string, note: string, files: Attachment[], revision: number, now: Date): Email {
  const format = files.some((f) => /\.pdf$/i.test(f.filename)) ? "PDF" : "Word";
  return letter(revision > 1 ? "Revised Resume Draft" : "Resume Draft", nancy, [
    `${greeting(now)} ${first(o.name)},`,
    "I hope you're having a great week!",
    revision > 1
      ? `I have attached your revised resume draft in ${format} format. Please review and let me know if there are any other revisions, additions, or deletions you would like made.`
      : `In follow-up to our recent telephone conversation and the information you submitted, I have attached your resume draft in ${format} format. Please review and let me know if we're headed in the right direction and notify me of any revisions, additions, or deletions you would like made.`,
    ...(note.trim() ? [note.trim()] : []),
    "Please note that I have strategically formatted the document and incorporated specific \"key words\" throughout in order to maximize its ability to pass through today's Applicant Tracking Systems (ATS). Nearly 93% of all hiring managers use ATS to collect, sort, scan, and rank the job applications and resumes received for their open positions. What began as a recruitment solution for large employers has turned into a commonplace tool for companies of all shapes and sizes. This is why I prefer to use clear, concise formats that do not incorporate fancy templates, graphics, charts, shading, or photos as they will be deemed unreadable and end up lost in cyberspace.",
    "Upon final approval, I will provide you with a \"Word\" formatted document so that you can personalize and make future additions.",
    "I look forward to your response and will be more than happy to revise your document until you are completely satisfied. Let me know if you would like to schedule a phone conference to discuss the details.",
    "Thank you, and enjoy the rest of your day!",
  ], files);
}

export const wordVsPdf =
  "Please note that when applying for a job through an Applicant Tracking System (ATS), submit your resume as a Microsoft Word file unless they specifically request a PDF file. While PDF files are great because they ensure that the format of your resume remains unchanged, many systems cannot convert the file or accurately extract the text. As a result, your resume file may be deemed \"unusable\" and discarded. Use PDF file format for emailing your resume to a specific person or reference or when printing a hard copy.";

export const formatLink = "https://askleo.com/why_does_my_microsoft_word_document_display_differently_on_different_computers/";

export function finalEmail(o: OrderRecord, nancy: string, note: string, files: Attachment[], reviewUrl: string): Email {
  return letter("Your Final Resume", nancy, [
    `${first(o.name)},`,
    "I am so glad you are satisfied with your resume. Attached please find revised PDF and Word files for your use. You have exceptional qualifications, experience, and personal attributes that I'm sure will be sought after by many.",
    ...(note.trim() ? [note.trim()] : []),
    wordVsPdf,
    {
      before: "I encourage you to take a look at ",
      link: { text: "this short article", href: formatLink },
      after: ", which explains why some MS Word documents, fonts, and formats appear very different when viewed or printed on one system or device as compared to another. PDF files cannot be manipulated and will always maintain the same format. Word files, however, can appear totally different depending on your computer, iPad, printer, default margins, edition of Word you are using, etc.",
    },
    ...(reviewUrl
      ? [{
          before: "In addition, I have a small favor to ask. If you have a free minute, I would really appreciate you posting a review on Google, which helps with search engine optimization and gives potential clients a comfort level about trusting me with their business. Many of my customers comment that they chose my service because of the reviews real-live customers have posted. ",
          link: { text: "Click here for a direct link to leave a review", href: reviewUrl },
          after: ".",
        }]
      : []),
    "I wish you the very best of luck and have no doubt that you will be super successful in your new career path.",
    "Thank you for your business!",
  ], files);
}

/** Sent automatically when someone uses the contact form, so they know it arrived. */
export function contactReceived(name: string, callAt: string, nancy: string): Email {
  const phone = phones[0]?.number;
  return letter(callAt ? "Your phone consultation request" : "I received your message", nancy, [
    `Hi ${first(name)},`,
    callAt
      ? `Thank you for requesting a free phone consultation for ${callAt}. Please note that this time is not confirmed yet. I'll reply shortly to confirm it or suggest another time that works.`
      : "Thank you for reaching out! I received your message and will get back to you within one business day.",
    ...(phone ? [`If you need me sooner, you're welcome to call or text ${phone}.`] : []),
    "If you don't see my reply, please check your spam or junk folder.",
    "Thank you!",
  ]);
}

/** Sent automatically when a resume comes in for the free review. */
export function reviewReceived(name: string, nancy: string): Email {
  return letter("I received your resume", nancy, [
    `Hi ${first(name)},`,
    "Thank you for sending your resume for a free review. I received it and will email you my honest feedback, usually within a couple of business days.",
    "If you don't see my reply, please check your spam or junk folder.",
    "Thank you!",
  ]);
}
