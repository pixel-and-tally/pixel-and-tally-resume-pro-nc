import { callIcsUrl } from "../../lib/call-link";
import { contactReceived } from "../../lib/client-mail";
import { formEndpoint } from "../../lib/endpoint";
import { parseContact } from "../../lib/forms";
import { callLabel, contactEmail } from "../../lib/mail";
import { messageFromContact, messageKey, newId } from "../../lib/records";
import { store } from "../../lib/store";
import { availability, site } from "../../site";

// Runs as a Netlify function; every other page is static HTML.
export const prerender = false;

export const POST = formEndpoint({
  page: "/contact/",
  parse: (form) => parseContact(form, availability, new Date()),
  save: async (v, now) => {
    const id = newId(now);
    await store().setJSON(messageKey(id), messageFromContact(v, id, now, callLabel(v)));
    return { id, path: `/admin/messages/${id}/` };
  },
  emails: async (v, cfg, link) => {
    const id = link.match(/messages\/([^/]+)\//)?.[1] ?? "";
    // Same address the form was sent to, so the link works before the domain moves too.
    const origin = link ? new URL(link).origin : site.url;
    const calendar = v.callDate ? callIcsUrl(origin, id, v.callDate, v.callTime) : "";
    return [
      { email: contactEmail(v, availability, new Date(), link, calendar) },
      // "Got it, I'll confirm": if it fails, Nancy still has the message.
      { email: contactReceived(v.name, callLabel(v), cfg.to), to: v.email, optional: true },
    ];
  },
  thanks: (v) => (v.callDate ? "/thanks/?form=call" : "/thanks/?form=contact"),
});
