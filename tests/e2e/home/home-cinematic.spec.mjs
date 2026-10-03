import { expect, test } from '@playwright/test'

const SECTIONS = ['hero', 'projects', 'about', 'skills', 'blog', 'contact', 'universe']
const SOURCE = /mg-universe-bg\.mp4/

const video = (page) => page.locator('video[data-cinematic-video]')
const stage = (page) => page.locator('[data-cinematic-stage]')
const dialog = (page) => page.getByRole('dialog', { name: 'MG Universe, full film' })

function observeMediaSources(page) {
  const sources = new Set()
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname
    if (/\/brand\/mg-universe(?:-bg)?\.(?:mp4|webm)$/.test(pathname)) sources.add(pathname)
  })
  return sources
}

async function observedMediaSources(page, requests) {
  const resourceTiming = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname))
  const filmPath = /\/brand\/mg-universe(?:-bg)?\.(?:mp4|webm)$/
  const paths = [...new Set([...requests, ...resourceTiming.filter((pathname) => filmPath.test(pathname))])].sort()
  if (paths.length > 0) return expect(paths).toEqual(['/brand/mg-universe-bg.mp4'])

  const readFallback = () => page.evaluate(() => ({
    path: document.querySelector('video').currentSrc ? new URL(document.querySelector('video').currentSrc).pathname : '',
    loadstart: window.__cine.loadstart,
  }))
  const expected = (await readFallback()).path ? { path: '/brand/mg-universe-bg.mp4', loadstart: 1 } : { path: '', loadstart: 0 }
  // loadstart fires asynchronously after the source is attached.
  await expect.poll(readFallback, { message: 'Use the selected source and one loadstart where the engine hides media requests' }).toEqual(expected)
}

test.beforeEach(async ({ page }) => {
  // Records every <video> insertion/removal and every media load so remounts and source swaps are observable.
  await page.addInitScript(() => {
    const log = { added: 0, removed: 0, loadstart: 0 }
    const seen = new Set()
    const videosIn = (nodes) => [...nodes].flatMap((node) => (node.nodeName === 'VIDEO' ? [node] : [...(node.querySelectorAll?.('video') || [])]))
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of videosIn(record.addedNodes)) seen.add(node)
        log.removed += videosIn(record.removedNodes).length
      }
      log.added = seen.size
    }).observe(document, { childList: true, subtree: true })
    document.addEventListener('loadstart', (event) => { if (event.target.nodeName === 'VIDEO') log.loadstart += 1 }, true)
    window.__cine = log
  })
})

