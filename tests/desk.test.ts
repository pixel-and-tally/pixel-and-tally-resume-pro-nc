import { describe, expect, it } from "vitest";
import { agenda, clients, matches, morningDigest, numbers } from "../src/lib/desk";
import type { Email, SendConfig } from "../src/lib/mail";
import { runMorning } from "../src/lib/morning";
import { listOrders, markPaid, messageKey, orderKey, setStatus, type MessageRecord, type OrderRecord } from "../src/lib/records";
import { memoryStore } from "../src/lib/store";

const now = new Date("2026-11-20T14:00:00Z"); // Friday 9 AM Eastern
const day = (iso: string) => new Date(`${iso}T15:00:00Z`);

function order(id: string, createdAt: string, extra: Partial<OrderRecord> = {}): OrderRecord {
  return {
    id,
    createdAt: day(createdAt).toISOString(),
    status: "awaiting-payment",
    name: `Client ${id}`,
    email: `${id}@example.com`,
    phone: "704-555-0100",
    address: { street: "", city: "", state: "", zip: "" },
    linkedin: "",
    careerChange: "",
    rush: "",
    lines: [{ name: "Professional Resume", price: 395 }],
    total: 395,
    answers: {},
    jobs: [],
    postings: [],
    files: [],
    notes: "",
    draftCount: 0,
    log: [{ at: day(createdAt).toISOString(), what: "Questionnaire and order received" }],
    ...extra,
  };
}

function message(id: string, kind: MessageRecord["kind"], createdAt: string, extra: Partial<MessageRecord> = {}): MessageRecord {
  return { id, kind, createdAt: day(createdAt).toISOString(), name: `Person ${id}`, email: `${id}@example.com`, phone: "", subject: "", body: "Hi", callAt: "", target: "", files: [], notes: "", handled: false, ...extra };
}

describe("Today list", () => {
  it("puts overdue drafts first and leaves far-off work out", () => {
    const late = markPaid(order("late", "2026-11-05"), day("2026-11-06"), 7);
    late.dueDate = "2026-11-18";
    const dueToday = { ...markPaid(order("today", "2026-11-10"), day("2026-11-10"), 7), dueDate: "2026-11-20" };
    const far = { ...markPaid(order("far", "2026-11-19"), day("2026-11-19"), 7), dueDate: "2026-12-01" };
    const tasks = agenda([far, dueToday, late], [], now);
    expect(tasks.map((t) => t.tone)).toEqual(["late", "today"]);
    expect(tasks[0].title).toBe("Send Client late's first draft");
  });

  it("flags unpaid orders after a few days and draft silence", () => {
    const unpaid = order("unpaid", "2026-11-16");
    const fresh = order("fresh", "2026-11-19");
    const drafted = order("drafted", "2026-11-01", { status: "draft-sent", draftCount: 1 });
    drafted.log.push({ at: day("2026-11-14").toISOString(), what: "Emailed draft 1" });
    const tasks = agenda([unpaid, fresh, drafted], [], now);
    expect(tasks.map((t) => t.title)).toEqual(["Check in on Client unpaid's payment", "Check in with Client drafted about the draft"]);
    expect(tasks[0].text).toContain("Nancy");
  });

  it("suggests a personal check-in a month after delivery, once", () => {
    const done = setStatus(order("done", "2026-10-01"), "delivered", day("2026-10-15"));
    expect(agenda([done], [], now)[0].title).toBe("See how Client's job search is going");
    expect(agenda([{ ...done, followedUpAt: now.toISOString() }], [], now)).toEqual([]);
  });

  it("lists unhandled messages and call requests", () => {
    const tasks = agenda([], [message("a", "call", "2026-11-20", { callAt: "Monday at 10 AM" }), message("b", "message", "2026-11-18"), message("c", "review", "2026-11-20", { handled: true })], now);
    expect(tasks.map((t) => [t.tone, t.title])).toEqual([
      ["late", "Reply to Person b"],
      ["today", "Confirm a call with Person a"],
    ]);
  });
});

