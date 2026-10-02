import { expect, test } from '@playwright/test'

async function openHome(page, width) {
  await page.setViewportSize({ width, height: 900 })
  const response = await page.goto('/')
  expect(response?.status(), `Home document should return HTTP 200 at ${width}px`).toBe(200)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `No horizontal overflow at ${width}px`).toBe(true)
}

test('Hero stacks at 760px and below and sits side by side above it @home-layout-boundary', async ({ page }) => {
  const tolerance = 4
  for (const width of [759, 760, 761, 767, 768, 769]) {
    await openHome(page, width)
    const copy = await page.locator('#hero .hero-copy').boundingBox()
    const portrait = await page.locator('#hero .hero-portrait-wrap').boundingBox()
    expect(copy && portrait, `Hero regions should render at ${width}px`).toBeTruthy()
    const sideBySide = portrait.x >= copy.x + copy.width - tolerance && Math.abs((copy.y + copy.height / 2) - (portrait.y + portrait.height / 2)) < Math.max(copy.height, portrait.height)
    const stacked = portrait.y >= copy.y + copy.height - tolerance && Math.abs(portrait.x - copy.x) < copy.width
    if (width <= 760) {
      expect(stacked, `Hero portrait should be stacked below copy at ${width}px (copy ${JSON.stringify(copy)}, portrait ${JSON.stringify(portrait)})`).toBe(true)
      expect(sideBySide, `Hero regions must not be side by side at ${width}px`).toBe(false)
    } else {
      expect(sideBySide, `Hero regions should be side by side at ${width}px (copy ${JSON.stringify(copy)}, portrait ${JSON.stringify(portrait)})`).toBe(true)
      expect(stacked, `Hero regions must not be stacked at ${width}px`).toBe(false)
    }
  }
})

test('Navigation switches between menu and inline links at 768px @home-layout-boundary', async ({ page }) => {
  const menuButton = page.getByRole('button', { name: 'Toggle menu' })
  const projectsLink = page.locator('header nav').getByRole('link', { name: 'Projects', exact: true })

  for (const width of [759, 760, 761, 767, 768, 769]) {
    await openHome(page, width)
    if (width < 768) {
      await expect(menuButton, `Mobile menu should be available at ${width}px`).toBeVisible()
      if (await menuButton.getAttribute('aria-expanded') !== 'true') await menuButton.click()
    } else {
      await expect(menuButton, `Mobile menu should be hidden at ${width}px`).toBeHidden()
    }
    await expect(projectsLink, `Projects link should be visible at ${width}px`).toBeVisible()
    await projectsLink.click()
    await expect(page).toHaveURL(/#projects$/)
  }
})

test('Home remains usable in representative landscape orientations @home-layout-landscape', async ({ page }) => {
  const response = await page.goto('/')
  expect(response?.status(), 'Home document should return HTTP 200').toBe(200)
  expect(await page.evaluate(() => matchMedia('(orientation: landscape)').matches), 'This profile must emulate landscape orientation').toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Landscape Home must not overflow horizontally').toBe(true)

  const menuButton = page.getByRole('button', { name: 'Toggle menu' })
  const navLink = (name) => page.locator('header nav').getByRole('link', { name, exact: true })
  const openNav = async () => { if (await menuButton.isVisible() && await menuButton.getAttribute('aria-expanded') !== 'true') await menuButton.click() }

  await openNav()
  await navLink('Projects').click()
  await expect(page).toHaveURL(/#projects$/)
  const project = page.getByRole('heading', { name: 'Checkpoint 1A Fixture Project', exact: true })
  await expect(page.locator('#projects')).toBeInViewport()
  await project.scrollIntoViewIfNeeded()
  await expect(project).toBeInViewport()

  // The navbar hides after scrolling down, so reload at the top as a user would.
  await page.goto('/')
  await openNav()
  await navLink('Contact').click()
  await expect(page).toHaveURL(/#contact$/)
  const contact = page.locator('#contact')
  await expect(contact.getByRole('heading', { name: /build what.s next/ })).toBeInViewport()
  const emailLink = contact.getByRole('link', { name: /home-fixture@example\.invalid/ })
  await expect(emailLink).toBeVisible()
  await expect(emailLink).toHaveAttribute('href', 'mailto:home-fixture@example.invalid')
  const submit = contact.locator('button[type=submit]')
  await submit.scrollIntoViewIfNeeded()
  await expect(submit).toBeInViewport()
})