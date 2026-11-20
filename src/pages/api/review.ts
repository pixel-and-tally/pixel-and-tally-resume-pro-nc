import { formEndpoint } from "../../lib/endpoint";
import { parseReview } from "../../lib/forms";
import { reviewEmail } from "../../lib/mail";

export const prerender = false;

export const POST = formEndpoint({
  page: "/free-resume-review/",
  parse: parseReview,
  emails: async (v) => [{ email: await reviewEmail(v) }],
  thanks: () => "/thanks/?form=review",
});
