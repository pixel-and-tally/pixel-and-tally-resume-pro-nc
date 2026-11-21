import { describe, expect, it } from "vitest";
import { honeypotField, maxUploadBytes, parseContact, parseOrder, parseReview } from "../src/lib/forms";
import type { Availability } from "../src/lib/schedule";
import { services } from "../src/site";

const cfg: Availability = { timeZone: "America/New_York", callMinutes: 30, stepMinutes: 30, noticeHours: 18, daysAhead: 7, weekly: { 1: [["09:00", "12:00"]] } };
const now = new Date("2026-10-18T13:00:00Z"); // Sunday 9 AM Eastern

const form = (fields: Record<string, string | string[] | File>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (Array.isArray(v)) v.forEach((x) => f.append(k, x));
    else f.set(k, v);
  }
  return f;
};
const pdf = (bytes = 10) => new File([new Uint8Array(bytes)], "resume.pdf", { type: "application/pdf" });

describe("parseContact", () => {
  const base = { name: "Sam Lee", email: "sam@example.com", message: "Do you write federal resumes?" };
  it("accepts a message", () => expect(parseContact(form(base), cfg, now).ok).toBe(true));
  it("always needs a message with some background", () => {
    expect(parseContact(form({ ...base, message: "" }), cfg, now)).toMatchObject({ invalid: ["message"] });
    expect(parseContact(form({ ...base, message: "Call pls" }), cfg, now)).toMatchObject({ invalid: ["message"] });
  });
  it("needs an open time and a phone number for a call", () => {
    const call = { ...base, callDate: "2026-10-19", callTime: "10:00" };
    expect(parseContact(form(call), cfg, now)).toMatchObject({ invalid: ["phone"] });
    expect(parseContact(form({ ...call, phone: "704-555-0123", message: "" }), cfg, now)).toMatchObject({ invalid: ["message"] });
    expect(parseContact(form({ ...call, phone: "704-555-0123" }), cfg, now).ok).toBe(true);
    expect(parseContact(form({ ...call, phone: "704-555-0123", callTime: "15:00" }), cfg, now)).toMatchObject({ invalid: ["callTime"] });
  });
  it("treats the honeypot as spam", () => {
    expect(parseContact(form({ ...base, [honeypotField]: "x" }), cfg, now)).toEqual({ ok: false, spam: true });
  });
});

describe("parseReview", () => {
  it("needs a resume file of an allowed type and size", () => {
    const base = { name: "Sam", email: "sam@example.com" };
    expect(parseReview(form(base))).toMatchObject({ invalid: ["resume"] });
    expect(parseReview(form({ ...base, resume: new File(["x"], "a.exe") }))).toMatchObject({ invalid: ["resume"] });
    expect(parseReview(form({ ...base, resume: pdf(maxUploadBytes + 1) }))).toMatchObject({ invalid: ["resume"] });
    expect(parseReview(form({ ...base, resume: pdf() })).ok).toBe(true);
  });
});

describe("parseOrder", () => {
  const base = { name: "Sam Lee", email: "sam@example.com", street: "12 Main St", city: "Belmont", state: "NC", zip: "28012", objective: "Operations manager", resumeLevel: "management" };
  it("prices a valid order and keeps filled jobs in order", () => {
    const r = parseOrder(form({ ...base, addons: ["cover-letter"], job1: "Acme, 2020 to now", job3: "Old job" }), services);
    expect(r.ok && r.value.priced.total).toBe(550);
    expect(r.ok && r.value.jobs).toEqual(["Acme, 2020 to now", "Old job"]);
  });
  it("lists every missing field", () => {
    const r = parseOrder(form({ name: "", email: "nope", resumeLevel: "" }), services);
    expect(r).toMatchObject({ invalid: ["name", "email", "services", "street", "city", "state", "zip", "objective"] });
  });
});
