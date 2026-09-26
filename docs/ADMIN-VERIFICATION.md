# Admin verification

## Local result — 2026-09-26

All seven admin profiles passed: Chromium 147.0.7727.15 desktop and Android-sized,
Firefox 148.0.2 desktop, WebKit 26.4 desktop, two iPhone-sized profiles and tablet.
Frontend/backend lint passed; backend tests passed 28/28. The production build and
`verify:production` checks also passed, including the intentional backend-outage
scenario. No production records were created or deleted by these tests.

The maintained suite now lives in [`tests/e2e`](../tests/e2e/README.md).
Run from the repository root:

```sh
npm run check
npm run test:e2e
npm run test:e2e:report
```

Install dependencies and matching browsers as described in the suite README.
The root Playwright installation is self-contained; no external module override
or another repository is needed.

## Isolated admin checks

`tests/e2e/scenarios/admin.mjs` starts a disposable MongoDB replica set, the actual
Express routes/controllers, and Next on a dynamically selected port (`ADMIN_TEST_PORT` overrides it).
It does not load backend environment files or use production credentials or data.
The publication worker is not started; mutations must still enqueue jobs.

The matrix covers Chromium, Firefox and WebKit desktop, two iPhone-sized WebKit
viewports, a small Android-sized Chromium viewport, and a touch tablet viewport.
These are browser engine and viewport tests, not physical-device certification.

Each profile checks:

- Protected routes, login, session persistence, logout and expired-session redirect.
- Dashboard loading.
- Project validation, creation, editing, clearing optional URLs, visibility,
  featured state, deletion cancellation and confirmed deletion.
- Article creation, full editor content, renaming, publishing, featuring,
  withdrawal and deletion.
- Contact loading, marking read, archiving and deletion.
- Settings save and persistence after reload; failed loading blocks the form
  and offers a working retry.
- Horizontal overflow in principal pages and dialogs, and JavaScript errors.

The Chromium desktop profile additionally exercises message pagination across
21 records, status filtering, searching and deleting a search result, plus a
real publication retry request and its database state transition. Use
`ADMIN_TEST_DEVICE=chromium-desktop` (or another matrix profile name) to run one
profile; its report has a separate filename.

Screenshots and the completed matrix report are written to
`tests/e2e/artifacts/results/` (ignored by Git).

## Changes supporting compatibility

Admin and auth requests use same-origin `/api/admin/*` and `/api/auth/*` routes.
Next rewrites them to `PORTFOLIO_API_URL` (or `NEXT_PUBLIC_API_URL`). Cookies
therefore belong to the frontend host. Express must still allow the actual
frontend origin via `FRONTEND_ORIGIN`; production requires HTTPS. Restart Next
after changing the backend URL. Public API fetching is unchanged.

The route outlet stays mounted consistently during navigation, avoiding an
animation-induced form reset. Dialogs are portalled to the document body.
Mutation controls remain disabled until the mutation and list refresh finish.
Article and message actions remain visible without mouse hover, including tablets.
Failed settings loading cannot silently present an empty editable form.

## Deployment checks still required

Local verification does not certify every browser or operating-system release.
Check login, keyboard behavior, dialogs and save/delete on real iPhone Safari
and Samsung Internet/Chrome against the HTTPS deployment. Check Render-to-Vercel
publication and recovery separately using `PUBLISHING.md`. Production verification
uses controlled fixtures for the worker status UI and tests public ISR behavior;
it does not contact the deployed services.