function collectErrors(page) {
  const errors = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`) })
  return errors
}

async function waitForMetadata(page) {
  return page.evaluate(() => new Promise((resolve) => {
    const node = document.querySelector('video')
    const done = () => resolve(node.error ? 'error' : 'ready')
    if (node.readyState >= 1 || node.error) return done()
    node.addEventListener('loadedmetadata', done, { once: true })
    node.addEventListener('error', done, { once: true })
    return undefined
  }))
}

async function loadHome(page) {
  const response = await page.goto('/')
  expect(response?.status()).toBe(200)
  await expect(page.locator('video')).toHaveCount(1)
}

// Returns whether the engine could decode the film; timeline checks only apply when it could.
async function tagAndSeek(page, seconds) {
  await expect(video(page)).toHaveAttribute('src', SOURCE)
  const media = await waitForMetadata(page)
  await page.evaluate((target) => {
    window.__node = document.querySelector('video')
    window.__src = window.__node.currentSrc
    if (window.__node.readyState >= 1) window.__node.currentTime = target
  }, seconds)
  if (media === 'error') test.info().annotations.push({ type: 'media', description: 'This engine cannot decode the film; timeline assertions skipped.' })
  return media === 'ready'
}

const sameNode = (page) => page.evaluate(() => document.querySelector('video') === window.__node)
const noHorizontalOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)

async function expectForeground(page, locator, label) {
  await locator.scrollIntoViewIfNeeded()
  await expect(locator, label).toBeVisible()
  const reachable = await locator.evaluate((element) => {
    const box = element.getBoundingClientRect()
    const top = document.elementFromPoint(box.left + box.width / 2, Math.min(box.top + box.height / 2, innerHeight - 1))
    return !!top && (element.contains(top) || top.contains(element)) && !top.closest('[data-cinematic-stage]')
  })
  expect(reachable, `${label} must be the topmost hit target, not the video layer`).toBe(true)
}

test('one persistent video survives navigation across every Home section @home-cinematic', async ({ page }) => {
  const errors = collectErrors(page)
  const mediaSources = observeMediaSources(page)
  await loadHome(page)
  const seekable = await tagAndSeek(page, 7)

  const visited = []
  for (const id of SECTIONS) {
    // Optional sections (e.g. the blog preview without posts) render nothing.
    if (!(await page.evaluate((target) => !!document.getElementById(target), id))) continue
    visited.push(id)
    await page.evaluate((target) => document.getElementById(target).scrollIntoView({ block: 'start' }), id)
    if (id === 'blog') {
      const article = page.getByRole('heading', { name: 'Checkpoint 1B Fixture Article', exact: true })
      await article.scrollIntoViewIfNeeded()
      await expect(article, 'Blog content is visible during section traversal').toBeInViewport()
    }
    await expect(page.locator('video'), `Exactly one video at #${id}`).toHaveCount(1)
    expect(await sameNode(page), `Same DOM node at #${id}`).toBe(true)
    expect(await page.evaluate(() => document.querySelector('video').currentSrc), `Source unchanged at #${id}`).toBe(await page.evaluate(() => window.__src))
  }
  expect(visited, 'All Home sections are traversed').toEqual(expect.arrayContaining(['hero', 'projects', 'about', 'skills', 'blog', 'contact', 'universe']))

  const link = page.locator('header nav').getByRole('link', { name: 'Skills', exact: true })
  await page.evaluate(() => window.scrollTo(0, 0))
  const menu = page.getByRole('button', { name: 'Toggle menu' })
  if (await menu.isVisible()) await menu.click()
  await link.click()
  await expect(page).toHaveURL(/#skills$/)

  const log = await page.evaluate(() => window.__cine)
  expect(log.added, 'The video is inserted into the DOM exactly once').toBe(1)
  expect(log.removed, 'The video is never removed').toBe(0)
  expect(log.loadstart, 'The media resource is loaded exactly once').toBe(1)
  await observedMediaSources(page, mediaSources)
  expect(await sameNode(page)).toBe(true)
  if (seekable) {
    const time = await page.evaluate(() => document.querySelector('video').currentTime)
    expect(time, 'Section navigation must not reset the timeline').toBeGreaterThanOrEqual(7)
  }
  expect(await noHorizontalOverflow(page)).toBe(true)
  expect(errors).toEqual([])
})

