import { defineConfig, devices } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { shellQuote } from './support/shell-quote.mjs'

const here = (path) => fileURLToPath(new URL(path, import.meta.url))
const host = '127.0.0.1'
const port = Number(process.env.HOME_E2E_PORT || 4179)
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error(`HOME_E2E_PORT must be an integer from 1024 to 65535; received ${process.env.HOME_E2E_PORT}`)
}
const baseURL = `http://${host}:${port}`
const runId = randomUUID()
process.env.HOME_E2E_RUN_ID = runId

export default defineConfig({
  testDir: here('./home'),
  outputDir: here('./artifacts/home-results'),
  globalTeardown: here('./support/home-teardown.mjs'),
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: here('./artifacts/home-html'), open: 'never' }],
    ['junit', { outputFile: here('./artifacts/home-junit.xml') }],
  ],
  use: { baseURL, headless: true },
  webServer: {
    command: `${shellQuote(process.execPath)} ${shellQuote(here('./support/home-server.mjs'))}`,
    timeout: 300_000,
    reuseExistingServer: false,
    wait: { stdout: /HOME_E2E_READY/ },
    env: { ...process.env, HOME_E2E_PORT: String(port), HOME_E2E_HOST: host, HOME_E2E_RUN_ID: runId },
  },
  projects: [
    {
      name: 'chromium-desktop',
      testMatch: ['**/home-smoke.spec.mjs', '**/home-cinematic.spec.mjs'],
      use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'firefox-desktop',
      testMatch: ['**/home-smoke.spec.mjs', '**/home-cinematic.spec.mjs'],
      use: { browserName: 'firefox', viewport: { width: 1366, height: 768 } },
    },
    {
      name: 'webkit-desktop',
      testMatch: ['**/home-smoke.spec.mjs', '**/home-cinematic.spec.mjs'],
      use: { browserName: 'webkit', viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'iphone-small',
      testMatch: ['**/home-smoke.spec.mjs', '**/home-cinematic.spec.mjs'],
      use: { ...devices['iPhone SE'], viewport: { width: 375, height: 667 } },
    },
    {
      name: 'iphone-modern',
      testMatch: ['**/home-smoke.spec.mjs', '**/home-cinematic.spec.mjs'],
      use: { ...devices['iPhone 15'], viewport: { width: 390, height: 844 } },
    },
    {
      name: 'android-small',
      testMatch: ['**/home-smoke.spec.mjs', '**/home-cinematic.spec.mjs'],
      use: { ...devices['Pixel 7'], viewport: { width: 360, height: 800 } },
    },
    {
      name: 'tablet',
      testMatch: ['**/home-smoke.spec.mjs', '**/home-cinematic.spec.mjs'],
      use: { ...devices['iPad (gen 7)'], viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'chromium-boundary',
      testMatch: '**/home-layout.spec.mjs',
      grep: /@home-layout-boundary/,
      use: { browserName: 'chromium', viewport: { width: 768, height: 900 } },
    },
    {
      name: 'iphone-landscape',
      testMatch: '**/home-layout.spec.mjs',
      grep: /@home-layout-landscape/,
      use: { ...devices['iPhone 13 landscape'] },
    },
    {
      name: 'tablet-landscape',
      testMatch: '**/home-layout.spec.mjs',
      grep: /@home-layout-landscape/,
      use: { ...devices['iPad (gen 7) landscape'] },
    },
  ],
})