import { test } from '@playwright/test'
import { runScenario } from '../support/run-scenario.mjs'

test('@media admin uploads, associates, replaces and removes content images', async ({}, testInfo) => {
  await runScenario('media', testInfo)
})