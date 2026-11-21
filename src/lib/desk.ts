// Nancy's "Today" list and her clients, worked out from the saved orders and
// messages. Pure functions, so the dashboard page, the morning email and the
// tests all agree on what needs her attention.
import { money } from "./order";
import { addBusinessDays, formatDay, type MessageRecord, type OrderRecord } from "./records";
import { localDateString } from "./schedule";

export const deskTimeZone = "America/New_York";

/** When something counts as "waiting too long". Business days unless noted. */
export const deskRules = {
  /** Draft due within this many business days shows as "coming up". */
  dueSoonDays: 2,
  /** Unpaid this many calendar days: worth a nudge. */
  unpaidDays: 3,
  /** Draft with the client this many calendar days with no update: check in. */
  draftQuietDays: 4,
  /** Delivered this many calendar days ago: a personal "how's the search going?" */
  followUpAfterDays: 30,
  /** Stop suggesting the follow-up after this many days. */
  followUpUntilDays: 75,
};

export type Tone = "late" | "today" | "soon" | "later";
export type Task = {
  tone: Tone;
  /** Short, starts with what to do. */
  title: string;
  detail: string;
  href: string;
  name: string;
  phone: string;
  /** What a one-tap text says, when a text is the natural next step. */
  text?: string;
};

const toneOrder: Record<Tone, number> = { late: 0, today: 1, soon: 2, later: 3 };
const dayOf = (iso: string) => localDateString(new Date(iso), deskTimeZone);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
const first = (name: string) => name.trim().split(/\s+/)[0] || name;
const items = (o: OrderRecord) => o.lines.map((l) => l.name).join(", ");
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** When the latest draft went out, from the order history. */
export function lastDraftAt(o: OrderRecord): string | undefined {
  return [...o.log].reverse().find((l) => /draft/i.test(l.what) && /emailed/i.test(l.what))?.at;
}

/** Everything that needs Nancy, most urgent first. */
export function agenda(orders: OrderRecord[], messages: MessageRecord[], now: Date): Task[] {
  const today = localDateString(now, deskTimeZone);
  const soon = addBusinessDays(today, deskRules.dueSoonDays);
  const tasks: Task[] = [];
  const add = (t: Task) => tasks.push(t);

  for (const m of messages) {
    if (m.handled) continue;
    const base = { href: `/admin/messages/${m.id}/`, name: m.name, phone: m.phone };
    const waited = daysBetween(dayOf(m.createdAt), today);
    const since = waited <= 0 ? "came in today" : `waiting ${plural(waited, "day")}`;
    if (m.kind === "call") add({ ...base, tone: "today", title: `Confirm a call with ${m.name}`, detail: `Asked for ${m.callAt}. Not confirmed until you reply (${since}).` });
    else if (m.kind === "review") add({ ...base, tone: waited >= 2 ? "late" : "today", title: `Review ${first(m.name)}'s resume`, detail: `Free resume review${m.target ? ` for ${m.target}` : ""}, ${since}.` });
    else add({ ...base, tone: waited >= 1 ? "late" : "today", title: `Reply to ${m.name}`, detail: `${m.subject || "Website message"}, ${since}.` });
  }

  for (const o of orders) {
    const base = { href: `/admin/orders/${o.id}/`, name: o.name, phone: o.phone };
    const rush = o.rush ? ` Rush: ${o.rush}.` : "";
    if ((o.status === "queued" || o.status === "writing") && o.dueDate) {
      const what = o.draftCount ? `revised draft ${o.draftCount + 1}` : "first draft";
      if (o.dueDate < today) add({ ...base, tone: "late", title: `Send ${o.name}'s ${what}`, detail: `Was due ${formatDay(o.dueDate)}. ${items(o)}.${rush}` });
      else if (o.dueDate === today) add({ ...base, tone: "today", title: `Send ${o.name}'s ${what}`, detail: `Due today. ${items(o)}.${rush}` });
      else if (o.dueDate <= soon || o.rush) add({ ...base, tone: "soon", title: `Write ${o.name}'s ${what}`, detail: `Due ${formatDay(o.dueDate)}. ${items(o)}.${rush}` });
    } else if (o.status === "queued" || o.status === "writing") {
      add({ ...base, tone: "soon", title: `Set a due date for ${o.name}`, detail: `Paid, but no draft date yet. ${items(o)}.` });
    }

    if (o.status === "awaiting-payment") {
      const waited = daysBetween(dayOf(o.createdAt), today);
      if (waited >= deskRules.unpaidDays) {
        add({
          ...base,
          tone: "soon",
          title: `Check in on ${o.name}'s payment`,
          detail: `Questionnaire came in ${plural(waited, "day")} ago, ${money(o.total)} not paid yet.${o.autoReminderAt ? " The automatic reminder already went out, so a call or text works best now." : ""}`,
          text: `Hi ${first(o.name)}, it's Nancy with Resume Pro NC. I got your questionnaire, thank you! Just checking whether you had any questions before you check out. Once payment is in, I'll put you on my writing schedule.`,
        });
      }
    }

    if (o.status === "draft-sent") {
      const sent = lastDraftAt(o);
      const quiet = sent ? daysBetween(dayOf(sent), today) : 0;
      if (quiet >= deskRules.draftQuietDays) {
        add({
          ...base,
          tone: "soon",
          title: `Check in with ${o.name} about the draft`,
          detail: `Draft ${o.draftCount} went out ${plural(quiet, "day")} ago with no update since.`,
          text: `Hi ${first(o.name)}, it's Nancy with Resume Pro NC. Just making sure you got your resume draft (it may be in spam). Let me know any changes, or if it's good to go I'll send your final files.`,
        });
      }
    }

    if (o.status === "delivered" && o.deliveredAt && !o.followedUpAt) {
      const since = daysBetween(dayOf(o.deliveredAt), today);
      if (since >= deskRules.followUpAfterDays && since <= deskRules.followUpUntilDays) {
        add({
          ...base,
          tone: "later",
          title: `See how ${first(o.name)}'s job search is going`,
          detail: `Final files went out ${plural(since, "day")} ago. A quick personal note goes a long way.`,
          text: `Hi ${first(o.name)}, it's Nancy with Resume Pro NC. I was thinking about you and wanted to see how the job search is going! Let me know if I can help with anything.`,
        });
      }
    }
  }

  return tasks.sort((a, b) => toneOrder[a.tone] - toneOrder[b.tone]);
}

