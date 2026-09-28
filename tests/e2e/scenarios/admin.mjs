import assert from 'node:assert/strict'
import { once } from 'node:events'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { mkdir, writeFile } from 'node:fs/promises'
import express from '../../../backend/node_modules/express/index.js'
import cors from '../../../backend/node_modules/cors/lib/index.js'
import cookieParser from '../../../backend/node_modules/cookie-parser/index.js'
import mongoose from '../../../backend/node_modules/mongoose/index.js'
import { MongoMemoryReplSet } from '../../../backend/node_modules/mongodb-memory-server/index.js'
import Admin from '../../../backend/src/models/Admin.js'
import Post from '../../../backend/src/models/Post.js'
import Project from '../../../backend/src/models/Project.js'
import Settings from '../../../backend/src/models/Settings.js'
import Contact from '../../../backend/src/models/Contact.js'
import PublicationJob from '../../../backend/src/models/PublicationJob.js'
import authRoutes from '../../../backend/src/routes/authRoutes.js'
import adminRoutes from '../../../backend/src/routes/adminRoutes.js'
import publicRoutes from '../../../backend/src/routes/publicRoutes.js'
import postRoutes from '../../../backend/src/routes/postRoutes.js'
import errorHandler from '../../../backend/src/middleware/errorHandler.js'
import { freePort, artifactDirectory } from '../support/environment.mjs'

