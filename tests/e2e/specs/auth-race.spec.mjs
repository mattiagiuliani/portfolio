import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import webpackPackage from '../../../frontend/portfolio/node_modules/next/dist/compiled/webpack/webpack.js'

const here = (path) => fileURLToPath(new URL(path, import.meta.url))

async function buildProbe(testInfo, realLock = false) {
  // Use installed tooling, real React and real production modules; no Next server,
  // database, credentials, timers or manually dispatched expiration events.
  const compiler = webpackPackage.webpack({
    mode: 'development', devtool: false,
    entry: here('../support/auth-probe.mjs'),
    output: { path: testInfo.outputPath('bundle'), filename: 'probe.js' },
    resolve: {
      extensions: ['.js', '.jsx', '.mjs'],
      modules: [here('../../../frontend/portfolio/node_modules'), 'node_modules'],
      // Keep testing generation ownership even when transport serialization
      // would prevent these completion orders in ordinary login/logout calls.
      alias: realLock ? {} : { './authTransition.js$': here('../support/auth-generation-scheduler.mjs') },
    },
    module: { rules: [{ test: /\.jsx$/, use: here('../support/auth-jsx-loader.mjs') }] },
  })
  try {
    await new Promise((resolve, reject) => compiler.run((error, stats) => {
      if (error || stats.hasErrors()) reject(error ?? new Error(stats.toString({ all: false, errors: true })))
      else resolve()
    }))
  } finally {
    await new Promise((resolve, reject) => compiler.close((error) => error ? reject(error) : resolve()))
  }
  const bundle = await readFile(testInfo.outputPath('bundle', 'probe.js'), 'utf8')
  return bundle
}

test('@auth-regression stale admin 401 must not clear a newer login', async ({ page }, testInfo) => {
  const bundle = await buildProbe(testInfo)
  const newerUser = { id: 'new-session-user', name: 'New admin', role: 'admin' }
  let oldRoute
  const oldStarted = new Promise((resolve) => { oldRoute = resolve })
  await page.route('http://auth.test/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname === '/api/admin/stats') { oldRoute(route); return }
    if (pathname === '/api/auth/me') {
      await route.fulfill({ json: { user: { id: 'old-session-user' } } })
    } else if (pathname === '/api/auth/login') {
      await route.fulfill({ json: { success: true, user: newerUser } })
    } else {
      await route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' })
    }
  })
  await page.goto('http://auth.test/')
  await page.addScriptTag({ content: bundle })
  await expect(page.locator('output')).toHaveText('old-session-user')
  await page.evaluate(() => window.startOldRequest())
  const delayedRequest = await oldStarted
  await page.evaluate(() => window.authProbe.login('admin@example.test', 'test-only'))
  await expect(page.locator('output')).toHaveText(newerUser.id)

  // Deliver only the obsolete response after the newer login has committed.
  await delayedRequest.fulfill({ status: 401, json: { message: 'Authentication required' } })
  expect(await page.evaluate(() => window.oldRequest)).toBe(401)
  await expect(page.locator('output'), 'stale 401 must preserve the newer authenticated user').toHaveText(newerUser.id)
})

test('@auth-regression queued old logout 401 cannot expire a newer queued login', async ({ page }, testInfo) => {
  await page.route('https://auth.test/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/logout') return route.fulfill({ status: 401, json: { message: 'Expired' } })
    if (path.startsWith('/api/')) return route.fulfill({ json: { user: { id: path.endsWith('/login') ? 'new-session-user' : 'old-session-user' } } })
    return route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' })
  })
  await page.goto('https://auth.test/')
  await page.addScriptTag({ content: await buildProbe(testInfo, true) })
  await expect(page.locator('output')).toHaveText('old-session-user')
  // A held transition in another tab would create the same queue. Hold the real
  // origin lock explicitly so both operations are queued before any HTTP is sent.
  await page.evaluate(() => {
    window.holder = navigator.locks.request('portfolio-admin-auth-transition', () => new Promise((resolve) => { window.releaseHolder = resolve }))
  })
  await page.waitForFunction(() => !!window.releaseHolder)
  await page.evaluate(() => {
    window.queuedLogout = window.authProbe.logout().catch((error) => error.status)
    window.queuedLogin = window.authProbe.login('new@example.test', 'test-only')
  })
  await page.waitForFunction(async () => (await navigator.locks.query()).pending.length === 2)
  await page.evaluate(() => window.releaseHolder())
  expect(await page.evaluate(() => window.queuedLogout)).toBe(401)
  await page.evaluate(() => window.queuedLogin)
  await expect(page.locator('output')).toHaveText('new-session-user')
})

