import { test } from '@playwright/test'
import { runScenario } from '../support/run-scenario.mjs'

test('@logout-order delayed logout in tab A must preserve newer login from tab B', async ({}, testInfo) => {
  await runScenario('auth-cookie-race', testInfo, { COOKIE_RACE_MODE: 'logout' })
})

test('@logout-order login first makes newer logout wait and remain authoritative', async ({}, testInfo) => {
  await runScenario('auth-cookie-race', testInfo, { COOKIE_RACE_MODE: 'reverse' })
})