test('the background layer sits behind Home and never blocks interaction @home-cinematic', async ({ page }) => {
  await loadHome(page)
  const layers = await page.evaluate(() => {
    const stageStyle = getComputedStyle(document.querySelector('[data-cinematic-stage]'))
    const videoStyle = getComputedStyle(document.querySelector('video'))
    const contentStyle = getComputedStyle(document.querySelector('.cine-content'))
    const box = document.querySelector('video').getBoundingClientRect()
    return {
      position: stageStyle.position, stagePointer: stageStyle.pointerEvents, videoPointer: videoStyle.pointerEvents,
      stageZ: Number(stageStyle.zIndex), contentZ: Number(contentStyle.zIndex), fit: videoStyle.objectFit,
      covers: box.width >= innerWidth - 1 && box.height >= innerHeight - 1,
      stageHidden: document.querySelector('[data-cinematic-stage]').getAttribute('aria-hidden'),
      videoHidden: document.querySelector('video').getAttribute('aria-hidden'),
      controls: document.querySelector('video').hasAttribute('controls'),
      muted: document.querySelector('video').muted, loops: document.querySelector('video').loop,
    }
  })
  expect(layers).toMatchObject({ position: 'fixed', stagePointer: 'none', videoPointer: 'none', fit: 'cover', covers: true, stageHidden: 'true', videoHidden: 'true', controls: false, muted: true, loops: true })
  expect(layers.stageZ).toBeLessThan(layers.contentZ)

  await expectForeground(page, page.locator('#hero').getByRole('link', { name: /Explore my work/ }), 'Hero CTA')
  await page.locator('#hero').getByRole('link', { name: /Explore my work/ }).click()
  await expect(page).toHaveURL(/#projects$/)
  await expectForeground(page, page.getByRole('heading', { name: 'Checkpoint 1A Fixture Project', exact: true }), 'Project card')
  await expectForeground(page, page.locator('#contact').getByRole('link', { name: /home-fixture@example\.invalid/ }), 'Contact email')
  await page.locator('#name').fill('Cinematic Tester')
  await expect(page.locator('#name')).toHaveValue('Cinematic Tester')

  await page.goto('/')
  await page.evaluate(() => window.scrollTo(0, 0))
  const menu = page.getByRole('button', { name: 'Toggle menu' })
  if (await menu.isVisible()) await menu.click()
  const contactNavigation = page.locator('header nav').getByRole('link', { name: 'Contact', exact: true })
  await expect(contactNavigation).toBeVisible()
  await contactNavigation.click()
  await expect(page).toHaveURL(/#contact$/)
  await expect(page.locator('video')).toHaveCount(1)
  expect(await noHorizontalOverflow(page)).toBe(true)
})

test('the full film reuses the same video node and returns to the background @home-cinematic', async ({ page }) => {
  const errors = collectErrors(page)
  const mediaSources = observeMediaSources(page)
  await loadHome(page)
  const seekable = await tagAndSeek(page, 7)

  const order = await page.evaluate(() => {
    const at = (selector) => document.querySelector(selector)
    const before = (a, b) => !!(at(a).compareDocumentPosition(at(b)) & Node.DOCUMENT_POSITION_FOLLOWING)
    return { contactBeforeFilm: before('#contact', '#universe'), filmBeforeFooter: before('#universe', 'footer') }
  })
  expect(order).toEqual({ contactBeforeFilm: true, filmBeforeFooter: true })

  const open = page.getByRole('button', { name: /View full film/ })
  for (const round of [1, 2]) {
    await open.scrollIntoViewIfNeeded()
    await open.click()
    await expect(dialog(page), `Dialog opens (round ${round})`).toBeVisible()
    await expect(page.locator('video'), 'Opening never creates a second video').toHaveCount(1)
    expect(await sameNode(page), 'Presentation reuses the same node').toBe(true)
    await expect(stage(page)).toHaveAttribute('data-mode', 'presenting')
    await expect(page.getByRole('button', { name: 'Close full film' })).toBeFocused()
    await expect(page.locator('.cine-content')).toHaveAttribute('inert', '')

    const ownership = await page.evaluate(() => {
      const modals = [...document.querySelectorAll('[role="dialog"]')]
      const modal = modals[0]
      const media = document.querySelector('video')
      return {
        modalCount: modals.length,
        named: modal?.getAttribute('aria-label'),
        aria: modal?.getAttribute('aria-modal'),
        containsVideo: !!modal?.contains(media),
        videoCountInModal: modal?.querySelectorAll('video').length,
        containsClose: !!modal?.querySelector('button[aria-label="Close full film"]'),
        containsControls: !!modal?.querySelector('button[aria-label="Film sound"]') && !!modal?.querySelector('input[type="range"]'),
        modalInert: !!modal?.closest('[inert]'),
        videoHidden: !!media.closest('[aria-hidden="true"]'),
        contentContainsModal: !!document.querySelector('.cine-content')?.contains(modal),
      }
    })
    expect(ownership, 'The one video and its controls share the active modal subtree').toEqual({
      modalCount: 1, named: 'MG Universe, full film', aria: 'true', containsVideo: true, videoCountInModal: 1,
      containsClose: true, containsControls: true, modalInert: false, videoHidden: false, contentContainsModal: false,
    })
    const frame = await page.evaluate(() => {
      const node = document.querySelector('video')
      const box = node.getBoundingClientRect()
      return {
        fit: getComputedStyle(node).objectFit, inside: box.left >= 0 && box.top >= 0 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1,
        ratio: box.width / box.height, muted: node.muted, label: node.getAttribute('aria-label'), hidden: node.getAttribute('aria-hidden'),
      }
    })
    expect(frame.fit).toBe('contain')
    expect(frame.inside, 'The whole portrait film fits in the viewport').toBe(true)
    expect(frame.ratio).toBeGreaterThan(0.4)
    expect(frame.ratio).toBeLessThan(0.7)
    expect(frame.muted, 'Audio is not enabled automatically').toBe(true)
    expect(frame.label).toMatch(/MG Universe/)
    expect(frame.hidden).toBeNull()

    for (let press = 0; press < 6; press += 1) {
      await page.keyboard.press('Tab')
      expect(await page.evaluate(() => !!document.activeElement.closest('[role="dialog"]')), 'Focus stays inside the dialog').toBe(true)
    }

    if (round === 1) await page.keyboard.press('Escape')
    else await page.getByRole('button', { name: 'Close full film' }).click()
    await expect(dialog(page)).toBeHidden()
    await expect(stage(page)).toHaveAttribute('data-mode', 'background')
    await expect(open, 'Focus returns to the control that opened the film').toBeFocused()
    await expect(page.locator('video')).toHaveCount(1)
    expect(await sameNode(page)).toBe(true)
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('video')).objectFit)).toBe('cover')
    expect(await page.evaluate(() => document.querySelector('video').muted)).toBe(true)
    await expect(page.locator('.cine-content')).not.toHaveAttribute('inert', '')
    expect(await page.evaluate(() => ({
      dialogs: document.querySelectorAll('[role="dialog"], [aria-modal]').length,
      stageHidden: document.querySelector('[data-cinematic-stage]').getAttribute('aria-hidden'),
      videoHidden: document.querySelector('video').getAttribute('aria-hidden'),
    })), 'Closing removes modal semantics and restores decorative background semantics').toEqual({ dialogs: 0, stageHidden: 'true', videoHidden: 'true' })
  }

  const log = await page.evaluate(() => window.__cine)
  expect(log).toMatchObject({ added: 1, removed: 0, loadstart: 1 })
  await observedMediaSources(page, mediaSources)
  if (seekable) expect(await page.evaluate(() => document.querySelector('video').currentTime), 'Timeline is preserved').toBeGreaterThanOrEqual(7)
  expect(await page.evaluate(() => document.querySelector('video').currentSrc)).toBe(await page.evaluate(() => window.__src))
  expect(await noHorizontalOverflow(page)).toBe(true)
  expect(errors).toEqual([])
})

