# Resume Pro NC

Website for Resume Pro NC, resume writing by Nancy Turner. Astro + Tailwind on Cloudflare Workers (free plan).

```
npm install
npm run dev      # local site
npm run verify   # type check, tests, build
```

Cloudflare: Workers & Pages > Create > Import a repository > this repo. Build command `npm run build`,
deploy command `npx wrangler deploy`; `wrangler.jsonc` holds the rest (KV storage, the weekday cron).
Variables (Worker > Settings > Variables and Secrets, type Secret): `RESEND_API_KEY`, `CONTACT_TO_EMAIL` (Nancy's inbox),
`CONTACT_FROM_EMAIL` once the domain is verified in Resend, `ADMIN_PASSWORD` and `SESSION_SECRET` for Nancy's dashboard at
`/admin/`, and `SITE_URL` (the workers.dev address) until resumepronc.com points here. Orders and files are kept in
Workers KV; the first deploy creates it. See CLAUDE.md for how it fits together.
