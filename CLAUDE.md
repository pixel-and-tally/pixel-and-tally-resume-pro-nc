# Resume Pro NC

New site for Resume Pro NC (resumepronc.com), Nancy Turner's resume, LinkedIn and cover letter
writing service. Built by Pixel & Tally as a case study; it replaces a Wix site. The full crawl of
the old site and the rebuild plan: https://claude.ai/artifact/DffaTexyFkzYNM6nd8AM2E

Rule from the rebuild: no feature of the old site may be lost. Look: clean and professional
(Blake, 2026-11-20), "the well-set page": the site is typeset like an excellent resume.

## Stack

- Astro 5 static site, Tailwind 4 (CSS-first tokens in `src/theme.css`), TypeScript strict.
- Netlify free plan (`@astrojs/netlify`, `netlify.toml`). Pages are static; only `src/pages/api/*`
  run as functions. They email Nancy through Resend (env: `RESEND_API_KEY`, `CONTACT_TO_EMAIL`,
  optional `CONTACT_FROM_EMAIL`). Validation lives in `src/lib/forms.ts`, emails in `src/lib/mail.ts`.
- Forms: order (services + questionnaire + resume upload, replaces PayPal buttons + BoomForm),
  free resume review (upload), contact with an optional free phone consultation picker
  (`src/lib/schedule.ts`, ported from Pixel & Tally; no database, Nancy confirms by reply).
- Nancy's dashboard (`/admin/`, server-rendered): password login (env `ADMIN_PASSWORD`, signed cookie,
  `src/lib/auth.ts`). Every order, message, call request and free review is saved to Netlify Blobs
  (`src/lib/store.ts`; in-memory in local dev) as records in `src/lib/records.ts`. Order steps: waiting on
  payment, queued (paid, draft due `draftDays` days later), writing, draft sent, delivered. Client emails
  (`src/lib/client-mail.ts`) are Nancy's own wording from her real emails, keep it: questionnaire received + payment
  link (automatic), Resume Information (inquiry reply, editable), Received Payment, Resume Draft, final Word + PDF
  with her ATS advice and `reviewRequestUrl`. Sent as text + simple HTML with her signature. Saving never blocks a form: the email to Nancy still has everything.
- Payment: "Check out" on the order form saves the order, then sends the client to PayPal for the exact total
  (`paypalEmail` in `src/site.ts`, nancy@resumepronc.com), with the order id as `custom`. PayPal reports the payment to
  `/api/paypal-ipn` (`src/lib/paypal.ts`), which verifies it, marks the order paid and sends "Received Payment".
  After a phone call Nancy sends the order link from `/admin/send-link/` (email, or a one-tap text). Empty `paypalEmail` switches all copy to "I email an invoice".
- Blog ("Career Tips"): Markdown in `src/content/blog/`. `public/_redirects` maps every old Wix URL
  (pages and all 40 `/single-post/` links) to the new pages; `tests/redirects.test.ts` checks them.
- Node 22. `npm run dev`, `npm run verify` (astro check + vitest + build). `astro preview` does not
  work with the Netlify adapter; serve `dist/` with any static server to look at a build.

## Rules

- `npm run verify` must pass before every commit; CI runs the same thing.
- No em dashes in user-facing copy. `tests/no-em-dash.test.ts` enforces it.
- Never show fake reviews, stats or client names. Testimonials are the real ones from the old site.
- Leave unknown facts empty in `site.ts` rather than guessing; pages hide empty fields.
- Every form field gets a label, `autocomplete`, and an inline error; on failure, focus the
  first bad field and show a form-level message (`src/scripts/form.ts`).
- Colors and type come only from theme tokens, never raw hex.
- Prices live only in `src/site.ts`; `tests/site.test.ts` pins them. Update both together.
- Voice: Nancy in first person ("I"). Plain, warm, professional. No all-caps shouting.
- Images still load from Wix (`static.wixstatic.com`). Copy them into `public/` before the Wix plan ends.
- Commit messages say what changed for the visitor, in plain English.
