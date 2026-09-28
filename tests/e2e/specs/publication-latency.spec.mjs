import { test } from '@playwright/test'
import { runScenario } from '../support/run-scenario.mjs'

test('@publication-latency committed publication is claimed before the recovery poll', async ({}, testInfo) => {
  await runScenario('publication-latency', testInfo)
})
