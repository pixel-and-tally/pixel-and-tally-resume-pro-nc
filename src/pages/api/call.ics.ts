import type { APIContext } from "astro";
import { validCallLink } from "../../lib/call-link";
import { messageKey, type MessageRecord } from "../../lib/records";
import { buildCallIcs } from "../../lib/schedule";
import { store } from "../../lib/store";
import { availability } from "../../site";

export const prerender = false;

// GET /api/call.ics?id=...&d=YYYY-MM-DD&t=HH:MM&s=signature, from the link in Nancy's call request email.
export async function GET({ url }: APIContext) {
  const id = url.searchParams.get("id") ?? "";
  const date = url.searchParams.get("d") ?? "";
  const time = url.searchParams.get("t") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time) || !validCallLink(id, date, time, url.searchParams.get("s") ?? "")) {
    return new Response("This calendar link isn't valid.", { status: 404 });
  }
  let m: MessageRecord | null = null;
  try {
    m = await store().getJSON<MessageRecord>(messageKey(id));
  } catch {
    // Still give her the event, just without the details.
  }
  const ics = buildCallIcs(
    {
      uid: `${id}@resumepronc.com`,
      date,
      time,
      summary: `Free phone consultation${m ? `: ${m.name}` : ""}`,
      description: m ? `Call ${m.phone}\n${m.email}\n\n${m.body}` : "Free phone consultation from the website.",
    },
    availability,
    new Date(),
  );
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="consultation.ics"',
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