test('cinematic footer spacing applies to Home only @home-cinematic', async ({ page }) => {
  const footerStyle = () => page.locator('footer.brand-footer').evaluate((node) => {
    const style = getComputedStyle(node)
    return { paddingBottom: style.paddingBottom, background: style.backgroundColor }
  })
  await loadHome(page)
  const home = await footerStyle()
  expect(home.paddingBottom).toBe('76px')

  const response = await page.goto('/blog')
  expect(response?.status()).toBe(200)
  await expect(page.locator('footer.brand-footer')).toBeVisible()
  const blog = await footerStyle()
  expect(blog.paddingBottom, 'Blog footer keeps the shared footer padding').toBe('26px')
  expect(blog.background, 'Blog footer gets no cinematic scrim').not.toBe(home.background)
})
test.describe('reduced motion', () => {
  test('shows the poster and starts no motion until the film is requested @home-cinematic', async ({ page }) => {
    const mediaSources = observeMediaSources(page)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await loadHome(page)
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true)
    await expect(video(page)).not.toHaveAttribute('src', /.*/)
    await expect(video(page)).toHaveAttribute('poster', /mg-universe-poster/)
    expect(await page.evaluate(() => ({ paused: document.querySelector('video').paused, state: document.querySelector('video').readyState }))).toEqual({ paused: true, state: 0 })
    await observedMediaSources(page, mediaSources)
    await expect(page.getByRole('button', { name: 'Play background film' })).toBeAttached()

    await page.locator('#hero').getByRole('link', { name: /Explore my work/ }).click()
    await expect(page).toHaveURL(/#projects$/)
    await expect(page.getByRole('heading', { name: 'Checkpoint 1A Fixture Project', exact: true })).toBeVisible()

    await page.evaluate(() => { window.__node = document.querySelector('video') })
    await page.getByRole('button', { name: /View full film/ }).click()
    await expect(dialog(page)).toBeVisible()
    await expect(video(page)).toHaveAttribute('src', SOURCE)
    await expect(page.locator('video')).toHaveCount(1)
    await observedMediaSources(page, mediaSources)
    expect(await sameNode(page)).toBe(true)

    await page.keyboard.press('Escape')
    await expect(dialog(page)).toBeHidden()
    await expect.poll(() => page.evaluate(() => document.querySelector('video').paused), 'Background motion stays off after closing').toBe(true)
    await expect(page.locator('video')).toHaveCount(1)
    expect(await noHorizontalOverflow(page)).toBe(true)
  })
})

test.describe('data saver', () => {
  test('does not download the film automatically @home-cinematic', async ({ page }) => {
    const mediaSources = observeMediaSources(page)
    await page.addInitScript(() => Object.defineProperty(navigator, 'connection', { value: { saveData: true, effectiveType: '4g' }, configurable: true }))
    await loadHome(page)
    await expect(video(page)).not.toHaveAttribute('src', /.*/)
    await observedMediaSources(page, mediaSources)
    await page.getByRole('button', { name: /View full film/ }).click()
    await expect(video(page)).toHaveAttribute('src', SOURCE)
    await expect(page.locator('video')).toHaveCount(1)
    await observedMediaSources(page, mediaSources)
  })
})
