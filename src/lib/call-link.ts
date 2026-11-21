// A signed link that opens a call request straight in Nancy's phone calendar.
// Tapping an .ics link on an iPhone (or Android) offers "Add to Calendar" in the
// phone's own calendar app, whichever mail app she reads the email in.
import { createHmac, timingSafeEqual } from "node:crypto";
import { authConfig } from "./auth";

const sign = (secret: string, data: string) => createHmac("sha256", secret).update(`call-ics:${data}`).digest("base64url").slice(0, 32);
const payload = (id: string, date: string, time: string) => `${id}|${date}|${time}`;

export function callIcsUrl(siteUrl: string, id: string, date: string, time: string, secret = authConfig().secret): string {
  if (!id || !date || !time || !secret) return "";
  const q = new URLSearchParams({ id, d: date, t: time, s: sign(secret, payload(id, date, time)) });
  return `${siteUrl}/api/call.ics?${q}`;
}

export function validCallLink(id: string, date: string, time: string, sig: string, secret = authConfig().secret): boolean {
  if (!id || !date || !time || !sig || !secret) return false;
  const want = Buffer.from(sign(secret, payload(id, date, time)));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}
