import { formEndpoint } from "../../lib/endpoint";
import { parseContact } from "../../lib/forms";
import { callLabel, contactEmail } from "../../lib/mail";
import { messageFromContact, messageKey, newId } from "../../lib/records";
import { store } from "../../lib/store";
import { availability } from "../../site";

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
  emails: async (v, _cfg, link) => [{ email: contactEmail(v, availability, new Date(), link) }],
  thanks: (v) => (v.callDate ? "/thanks/?form=call" : "/thanks/?form=contact"),
});
