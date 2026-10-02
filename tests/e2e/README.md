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
| `npm run test:e2e:home` | Isolated public Home smoke matrix and focused layout checks |
| `npm run test:e2e:home:layout` | Breakpoint and landscape checks only |
| `npm run test:e2e:admin` | Seven admin profiles |
| `npm run test:e2e:production` | Build, SSR, branding, SEO and ISR |
| `npm run test:e2e:smoke` | Complete admin workflow on Chromium desktop |
| `npm run test:e2e -- --project iphone-small --grep @admin` | One profile |
| `npm run test:e2e:report` | Open the HTML report |

The old frontend `verify:admin` and `verify:production` commands remain as
compatibility entrypoints. Use the root commands for the unified reports.

## Layout

- `playwright.config.mjs`: serial execution, project selection, timeouts and reporters.
- `home.playwright.config.mjs`: isolated Home browser/device projects and owned web server.
- `home/`: small cross-browser Home and responsive-layout smoke checks.
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

The Home suite has its own Playwright configuration and does not alter how the
existing admin, media, authentication or production scenarios start their servers.
It builds production output in a run-unique
`frontend/portfolio/.next-home-e2e-<port>-<run-id>` directory, uses a
local fixture API, and binds the Next server to `127.0.0.1`. The default port is
4179; set `HOME_E2E_PORT` to select another port. A listener already on that port
causes an actionable failure. The harness sets `reuseExistingServer: false`, never
attaches to or terminates an existing service, and verifies unique fixture content
and fixture requests before Playwright starts tests. Its owned server/process tree
and build output are cleaned after the run, including Playwright teardown on
Windows. Do not run this suite concurrently with another Home run using the same
port.

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

The separate Home suite runs the same focused public Home smoke in this matrix:

| Home project | Engine and emulation | Viewport |
| --- | --- | --- |
| chromium-desktop | Chromium | 1440 × 900 |
| firefox-desktop | Firefox | 1366 × 768 |
| webkit-desktop | WebKit | 1440 × 900 |
| iphone-small | WebKit, iPhone SE descriptor | 375 × 667 |
| iphone-modern | WebKit, iPhone 15 descriptor | 390 × 844 |
| android-small | Chromium, Pixel 7 descriptor | 360 × 800 |
| tablet | WebKit, iPad (gen 7) descriptor | 768 × 1024 |

Mobile and tablet projects use official Playwright descriptors for browser
defaults, user agent, device scale factor and touch/mobile behavior. The requested
representative viewport sizes override descriptor dimensions where they differ;
notably iPhone 15, Pixel 7 and iPad (gen 7). Separate focused checks exercise
759–769px around the CSS/Tailwind 760/768px boundary and iPhone/tablet landscape.
This is browser emulation, not validation on every physical browser, device,
operating system or vendor browser. Physical-device validation remains separate.

The Home smoke checks fixture identity, Hero, usable navigation, fixture project,
Contact reachability, horizontal overflow and uncaught page errors. It does not
assert cinematic/video behavior. Home reports are written to the ignored
`artifacts/home-*` paths.

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

## Verified locally — 2026-10-01

The existing full E2E run passed all 29 tests with zero failures or skips.
Frontend, backend and E2E lint passed, along with all 181 backend tests. The
separate Home run passed all 10 smoke/layout checks, including all seven browser
and device projects.
