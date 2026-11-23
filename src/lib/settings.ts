// Nancy's settings: the everyday facts she can change herself from the
// dashboard (Settings) without a code change: phone numbers, email, where form
// notes go, call hours, prices, turnaround, payment and review links, the
// morning email and her password.
//
// src/site.ts holds the starting values. What Nancy saves lives in the store
// (Workers KV) under "settings", and apply() lays it over the site.ts objects at
// the start of every request (src/middleware.ts) and before the morning run
// (src/worker.ts), so pages and emails read the current values as usual.
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { availability, services, site } from "../site";
import { store as getStore, type Store } from "./store";

export const days = [
  { n: 1, name: "Monday" },
  { n: 2, name: "Tuesday" },
  { n: 3, name: "Wednesday" },
  { n: 4, name: "Thursday" },
  { n: 5, name: "Friday" },
  { n: 6, name: "Saturday" },
  { n: 0, name: "Sunday" },
] as const;

export type Hours = Record<string, { from: string; to: string }>;

export type Settings = {
  email: string;
  phones: { label: string; number: string }[];
  /** Where form notes and the morning email go. Empty = the CONTACT_TO_EMAIL secret. */
  notifyEmail: string;
  hours: Hours;
  prices: Record<string, number>;
  turnaround: string;
  draftDays: number;
  revisionWindowDays: number;
  paypalEmail: string;
  reviewRequestUrl: string;
  googleReviewsUrl: string;
  morningEmail: boolean;
  autoPaymentReminderDays: number;
};

const hoursOf = (weekly: typeof availability.weekly): Hours =>
  Object.fromEntries(Object.entries(weekly).flatMap(([d, spans]) => (spans?.[0] ? [[d, { from: spans[0][0], to: spans[0][1] }]] : [])));

/** The site.ts values, captured before any request changes them. */
export const defaults: Settings = structuredClone({
  email: site.email,
  phones: site.phones.map((p) => ({ label: p.label, number: p.number })),
  notifyEmail: site.notifyEmail,
  hours: hoursOf(availability.weekly),
  prices: Object.fromEntries(services.map((s) => [s.id, s.price])),
  turnaround: site.turnaround,
  draftDays: site.draftDays,
  revisionWindowDays: site.revisionWindowDays,
  paypalEmail: site.paypalEmail,
  reviewRequestUrl: site.reviewRequestUrl,
  googleReviewsUrl: site.googleReviewsUrl,
  morningEmail: site.morningEmail,
  autoPaymentReminderDays: site.autoPaymentReminderDays,
});

/** Lays saved settings over site.ts. Safe to call on every request. */
export function apply(saved: Partial<Settings>): Settings {
  const s: Settings = { ...defaults, ...saved, prices: { ...defaults.prices, ...saved.prices } };
  Object.assign(site as Record<string, unknown>, {
    email: s.email,
    phones: s.phones,
    notifyEmail: s.notifyEmail,
    turnaround: s.turnaround,
    draftDays: s.draftDays,
    revisionWindowDays: s.revisionWindowDays,
    paypalEmail: s.paypalEmail,
    reviewRequestUrl: s.reviewRequestUrl,
    googleReviewsUrl: s.googleReviewsUrl,
    morningEmail: s.morningEmail,
    autoPaymentReminderDays: s.autoPaymentReminderDays,
  });
  for (const service of services) service.price = s.prices[service.id] ?? service.price;
  availability.weekly = Object.fromEntries(Object.entries(s.hours).map(([d, h]) => [d, [[h.from, h.to] as const]])) as typeof availability.weekly;
  return s;
}

// One KV read per Worker instance every 30 seconds keeps page views cheap.
const TTL = 30_000;
let cache: { at: number; value: Settings } | undefined;

export async function loadSettings(s: Store = getStore(), now = Date.now(), fresh = false): Promise<Settings> {
  if (cache && !fresh && now - cache.at < TTL) return cache.value;
  let saved: Partial<Settings> = {};
  try {
    saved = (await s.getJSON<Partial<Settings>>("settings")) ?? {};
  } catch (err) {
    console.error("Settings: read failed, using site.ts", err);
  }
  cache = { at: now, value: apply(saved) };
  return cache.value;
}

export async function saveSettings(value: Settings, s: Store = getStore()) {
  await s.setJSON("settings", value);
  cache = { at: Date.now(), value: apply(value) };
}

// Password Nancy sets in Settings. Kept as a scrypt hash; it wins over ADMIN_PASSWORD.
export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  return `scrypt$${salt}$${scryptSync(password, salt, 32).toString("hex")}`;
}

