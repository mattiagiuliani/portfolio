import assert from 'node:assert/strict'
import { once } from 'node:events'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import express from '../../../backend/node_modules/express/index.js'
import cookieParser from '../../../backend/node_modules/cookie-parser/index.js'
import mongoose from '../../../backend/node_modules/mongoose/index.js'
import { MongoMemoryReplSet } from '../../../backend/node_modules/mongodb-memory-server/index.js'
import Admin from '../../../backend/src/models/Admin.js'
import authRoutes from '../../../backend/src/routes/authRoutes.js'
import adminRoutes from '../../../backend/src/routes/adminRoutes.js'
import { buildAuthClient } from '../support/build-auth-client.mjs'
import { freePort } from '../support/environment.mjs'

// Disposable process/database only. No .env, production credentials, modified JWT
// lifetime, mocked middleware, browser cookie injection or intercepted HTTP routes.
process.env.NODE_ENV = 'development'
process.env.JWT_SECRET = 'disposable-cookie-race-test-secret'
const logoutRace = process.env.COOKIE_RACE_MODE === 'logout'
const reverse = process.env.COOKIE_RACE_MODE === 'reverse'
const serialized = logoutRace || reverse
const port = await freePort()
const base = `http://localhost:${port}`
process.env.FRONTEND_ORIGIN = base
const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
let api, next, browser, releaseResponse
try {
  await mongoose.connect(replica.getUri())
  const credentials = { email: 'owner@example.test', password: 'Disposable-password-123' }
  const owner = await Admin.create({ ...credentials, name: 'Owner', role: 'super_admin' })
  const app = express()
  app.use(express.json(), cookieParser())
  let signalHeld
  const held = new Promise((resolve) => { signalHeld = resolve })
  let holdEnabled = false
  let transitionRequests = 0
  app.use('/api/auth', (req, _res, nextMiddleware) => {
    if (req.path === '/login' || req.path === '/logout') transitionRequests++
    nextMiddleware()
  })
  app.use(serialized ? (reverse ? '/api/auth/login' : '/api/auth/logout') : '/api/admin/stats', (req, res, nextMiddleware) => {
    if (!holdEnabled) return nextMiddleware()
    // Hold the real middleware's complete response BEFORE headers reach Next.
    // This models network/response delay, not an invented 401 or cookie header.
    const end = res.end
    res.end = function (...args) {
      releaseResponse = () => {
        releaseResponse = undefined
        return end.apply(res, args)
      }
      signalHeld({ status: res.statusCode, setCookie: res.getHeader('set-cookie'), hadCookie: !!req.cookies.admin_token })
      return res
    }
    nextMiddleware()
  })
  app.use('/api/auth', authRoutes)
  app.use('/api/admin', adminRoutes)
  api = app.listen(0, '127.0.0.1')
  await once(api, 'listening')
  const apiUrl = `http://127.0.0.1:${api.address().port}`
  next = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--webpack', '-p', String(port)], {
    cwd: fileURLToPath(new URL('../../../frontend/portfolio/', import.meta.url)),
    windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NEXT_BUILD_DIR: '.next-cookie-race', PORTFOLIO_API_URL: apiUrl, NEXT_PUBLIC_API_URL: apiUrl, NEXT_TELEMETRY_DISABLED: '1' },
  })
  let serverLog = ''
  next.stdout.on('data', (chunk) => { serverLog = (serverLog + chunk).slice(-6000) })
  next.stderr.on('data', (chunk) => { serverLog = (serverLog + chunk).slice(-6000) })
  for (let attempt = 0; attempt < 80; attempt++) {
    if (next.exitCode !== null) throw new Error(serverLog)
    try { if ((await fetch(`${base}/api/auth/me`)).status === 401) break } catch { /* startup */ }
    if (attempt === 79) throw new Error(`Next startup timed out: ${serverLog}`)
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()
  // An API document supplies the real Next origin without mounting admin polling.
  await page.goto(`${base}/api/auth/me`)
  const bundle = await buildAuthClient(process.env.E2E_ARTIFACT_DIR)
  await page.addScriptTag({ content: bundle })
  const login = (tab = page) => tab.evaluate(async (credentials) => {
    await window.authClient.login(credentials.email, credentials.password)
    return 200
  }, credentials)
  const me = () => page.evaluate(async () => (await fetch('/api/auth/me')).status)
  const cookie = async () => (await context.cookies(base)).find((item) => item.name === 'admin_token')
  assert.equal(await login(), 200)
  assert.equal(await me(), 200)
  assert.ok(await cookie(), 'session A set by real login')

  holdEnabled = true
  let loginTab = page
  if (serialized) {
    loginTab = await context.newPage()
    await loginTab.goto(`${base}/api/auth/me`)
    await loginTab.addScriptTag({ content: bundle })
    await page.evaluate(({ reverse, credentials }) => {
      window.oldResponse = (reverse ? window.authClient.login(credentials.email, credentials.password) : window.authClient.logout()).then(() => 200)
    }, { reverse, credentials })
  } else {
    // A real rejection condition in the disposable database only.
    await Admin.updateOne({ _id: owner._id }, { $set: { isActive: false } })
    await page.evaluate(() => { window.oldResponse = fetch('/api/admin/stats').then((res) => res.status) })
  }
  const old = await held
  assert.equal(old.hadCookie, true)
  if (serialized) {
    assert.equal(old.status, 200)
    if (logoutRace) assert.match(String(old.setCookie), /admin_token=;.*Expires=Thu, 01 Jan 1970/i)
  } else {
    assert.equal(old.status, 401)
    assert.equal(old.setCookie, undefined, 'protected 401 must not mutate cookies')
    await Admin.updateOne({ _id: owner._id }, { $set: { isActive: true } })
  }
  if (serialized) {
    const requestsBeforeQueue = transitionRequests
    await loginTab.evaluate(({ reverse, credentials }) => {
      window.queuedAuth = (reverse ? window.authClient.logout() : window.authClient.login(credentials.email, credentials.password)).then(() => 200)
    }, { reverse, credentials })
    await loginTab.waitForFunction(async () => {
      const locks = await navigator.locks.query()
      return locks.pending.some((lock) => lock.name === 'portfolio-admin-auth-transition')
    })
    assert.equal(transitionRequests, requestsBeforeQueue, 'queued operation must not send HTTP yet')
    // /me and protected reads remain usable while an auth operation owns the lock.
    assert.equal(await me(), 200)
    await loginTab.evaluate(() => window.dashboardClient.getStats())
    holdEnabled = false
    releaseResponse()
    assert.equal(await page.evaluate(() => window.oldResponse), 200)
    assert.equal(await loginTab.evaluate(() => window.queuedAuth), 200)
    console.log('Serialized order:', reverse ? 'login completed -> logout sent' : 'logout completed -> login sent')
  } else {
    assert.equal(await login(loginTab), 200)
  }
  if (reverse) {
    assert.equal(await cookie(), undefined, 'newer explicit logout must clear cookie')
    assert.equal(await me(), 401)
    console.log('Reverse final state: cookiePresent=false, meStatus=401')
  } else {
    const newerCookie = await cookie()
    assert.ok(newerCookie, 'session B cookie is stored')
    assert.equal(await me(), 200, 'session B is valid after login completion')
    console.log('After newer login:', JSON.stringify({ cookiePresent: true, httpOnly: newerCookie.httpOnly, sameSite: newerCookie.sameSite, secure: newerCookie.secure, path: newerCookie.path, meStatus: 200 }))
    console.log('Real delayed response:', JSON.stringify({ status: old.status, setCookie: old.setCookie, tabs: logoutRace ? 2 : 1 }))
    releaseResponse?.()
    assert.equal(await page.evaluate(() => window.oldResponse), logoutRace ? 200 : 401)
    const afterCookie = await cookie()
    const afterMe = await me()
    console.log('Final cookie state:', JSON.stringify({ cookiePresent: !!afterCookie, meStatus: afterMe }))
    // Preserve the original regression invariants: cookie and authentication survive.
    assert.ok(afterCookie, logoutRace ? 'stale logout must not delete the newer admin_token cookie' : 'stale protected 401 must not delete the newer admin_token cookie')
    assert.equal(afterMe, 200, 'newer login must remain authenticated')
  }
} finally {
  releaseResponse?.()
  await browser?.close()
  if (next?.pid && next.exitCode === null) {
    // Only terminate the process tree this scenario created.
    if (process.platform === 'win32') {
      const killer = spawn('taskkill', ['/PID', String(next.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
      await once(killer, 'close')
    } else next.kill('SIGTERM')
  }
  if (api) { api.closeAllConnections(); await new Promise((resolve) => api.close(resolve)) }
  await mongoose.disconnect()
  await replica.stop()
}
