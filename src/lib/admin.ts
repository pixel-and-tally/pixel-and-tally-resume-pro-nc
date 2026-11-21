// Shared bits for Nancy's dashboard pages.
import type { AstroCookies } from "astro";
import { authConfig, sessionCookie, validSession } from "./auth";

export const isAdmin = (cookies: AstroCookies) => validSession(cookies.get(sessionCookie)?.value, authConfig().secret);

export const fileTypes = [".pdf", ".doc", ".docx"];
export const maxFileBytes = 4 * 1024 * 1024;
/** Kept small (6 MB for both final files) so uploads stay quick and well under Cloudflare's limits. */
export const maxTotalBytes = 5.5 * 1024 * 1024;

/** A file from the form, or why it can't be used. */
export function pickFile(form: FormData, key: string, exts: string[] = fileTypes): { file: File | null; bad: boolean } {
  const f = form.get(key);
  if (!(f instanceof File) || f.size === 0) return { file: null, bad: false };
  const okType = exts.some((e) => f.name.toLowerCase().endsWith(e));
  return { file: f, bad: !okType || f.size > maxFileBytes };
}

export async function toBase64(data: ArrayBuffer) {
  return Buffer.from(data).toString("base64");
}

export const telLink = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;
export const smsLink = (phone: string, body = "") => `sms:${phone.replace(/[^\d+]/g, "")}${body ? `?&body=${encodeURIComponent(body)}` : ""}`;
