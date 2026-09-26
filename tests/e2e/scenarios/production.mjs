import assert from 'node:assert/strict'
const { chromium, firefox, webkit } = await import('playwright')
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { readFile, mkdir } from 'node:fs/promises'
import { publicSnapshot } from '../../../frontend/portfolio/src/lib/publicSnapshot.server.js'
import { artifactDirectory } from '../support/environment.mjs'

// All API data and writes in this check are local, disposable fixtures.
const settings = { name: 'Mattia Giuliani', heroTagline: '// Full stack developer', jobTitle: 'Full Stack Developer', heroDescription: 'Building modern software today while exploring the technologies shaping tomorrow: Cloud Computing, Artificial Intelligence, and Quantum Computing.', aboutText: 'I approach software as engineering, focusing on clean architecture, thoughtful interfaces, and maintainable code. Beyond full stack development, I keep exploring Cloud Computing, Artificial Intelligence and Quantum Computing.', updatedAt: '2026-01-01' }
const projects = [{ _id: 'project', title: 'Fixture Project', description: 'Project description', technologies: ['React'] }]
let posts = [{ _id: 'post', slug: 'fixture-article', title: 'Fixture Article', content: 'First article body', excerpt: 'Fixture excerpt', category: 'Web Development', tags: [], readingTime: 1, publishedAt: '2026-01-01', updatedAt: '2026-01-01', featured: true }]
let unavailable = false
function apiResponse(path) {
  const url = new URL(path, 'http://fixture')
  if (unavailable) return { status: 503, body: { success: false } }
  if (url.pathname === '/api/settings') return { status: 200, body: { success: true, data: settings } }
  if (url.pathname === '/api/projects') return { status: 200, body: { success: true, data: projects } }
  if (url.pathname === '/api/posts') {
    const page = Number(url.searchParams.get('page') || 1)
    const limit = Number(url.searchParams.get('limit') || 9)
    const filtered = url.searchParams.get('featured') ? posts.filter((post) => post.featured) : posts
    const data = filtered.slice((page - 1) * limit, page * limit).map(({ content: _content, ...post }) => post)
    return { status: 200, body: { success: true, data, pagination: { total: filtered.length, page, limit, pages: Math.ceil(filtered.length / limit), hasNext: page * limit < filtered.length, hasPrev: page > 1 } } }
  }
  const post = posts.find((item) => url.pathname === `/api/posts/${item.slug}`)
  return post ? { status: 200, body: { success: true, data: post } } : { status: 404, body: { success: false } }
}