export type Numbers = {
  paidThisMonth: number;
  ordersThisMonth: number;
  unpaidTotal: number;
  onSchedule: number;
  deliveredThisMonth: number;
};

/** The few numbers worth seeing at a glance, for the current month (Eastern). */
export function numbers(orders: OrderRecord[], now: Date): Numbers {
  const month = localDateString(now, deskTimeZone).slice(0, 7);
  const inMonth = (iso?: string) => Boolean(iso) && dayOf(iso!).slice(0, 7) === month;
  return {
    paidThisMonth: orders.filter((o) => o.status !== "cancelled" && inMonth(o.paidAt)).reduce((s, o) => s + o.total, 0),
    ordersThisMonth: orders.filter((o) => inMonth(o.createdAt)).length,
    unpaidTotal: orders.filter((o) => o.status === "awaiting-payment").reduce((s, o) => s + o.total, 0),
    onSchedule: orders.filter((o) => ["queued", "writing", "draft-sent"].includes(o.status)).length,
    deliveredThisMonth: orders.filter((o) => o.status === "delivered" && inMonth(o.deliveredAt)).length,
  };
}

export type Client = {
  key: string;
  name: string;
  email: string;
  phone: string;
  orders: OrderRecord[];
  messages: MessageRecord[];
  /** Total of paid orders. */
  spent: number;
  lastAt: string;
};

export const clientKey = (email: string) => email.trim().toLowerCase();
export const clientHref = (email: string) => `/admin/clients/${encodeURIComponent(clientKey(email))}/`;

/** Everyone who has ordered or written in, one entry per email address, most recent first. */
export function clients(orders: OrderRecord[], messages: MessageRecord[]): Client[] {
  const by = new Map<string, Client>();
  const get = (email: string, name: string, phone: string, at: string) => {
    const key = clientKey(email);
    let c = by.get(key);
    if (!c) by.set(key, (c = { key, name, email, phone, orders: [], messages: [], spent: 0, lastAt: at }));
    if (at >= c.lastAt) {
      c.lastAt = at;
      c.name = name || c.name;
    }
    c.phone ||= phone;
    return c;
  };
  for (const o of orders) {
    const c = get(o.email, o.name, o.phone, o.createdAt);
    c.orders.push(o);
    if (o.paidAt && o.status !== "cancelled") c.spent += o.total;
  }
  for (const m of messages) get(m.email, m.name, m.phone, m.createdAt).messages.push(m);
  for (const c of by.values()) {
    c.orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    c.messages.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  return [...by.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

/** Matches a search box: name, email, phone digits, or anything they ordered. */
export function matches(c: Client, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const digits = s.replace(/\D/g, "");
  return (
    c.name.toLowerCase().includes(s) ||
    c.email.toLowerCase().includes(s) ||
    (digits.length >= 3 && c.phone.replace(/\D/g, "").includes(digits)) ||
    c.orders.some((o) => o.lines.some((l) => l.name.toLowerCase().includes(s)))
  );
}

/** The morning email to Nancy: what's on her plate today, plain text. */
export function morningDigest(tasks: Task[], n: Numbers, dashboardUrl: string, now: Date) {
  const day = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: deskTimeZone }).format(now);
  const late = tasks.filter((t) => t.tone === "late").length;
  const todayCount = tasks.filter((t) => t.tone === "today").length;
  const headline = tasks.length
    ? [late && `${late} overdue`, todayCount && `${todayCount} for today`, tasks.length - late - todayCount && `${tasks.length - late - todayCount} coming up`].filter(Boolean).join(", ")
    : "nothing urgent";
  const group = (tone: Tone, label: string) => {
    const list = tasks.filter((t) => t.tone === tone);
    return list.length ? [label.toUpperCase(), ...list.map((t) => `- ${t.title}\n  ${t.detail}`), ""] : [];
  };
  const text = [
    `Good morning! Here's your ${day}.`,
    "",
    ...group("late", "Overdue"),
    ...group("today", "Today"),
    ...group("soon", "Coming up"),
    ...group("later", "When you have a minute"),
    ...(tasks.length ? [] : ["Nothing needs you today. Enjoy it!", ""]),
    `This month: ${money(n.paidThisMonth)} paid, ${plural(n.ordersThisMonth, "new order")}, ${n.deliveredThisMonth} delivered. ${plural(n.onSchedule, "client")} on your schedule${n.unpaidTotal ? `, ${money(n.unpaidTotal)} waiting on payment` : ""}.`,
    "",
    `Open your dashboard: ${dashboardUrl}`,
  ].join("\n");
  return { subject: `Your day: ${headline}`, text };
}
