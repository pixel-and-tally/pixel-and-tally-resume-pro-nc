import { formEndpoint } from "../../lib/endpoint";
import { parseReview } from "../../lib/forms";
import { reviewEmail } from "../../lib/mail";
import { messageFromReview, messageKey, newId, saveFile } from "../../lib/records";
import { store } from "../../lib/store";

export const prerender = false;

export const POST = formEndpoint({
  page: "/free-resume-review/",
  parse: parseReview,
  save: async (v, now) => {
    const s = store();
    const id = newId(now);
    const resume = await saveFile(s, id, v.resume, "Resume to review", now);
    await s.setJSON(messageKey(id), messageFromReview(v, id, now, resume));
    return `/admin/messages/${id}/`;
  },
  emails: async (v, _cfg, link) => [{ email: await reviewEmail(v, link) }],
  thanks: () => "/thanks/?form=review",
});
