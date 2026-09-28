import assert from 'node:assert/strict'
import { once } from 'node:events'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'
import express from '../../../backend/node_modules/express/index.js'
import cookieParser from '../../../backend/node_modules/cookie-parser/index.js'
import mongoose from '../../../backend/node_modules/mongoose/index.js'
import { MongoMemoryReplSet } from '../../../backend/node_modules/mongodb-memory-server/index.js'
import Admin from '../../../backend/src/models/Admin.js'
import Settings from '../../../backend/src/models/Settings.js'
import Project from '../../../backend/src/models/Project.js'
import Post from '../../../backend/src/models/Post.js'
import PublicationJob from '../../../backend/src/models/PublicationJob.js'
import authRoutes from '../../../backend/src/routes/authRoutes.js'
import adminRoutes from '../../../backend/src/routes/adminRoutes.js'
import publicRoutes from '../../../backend/src/routes/publicRoutes.js'
import postRoutes from '../../../backend/src/routes/postRoutes.js'
import errorHandler from '../../../backend/src/middleware/errorHandler.js'
import { startPublicationWorker } from '../../../backend/src/services/publicationQueue.js'
import { freePort } from '../support/environment.mjs'

// Instrumentation is confined to this disposable process. Real wall-clock worker
// and UI intervals, real transactions, and a production Next build (not next dev).
process.env.NODE_ENV = 'development'
process.env.JWT_SECRET = 'publication-measurement-disposable-secret'
process.env.REVALIDATION_SECRET = 'publication-measurement-local-only'
delete process.env.PUBLICATION_POLL_MS
delete process.env.PUBLICATION_REQUEST_TIMEOUT_MS
delete process.env.FRONTEND_REVALIDATE_URL
const port = await freePort()
const base = `http://127.0.0.1:${port}`
process.env.PUBLIC_SITE_URL = base
process.env.FRONTEND_ORIGIN = base
const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
const WORKER_PICKUP_MAX_MS = 5000
let api, next, browser, stopWorker, measuring = false, emptyPoll, measuredJobId
const events = {}
const eventWaiters = new Map()
const statusPolls = []
const mark = (name) => {
  events[name] ??= performance.now()
  for (const resolve of eventWaiters.get(name) ?? []) resolve(events[name])
}
const waitForMark = (name, timeoutMs) => {
  if (events[name] !== undefined) return Promise.resolve(events[name])
  return new Promise((resolve, reject) => {
    const listeners = eventWaiters.get(name) ?? new Set()
    let timer
    const finish = (time) => {
      clearTimeout(timer)
      listeners.delete(finish)
      if (!listeners.size) eventWaiters.delete(name)
      resolve(time)
    }
    timer = setTimeout(() => {
      listeners.delete(finish)
      if (!listeners.size) eventWaiters.delete(name)
      reject(new Error(`Timed out waiting for ${name}`))
    }, timeoutMs)
    listeners.add(finish)
    eventWaiters.set(name, listeners)
  })
}
const elapsedMs = (from, to) => events[from] === undefined || events[to] === undefined
  ? null
  : Math.round((events[to] - events[from]) * 10) / 10