// Each case uses a fresh browser page and module instance.
async function mountProbe(page, testInfo) {
  await page.route('http://auth.test/**', (route) => {
    const pathname = new URL(route.request().url()).pathname
    return pathname.startsWith('/api/')
      ? route.fulfill({ json: { user: { id: pathname === '/api/auth/login' ? 'new-session-user' : 'old-session-user' } } })
      : route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' })
  })
  await page.goto('http://auth.test/')
  await page.addScriptTag({ content: await buildProbe(testInfo) })
  await expect(page.locator('output')).toHaveText('old-session-user')
}

function holdNext(page, pathname) {
  return new Promise((resolve) => {
    page.route(`http://auth.test${pathname}`, (route) => resolve(route), { times: 1 })
  })
}

test('@auth-regression current-generation 401 expires the session', async ({ page }, testInfo) => {
  await mountProbe(page, testInfo)
  await page.route('**/api/admin/stats', (route) => route.fulfill({ status: 401, json: { message: 'Authentication required' } }))
  await page.evaluate(() => window.startOldRequest())
  expect(await page.evaluate(() => window.oldRequest)).toBe(401)
  await expect(page.locator('output')).toHaveText('anonymous')
})

for (const operation of ['login', 'logout', 'checkAuth']) {
  test(`@auth-regression old ${operation} completion cannot overwrite newer login`, async ({ page }, testInfo) => {
    await mountProbe(page, testInfo)
    const pendingRoute = holdNext(page, operation === 'checkAuth' ? '/api/auth/me' : `/api/auth/${operation}`)
    await page.evaluate((operation) => {
      window.pendingAuth = window.authProbe[operation]('old@example.test', 'test-only')
    }, operation)
    const delayed = await pendingRoute
    await page.evaluate(() => window.authProbe.login('new@example.test', 'test-only'))
    await expect(page.locator('output')).toHaveText('new-session-user')
    await delayed.fulfill({ json: { user: { id: 'obsolete-user' } } })
    await page.evaluate(() => window.pendingAuth)
    await expect(page.locator('output')).toHaveText('new-session-user')
  })
}

test('@auth-regression old login completion cannot undo newer logout', async ({ page }, testInfo) => {
  await mountProbe(page, testInfo)
  const pendingRoute = holdNext(page, '/api/auth/login')
  await page.evaluate(() => { window.pendingAuth = window.authProbe.login('old@example.test', 'test-only') })
  const delayed = await pendingRoute
  await page.evaluate(() => window.authProbe.logout())
  await expect(page.locator('output')).toHaveText('anonymous')
  await delayed.fulfill({ json: { user: { id: 'obsolete-user' } } })
  await page.evaluate(() => window.pendingAuth)
  await expect(page.locator('output')).toHaveText('anonymous')
})

test('@auth-regression request started during login cannot expire its completed session', async ({ page }, testInfo) => {
  await mountProbe(page, testInfo)
  const pendingLogin = holdNext(page, '/api/auth/login')
  await page.evaluate(() => { window.pendingAuth = window.authProbe.login('new@example.test', 'test-only') })
  const login = await pendingLogin
  const pendingStats = holdNext(page, '/api/admin/stats')
  await page.evaluate(() => window.startOldRequest())
  const stats = await pendingStats
  await login.fulfill({ json: { user: { id: 'new-session-user' } } })
  await page.evaluate(() => window.pendingAuth)
  await expect(page.locator('output')).toHaveText('new-session-user')
  await stats.fulfill({ status: 401, json: { message: 'Authentication required' } })
  expect(await page.evaluate(() => window.oldRequest)).toBe(401)
  await expect(page.locator('output')).toHaveText('new-session-user')
})
