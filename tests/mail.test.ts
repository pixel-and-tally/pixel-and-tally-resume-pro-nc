import { describe, expect, it, vi } from "vitest";
import { contactEmail, orderEmail, orderReceipt, send } from "../src/lib/mail";
import { parseOrder } from "../src/lib/forms";
import type { Availability } from "../src/lib/schedule";
import { services } from "../src/site";

const cfg: Availability = { timeZone: "America/New_York", callMinutes: 30, stepMinutes: 30, noticeHours: 18, daysAhead: 7, weekly: { 1: [["09:00", "12:00"]] } };
const now = new Date("2026-10-18T13:00:00Z");

describe("emails", () => {
  it("attaches a calendar file to a call request", () => {
    const e = contactEmail(
      { name: "Sam", email: "sam@example.com", phone: "704-555-0123", subject: "", message: "", callDate: "2026-10-19", callTime: "10:00" },
      cfg,
      now,
    );
    expect(e.subject).toContain("Monday, October 19 at 10 AM Eastern");
    expect(e.attachments?.[0].filename).toBe("consultation.ics");
    expect(e.replyTo).toBe("sam@example.com");
  });

  it("puts the order, answers and resume in the order email, and a receipt for the client", async () => {
    const f = new FormData();
    Object.entries({ name: "Sam Lee", email: "sam@example.com", street: "12 Main St", city: "Belmont", state: "NC", zip: "28012", objective: "Ops manager", resumeLevel: "entry", achievements: "Cut costs 15%" }).forEach(([k, v]) => f.set(k, v));
    f.set("resume", new File(["hello"], "Sam Resume.pdf"));
    const r = parseOrder(f, services);
    if (!r.ok) throw new Error("expected a valid order");
    const e = await orderEmail(r.value);
    expect(e.subject).toBe("New order: Sam Lee, $295");
    expect(e.text).toContain("Cut costs 15%");
    expect(e.attachments?.[0]).toMatchObject({ filename: "Sam Resume.pdf", content: Buffer.from("hello").toString("base64") });
    expect(orderReceipt(r.value, "nancy@example.com", "").text).toContain("I'll email you an invoice");
  });

  it("sends through Resend and throws on failure", async () => {
    const ok = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    await send({ subject: "s", text: "t", replyTo: "a@b.co" }, { apiKey: "k", to: "n@x.co", from: "f@x.co" }, undefined, ok);
    expect(JSON.parse(ok.mock.calls[0][1].body)).toMatchObject({ to: ["n@x.co"], reply_to: "a@b.co" });
    const bad = vi.fn().mockResolvedValue(new Response("nope", { status: 500 }));
    await expect(send({ subject: "s", text: "t", replyTo: "a@b.co" }, { apiKey: "k", to: "n", from: "f" }, undefined, bad)).rejects.toThrow("500");
  });
});
