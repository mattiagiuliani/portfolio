import { test } from '@playwright/test'
import { runScenario } from '../support/run-scenario.mjs'

test('@publication-status observes queued work promptly with bounded serialized refreshes', async ({}, testInfo) => {
  await runScenario('publication-status', testInfo)
})
