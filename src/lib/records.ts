// Orders and messages as Nancy's dashboard keeps them, and the steps an order
// moves through: questionnaire in, paid and on the schedule, writing, draft out,
// final delivered.
import type { ContactValue, OrderValue, ReviewValue } from "./forms";
import { localDateString } from "./schedule";
import type { Store } from "./store";

export const timeZone = "America/New_York";

export type FileRef = { key: string; filename: string; type: string; label: string; at: string };
export type LogEntry = { at: string; what: string };

export const statuses = {
  "awaiting-payment": "Waiting on payment",
  queued: "Paid, on the schedule",
  writing: "Writing",
  "draft-sent": "Draft sent",
  delivered: "Delivered",
  cancelled: "Cancelled",
} as const;
export type Status = keyof typeof statuses;

/** The dashboard tabs, in order. */
export const views = [
  { id: "payment", label: "Waiting on payment", statuses: ["awaiting-payment"] },
  { id: "queued", label: "Queued", statuses: ["queued"] },
  { id: "present", label: "In progress", statuses: ["writing", "draft-sent"] },
  { id: "past", label: "Done", statuses: ["delivered", "cancelled"] },
] as const satisfies readonly { id: string; label: string; statuses: readonly Status[] }[];
export type ViewId = (typeof views)[number]["id"] | "messages";

export type OrderRecord = {
  id: string;
  createdAt: string;
  status: Status;
  name: string;
  email: string;
  phone: string;
  address: { street: string; city: string; state: string; zip: string };
  linkedin: string;
  careerChange: string;
  rush: string;
  lines: { name: string; price: number }[];
  total: number;
  answers: Record<string, string>;
  jobs: string[];
  postings: string[];
  files: FileRef[];
  notes: string;
  paidAt?: string;
  /** PayPal transaction id, when PayPal reported the payment. */
  paypalTxn?: string;
  /** First draft due, YYYY-MM-DD (Eastern). */
  dueDate?: string;
  draftCount: number;
  deliveredAt?: string;
  /** When the automatic payment reminder went out (it only goes once). */
  autoReminderAt?: string;
  /** When Nancy checked in after delivery to see how the job search is going. */
  followedUpAt?: string;
  log: LogEntry[];
};

export type MessageKind = "message" | "call" | "review";
export type MessageRecord = {
  id: string;
  kind: MessageKind;
  createdAt: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  body: string;
  /** "Monday, November 23 at 10 AM Eastern" for call requests. */
  callAt: string;
  target: string;
  files: FileRef[];
  notes: string;
  handled: boolean;
  /** Emails Nancy sent from the dashboard. */
  sent?: LogEntry[];
};

export const messageKinds: Record<MessageKind, string> = {
  call: "Phone consultation",
  review: "Free resume review",
  message: "Message",
};

export function newId(now: Date, rand = Math.random): string {
  const day = localDateString(now, timeZone);
  return `${day}-${rand().toString(36).slice(2, 8).padEnd(6, "0")}`;
}

export const orderKey = (id: string) => `order/${id}`;
export const messageKey = (id: string) => `message/${id}`;
export const fileKey = (id: string, name: string, now: Date) => `file/${id}/${now.getTime()}-${safeName(name)}`;
export const safeName = (name: string) => name.replace(/[^\w.\- ]/g, "_").slice(0, 120) || "file";

/** Adds calendar days to a YYYY-MM-DD date. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Adds business days (Mon to Fri) to a YYYY-MM-DD date. */
export function addBusinessDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  let left = days;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) left--;
  }
  return d.toISOString().slice(0, 10);
}

export function orderFromForm(v: OrderValue, id: string, now: Date, resume: FileRef | null): OrderRecord {
  return {
    id,
    createdAt: now.toISOString(),
    status: "awaiting-payment",
    name: v.name,
    email: v.email,
    phone: v.phone,
    address: { street: v.street, city: v.city, state: v.state, zip: v.zip },
    linkedin: v.linkedin,
    careerChange: v.careerChange,
    rush: v.rush,
    lines: v.priced.lines,
    total: v.priced.total,
    answers: v.answers,
    jobs: v.jobs,
    postings: v.postings,
    files: resume ? [resume] : [],
    notes: "",
    draftCount: 0,
    log: [{ at: now.toISOString(), what: "Questionnaire and order received" }],
  };
}

export function messageFromContact(v: ContactValue, id: string, now: Date, callAt: string): MessageRecord {
  return {
    id,
    kind: callAt ? "call" : "message",
    createdAt: now.toISOString(),
    name: v.name,
    email: v.email,
    phone: v.phone,
    subject: v.subject,
    body: v.message,
    callAt,
    target: "",
    files: [],
    notes: "",
    handled: false,
  };
}

export function messageFromReview(v: ReviewValue, id: string, now: Date, resume: FileRef | null): MessageRecord {
  return {
    id,
    kind: "review",
    createdAt: now.toISOString(),
    name: v.name,
    email: v.email,
    phone: v.phone,
    subject: "",
    body: v.notes,
    callAt: "",
    target: v.target,
    files: resume ? [resume] : [],
    notes: "",
    handled: false,
  };
}

const log = (o: OrderRecord, now: Date, what: string) => o.log.push({ at: now.toISOString(), what });

/** Payment received: the order joins the writing schedule with a draft due date. */
export function markPaid(o: OrderRecord, now: Date, draftDays: number): OrderRecord {
  o.paidAt = now.toISOString();
  o.status = "queued";
  o.dueDate ??= addBusinessDays(localDateString(now, timeZone), draftDays);
  log(o, now, "Payment received, added to the writing schedule");
  return o;
}

export function setStatus(o: OrderRecord, status: Status, now: Date, what = `Moved to "${statuses[status]}"`): OrderRecord {
  o.status = status;
  if (status === "delivered") o.deliveredAt = now.toISOString();
  log(o, now, what);
  return o;
}

export function addFiles(o: { files: FileRef[] }, files: FileRef[]) {
  o.files.push(...files);
}

/** Orders for one tab. The writing schedule (queued, in progress) is soonest due first; the rest newest first. */
export function inView(orders: OrderRecord[], view: (typeof views)[number]): OrderRecord[] {
  const list = orders.filter((o) => (view.statuses as readonly Status[]).includes(o.status));
  if (view.id === "queued" || view.id === "present") {
    return list.sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || a.createdAt.localeCompare(b.createdAt));
  }
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listOrders(s: Store): Promise<OrderRecord[]> {
  const keys = await s.listKeys("order/");
  const all = await Promise.all(keys.map((k) => s.getJSON<OrderRecord>(k)));
  return all.filter((o): o is OrderRecord => Boolean(o));
}

export async function listMessages(s: Store): Promise<MessageRecord[]> {
  const keys = await s.listKeys("message/");
  const all = await Promise.all(keys.map((k) => s.getJSON<MessageRecord>(k)));
  return all.filter((m): m is MessageRecord => Boolean(m)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Saves an uploaded file and returns the reference kept on the record. */
export async function saveFile(s: Store, id: string, file: File, label: string, now: Date): Promise<FileRef> {
  const key = fileKey(id, file.name, now);
  await s.setFile(key, { data: await file.arrayBuffer(), type: file.type || "application/octet-stream", filename: safeName(file.name) });
  return { key, filename: safeName(file.name), type: file.type || "application/octet-stream", label, at: now.toISOString() };
}

export const formatDay = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });

export const formatStamp = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone });
