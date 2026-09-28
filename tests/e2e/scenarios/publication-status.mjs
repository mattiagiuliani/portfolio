import assert from 'node:assert/strict'
import { once } from 'node:events'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import express from '../../../backend/node_modules/express/index.js'
import cors from '../../../backend/node_modules/cors/lib/index.js'
import cookieParser from '../../../backend/node_modules/cookie-parser/index.js'
import mongoose from '../../../backend/node_modules/mongoose/index.js'
import { MongoMemoryReplSet } from '../../../backend/node_modules/mongodb-memory-server/index.js'
import Admin from '../../../backend/src/models/Admin.js'
import Contact from '../../../backend/src/models/Contact.js'
import Post from '../../../backend/src/models/Post.js'
import Project from '../../../backend/src/models/Project.js'
import PublicationJob from '../../../backend/src/models/PublicationJob.js'
import Settings from '../../../backend/src/models/Settings.js'
import authRoutes from '../../../backend/src/routes/authRoutes.js'
import adminRoutes from '../../../backend/src/routes/adminRoutes.js'
import publicRoutes from '../../../backend/src/routes/publicRoutes.js'
import postRoutes from '../../../backend/src/routes/postRoutes.js'
import errorHandler from '../../../backend/src/middleware/errorHandler.js'
import { freePort } from '../support/environment.mjs'

