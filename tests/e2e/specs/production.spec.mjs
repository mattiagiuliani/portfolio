import { test } from '@playwright/test'
import { runScenario } from '../support/run-scenario.mjs'

test('@production build, SSR, SEO, branding and ISR publishing', async ({}, testInfo) => {
  // The production scenario itself verifies all three browser engines.
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Production matrix runs once')
  await runScenario('production', testInfo)
})
