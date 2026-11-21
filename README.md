# Resume Pro NC

Website for Resume Pro NC, resume writing by Nancy Turner. Astro + Tailwind on Netlify.

```
npm install
npm run dev      # local site
npm run verify   # type check, tests, build
```

Netlify environment variables: `RESEND_API_KEY`, `CONTACT_TO_EMAIL` (Nancy's inbox), and
`CONTACT_FROM_EMAIL` once the domain is verified in Resend, and `ADMIN_PASSWORD` for Nancy's dashboard at
`/admin/` (orders and files are kept in Netlify Blobs, which needs no setup). See CLAUDE.md for how it fits together.