export function verifyHash(password: string, stored: string) {
  const [kind, salt, hash] = stored.split("$");
  if (kind !== "scrypt" || !salt || !hash || !password) return false;
  const want = Buffer.from(hash, "hex");
  const got = scryptSync(password, salt, want.length);
  return want.length === got.length && timingSafeEqual(want, got);
}

export async function savedPasswordHash(s: Store = getStore()): Promise<string> {
  try {
    return (await s.getJSON<{ hash: string }>("settings:password"))?.hash ?? "";
  } catch (err) {
    console.error("Settings: password read failed, using ADMIN_PASSWORD", err);
    return "";
  }
}

export async function setPassword(password: string, s: Store = getStore()) {
  await s.setJSON("settings:password", { hash: hashPassword(password), changedAt: new Date().toISOString() });
}

export function checkNewPassword(next: string, confirm: string): string {
  if (next.length < 10) return "Use at least 10 characters.";
  if (next !== confirm) return "The two new passwords don't match.";
  return "";
}

// Form checks, shared by the Settings page and the tests.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[\d\s().+-]{10,}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const URL_OK = /^https:\/\/\S+$/;

export type SettingsErrors = Record<string, string>;

const field = (form: FormData, key: string, max = 300) => String(form.get(key) ?? "").trim().slice(0, max);

export const phoneSlots = 3;

export function parseSettings(form: FormData): { ok: true; settings: Settings } | { ok: false; errors: SettingsErrors } {
  const errors: SettingsErrors = {};

  const email = field(form, "email");
  if (email && !EMAIL.test(email)) errors.email = "Enter an email address, like you@example.com.";
  const notifyEmail = field(form, "notifyEmail", 500);
  if (notifyEmail && !notifyEmail.split(",").every((e) => EMAIL.test(e.trim()))) errors.notifyEmail = "Enter one or more email addresses, separated by commas.";

  const phones: Settings["phones"] = [];
  for (let i = 0; i < phoneSlots; i++) {
    const number = field(form, `phone-${i}`);
    const label = field(form, `phoneLabel-${i}`, 60);
    if (!number && !label) continue;
    if (!PHONE.test(number)) errors[`phone-${i}`] = "Enter a phone number with area code, like 704-555-0123.";
    else phones.push({ label, number });
  }

  const hours: Hours = {};
  for (const d of days) {
    const from = field(form, `from-${d.n}`);
    const to = field(form, `to-${d.n}`);
    if (!from && !to) continue;
    if (!TIME.test(from) || !TIME.test(to) || from >= to) errors[`from-${d.n}`] = `Give ${d.name} a start time before the end time, or clear both for no calls.`;
    else hours[d.n] = { from, to };
  }

  const prices: Record<string, number> = {};
  for (const s of services) {
    const raw = field(form, `price-${s.id}`).replace(/[$,\s]/g, "");
    const n = Number(raw);
    if (!raw || !Number.isFinite(n) || n < 0 || n > 10000) errors[`price-${s.id}`] = "Enter a price in dollars, like 395.";
    else prices[s.id] = Math.round(n * 100) / 100;
  }

  const turnaround = field(form, "turnaround", 80);
  if (!turnaround) errors.turnaround = "Say how long a first draft usually takes, like 5 to 7 business days.";
  const whole = (key: string, min: number, max: number, msg: string) => {
    const raw = field(form, key);
    const n = Number(raw);
    if (!/^\d+$/.test(raw) || n < min || n > max) {
      errors[key] = msg;
      return min;
    }
    return n;
  };
  const draftDays = whole("draftDays", 1, 60, "Enter a number of business days, from 1 to 60.");
  const revisionWindowDays = whole("revisionWindowDays", 0, 365, "Enter a number of days, from 0 to 365.");
  const autoPaymentReminderDays = whole("autoPaymentReminderDays", 0, 30, "Enter a number of days from 1 to 30, or 0 for no reminder.");

  const paypalEmail = field(form, "paypalEmail");
  if (paypalEmail && !EMAIL.test(paypalEmail)) errors.paypalEmail = "Enter the email address of your PayPal account.";
  const reviewRequestUrl = field(form, "reviewRequestUrl", 1000);
  if (reviewRequestUrl && !URL_OK.test(reviewRequestUrl)) errors.reviewRequestUrl = "Paste the full link, starting with https://.";
  const googleReviewsUrl = field(form, "googleReviewsUrl", 1000);
  if (googleReviewsUrl && !URL_OK.test(googleReviewsUrl)) errors.googleReviewsUrl = "Paste the full link, starting with https://.";

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    settings: {
      email,
      phones,
      notifyEmail,
      hours,
      prices,
      turnaround,
      draftDays,
      revisionWindowDays,
      paypalEmail,
      reviewRequestUrl,
      googleReviewsUrl,
      morningEmail: form.get("morningEmail") === "on",
      autoPaymentReminderDays,
    },
  };
}
