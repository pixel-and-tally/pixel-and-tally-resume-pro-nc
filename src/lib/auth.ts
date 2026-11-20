// Nancy's login: one password (env ADMIN_PASSWORD), checked on the server, and a
// signed cookie that lasts two weeks. Changing the password signs everyone out.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const sessionCookie = "rpn_admin";
export const sessionDays = 14;

const sha = (s: string) => createHash("sha256").update(s).digest();
const sign = (secret: string, data: string) => createHmac("sha256", secret).update(data).digest("base64url");

export const authConfig = () => {
  const password = process.env.ADMIN_PASSWORD ?? "";
  return { password, secret: process.env.SESSION_SECRET || (password ? `rpn-session:${password}` : "") };
};

/** Constant-time check. An unset password never matches. */
export function passwordMatches(given: string, expected: string): boolean {
  if (!expected) return false;
  return timingSafeEqual(sha(given), sha(expected));
}

export function createSession(secret: string, now = Date.now()): string {
  const exp = String(now + sessionDays * 86_400_000);
  return `${exp}.${sign(secret, exp)}`;
}

export function validSession(token: string | undefined, secret: string, now = Date.now()): boolean {
  if (!token || !secret) return false;
  const [exp, mac] = token.split(".");
  if (!exp || !mac || !/^\d+$/.test(exp) || Number(exp) < now) return false;
  const want = Buffer.from(sign(secret, exp));
  const got = Buffer.from(mac);
  return want.length === got.length && timingSafeEqual(want, got);
}

/** Blocks form posts from other sites (the cookie is SameSite=Strict too). */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
