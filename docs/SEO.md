# Search and editorial setup

The English copy is grounded in the public profile at
https://www.linkedin.com/in/mattia-giuliani-dev and the supplied MG brand references.
It emphasizes learning through projects, full stack implementation, testing and
curiosity about quantum computing. It does not claim seniority or infer personal traits.

## Copy and publication

Section introductions are in the frontend. Hero and About remain editable database
settings. Their revised draft is in `frontend/portfolio/src/data/profileCopy.js`.
In Admin > Settings, **Load revised profile copy** fills those fields; review and
save through the existing transactional publishing flow to publish them.
This does not overwrite contact information or social links.

`node scripts/preview-api.mjs`, from `frontend/portfolio`, starts a GET-only API
on localhost:5000. It reads the existing development Mongo connection and overlays
the draft in the response without writing to Mongo or running the publication worker.
Run Next locally with both API URLs set to http://127.0.0.1:5000 to review it.

## Search implementation

- Unique server-rendered titles and descriptions for home, blog and each article.
- Absolute canonical URLs and Open Graph/Twitter metadata.
- ProfilePage/Person and BlogPosting JSON-LD, escaped for safe HTML embedding.
- Visible author attribution on articles and initial content readable without JavaScript.
- Paginated public-post sitemap, including posts beyond the first listing page.
- Post publication invalidates listing caches used by the sitemap, including deleted
  and renamed URLs. Revalidation is stale-while-revalidate, not instantaneous.
- Admin has `noindex,nofollow`. It remains crawlable so crawlers can read noindex;
  authentication, not robots.txt, protects the admin.
- Vercel preview deployments are marked noindex and have no public sitemap entries.
- Fonts are served locally and video remains lazy-loaded.

Set `SITE_URL` in Vercel to the final HTTPS origin before deploying. The default,
`https://mattiagiuliani-portfolio.vercel.app`, comes from the repository README.
Do not set it to a preview deployment or API address. Custom staging deployments
should also set `VERCEL_ENV=preview` for the indexing guard.

## Verification and release

`npm run verify:production` uses disposable fixture data and a separate
`.next-verification` build directory. It checks metadata, JSON-LD, mobile layout,
content without JavaScript, publishing and sitemap changes in production mode.
Browser checks use Chromium, Firefox and Playwright WebKit. WebKit is useful
Safari-engine coverage, not a test on an actual Safari/macOS or iPhone installation.
Install the matching test browsers with `npx playwright install chromium firefox webkit`.
The root Playwright installation provides the matching browser driver. See
[`tests/e2e/README.md`](../tests/e2e/README.md) for installation and unified reports.

The read-only preview API does not support admin login. For the admin, run the
normal backend with `FRONTEND_ORIGIN=http://localhost:3000` in `.env.development`.
When diagnosing against a shared database, set `PUBLICATION_WORKER_ENABLED=false`
to avoid consuming publication jobs locally. Content saves still use the database;
enable the worker in the intended publishing environment to process queued jobs.

After deployment, verify the canonical host redirects, real response headers,
robots.txt and sitemap.xml. Submit the sitemap in Google Search Console and Bing
Webmaster Tools, inspect representative URLs and validate structured data.
Check Lighthouse/PageSpeed and field Core Web Vitals on the deployed site; no
performance score or ranking guarantee is implied by passing local tests.

Reference: https://developers.google.com/search/docs/fundamentals/get-started-developers