// No .env files, real credentials, external Mongo connections or worker are used.
const { chromium, firefox, webkit } = await import('playwright')
process.env.NODE_ENV = 'development'
process.env.JWT_SECRET = 'disposable-admin-test-secret-not-for-production'
const port = Number(process.env.ADMIN_TEST_PORT || await freePort())
const base = `http://localhost:${port}`
process.env.FRONTEND_ORIGIN = base
delete process.env.PUBLIC_SITE_URL
delete process.env.FRONTEND_REVALIDATE_URL
const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
let api, next
const report = []
const output = artifactDirectory(new URL(`../artifacts/admin/${process.env.ADMIN_TEST_DEVICE || 'matrix'}/`, import.meta.url))
await mkdir(output, { recursive: true })
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function until(check, label) {
  for (let i = 0; i < 60; i++) { if (await check()) return; await pause(100) }
  assert.fail(label)
}
try {
  await mongoose.connect(replica.getUri())
  await Promise.all([Admin, Post, Project, Settings, Contact, PublicationJob].map((model) => model.init()))
  const email = 'admin@example.test', password = 'Disposable-test-password-123'
  await Admin.create({ name: 'Test Admin', email, password, role: 'super_admin' })
  await Settings.create({ name: 'Fixture Portfolio', email, heroDescription: 'Fixture description', aboutText: 'Fixture biography' })
  const app = express()
  app.use(cors({ origin: base, credentials: true }))
  app.use(cookieParser(), express.json())
  app.use('/api/auth', authRoutes)
  app.use('/api/admin', adminRoutes)
  app.use('/api/posts', postRoutes)
  app.use('/api', publicRoutes)
  app.use(errorHandler)
  api = app.listen(0)
  await once(api, 'listening')
  const apiUrl = `http://localhost:${api.address().port}`
  const cwd = fileURLToPath(new URL('../../../frontend/portfolio/', import.meta.url))
  next = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--webpack', '-p', String(port)], {
    cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NEXT_BUILD_DIR: '.next-admin-verification', PORTFOLIO_API_URL: apiUrl, NEXT_PUBLIC_API_URL: apiUrl, NEXT_TELEMETRY_DISABLED: '1' },
  })
  let serverLog = ''
  next.stdout.on('data', (chunk) => { serverLog = (serverLog + chunk).slice(-12000) })
  next.stderr.on('data', (chunk) => { serverLog = (serverLog + chunk).slice(-12000) })
  for (let attempt = 0; attempt < 80; attempt++) {
    if (next.exitCode !== null) throw new Error(`Test frontend exited: ${serverLog}`)
    try { if ((await fetch(`${base}/admin/login`)).ok) break } catch { /* startup */ }
    if (attempt === 79) throw new Error(`Test frontend failed to start: ${serverLog}`)
    await pause(500)
  }
  const matrix = [
    { name: 'chromium-desktop', engine: chromium, width: 1440, height: 900 },
    { name: 'firefox-desktop', engine: firefox, width: 1366, height: 768 },
    { name: 'webkit-desktop', engine: webkit, width: 1440, height: 900 },
    { name: 'iphone-small', engine: webkit, width: 375, height: 667, mobile: true },
    { name: 'iphone-modern', engine: webkit, width: 390, height: 844, mobile: true },
    { name: 'android-small', engine: chromium, width: 360, height: 800, mobile: true },
    { name: 'tablet', engine: webkit, width: 768, height: 1024, mobile: true },
  ]
  const selected = matrix.filter((device) => !process.env.ADMIN_TEST_DEVICE || device.name === process.env.ADMIN_TEST_DEVICE)
  assert.ok(selected.length, 'unknown ADMIN_TEST_DEVICE')
  for (const device of selected) {
    const browser = await device.engine.launch({ headless: true })
    const context = await browser.newContext({ viewport: { width: device.width, height: device.height }, hasTouch: !!device.mobile, isMobile: !!device.mobile })
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true })
    const page = await context.newPage()
    page.setDefaultTimeout(15000)
    const errors = []
    const navigationAborts = []
    let replacingDocument = false
    const reloadPage = async () => {
      replacingDocument = true
      try { await page.reload() } finally { replacingDocument = false }
    }
    const mutations = []
    page.on('response', async (response) => {
      if (response.request().method() !== 'GET' && response.url().includes('/api/')) mutations.push({ path: new URL(response.url()).pathname, status: response.status(), ...(response.status() >= 400 ? { error: await response.text() } : {}) })
    })
    page.on('pageerror', (error) => {
      // Confirmed in the WebKit trace: an in-flight polling fetch is cancelled
      // between reload start and the replacement document. Preserve diagnostics;
      // never ignore this error during normal interaction or for another URL.
      if (device.engine === webkit && replacingDocument &&
          error.name.startsWith('Fetch API cannot load') &&
          error.message.includes(`/localhost:${port}/api/admin/publication-jobs due to access control checks.`)) {
        navigationAborts.push(error.message)
      } else errors.push(error.message)
    })
    const checkLayout = async (label) => {
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${device.name}: overflow ${label}`)
    }
    const waitForDashboardStats = async () => {
      // Labels also render while loading. Each fixture metric must show its real
      // value before replacing the document, and again after the reload.
      for (const label of ['Unread Messages', 'Published Articles', 'Portfolio Projects', 'Featured Projects']) {
        const card = page.getByText(label, { exact: true }).locator('../..')
        await card.getByText('0', { exact: true }).waitFor({ state: 'visible' })
      }
    }
    const login = async () => {
      await page.getByLabel('Email address').fill(email)
      await page.getByLabel('Password', { exact: true }).fill(password)
      await page.getByRole('button', { name: 'Sign in', exact: true }).click()
      await page.waitForURL((url) => url.pathname.startsWith('/admin') && url.pathname !== '/admin/login')
      await page.waitForLoadState('networkidle')
    }
    try {
      await page.goto(`${base}/admin`)
      await page.waitForURL('**/admin/login')
      await login()
      await waitForDashboardStats()
      await reloadPage()
      await waitForDashboardStats()
      await checkLayout('dashboard')

      // Real project create/update/remove, including clearing an optional URL.
      await page.getByRole('link', { name: 'Projects', exact: true }).click()
      await page.getByRole('button', { name: 'Add project', exact: true }).click()
      await page.getByRole('button', { name: 'Create project', exact: true }).click()
      await page.getByText('Title and description are required.').waitFor()
      await page.getByLabel('Title *', { exact: true }).fill(`Project ${device.name}`)
      await page.getByLabel('Description *', { exact: true }).fill('A disposable project for real browser testing.')
      await page.getByLabel('GitHub URL', { exact: true }).fill('https://github.com/example/test')
      await checkLayout('project editor')
      await page.getByRole('button', { name: 'Create project', exact: true }).click()
      await until(() => Project.exists({ title: `Project ${device.name}` }), 'project creation')
      await page.getByRole('button', { name: 'Edit', exact: true }).click()
      await page.getByLabel('GitHub URL', { exact: true }).fill('')
      await page.getByLabel('Description *', { exact: true }).fill('Updated project description')
      await page.getByRole('button', { name: 'Save changes', exact: true }).click()
      await until(async () => (await Project.findOne({ title: `Project ${device.name}` }))?.githubUrl === '', 'clear GitHub URL')
      await page.getByRole('button', { name: 'Feature', exact: true }).click()
      await until(() => Project.exists({ featured: true }), 'feature project')
      await page.getByRole('button', { name: 'Published', exact: true }).click()
      await until(() => Project.exists({ published: false }), 'hide project')
      await page.getByRole('button', { name: 'Delete', exact: true }).click()
      await page.getByRole('button', { name: 'No', exact: true }).click()
      assert.equal(await Project.countDocuments(), 1)
      await page.getByRole('button', { name: 'Delete', exact: true }).click()
      await page.getByRole('button', { name: 'Yes', exact: true }).click()
      await until(async () => await Project.countDocuments() === 0, 'delete project')

      // Draft, full-body reload, publish, withdraw, rename, feature, delete.
      await page.getByRole('link', { name: 'Blog', exact: true }).click()
      await page.getByRole('button', { name: 'New article', exact: true }).click()
      await page.getByLabel('Article title', { exact: true }).fill(`Article ${device.name}`)
      await page.getByLabel('Article content', { exact: true }).fill('## Original body\n\nFull article content must survive editing.')
      await page.getByLabel('Category *', { exact: true }).selectOption('Web Development')
      await checkLayout('blog editor')
      await page.getByRole('button', { name: 'Save draft', exact: true }).click()
      await until(() => Post.exists({ published: false }), 'create draft')
      await page.getByRole('button', { name: 'Edit', exact: true }).click()
      await until(async () => (await page.getByLabel('Article content', { exact: true }).inputValue()).includes('Original body'), 'load full article body')
      await page.getByLabel('Article title', { exact: true }).fill(`Renamed ${device.name}`)
      await page.getByRole('dialog').getByRole('button', { name: 'Publish', exact: true }).click()
      await until(() => Post.exists({ published: true, title: `Renamed ${device.name}` }), 'publish and rename')
      await page.getByRole('button', { name: 'Feature', exact: true }).click()
      await until(() => Post.exists({ featured: true }), 'feature article')
      await page.getByRole('button', { name: 'Unpublish', exact: true }).click()
      await until(() => Post.exists({ published: false }), 'withdraw article')
      await page.getByRole('button', { name: 'Delete', exact: true }).click()
      await page.getByRole('button', { name: 'Cancel', exact: true }).waitFor()
      await page.getByRole('button', { name: 'Delete', exact: true }).click()
      await until(async () => await Post.countDocuments() === 0, 'delete article')

      const message = await Contact.create({ name: `Contact ${device.name}`, email: 'contact@example.test', message: 'A disposable contact message for browser verification.' })
      await page.getByRole('link', { name: 'Messages', exact: true }).click()
      await page.getByText(message.name, { exact: true }).click()
      await until(() => Contact.exists({ _id: message._id, status: 'read' }), 'mark read on open')
      await checkLayout('message dialog')
      await page.getByRole('dialog').getByRole('button', { name: 'Archive', exact: true }).click()
      await until(() => Contact.exists({ _id: message._id, status: 'archived' }), 'archive message')
      await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
      await until(async () => !await Contact.exists({ _id: message._id }), 'delete message')

      if (device.name === 'chromium-desktop') {
        // Exercise pagination/filtering against real database queries, not route mocks.
        await Contact.insertMany(Array.from({ length: 21 }, (_, index) => ({
          name: `Pagination contact ${index}`, email: 'pagination@example.test',
          message: 'Disposable pagination fixture', status: index === 20 ? 'archived' : 'unread',
        })))
        await reloadPage()
        await page.getByRole('button', { name: /Next/ }).click()
        await page.getByText('2 / 2', { exact: true }).waitFor()
        await page.getByRole('button', { name: 'Archived', exact: true }).click()
        await page.getByText('Pagination contact 20', { exact: true }).waitFor()
        assert.equal(await page.getByText('2 / 2', { exact: true }).count(), 0)
        await page.getByRole('button', { name: 'All', exact: true }).click()
        await page.getByPlaceholder(/Search messages/).fill('Pagination contact 17')
        await page.getByRole('button', { name: 'Go', exact: true }).click()
        await page.getByText('Pagination contact 17', { exact: true }).waitFor()
        await page.getByText('Pagination contact 17', { exact: true }).click()
        await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
        await page.getByText('No messages', { exact: true }).waitFor()
        await Contact.deleteMany({ email: 'pagination@example.test' })

        const job = await PublicationJob.findOneAndUpdate({}, { $set: { status: 'retrying', lastError: 'Disposable retry check', leaseUntil: null } }, { new: true })
        await reloadPage()
        await page.getByText('Publication details', { exact: true }).click()
        await page.getByRole('button', { name: 'Retry publication', exact: true }).click()
        await until(() => PublicationJob.exists({ _id: job._id, status: 'queued', lastError: '' }), 'publication retry')
      }

      await page.getByRole('link', { name: 'Settings', exact: true }).click()
      await page.getByLabel('About text', { exact: true }).fill(`Saved by ${device.name}`)
      assert.equal(await page.getByLabel('About text', { exact: true }).inputValue(), `Saved by ${device.name}`)
      await page.getByRole('button', { name: 'Save settings', exact: true }).click()
      await until(() => Settings.exists({ aboutText: `Saved by ${device.name}` }), 'save settings')
      await page.waitForLoadState('networkidle')
      await reloadPage()
      await until(async () => (await page.getByLabel('About text', { exact: true }).inputValue()) === `Saved by ${device.name}`, 'settings persist')
      await checkLayout('settings')
      await page.screenshot({ path: fileURLToPath(new URL(`${device.name}.png`, output)), fullPage: true })

      // A failed settings read must not expose an empty, savable form.
      await page.route(`${base}/api/admin/settings`, (route) => route.fulfill({ status: 503, json: { message: 'Temporary settings outage' } }))
      await page.waitForLoadState('networkidle')
      await reloadPage()
      await page.getByRole('button', { name: 'Retry loading settings' }).waitFor()
      assert.equal(await page.getByRole('button', { name: 'Save settings', exact: true }).count(), 0)
      await page.unroute(`${base}/api/admin/settings`)
      await page.getByRole('button', { name: 'Retry loading settings' }).click()
      await page.getByLabel('About text', { exact: true }).waitFor()
      await page.getByRole('button', { name: 'Log out', exact: true }).click()
      await page.waitForURL('**/admin/login')
      await login()
      assert.deepEqual(errors, [], 'runtime errors during admin operations')
      // Deliberately revoke the session then navigate. WebKit can report aborted
      // in-flight polling during this teardown; operation errors were checked above.
      await context.clearCookies()
      await page.goto(`${base}/admin/projects`)
      await page.waitForURL('**/admin/login')
      const item = { device: device.name, engine: device.engine.name(), version: browser.version(), status: 'passed', navigationAborts }
      report.push(item)
      console.log('PASS', JSON.stringify(item))
    } catch (error) {
      await context.tracing.stop({ path: fileURLToPath(new URL('trace.zip', output)) }).catch(() => {})
      await page.screenshot({ path: fileURLToPath(new URL(`${device.name}-failure.png`, output)), fullPage: true }).catch(() => {})
      console.error('FAILED:', device.name, new URL(page.url()).pathname)
      console.error('Recent mutation results:', mutations.slice(-5))
      console.error('Fixture saved biography:', (await Settings.findOne())?.aboutText)
      throw error
    } finally { await browser.close() }
  }
  assert.ok(await PublicationJob.countDocuments() > 0, 'content mutations must enqueue publication')
  await writeFile(new URL(process.env.ADMIN_TEST_DEVICE ? `report-${process.env.ADMIN_TEST_DEVICE}.json` : 'report.json', output), JSON.stringify(report, null, 2))
} finally {
  if (next && next.exitCode === null) { const stopped = once(next, 'exit'); next.kill(); await stopped }
  if (api) await new Promise((resolve) => api.close(resolve))
  await mongoose.disconnect()
  await replica.stop()
}
