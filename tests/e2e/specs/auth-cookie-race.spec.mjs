import { test } from '@playwright/test'
import { runScenario } from '../support/run-scenario.mjs'

test('@cookie-regression delayed protected 401 must preserve the newer login cookie', async ({}, testInfo) => {
  await runScenario('auth-cookie-race', testInfo)
})
