# point.dog

Astro site for **point.dog Digital** — Mike Usry's small-business digital marketing agency in Athens, GA.

**Production URL:** https://www.point.dog (currently on Webflow, replacing with this Astro build)

**Position:** "The agency that actually builds the backend." We grow our clients' businesses
and operating efficiency by handling the technical work most agencies hand off — custom
integrations, first-party tracking, CDPs, the engineering layer that makes modern advertising
actually convert.

**Stack:** Astro 5 (SSR) + Tailwind 4 + MDX content collections + Vercel
**Backend:** SendGrid only (mike@point.dog). No HubSpot. Volume doesn't justify CRM yet.

## Pattern source

Cloned from drain-tree (which cloned from SpraySquad). Same conventions:

- `src/data/siteConfig.ts` is the single source of truth for company info, nav, brand colors,
  social, operating entities. Never hardcode these in pages.
- `src/layouts/Layout.astro` handles meta, OG, canonical, GTM, pixel, fonts, schema prop.
- `src/components/schema/` for reusable JSON-LD blobs.
- `src/content/case-studies/` MDX files = the only content collection.
- `astro.config.mjs` `customPages` array carries SSR routes the sitemap can't auto-discover.

## Page map

- `/` — Home: hero, recent work, "Why we build the backend" section, outcomes, operating entities
- `/work` — All case studies
- `/work/[slug]` — Individual case study (Hamilton, Banyan, CPRC, Heiser)
- `/about` — Mike + operator-turned-agency story + who we work with
- `/contact` — Contact form → `mike@point.dog` via SendGrid
- `/thank-you` — Post-submit
- `/privacy` — Policy

## Environment

```
SENDGRID_API_KEY=SG.xxx   # required; point.dog domain authenticated
```

GTM container `GTM-PNT6BSJ` hardcoded in `Layout.astro`.

## Running

```bash
npm install
npm run dev          # http://localhost:4321
npm run build        # astro check + build
npm run screenshots  # design QA via Playwright
```

## Don't

- Don't add HubSpot back unless lead volume justifies CRM (Mike's call Apr 28).
- Don't hardcode operating entity URLs — they live in `siteConfig.operatingEntities`.
- Don't add a "team" page — this is Mike's agency. Keep it honest.
