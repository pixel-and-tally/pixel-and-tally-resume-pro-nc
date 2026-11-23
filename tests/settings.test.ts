import { afterEach, describe, expect, it } from "vitest";
import { mailConfig } from "../src/lib/mail";
import { apply, checkNewPassword, defaults, loadSettings, parseSettings, saveSettings, savedPasswordHash, setPassword, verifyHash } from "../src/lib/settings";
import { memoryStore } from "../src/lib/store";
import { availability, faqs, services, site, steps } from "../src/site";

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

const prices = Object.fromEntries(services.map((s) => [`price-${s.id}`, String(s.price)]));
const good: Record<string, string> = {
  email: "nancy@example.com",
  notifyEmail: "inbox@example.com",
  "phone-0": "704-555-0100",
  "phoneLabel-0": "Charlotte, NC",
  "from-1": "09:00",
  "to-1": "15:00",
  ...prices,
  "price-professional": "$425",
  turnaround: "3 to 5 business days",
  draftDays: "5",
  revisionWindowDays: "14",
  paypalEmail: "",
  reviewRequestUrl: "https://g.page/r/example",
  googleReviewsUrl: "",
  autoPaymentReminderDays: "0",
};

afterEach(() => apply({}));

describe("Nancy's settings", () => {
  it("parses a good form", () => {
    const r = parseSettings(form(good));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.settings.prices.professional).toBe(425);
    expect(r.settings.phones).toEqual([{ label: "Charlotte, NC", number: "704-555-0100" }]);
    expect(r.settings.morningEmail).toBe(false);
  });

  it("flags bad fields and saves nothing", () => {
    const r = parseSettings(form({ ...good, email: "x", "phone-1": "12", "price-entry": "", turnaround: "", draftDays: "zero", "from-2": "10:00", reviewRequestUrl: "g.page" }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.errors).sort()).toEqual(["draftDays", "email", "from-2", "phone-1", "price-entry", "reviewRequestUrl", "turnaround"]);
  });

  it("lays saved values over site.ts, copy and emails included, and back again", async () => {
    const store = memoryStore();
    const r = parseSettings(form({ ...good, morningEmail: "on" }));
    if (!r.ok) throw new Error("bad form");
    await saveSettings(r.settings, store);
    expect(services.find((s) => s.id === "professional")?.price).toBe(425);
    expect(site.phones).toHaveLength(1);
    expect(site.paypalEmail).toBe("");
    expect(availability.weekly).toEqual({ 1: [["09:00", "15:00"]] });
    expect(steps.some((s) => s.body.includes("3 to 5 business days"))).toBe(true);
    expect(faqs.some((f) => f.a.includes("14 more days"))).toBe(true);
    expect(faqs.some((f) => f.a.includes("invoice"))).toBe(true);
    expect(mailConfig().to).toBe("inbox@example.com");
    expect((await loadSettings(store, Date.now(), true)).turnaround).toBe("3 to 5 business days");
    apply({});
    expect(services.find((s) => s.id === "professional")?.price).toBe(defaults.prices.professional);
    expect(site.turnaround).toBe(defaults.turnaround);
  });

  it("keeps a new password as a hash", async () => {
    const store = memoryStore();
    expect(await savedPasswordHash(store)).toBe("");
    await setPassword("a-new-password-1", store);
    const hash = await savedPasswordHash(store);
    expect(hash).not.toContain("a-new-password-1");
    expect(verifyHash("a-new-password-1", hash)).toBe(true);
    expect(verifyHash("wrong", hash)).toBe(false);
    expect(checkNewPassword("short", "short")).not.toBe("");
    expect(checkNewPassword("long-enough-1", "long-enough-1")).toBe("");
  });
});
