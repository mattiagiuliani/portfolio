# Portfolio publishing

The public Next.js pages `/`, `/blog` and `/blog/[slug]` contain their initial
content in HTML. Express and MongoDB remain the source of truth. The private
admin UI stays a client-only React Router application under `/admin/*`.

## Save and publication are different operations

Every admin content mutation runs in a MongoDB transaction together with its
`PublicationJob` insert. A failed outbox insert rolls back the content mutation;
the API does not claim it saved. Once committed, webhook/network failures do
not undo the content: the durable job retries independently.

**MongoDB Atlas or a replica set is required**, including local development.
Standalone MongoDB cannot provide these transactions. The backend initializes model indexes
before accepting requests when provisioning a new database. No database schema
migration or production data changes are performed by the frontend build.

The worker runs inside Express, polling every 15 seconds by default. It processes
jobs in order within that process. A token protects lease ownership; jobs left in
`invalidated` or `warming` are reclaimed after their lease expires. An unavailable
database is logged and retried on the next poll, without an unhandled rejection.

States: `queued` → `invalidated` → `warming` → `published`; failures become
`retrying` with exponential delay capped at 15 minutes. Missing webhook
configuration also leaves a durable retryable job. Manual retry is available
in the admin publication panel and refuses to steal an active lease.

The webhook marks path-specific data cache tags stale using stale-while-revalidate.
It does not report publication complete. The worker visits **every affected
path**, compares its HTTP status and `data-public-version` hash to the current
public API snapshot, then rechecks that the source has not changed during the
verification. Hashes cover complete public data, including descriptions, article
bodies, ordering and pagination. Old jobs verify the latest source state instead
of waiting forever for a revision superseded by another edit. Draft contents
are never used in these public snapshots.

Visitors may receive the previous complete version while regeneration is pending;
they do not see hardcoded placeholder content replaced after a browser API call.
Already-open browser pages are not pushed live updates. `published` means the
listed URLs were verified at that time, not a global CDN propagation guarantee.
The 60-second operational target applies only with running, reachable services.
A sleeping Render process cannot execute retries until it resumes.

Failed background regeneration preserves an existing valid page. Initial build
failure prevents publishing a partial build. A never-generated route has no last
good version to fall back to and can return an error if the backend is down;
no blanket HTTP 503 guarantee is made. Withdrawal/deletion is verified as HTTP
404 after revalidation; during an outage the previous cache may remain visible.

## Vercel

- Root Directory: `frontend/portfolio` relative to this repository.
- Framework: Next.js. Remove previous Vite build/output overrides and SPA rewrites.
- Build command: `npm run build`; use the framework's default output settings.
- `NEXT_PUBLIC_API_URL`: browser-accessible Express URL (admin/contact/filtering).
- `PORTFOLIO_API_URL`: Express URL reachable during build and ISR.
- `REVALIDATION_SECRET`: long random server-only secret, identical on Render.

The API must be reachable during build. Public endpoints must return the expected
data shape. Do not use `output: 'export'`: ISR requires the Next.js Node runtime.

## Render

Keep existing auth, MongoDB and CORS variables. Add:

- `PUBLIC_SITE_URL`: canonical frontend origin, without a trailing slash.
- `FRONTEND_REVALIDATE_URL`: optional explicit canonical URL ending in
  `/api/internal/revalidate`; otherwise derived from `PUBLIC_SITE_URL`.
- `REVALIDATION_SECRET`: shared server-only secret.
- `PUBLICATION_POLL_MS`: optional, default 15000.
- `PUBLICATION_REQUEST_TIMEOUT_MS`: optional, default 15000; includes body reading.

Use separate preview backend/database settings when verifying a preview deploy.
Do not point production publication jobs at a preview URL. Vercel preview access
protection, if enabled, must be accounted for before testing the webhook.

## Blog queries

The default blog listing is static HTML. Search, category and pagination update
the URL and fetch on the client after interaction. Bookmarked query URLs start
with the static default listing and resolve the requested filter after hydration.
Back/forward restores the selected query; returning to the default query restores
the initial data without another request. This is distinct from the unfiltered
portfolio's initial rendering, which requires no browser public-data requests.

## Docker

The frontend now runs Next on port 3000, mapped to host port 80 by Compose.
Set `PORTFOLIO_BUILD_API_URL` to a backend already reachable during Docker build,
`NEXT_PUBLIC_API_URL` to its browser-accessible URL and `REVALIDATION_SECRET` in
the Compose environment. `depends_on` does not start the backend before the image
build: start/provision the API first. At runtime the Compose frontend uses
`http://backend:5000`; backend `PUBLIC_SITE_URL` must be reachable from its
container (for local Compose, usually `http://frontend:3000`).

## Verification

- `cd backend && npm test`: existing tests plus real disposable Mongo replica-set
  integration tests for atomic rollback, durable enqueue, toggles, slug changes
  and crash recovery. First run downloads a MongoDB binary; no real database is used.
- Run `npm run lint` in both apps.
- `cd frontend/portfolio && npm run verify:production`: fixture-only production
  build/server tests, including HTML hashes, invalidation, renamed/withdrawn posts,
  empty lists and outages. Browser tests use headless Edge on Windows, Chromium
  elsewhere (`npx playwright install chromium`). Local `.next` is replaced by
  fixture artifacts; rebuild with the intended environment before deployment.

Real Render → Vercel delivery, platform CDN behavior, deployment credentials and
actual Render suspension/restart still require a separately authorized staging
deployment. Local verification does not claim to cover those platform checks.
