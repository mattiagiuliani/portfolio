import { test } from '@playwright/test'
import { runScenario } from '../support/run-scenario.mjs'

test('@admin authentication, CRUD, settings, recovery and responsive layout', async ({}, testInfo) => {
  await runScenario('admin', testInfo, { ADMIN_TEST_DEVICE: testInfo.project.name })
})
