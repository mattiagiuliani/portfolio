import { expect, test } from '@playwright/test'

test('public Home renders its fixture and primary navigation works @home-smoke', async ({ page }) => {
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  const response = await page.goto('/')
  expect(response?.status(), 'Home document should return HTTP 200').toBe(200)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^Home Harness Fixture 1A /)
  await expect(page.getByText(/HOME E2E FIXTURE [\da-f-]+: isolated public Home data\./)).toBeVisible()

  const projectNavigation = page.locator('header nav').getByRole('link', { name: 'Projects', exact: true })
  if (await page.getByRole('button', { name: 'Toggle menu' }).isVisible()) {
    await page.getByRole('button', { name: 'Toggle menu' }).click()
  }
  await expect(projectNavigation).toBeVisible()
  await projectNavigation.click()
  await expect(page).toHaveURL(/#projects$/)
  await expect(page.locator('#projects')).toBeAttached()
  await page.getByRole('heading', { name: 'Checkpoint 1A Fixture Project', exact: true }).scrollIntoViewIfNeeded()
  await expect(page.getByRole('heading', { name: 'Checkpoint 1A Fixture Project', exact: true })).toBeVisible()

  await page.locator('#hero').getByRole('link', { name: /Let’s talk/ }).click()
  await expect(page).toHaveURL(/#contact$/)
  await expect(page.getByRole('heading', { name: 'Let’s build what’s next.' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Home must not overflow horizontally').toBe(true)
  expect(pageErrors, 'Home must not produce uncaught page errors').toEqual([])
})