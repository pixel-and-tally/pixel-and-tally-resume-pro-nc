import { formEndpoint } from "../../lib/endpoint";
import { parseContact } from "../../lib/forms";
import { contactEmail } from "../../lib/mail";
import { availability } from "../../site";

// Runs as a Netlify function; every other page is static HTML.
export const prerender = false;

export const POST = formEndpoint({
  page: "/contact/",
  parse: (form) => parseContact(form, availability, new Date()),
  emails: async (v) => [{ email: contactEmail(v, availability, new Date()) }],
  thanks: (v) => (v.callDate ? "/thanks/?form=call" : "/thanks/?form=contact"),
});
