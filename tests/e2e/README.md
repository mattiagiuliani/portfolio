# Portfolio E2E

Playwright Test orchestrates the existing browser verification scenarios against
an isolated Next instance. Admin scenarios use the actual Express controllers,
authentication and a disposable MongoDB replica set. Production scenarios use
controlled API fixtures to test build failures, prerendering and ISR recovery.

## Install (Node.js 22+)

From the repository root:

```sh
npm ci
npm --prefix backend ci
npm --prefix frontend/portfolio ci
npm run test:e2e:install
```

The first admin run may download MongoDB's test binary. No production `.env`,
credentials or remote database are needed. The frontend and backend keep their
own lockfiles; the root lockfile pins the test runner and Husky. Browser binaries
must match the root Playwright version. No dependency on another repository is
required.

## Commands

| Command from repository root | Purpose |
| --- | --- |
| `npm test` | All quality checks, backend tests and E2E |
| `npm run check` | Frontend, backend and E2E lint; backend tests |
| `npm run test:e2e` | Complete browser/device and production suite |
| `npm run test:e2e:admin` | Seven admin profiles |
| `npm run test:e2e:production` | Build, SSR, branding, SEO and ISR |
| `npm run test:e2e:smoke` | Complete admin workflow on Chromium desktop |
| `npm run test:e2e -- --project iphone-small --grep @admin` | One profile |
| `npm run test:e2e:report` | Open the HTML report |

The old frontend `verify:admin` and `verify:production` commands remain as
compatibility entrypoints. Use the root commands for the unified reports.

## Layout

- `playwright.config.mjs`: serial execution, project selection, timeouts and reporters.
- `specs/`: tests exposed to Playwright Test.
- `scenarios/`: detailed assertions ported from the verified browser checks.
- `support/`: process lifecycle, ephemeral ports and artifact handling.
- `artifacts/`: generated HTML/JUnit reports, logs, screenshots and failed admin
  traces; ignored by Git. Each runner test gets a separate output directory.

Each admin profile is one sequential workflow: create, edit and delete assertions
deliberately operate on the same disposable records. A failed assertion stops that
workflow; it is not reported as several independent passing tests. Profiles have
separate databases. Zero automatic retries prevents flaky failures being hidden.
One worker avoids concurrent Next builds in the same output directory. Do not run
multiple suite commands simultaneously in the same checkout.

## Coverage

| Profile | Engine | Viewport |
| --- | --- | --- |
| chromium-desktop | Chromium | 1440 × 900 |
| firefox-desktop | Firefox | 1366 × 768 |
| webkit-desktop | WebKit | 1440 × 900 |
| iphone-small | WebKit + touch/mobile | 375 × 667 |
| iphone-modern | WebKit + touch/mobile | 390 × 844 |
| android-small | Chromium + touch/mobile | 360 × 800 |
| tablet | WebKit + touch/mobile | 768 × 1024 |

Admin checks cover protected routes, login/logout/session restoration, dashboard,
project CRUD and optional URL clearing, visibility and featured toggles, article
draft/edit/publish/withdraw/delete, contact read/archive/delete, settings persistence,
failed-settings-load recovery, overflow and runtime errors. Chromium additionally
checks message search/filter/pagination and real publication retry state changes.
The final forced session-revocation navigation checks redirection; WebKit teardown
errors during that deliberately interrupted navigation are outside the earlier
runtime-error assertion.
During explicit reloads, the known WebKit cancellation of the publication polling
request is recorded in the profile JSON as `navigationAborts`. This exception is
limited to that URL, error type and navigation interval; the same error during
normal interaction still fails the test. The failed trace established this case.

Production checks cover failed build when API data is unavailable, initial HTML,
canonical/robots/sitemap/JSON-LD, hydration on three engines, mobile layout, public
search/back navigation, video controls, reduced motion, keyboard Ares interaction,
authenticated revalidation, slug changes, withdrawal, empty data and last-good ISR
content during an API outage. Production admin responses are mocked; actual CRUD
belongs to the admin scenarios. Audio checks verify playback controls and media
state, not physical speaker output.

These are engine/viewport tests, not certification of physical iPhones, Samsung
Internet or all historical OS releases. HTTPS cookie behavior and Render/Vercel
integration still require deployment checks.

## Husky

`npm ci` at the root installs `.husky/_` as this repository's Git hooks path.

- `pre-commit`: `npm run check` (lint plus backend tests).
- `pre-push`: `npm run test:e2e` (full E2E matrix and production scenario).

Failures stop the Git operation. Hooks do not rewrite, stage, commit or push files.
The full pre-push run takes several minutes and needs the installed browser and
MongoDB test binaries. `npm run prepare` reinstalls hooks if needed. As with all
local Git hooks, they are not a server-enforced protection.

On failure, open the HTML report and its scenario log. Failed admin workflows also
attach a screenshot and `trace.zip`; open the trace with
`npx playwright show-trace <path-to-trace.zip>`. Timeout cleanup terminates only
the process tree spawned by that scenario, not your local development server.