const api = createServer((req, res) => {
  const result = apiResponse(req.url)
  res.writeHead(result.status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(result.body))
})
api.listen(0, '127.0.0.1')
await once(api, 'listening')
const apiUrl = `http://127.0.0.1:${api.address().port}`
const probe = createServer()
probe.listen(0, '127.0.0.1')
await once(probe, 'listening')
const port = probe.address().port
await new Promise((resolve) => probe.close(resolve))
const env = { ...process.env, NEXT_BUILD_DIR: '.next-verification', SITE_URL: 'https://portfolio.example', VERCEL_ENV: 'production', NEXT_PUBLIC_API_URL: apiUrl, PORTFOLIO_API_URL: apiUrl, REVALIDATION_SECRET: 'local-verification-only', NEXT_TELEMETRY_DISABLED: '1' }
const cli = new URL('../../../frontend/portfolio/node_modules/next/dist/bin/next', import.meta.url)
const { fileURLToPath } = await import('node:url')
const cwd = fileURLToPath(new URL('../../../frontend/portfolio/', import.meta.url))
function next(args, stdio = 'inherit') { return spawn(process.execPath, [fileURLToPath(cli), ...args], { cwd, env, stdio, windowsHide: true }) }
let server
try {
  unavailable = true
  const failedBuild = next(['build', '--webpack'], 'ignore')
  assert.notEqual((await once(failedBuild, 'exit'))[0], 0, 'build must fail when initial public data is unavailable')
  console.log('PASS: unavailable API prevents incomplete build')
  unavailable = false
  const build = next(['build', '--webpack'])
  const [code] = await once(build, 'exit')
  assert.equal(code, 0, 'production build failed')
  const manifest = JSON.parse(await readFile(new URL('../../../frontend/portfolio/.next-verification/prerender-manifest.json', import.meta.url)))
  for (const path of ['/', '/blog', '/blog/fixture-article']) assert.ok(manifest.routes[path], `${path} must be prerendered`)
  server = next(['start', '-H', '127.0.0.1', '-p', String(port)])
  const base = `http://127.0.0.1:${port}`
  const get = (path, options) => fetch(`${base}${path}`, { ...options, signal: AbortSignal.timeout(20000) })
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await get('/')).ok) break } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  async function verify(path, attempt = 0) {
    const expected = await publicSnapshot(path, async (apiPath) => structuredClone(apiResponse(apiPath).body))
    const response = await get(path)
    assert.equal(response.status, 200)
    const html = await response.text()
    if (!html.includes(`data-public-version="${expected.revision}"`) && attempt < 20) {
      await new Promise((resolve) => setTimeout(resolve, 500))
      return verify(path, attempt + 1)
    }
    assert.ok(html.includes(`data-public-version="${expected.revision}"`), `wrong revision: ${path}`)
    assert.ok(!/opacity:\s*0(?:[;"}])/.test(html), `initially invisible content: ${path}`)
    return html
  }
  async function verifyMissing(path) {
    for (let i = 0; i < 20; i++) {
      if ((await get(path)).status === 404) return
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    assert.fail(`Expected HTTP 404 for ${path}`)
  }
  async function invalidate(paths) {
    const response = await get('/api/internal/revalidate', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-revalidation-secret': env.REVALIDATION_SECRET }, body: JSON.stringify({ paths }) })
    assert.equal(response.status, 200)
  }
  assert.ok((await verify('/')).includes('Fixture Project'))
  assert.ok((await verify('/blog')).includes('Fixture Article'))
  assert.ok((await verify('/blog/fixture-article')).includes('First article body'))
  assert.equal((await get('/api/internal/revalidate', { method: 'POST' })).status, 401)
  // Real browser check: hydrate public pages, interact with search, then restore
  // an admin session using fixture responses (never production credentials).
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    const errors = []
    const publicCalls = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => { if (message.type() === 'error' && /hydration|hydrating|Minified React/.test(message.text())) errors.push(message.text()) })
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url())
      let result
      if (url.pathname === '/api/auth/me') result = { success: true, user: { name: 'Fixture Admin', role: 'admin' } }
      else if (url.pathname === '/api/admin/settings') result = { success: true, data: settings }
      else if (url.pathname === '/api/admin/publication-jobs') result = { success: true, data: [{ _id: 'job', status: 'retrying', paths: ['/'], lastError: 'Fixture retry' }] }
      else if (url.pathname.endsWith('/retry')) result = { success: true, data: { status: 'queued' } }
      else {
        publicCalls.push(url.pathname + url.search)
        result = apiResponse(url.pathname + url.search).body
      }
      await route.fulfill({ json: result })
    })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto(base)
    await page.getByRole('heading', { name: 'Mattia Giuliani', exact: true }).waitFor()
    const reviewDir = artifactDirectory(new URL('../artifacts/production/', import.meta.url))
    await mkdir(reviewDir, { recursive: true })
    await page.waitForLoadState('networkidle')
    await page.locator('img').evaluateAll(async (images) => {
      images.forEach((img) => { img.loading = 'eager' })
      await Promise.all(images.map((img) => img.decode()))
    })
    await page.screenshot({ path: fileURLToPath(new URL('desktop.png', reviewDir)), fullPage: true })
    await page.screenshot({ path: fileURLToPath(new URL('hero-desktop.png', reviewDir)) })
    assert.equal(await page.locator('video').getAttribute('src'), null, 'film must not download before approaching its section')
    await page.locator('#universe').scrollIntoViewIfNeeded()
    await page.waitForFunction(() => { const v = document.querySelector('video'); return v.readyState >= 2 && !v.paused })
    assert.equal(await page.locator('video').evaluate((v) => v.muted), true, 'autoplay must be silent')
    await page.getByRole('button', { name: 'Enable film audio', exact: true }).click()
    assert.equal(await page.locator('video').evaluate((v) => v.muted), false)
    await page.getByRole('button', { name: 'Pause film', exact: true }).click()
    assert.equal(await page.locator('video').evaluate((v) => v.paused), true)
    await page.getByRole('button', { name: 'Mute film audio', exact: true }).click()
    await page.locator('#about').scrollIntoViewIfNeeded()
    assert.ok(await page.locator('.companion-art').evaluate((img) => img.complete && img.naturalWidth > 0), 'anime avatar must load')
    await page.screenshot({ path: fileURLToPath(new URL('about-desktop.png', reviewDir)) })
    await page.getByRole('button', { name: 'Meet Ares' }).focus()
    await page.keyboard.press('Enter')
    assert.equal(await page.locator('#ares-note').isVisible(), true)
    await page.locator('#universe').scrollIntoViewIfNeeded()
    assert.equal(await page.locator('video').evaluate((v) => v.paused), true, 'explicit pause survives scrolling')
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(base)
    await page.waitForLoadState('networkidle')
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, 'homepage must fit mobile viewport')
    await page.locator('img').evaluateAll(async (images) => {
      images.forEach((img) => { img.loading = 'eager' })
      await Promise.all(images.map((img) => img.decode()))
    })
    await page.screenshot({ path: fileURLToPath(new URL('mobile.png', reviewDir)), fullPage: true })
    await page.screenshot({ path: fileURLToPath(new URL('hero-mobile.png', reviewDir)) })
    await page.getByRole('button', { name: 'Toggle menu' }).click()
    await page.getByRole('link', { name: 'Universe', exact: true }).click()
    await page.waitForFunction(() => location.hash === '#universe')
    await page.setViewportSize({ width: 1440, height: 1000 })
    const reducedPage = await browser.newPage({ reducedMotion: 'reduce' })
    await reducedPage.goto(base)
    await reducedPage.locator('#universe').scrollIntoViewIfNeeded()
    assert.equal(await reducedPage.locator('video').getAttribute('src'), null, 'reduced motion disables automatic video loading')
    await reducedPage.getByRole('button', { name: 'Play film', exact: true }).click()
    await reducedPage.waitForFunction(() => !document.querySelector('video').paused)
    await reducedPage.close()
    console.log('PASS: responsive branding, lazy silent video, sound/pause controls, reduced motion and keyboard Ares interaction')
    await page.goto(`${base}/blog`)
    await page.getByRole('heading', { name: 'The Blog', exact: true }).waitFor()
    await page.waitForLoadState('networkidle')
    assert.deepEqual(publicCalls, [], 'initial public data must not be fetched by the browser')
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search"]').first()
    await searchInput.fill('Fixture')
    await searchInput.press('Enter')
    await page.waitForFunction(() => location.search.includes('search=Fixture'))
    await page.waitForLoadState('networkidle')
    assert.ok(publicCalls.some((url) => url.includes('search=Fixture')), 'search must fetch filtered data')
    await page.goBack()
    await page.waitForLoadState('networkidle')
    assert.ok(await page.getByText('Fixture Article', { exact: true }).first().isVisible())
    await page.goto(`${base}/admin/settings`)
    await page.getByText('Publication details', { exact: true }).waitFor()
    await page.getByText('Publication details', { exact: true }).click()
    await page.getByRole('button', { name: 'Retry publication' }).click()
    await page.setViewportSize({ width: 390, height: 844 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, 'admin must fit mobile viewport')
    assert.deepEqual(errors, [], 'browser runtime/hydration errors')
    console.log('PASS: browser hydration, zero initial API fetches, search/back navigation, admin session and publication retry UI')
  } finally { await browser.close() }
  for (const engine of [chromium, firefox, webkit]) {
    const browser = await engine.launch({ headless: true })
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
      const runtimeErrors = []
      page.on('pageerror', (error) => runtimeErrors.push(error.message))
      await page.goto(base)
      await page.getByRole('heading', { name: 'Mattia Giuliani', exact: true }).waitFor()
      assert.equal(await page.locator('h1').count(), 1)
      assert.equal(new URL(await page.locator('link[rel="canonical"]').getAttribute('href')).href, 'https://portfolio.example/')
      assert.equal(await page.locator('meta[name="description"]').getAttribute('content'), settings.heroDescription)
      assert.equal(await page.locator('script[type="application/ld+json"]').evaluate((node) => JSON.parse(node.textContent)['@type']), 'ProfilePage')
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      await page.goto(`${base}/blog/fixture-article`)
      assert.equal(await page.title(), 'Fixture Article | Mattia Giuliani')
      assert.equal(await page.locator('meta[property="og:type"]').getAttribute('content'), 'article')
      assert.equal(await page.locator('script[type="application/ld+json"]').evaluate((node) => JSON.parse(node.textContent).headline), 'Fixture Article')
      assert.deepEqual(runtimeErrors, [])
      const noJs = await browser.newPage({ javaScriptEnabled: false })
      await noJs.goto(base)
      assert.ok(await noJs.getByRole('heading', { name: 'Mattia Giuliani', exact: true }).isVisible())
      await noJs.goto(`${base}/blog/fixture-article`)
      assert.ok(await noJs.getByRole('heading', { name: 'Fixture Article', exact: true }).isVisible())
      console.log(`PASS: ${engine.name()} ${browser.version()} metadata, structured data, mobile layout and content without JavaScript`)
    } finally { await browser.close() }
  }
  assert.ok((await (await get('/robots.txt')).text()).includes('https://portfolio.example/sitemap.xml'))
  assert.ok((await (await get('/sitemap.xml')).text()).includes('https://portfolio.example/blog/fixture-article'))
  assert.match(await (await get('/admin/login')).text(), /name="robots" content="noindex, nofollow"/)
  settings.heroDescription = 'Updated description with unchanged name'
  projects[0].description = 'Updated project description'
  posts[0].content = 'Updated body with unchanged title'
  await invalidate(['/', '/blog', '/blog/fixture-article'])
  assert.ok((await verify('/')).includes('Updated description with unchanged name'))
  assert.ok((await verify('/blog/fixture-article')).includes('Updated body with unchanged title'))
  await verify('/blog')
  posts[0].slug = 'renamed-article'
  await invalidate(['/', '/blog', '/blog/fixture-article', '/blog/renamed-article'])
  await verifyMissing('/blog/fixture-article')
  await verify('/blog/renamed-article')
  async function verifySitemap(slug, present) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const xml = await (await get('/sitemap.xml')).text()
      if (xml.includes(`/blog/${slug}</loc>`) === present) return
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    assert.fail(`sitemap did not update: ${slug}, expected presence ${present}`)
  }
  await verifySitemap('renamed-article', true)
  await verifySitemap('fixture-article', false)
  posts = []
  await invalidate(['/', '/blog', '/blog/renamed-article'])
  await verifyMissing('/blog/renamed-article')
  assert.ok(!(await verify('/')).includes('Fixture Article'))
  await verify('/blog')
  await verifySitemap('renamed-article', false)
  const lastGoodHtml = await verify('/')
  unavailable = true
  await invalidate(['/'])
  const outage = await get('/')
  assert.equal(outage.status, 200, 'outage must preserve last good page')
  assert.equal((await outage.text()).match(/data-public-version="([^"]+)/)?.[1], lastGoodHtml.match(/data-public-version="([^"]+)/)?.[1])
  await new Promise((resolve) => setTimeout(resolve, 1000))
  assert.equal((await get('/')).status, 200, 'failed background regeneration must preserve last good page')
  console.log('PASS: last good public page preserved during backend outage')
  console.log('PASS: prerendered HTML, authenticated invalidation, description/body edits, slug change, withdrawal, empty lists.')
} finally {
  if (server) { const stopped = once(server, 'exit'); server.kill(); await stopped }
  await new Promise((resolve) => api.close(resolve))
}
