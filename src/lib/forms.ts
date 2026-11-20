// Field checks for the three forms (order, free review, contact), shared by the
// browser script and the server endpoints. Each returns the clean values or the
// list of bad fields, which the page shows inline.
import { isBookable, type Availability } from "./schedule";
import { priceOrder, type Priced } from "./order";
import type { Service } from "../site";

/** Hidden field that only bots fill in. */
export const honeypotField = "company-website";
export const maxUploadBytes = 4 * 1024 * 1024;
export const uploadTypes = [".pdf", ".doc", ".docx", ".txt", ".rtf", ".odt", ".pages"];
export const maxJobs = 8;
export const maxPostings = 10;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[\d\s().+-]{7,20}$/;

const text = (form: FormData, key: string, max = 5000) => String(form.get(key) ?? "").trim().slice(0, max);

export type Upload = { filename: string; content: string } | null;

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; spam: true }
  | { ok: false; spam: false; invalid: string[] };

function upload(form: FormData, key: string): { file: File | null; bad: boolean } {
  const f = form.get(key);
  if (!(f instanceof File) || f.size === 0) return { file: null, bad: false };
  const okType = uploadTypes.some((ext) => f.name.toLowerCase().endsWith(ext));
  return { file: f, bad: !okType || f.size > maxUploadBytes };
}

export async function toAttachment(file: File | null): Promise<Upload> {
  if (!file) return null;
  return { filename: file.name.replace(/[^\w.\- ]/g, "_").slice(0, 120), content: Buffer.from(await file.arrayBuffer()).toString("base64") };
}

function basics(form: FormData, invalid: string[]) {
  const v = { name: text(form, "name", 200), email: text(form, "email", 200), phone: text(form, "phone", 40) };
  if (!v.name) invalid.push("name");
  if (!EMAIL.test(v.email)) invalid.push("email");
  if (v.phone && !PHONE.test(v.phone)) invalid.push("phone");
  return v;
}

// ---------- Contact (with optional free phone consultation) ----------

export type ContactValue = { name: string; email: string; phone: string; subject: string; message: string; callDate: string; callTime: string };

export function parseContact(form: FormData, availability: Availability, now: Date): Result<ContactValue> {
  if (text(form, honeypotField)) return { ok: false, spam: true };
  const invalid: string[] = [];
  const b = basics(form, invalid);
  const value: ContactValue = {
    ...b,
    subject: text(form, "subject", 200),
    message: text(form, "message"),
    callDate: text(form, "callDate", 10),
    callTime: text(form, "callTime", 5),
  };
  const wantsCall = Boolean(value.callDate || value.callTime);
  if (wantsCall) {
    if (!isBookable(value.callDate, value.callTime, availability, now)) invalid.push("callTime");
    if (!value.phone) invalid.push("phone");
  } else if (value.message.length < 5) {
    invalid.push("message");
  }
  return invalid.length ? { ok: false, spam: false, invalid } : { ok: true, value };
}

// ---------- Free resume review ----------

export type ReviewValue = { name: string; email: string; phone: string; target: string; notes: string; resume: File };

export function parseReview(form: FormData): Result<ReviewValue> {
  if (text(form, honeypotField)) return { ok: false, spam: true };
  const invalid: string[] = [];
  const b = basics(form, invalid);
  const up = upload(form, "resume");
  if (!up.file || up.bad) invalid.push("resume");
  const value = { ...b, target: text(form, "target", 300), notes: text(form, "notes"), resume: up.file as File };
  return invalid.length ? { ok: false, spam: false, invalid } : { ok: true, value };
}

// ---------- Order + questionnaire ----------

export const questionnaire = [
  { id: "objective", label: "Position or career objective", required: true, hint: "The job title or kind of role you want next." },
  { id: "strengths", label: "Strengths and skills" },
  { id: "education", label: "Education and training" },
  { id: "development", label: "Professional development" },
  { id: "certifications", label: "Professional certifications and licensures" },
  { id: "publications", label: "Publications and presentations" },
  { id: "computer", label: "Computer skills" },
  { id: "languages", label: "Foreign languages" },
  { id: "community", label: "Community and volunteer activities" },
  {
    id: "achievements",
    label: "Career achievements and measurable results",
    hint: "Vital information, and the most important part. Numbers help: dollars saved, sales grown, people trained, awards won.",
  },
] as const;

export type OrderValue = {
  name: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  linkedin: string;
  careerChange: string;
  rush: string;
  answers: Record<string, string>;
  jobs: string[];
  /** Links (or titles) of the job postings they're applying for. */
  postings: string[];
  priced: Priced;
  resume: File | null;
};

export function parseOrder(form: FormData, services: Service[]): Result<OrderValue> {
  if (text(form, honeypotField)) return { ok: false, spam: true };
  const invalid: string[] = [];
  const b = basics(form, invalid);

  const priced = priceOrder({ resume: text(form, "resumeLevel", 40), addons: form.getAll("addons").map(String) }, services);
  if (priced.problems.length) invalid.push("services");

  const addr = { street: text(form, "street", 200), city: text(form, "city", 100), state: text(form, "state", 40), zip: text(form, "zip", 12) };
  if (!addr.street) invalid.push("street");
  if (!addr.city) invalid.push("city");
  if (!addr.state) invalid.push("state");
  if (!addr.zip) invalid.push("zip");

  const answers = Object.fromEntries(questionnaire.map((q) => [q.id, text(form, q.id)]));
  if (!answers.objective) invalid.push("objective");

  const jobs = Array.from({ length: maxJobs }, (_, i) => text(form, `job${i + 1}`)).filter(Boolean);

  const postings = text(form, "postings")
    .split(/\r?\n/)
    .map((l) => l.trim().slice(0, 500))
    .filter(Boolean)
    .slice(0, maxPostings);

  const up = upload(form, "resume");
  if (up.bad) invalid.push("resume");

  const value: OrderValue = {
    ...b,
    ...addr,
    linkedin: text(form, "linkedin", 300),
    careerChange: text(form, "careerChange", 10),
    rush: text(form, "rush", 300),
    answers,
    jobs,
    postings,
    priced,
    resume: up.file,
  };
  return invalid.length ? { ok: false, spam: false, invalid } : { ok: true, value };
}
