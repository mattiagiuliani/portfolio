import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const here = (path) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  testDir: here('./specs'),
  outputDir: here('./artifacts/results'),
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 300_000,
  reporter: [
    ['list'],
    ['html', { outputFolder: here('./artifacts/html'), open: 'never' }],
    ['junit', { outputFile: here('./artifacts/junit.xml') }],
  ],
  projects: [
    'chromium-desktop', 'firefox-desktop', 'webkit-desktop',
    'iphone-small', 'iphone-modern', 'android-small', 'tablet',
  ].map((name) => ({ name, testMatch: name === 'chromium-desktop' ? '**/*.spec.mjs' : '**/admin.spec.mjs' })),
})
