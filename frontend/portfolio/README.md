# Portfolio frontend

Next.js App Router frontend for the public portfolio and private admin dashboard.

## Commands

```bash
npm install
npm run dev
npm run lint
npm run build
npm run start
```

`NEXT_PUBLIC_API_URL` is the backend base URL used by browser-only admin and
contact requests. `PORTFOLIO_API_URL` is server-only and is required during
`next build` and static regeneration; it normally has the same value.

Public routes (`/`, `/blog`, and `/blog/[slug]`) are generated from the existing
published Express API responses. Their initial HTML already contains settings,
projects and post content; the browser does not fetch those initial values again.
Search, filters and pagination remain client-triggered requests after the first
render. Drafts are excluded by the existing public API and never enter the
public cache.

## Vercel configuration

Set the Vercel project root to `frontend/portfolio` and select Next.js. Do not
configure the previous SPA rewrite. Configure:

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | browser + build | Public Render API URL |
| `PORTFOLIO_API_URL` | server-only | Render API URL for static generation/ISR |
| `REVALIDATION_SECRET` | server-only | Shared secret used by Render to call `/api/internal/revalidate` |

`next build` fails if `PORTFOLIO_API_URL` cannot provide required public data.
This deliberately prevents an initial deployment with partial content. Existing
ISR artifacts remain Vercel's last valid pages when a later regeneration fails.

The revalidation handler only acknowledges invalidation. Render then warms each
affected public URL and confirms its expected HTTP status and SHA-256 fingerprint of the complete public data
before the backend marks the publication job `published`.

See [the full publishing guide](../../docs/PUBLISHING.md) for transactional outbox
requirements, retry behavior, Docker setup and production verification.

`npm run verify:production` starts a disposable fixture API, verifies a failed
build on outage, builds Next, starts it locally and checks HTML/ISR and browser
behavior. The maintained suite uses the root Playwright installation and matching
Chromium, Firefox and WebKit binaries. No real backend or production database is
used. Builds use `.next-verification`, separate from local development output.
See [E2E setup and Husky hooks](../../tests/e2e/README.md) for installation, root
commands, browser profiles and reports.