const measurementReport = () => ({
  milestonesMsFromMutation: Object.fromEntries(Object.entries({
    mutationReceived: 'mutation_received',
    contentWriteCompleted: 'content_write_completed',
    publicationJobInserted: 'publication_job_inserted',
    transactionCommitted: 'transaction_committed',
    workerClaimed: 'worker_claimed',
    revalidationStarted: 'revalidation_started',
    revalidationAcknowledged: 'revalidation_acknowledged',
    publicHtmlFresh: 'public_html_fresh',
    adminObserved: 'admin_observed',
  }).map(([label, name]) => [label, elapsedMs('mutation_received', name)])),
  intervalsMs: {
    mutationToCommit: elapsedMs('mutation_received', 'transaction_committed'),
    commitToWorkerPickup: elapsedMs('transaction_committed', 'worker_claimed'),
    pickupToRevalidation: elapsedMs('worker_claimed', 'revalidation_started'),
    revalidationRoundTrip: elapsedMs('revalidation_started', 'revalidation_acknowledged'),
    commitToPublicHtmlFresh: elapsedMs('transaction_committed', 'public_html_fresh'),
    commitToAdminObservation: elapsedMs('transaction_committed', 'admin_observed'),
  },
  statusPollsMsFromMutation: statusPolls.map((time) => Math.round((time - events.mutation_received) * 10) / 10),
})
const marker = 'Measured publication paragraph'
const originalExec = mongoose.Query.prototype.exec
const originalCreate = PublicationJob.create
const originalTransaction = mongoose.connection.transaction
const originalFetch = globalThis.fetch
try {
  await mkdir(process.env.E2E_ARTIFACT_DIR, { recursive: true })
  await mongoose.connect(replica.getUri())
  await Promise.all([Admin, Settings, Project, Post, PublicationJob].map((model) => model.init()))
  const credentials = { email: 'owner@example.test', password: 'Disposable-test-password-123' }
  await Admin.create({ ...credentials, name: 'Test Owner', role: 'super_admin' })
  await Settings.create({ singletonKey: 'default', name: 'Test Owner', email: credentials.email, aboutText: 'Original paragraph' })
  await Project.create({ title: 'Measured project', description: 'Fixture project', published: true })
  await Post.create({ title: 'Measured article', content: 'Fixture body', category: 'Web Development', published: true })

  mongoose.Query.prototype.exec = async function (...args) {
    const result = await originalExec.apply(this, args)
    if (measuring) {
      if (this.model === Settings && this.op === 'findOneAndUpdate') mark('content_write_completed')
      if (this.model === PublicationJob && this.op === 'find' && this.getFilter().nextAttemptAt && result.length === 0) {
        emptyPoll?.()
      }
      if (this.model === PublicationJob && this.op === 'findOneAndUpdate' && this.getUpdate().$inc?.attempts && result) {
        events.workerClaimedJobId = String(result._id)
        mark('worker_claimed')
      }
    }
    return result
  }
  PublicationJob.create = async function (...args) {
    const result = await originalCreate.apply(this, args)
    if (measuring) mark('publication_job_inserted')
    return result
  }
  mongoose.connection.transaction = async function (...args) {
    const result = await originalTransaction.apply(this, args)
    if (measuring) mark('transaction_committed')
    return result
  }
  globalThis.fetch = async (url, options) => {
    const webhook = String(url) === `${base}/api/internal/revalidate`
    if (measuring && webhook) mark('revalidation_started')
    const response = await originalFetch(url, options)
    if (measuring && webhook) {
      const body = await response.clone().json()
      if (response.ok && body.accepted) mark('revalidation_acknowledged')
    }
    if (measuring && String(url) === `${base}/`) {
      if ((await response.clone().text()).includes(marker)) mark('public_html_fresh')
    }
    return response
  }

  const app = express()
  app.use(express.json(), cookieParser())
  app.use((req, res, nextMiddleware) => {
    if (measuring && req.method === 'PUT' && req.path === '/api/admin/settings') {
      mark('mutation_received')
    }
    nextMiddleware()
  })
  app.use('/api/auth', authRoutes)
  app.use('/api/admin', adminRoutes)
  app.use('/api/posts', postRoutes)
  app.use('/api', publicRoutes)
  app.use(errorHandler)
  api = app.listen(0, '127.0.0.1')
  await once(api, 'listening')
  const apiUrl = `http://127.0.0.1:${api.address().port}`
  const env = { ...process.env, NEXT_BUILD_DIR: `.next-verification/latency-${process.pid}`, PORTFOLIO_API_URL: apiUrl, NEXT_PUBLIC_API_URL: apiUrl, SITE_URL: base, VERCEL_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' }
  delete env.NODE_ENV
  const cwd = fileURLToPath(new URL('../../../frontend/portfolio/', import.meta.url))
  const launch = (args) => spawn(process.execPath, ['node_modules/next/dist/bin/next', ...args], { cwd, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  const build = launch(['build', '--webpack'])
  let buildLog = ''
  build.stdout.on('data', (chunk) => { buildLog += chunk })
  build.stderr.on('data', (chunk) => { buildLog += chunk })
  assert.equal((await once(build, 'exit'))[0], 0, buildLog)
  next = launch(['start', '-H', '127.0.0.1', '-p', String(port)])
  let serverLog = ''
  next.stdout.on('data', (chunk) => { serverLog += chunk })
  next.stderr.on('data', (chunk) => { serverLog += chunk })
  for (let attempt = 0; attempt < 80; attempt++) {
    if (next.exitCode !== null) throw new Error(serverLog)
    try { if ((await fetch(base)).ok) break } catch { /* startup only */ }
    if (attempt === 79) throw new Error('Next startup timeout')
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto(`${base}/admin/settings`)
  await page.getByLabel('Email address').fill(credentials.email)
  await page.getByLabel('Password', { exact: true }).fill(credentials.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByLabel('About text', { exact: true }).fill(marker)
  page.on('response', (response) => {
    if (response.url().endsWith('/api/admin/publication-jobs')) statusPolls.push(performance.now())
  })
  measuring = true
  const pollCompleted = new Promise((resolve) => { emptyPoll = resolve })
  stopWorker = startPublicationWorker()
  await pollCompleted
  // No arbitrary 15-second sleep: save is synchronized with the empty scan.
  const saved = page.waitForResponse((response) => response.url().endsWith('/api/admin/settings') && response.request().method() === 'PUT')
  await page.getByRole('button', { name: 'Save settings', exact: true }).click()
  const result = await (await saved).json()
  assert.equal(result.publication.status, 'queued')
  measuredJobId = result.publication.id
  assert.ok(await PublicationJob.findById(measuredJobId))
  const commitTime = events.transaction_committed
  assert.ok(commitTime !== undefined, 'the publication transaction must commit before returning')
  // Five seconds leaves CI headroom while failing well before the 15-second recovery poll.
  const pickupDeadlineMs = WORKER_PICKUP_MAX_MS - (performance.now() - commitTime)
  let workerClaimedAt
  try {
    workerClaimedAt = await waitForMark('worker_claimed', pickupDeadlineMs)
  } catch {
    assert.fail(`Publication worker did not claim committed job ${measuredJobId} within ${WORKER_PICKUP_MAX_MS}ms; ${JSON.stringify(measurementReport())}`)
  }
  assert.equal(events.workerClaimedJobId, measuredJobId, 'the worker must claim the committed publication job')
  assert.ok(workerClaimedAt - commitTime <= WORKER_PICKUP_MAX_MS, `worker pickup exceeded ${WORKER_PICKUP_MAX_MS}ms; ${JSON.stringify(measurementReport())}`)
  const publicApi = await (await fetch(`${apiUrl}/api/settings`)).json()
  assert.equal(publicApi.data.aboutText, marker)
  await expect(page.getByRole('status').filter({ hasText: 'Latest publication completed' })).toBeVisible({ timeout: 65000 })
  mark('admin_observed')
  stopWorker(); stopWorker = undefined
  const job = await PublicationJob.findById(result.publication.id)
  assert.equal(job.status, 'published', job.lastError)
  assert.equal(job.attempts, 1, 'normal path must not rely on outer retries')
  assert.ok(events.public_html_fresh, `Next must serve the updated public HTML; ${JSON.stringify(measurementReport())}`)
  const report = { ...measurementReport(), attempts: job.attempts }
  console.log(JSON.stringify(report, null, 2))
  await writeFile(`${process.env.E2E_ARTIFACT_DIR}/timeline.json`, JSON.stringify(report, null, 2))
} catch (error) {
  console.error(JSON.stringify({ failure: error.message, ...measurementReport() }, null, 2))
  throw error
} finally {
  stopWorker?.()
  await browser?.close()
  if (next?.pid && next.exitCode === null) {
    if (process.platform === 'win32') {
      const killer = spawn('taskkill', ['/PID', String(next.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
      await once(killer, 'close')
    } else {
      const exited = once(next, 'exit')
      next.kill('SIGTERM')
      await exited
    }
  }
  if (api) { api.closeAllConnections(); await new Promise((resolve) => api.close(resolve)) }
  globalThis.fetch = originalFetch
  mongoose.Query.prototype.exec = originalExec
  PublicationJob.create = originalCreate
  mongoose.connection.transaction = originalTransaction
  await mongoose.disconnect()
  await replica.stop()
}