describe("numbers and clients", () => {
  it("counts this month only", () => {
    const paid = markPaid(order("p", "2026-11-02"), day("2026-11-03"), 7);
    const old = markPaid(order("o", "2026-10-02"), day("2026-10-03"), 7);
    const unpaid = order("u", "2026-11-10");
    expect(numbers([paid, old, unpaid], now)).toEqual({ paidThisMonth: 395, ordersThisMonth: 2, unpaidTotal: 395, onSchedule: 2, deliveredThisMonth: 0 });
  });

  it("groups orders and messages by email and searches them", () => {
    const o = markPaid(order("sam", "2026-11-10", { email: "Sam@Example.com", name: "Sam Lee" }), day("2026-11-11"), 7);
    const m = message("x", "call", "2026-11-05", { email: "sam@example.com", name: "Sam", phone: "(704) 555-0199" });
    const [c, ...rest] = clients([o], [m, message("y", "message", "2026-11-01")]);
    expect(rest).toHaveLength(1);
    expect(c.name).toBe("Sam Lee");
    expect(c.orders).toHaveLength(1);
    expect(c.messages).toHaveLength(1);
    expect(c.spent).toBe(395);
    expect(matches(c, "lee")).toBe(true);
    expect(matches(c, "professional")).toBe(true);
    expect(matches(c, "704-555-0100")).toBe(true);
    expect(matches(c, "zzz")).toBe(false);
  });

  it("writes a morning email without em dashes", () => {
    const d = morningDigest(agenda([order("u", "2026-11-10")], [], now), numbers([], now), "https://x.netlify.app/admin/", now);
    expect(d.subject).toBe("Your day: 1 coming up");
    expect(d.text).toContain("Friday, November 20");
    expect(d.text).not.toContain("—");
  });
});

describe("morning run", () => {
  const cfg: SendConfig = { apiKey: "k", to: "nancy@example.com", from: "site@example.com" };

  it("sends one payment reminder per unpaid order, then Nancy's email", async () => {
    const s = memoryStore();
    await s.setJSON(orderKey("old"), order("old", "2026-11-16"));
    await s.setJSON(orderKey("new"), order("new", "2026-11-19"));
    await s.setJSON(messageKey("m"), message("m", "message", "2026-11-20"));
    const sent: { to: string; email: Email }[] = [];
    const opts = { store: s, mail: cfg, now, siteUrl: "https://www.resumepronc.com", dashboardUrl: "https://x/admin/", paypalEmail: "nancy@resumepronc.com", nancy: "nancy@example.com", autoReminderDays: 3, send: async (email: Email, _c: SendConfig, to: string) => void sent.push({ to, email }) };

    const r = await runMorning(opts);
    expect(r.reminders).toBe(1);
    expect(sent.map((x) => x.to)).toEqual(["old@example.com", "nancy@example.com"]);
    expect(sent[0].email.text).toContain("paypal.com");
    expect(sent[1].email.text).toContain("1 automatic payment reminder");
    const saved = (await listOrders(s)).find((o) => o.id === "old")!;
    expect(saved.autoReminderAt).toBeTruthy();
    expect(saved.log.at(-1)?.what).toBe("Automatic payment reminder emailed");

    sent.length = 0;
    await runMorning(opts);
    expect(sent.map((x) => x.to)).toEqual(["nancy@example.com"]);
  });

  it("does nothing without email set up, and skips reminders when turned off", async () => {
    const s = memoryStore();
    await s.setJSON(orderKey("old"), order("old", "2026-11-01"));
    const sent: string[] = [];
    const base = { store: s, now, siteUrl: "", dashboardUrl: "", paypalEmail: "", nancy: "n@example.com", send: async (_e: Email, _c: SendConfig, to: string) => void sent.push(to) };
    expect((await runMorning({ ...base, mail: { ...cfg, apiKey: "" }, autoReminderDays: 3 })).digest).toBe(false);
    await runMorning({ ...base, mail: cfg, autoReminderDays: 0 });
    expect(sent).toEqual(["nancy@example.com"]);
  });
});
