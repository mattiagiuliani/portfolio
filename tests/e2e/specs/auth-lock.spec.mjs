import { test, expect, firefox, webkit } from '@playwright/test'
import { buildAuthClient } from '../support/build-auth-client.mjs'

async function mount(page, testInfo) {
  await page.route('https://auth.test/**', (route) => route.fulfill({ contentType: 'text/html', body: '<div></div>' }))
  await page.goto('https://auth.test/')
  await page.addScriptTag({ content: await buildAuthClient(testInfo.outputPath('bundle')) })
}

for (const operation of ['login', 'logout']) {
  for (const failure of ['401', 'network']) {
    test(`@auth-lock ${operation} ${failure} releases lock and preserves failure`, async ({ page }, testInfo) => {
      await mount(page, testInfo)
      await page.route(`**/api/auth/${operation}`, (route) => failure === 'network'
        ? route.abort('failed')
        : route.fulfill({ status: 401, json: { message: 'Denied' } }), { times: 1 })
      const error = await page.evaluate(async (operation) => {
        try { await window.authClient[operation]('test@example.test', 'test-only') }
        catch (error) { return { status: error.status, message: error.message } }
      }, operation)
      if (failure === '401') expect(error).toEqual({ status: 401, message: 'Denied' })
      else expect(error.message).toBeTruthy()
      const locks = await page.evaluate(() => navigator.locks.query())
      expect(locks.held).toEqual([])
      await page.route('**/api/auth/login', (route) => route.fulfill({ json: { user: { id: 'new-user' } } }))
      expect(await page.evaluate(() => window.authClient.login('test@example.test', 'test-only'))).toEqual({ user: { id: 'new-user' } })
    })
  }
}

test('@auth-lock unsupported browsers fail closed without sending credentials', async ({ page }, testInfo) => {
  await mount(page, testInfo)
  let requests = 0
  page.on('request', (request) => { if (request.url().includes('/api/auth/')) requests++ })
  const messages = await page.evaluate(async () => {
    Object.defineProperty(navigator, 'locks', { value: undefined })
    return Promise.all(['login', 'logout'].map(async (operation) => {
      try { await window.authClient[operation]('test@example.test', 'test-only') }
      catch (error) { return error.message }
    }))
  })
  for (const message of messages) expect(message).toContain('Web Locks')
  expect(requests).toBe(0)
})

for (const [name, engine] of [['Firefox', firefox], ['WebKit', webkit]]) {
  test(`@auth-lock ${name} shares the real lock across tabs`, async ({}, testInfo) => {
    const browser = await engine.launch()
    try {
      const context = await browser.newContext()
      const a = await context.newPage()
      const b = await context.newPage()
      await mount(a, testInfo)
      await mount(b, testInfo)
      let heldRoute
      const received = new Promise((resolve) => { heldRoute = resolve })
      await a.route('**/api/auth/logout', (route) => heldRoute(route))
      await a.evaluate(() => { window.first = window.authClient.logout() })
      const delayed = await received
      let loginSent = false
      await b.route('**/api/auth/login', (route) => {
        loginSent = true
        return route.fulfill({ json: { user: { id: 'new-user' } } })
      })
      await b.evaluate(() => { window.second = window.authClient.login('test@example.test', 'test-only') })
      await b.waitForFunction(async () => (await navigator.locks.query()).pending.length === 1)
      expect(loginSent).toBe(false)
      await delayed.fulfill({ json: { success: true } })
      await a.evaluate(() => window.first)
      expect(await b.evaluate(() => window.second)).toEqual({ user: { id: 'new-user' } })
      expect(loginSent).toBe(true)
    } finally {
      await browser.close()
    }
  })
}