const { chromium, expect } = await import('@playwright/test')
process.env.NODE_ENV = 'development'
process.env.JWT_SECRET = 'disposable-publication-status-test-secret'
const port = await freePort()
const base = `http://localhost:${port}`
process.env.FRONTEND_ORIGIN = base
delete process.env.PUBLIC_SITE_URL
delete process.env.FRONTEND_REVALIDATE_URL
const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
let api, next, browser
const credentials = { email: 'status-admin@example.test', password: 'Disposable-test-password-123' }
const deferred = () => {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}
try {
  await mongoose.connect(replica.getUri())
  await Promise.all([Admin, Contact, Post, Project, PublicationJob, Settings].map((model) => model.init()))
  await Admin.create({ ...credentials, name: 'Status Test Admin', role: 'super_admin' })
  await Settings.create({ name: 'Status Test Portfolio', email: credentials.email, aboutText: 'Status fixture' })

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
    env: { ...process.env, NEXT_BUILD_DIR: `.next-verification/status-${process.pid}`, PORTFOLIO_API_URL: apiUrl, NEXT_PUBLIC_API_URL: apiUrl, NEXT_TELEMETRY_DISABLED: '1' },
  })
  let serverLog = ''
  next.stdout.on('data', (chunk) => { serverLog = (serverLog + chunk).slice(-10000) })
  next.stderr.on('data', (chunk) => { serverLog = (serverLog + chunk).slice(-10000) })
  for (let attempt = 0; attempt < 80; attempt++) {
    if (next.exitCode !== null) throw new Error(`Test frontend exited: ${serverLog}`)
    try { if ((await fetch(`${base}/admin/login`)).ok) break } catch { /* startup */ }
    if (attempt === 79) throw new Error(`Test frontend failed to start: ${serverLog}`)
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  page.setDefaultTimeout(15000)
  const runtimeErrors = []
  page.on('pageerror', (error) => runtimeErrors.push(error.message))

  let statusCalls = 0
  const activeStatusRequests = new Set()
  let maxActiveStatusRequests = 0
  const statusTimeline = []
  let statusRows = []
  const statusResponses = []
  let heldStatusResponse = null
  const statusWaiters = []
  const isStatusRequest = (request) => new URL(request.url()).pathname === '/api/admin/publication-jobs'
  page.on('request', (request) => {
    if (!isStatusRequest(request)) return
    activeStatusRequests.add(request)
    maxActiveStatusRequests = Math.max(maxActiveStatusRequests, activeStatusRequests.size)
    statusTimeline.push({ event: 'start', active: activeStatusRequests.size, at: Date.now() })
  })
  page.on('requestfinished', (request) => {
    if (isStatusRequest(request)) statusTimeline.push({ event: 'finish', active: activeStatusRequests.size - 1, at: Date.now() })
    activeStatusRequests.delete(request)
  })
  page.on('requestfailed', (request) => activeStatusRequests.delete(request))
  const waitForStatusCalls = (target) => {
    if (statusCalls >= target) return Promise.resolve()
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out waiting for status request ${target}; have ${statusCalls}`)), 10000)
      statusWaiters.push({ target, resolve: () => { clearTimeout(timer); resolve() } })
    })
  }
  const signalStatusCall = () => {
    for (let index = statusWaiters.length - 1; index >= 0; index--) {
      if (statusCalls >= statusWaiters[index].target) statusWaiters.splice(index, 1)[0].resolve()
    }
  }
  await page.route('**/api/admin/publication-jobs', async (route) => {
    statusCalls++
    signalStatusCall()
    const held = heldStatusResponse
    heldStatusResponse = null
    const rows = held ? await held.promise : (statusResponses.length ? statusResponses.shift() : statusRows)
    await route.fulfill({ json: { success: true, data: rows } }).catch(() => {})
  })

  let mutationPublication = { id: 'job-mutation', status: 'queued' }
  await page.route('**/api/admin/settings', async (route) => {
    if (route.request().method() !== 'PUT') return route.continue()
    await route.fulfill({ json: { success: true, data: { aboutText: 'Updated fixture' }, publication: mutationPublication } })
  })
  await page.route('**/api/admin/publication-jobs/*/retry', async (route) => {
    await route.fulfill({ json: { success: true, data: { id: 'job-retry', status: 'queued', attempts: 2, paths: ['/'] } } })
  })

  await page.goto(`${base}/admin/login`)
  await page.clock.install({ time: new Date('2026-09-28T12:00:00Z') })
  await page.getByLabel('Email address').fill(credentials.email)
  await page.getByLabel('Password', { exact: true }).fill(credentials.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.waitForURL('**/admin')
  await page.getByRole('link', { name: 'Settings', exact: true }).click()
  await page.getByLabel('About text', { exact: true }).waitFor()
  await waitForStatusCalls(1)

  await page.evaluate(() => {
    window.__publicationEvents = []
    window.addEventListener('publication-updated', (event) => {
      window.__publicationEvents.push({ custom: event instanceof CustomEvent, detail: event.detail })
    })
  })
  statusResponses.push(
    [{ _id: 'job-mutation', status: 'queued', paths: ['/'] }],
    [{ _id: 'job-mutation', status: 'published', paths: ['/'] }]
  )
  let targetCalls = statusCalls + 1
  await page.getByLabel('About text', { exact: true }).fill('Queued fixture')
  await page.getByRole('button', { name: 'Save settings', exact: true }).click()
  await waitForStatusCalls(targetCalls)
  await expect(page.getByRole('status')).toContainText('pending')
  await page.getByText('Publication details', { exact: true }).click()
  await expect(page.getByText('Saved — awaiting publication')).toBeVisible()
  const eventContract = await page.evaluate(() => window.__publicationEvents.at(-1))
  assert.deepEqual(eventContract, { custom: true, detail: { jobId: 'job-mutation', status: 'queued' } })
  await page.clock.runFor(750)
  await expect(page.getByRole('status')).toHaveText('Latest publication completed')
  await expect(page.getByText('Public pages verified')).toBeVisible()
  const afterPublished = statusCalls
  await page.clock.runFor(7000)
  assert.equal(statusCalls, afterPublished, 'published stops the temporary watcher')

  statusRows = [{ _id: 'job-retry', status: 'retrying', paths: ['/'], lastError: 'Fixture outage' }]
  targetCalls = statusCalls + 1
  await page.clock.runFor(15000)
  await waitForStatusCalls(targetCalls)
  await expect(page.getByRole('button', { name: 'Retry publication' })).toBeVisible()
  await page.getByRole('button', { name: 'Retry publication' }).click()
  statusResponses.push(
    [{ _id: 'job-retry', status: 'queued', paths: ['/'] }],
    [{ _id: 'job-retry', status: 'published', paths: ['/'] }]
  )
  targetCalls = statusCalls + 1
  await waitForStatusCalls(targetCalls)
  await expect(page.getByText('Saved — awaiting publication')).toBeVisible()
  assert.deepEqual(await page.evaluate(() => window.__publicationEvents.at(-1)), {
    custom: true, detail: { jobId: 'job-retry', status: 'queued' },
  })
  await page.clock.runFor(750)
  await expect(page.getByText('Public pages verified')).toBeVisible()

  mutationPublication = { status: 'not-required' }
  const beforeNotRequired = statusCalls
  const settingsSave = page.waitForResponse((response) => response.url().endsWith('/api/admin/settings') && response.request().method() === 'PUT')
  await page.getByLabel('About text', { exact: true }).fill('No publication fixture')
  await page.getByRole('button', { name: 'Save settings', exact: true }).click()
  await settingsSave
  await page.clock.runFor(750)
  assert.equal(statusCalls, beforeNotRequired, 'not-required does not start temporary observation')
  assert.deepEqual(await page.evaluate(() => window.__publicationEvents.at(-1)).then((event) => event.detail), {
    jobId: 'job-retry', status: 'queued',
  }, 'not-required does not emit publication-updated')

  const gate = deferred()
  heldStatusResponse = gate
  statusResponses.push([{ _id: 'job-a', status: 'published', paths: ['/'] }])
  await page.evaluate(() => {
    window.__statusHistory = []
    const status = document.querySelector('[role="status"]')
    new MutationObserver(() => window.__statusHistory.push(status?.textContent ?? '')).observe(status, { childList: true, subtree: true, characterData: true })
    window.dispatchEvent(new CustomEvent('publication-updated', { detail: { jobId: 'job-a', status: 'queued' } }))
  })
  targetCalls = statusCalls + 1
  await waitForStatusCalls(targetCalls)
  await page.evaluate(() => {
    for (const jobId of ['job-a', 'job-a', 'job-b', 'job-b']) {
      window.dispatchEvent(new CustomEvent('publication-updated', { detail: { jobId, status: 'queued' } }))
    }
  })
  gate.resolve([
    { _id: 'job-a', status: 'queued', paths: ['/'] },
    { _id: 'job-b', status: 'queued', paths: ['/'] },
  ])
  statusRows = [
    { _id: 'job-a', status: 'published', paths: ['/'] },
    { _id: 'job-b', status: 'published', paths: ['/'] },
  ]
  await waitForStatusCalls(targetCalls + 1)
  await expect(page.getByRole('status')).toHaveText('Latest publication completed')
  assert.equal(statusCalls, targetCalls + 1, 'overlapping events coalesce into one follow-up refresh')
  assert.equal(maxActiveStatusRequests, 1, `status requests are serialized: ${JSON.stringify(statusTimeline)}`)
  assert.deepEqual(await page.evaluate(() => window.__statusHistory), [], 'stale queued response is not rendered')

  statusResponses.push(
    [{ _id: 'job-visible', status: 'queued', paths: ['/'] }],
    [{ _id: 'job-visible', status: 'published', paths: ['/'] }]
  )
  targetCalls = statusCalls + 1
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('publication-updated', { detail: { jobId: 'job-visible', status: 'queued' } })))
  await waitForStatusCalls(targetCalls)
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  assert.equal(statusCalls, targetCalls, 'hidden state does not trigger an extra refresh')
  targetCalls = statusCalls + 1
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await waitForStatusCalls(targetCalls)
  await expect(page.getByRole('status')).toHaveText('Latest publication completed')
  const afterVisibility = statusCalls
  await page.clock.runFor(750)
  assert.ok(statusCalls - afterVisibility <= 1, 'terminal status stops the fast watcher; at most one fallback tick is due')

  const unmountGate = deferred()
  heldStatusResponse = unmountGate
  targetCalls = statusCalls + 1
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('publication-updated', { detail: { jobId: 'job-unmount', status: 'queued' } })))
  await waitForStatusCalls(targetCalls)
  await page.getByRole('button', { name: 'Log out' }).click()
  await page.waitForURL('**/admin/login')
  unmountGate.resolve([{ _id: 'job-unmount', status: 'queued', paths: ['/'] }])
  const afterUnmount = statusCalls
  await page.clock.runFor(30000)
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('publication-updated', { detail: { jobId: 'job-after-unmount', status: 'queued' } })))
  assert.equal(statusCalls, afterUnmount, 'unmount clears polling and removes event listener')
  assert.deepEqual(runtimeErrors, [], 'publication status interactions have no runtime errors')
  console.log(JSON.stringify({ statusRequests: statusCalls, maxConcurrentStatusRequests: maxActiveStatusRequests, eventContract, result: 'passed' }))
} finally {
  await browser?.close()
  if (next && next.exitCode === null) { const exited = once(next, 'exit'); next.kill(); await exited }
  if (api) { api.closeAllConnections(); await new Promise((resolve) => api.close(resolve)) }
  await mongoose.disconnect()
  await replica.stop()
}
