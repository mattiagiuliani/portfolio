import assert from 'node:assert/strict'
import { once } from 'node:events'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import express from '../../../backend/node_modules/express/index.js'
import cors from '../../../backend/node_modules/cors/lib/index.js'
import cookieParser from '../../../backend/node_modules/cookie-parser/index.js'
import mongoose from '../../../backend/node_modules/mongoose/index.js'
import { MongoMemoryReplSet } from '../../../backend/node_modules/mongodb-memory-server/index.js'
import { chromium, expect } from '@playwright/test'
import Admin from '../../../backend/src/models/Admin.js'
import MediaAsset from '../../../backend/src/models/MediaAsset.js'
import Post from '../../../backend/src/models/Post.js'
import Project from '../../../backend/src/models/Project.js'
import PublicationJob from '../../../backend/src/models/PublicationJob.js'
import Settings from '../../../backend/src/models/Settings.js'
import authRoutes from '../../../backend/src/routes/authRoutes.js'
import { createAdminRouter } from '../../../backend/src/routes/adminRoutes.js'
import publicRoutes from '../../../backend/src/routes/publicRoutes.js'
import postRoutes from '../../../backend/src/routes/postRoutes.js'
import errorHandler from '../../../backend/src/middleware/errorHandler.js'
import { MediaError } from '../../../backend/src/services/media/errors.js'
import { startPublicationWorker } from '../../../backend/src/services/publicationQueue.js'
import { freePort } from '../support/environment.mjs'

const requireBackend = createRequire(new URL('../../../backend/package.json', import.meta.url))
const sharp = requireBackend('sharp')
const credentials = { email: 'media-admin@example.test', password: 'Disposable-test-password-123' }
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const deferred = () => {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}

async function until(check, label, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const result = await check()
    if (result) return result
    await pause(150)
  }
  assert.fail(label)
}

async function waitForPublished(path) {
  const job = await until(
    () => PublicationJob.findOne({ paths: path }).sort({ createdAt: -1 }).lean(),
    `publication job for ${path}`
  )
  return until(
    () => PublicationJob.findOne({ _id: job._id, status: 'published' }).lean(),
    `published job for ${path}`,
  )
}

process.env.NODE_ENV = 'development'
process.env.JWT_SECRET = 'disposable-media-e2e-secret'
process.env.REVALIDATION_SECRET = 'disposable-media-revalidation-secret'
process.env.FRONTEND_ORIGIN = 'http://127.0.0.1'
const port = await freePort()
const base = `http://127.0.0.1:${port}`
process.env.FRONTEND_ORIGIN = base
process.env.PUBLIC_SITE_URL = base
process.env.SITE_URL = base
process.env.VERCEL_ENV = 'production'
delete process.env.FRONTEND_REVALIDATE_URL
const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
let api, next, browser, stopWorker
let providerUploads = 0
let providerDeletes = 0
let providerFailures = 1
const config = { namespace: 'portfolio/e2e', maxBytes: 1024 * 1024, providerTimeoutMs: 2000 }
const storage = {
  provider: 'fixture-storage',
  assertConfigured() {},
  async upload({ key, image }) {
    providerUploads++
    if (providerFailures) {
      providerFailures--
      throw new MediaError('MEDIA_PROVIDER')
    }
    await pause(450)
    return {
      url: `https://images.example.test/${key}.${image.format}`,
      width: image.width,
      height: image.height,
      format: image.format,
      bytes: image.bytes,
    }
  },
  async delete() { providerDeletes++; throw new Error('Provider deletion is not part of this workflow') },
}

try {
  await mongoose.connect((await replica).getUri())
  await Promise.all([Admin, MediaAsset, Post, Project, PublicationJob, Settings].map((model) => model.init()))
  await Admin.create({ ...credentials, name: 'Media E2E Admin', role: 'super_admin' })
  await Settings.create({ singletonKey: 'default', name: 'Media E2E', email: credentials.email, aboutText: 'Media fixture' })
  await Post.create({
    title: 'Legacy image fixture', content: 'Legacy content', category: 'Web Development',
    coverImage: '/images/blog/blog1.jpg', published: false,
  })

  const app = express()
  app.use(cors({ origin: base, credentials: true }))
  app.use(cookieParser(), express.json())
  app.use('/api/auth', authRoutes)
  app.use('/api/admin', createAdminRouter({ storage, getConfig: () => config }))
  app.use('/api/posts', postRoutes)
  app.use('/api', publicRoutes)
  app.use(errorHandler)
  api = app.listen(0, '127.0.0.1')
  await once(api, 'listening')
  const apiUrl = `http://127.0.0.1:${api.address().port}`
  const cwd = fileURLToPath(new URL('../../../frontend/portfolio/', import.meta.url))
  const env = {
    ...process.env,
    NEXT_BUILD_DIR: '.next-admin-verification',
    PORTFOLIO_API_URL: apiUrl,
    NEXT_PUBLIC_API_URL: apiUrl,
    NEXT_TELEMETRY_DISABLED: '1',
    REVALIDATION_SECRET: process.env.REVALIDATION_SECRET,
    SITE_URL: base,
    VERCEL_ENV: 'production',
  }
  next = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--webpack', '-H', '127.0.0.1', '-p', String(port)], {
    cwd, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  })
  let serverLog = ''
  next.stdout.on('data', (chunk) => { serverLog = (serverLog + chunk).slice(-12000) })
  next.stderr.on('data', (chunk) => { serverLog = (serverLog + chunk).slice(-12000) })
  for (let attempt = 0; attempt < 80; attempt++) {
    if (next.exitCode !== null) throw new Error(`Test frontend exited: ${serverLog}`)
    try { if ((await fetch(`${base}/admin/login`)).ok) break } catch { /* startup */ }
    if (attempt === 79) throw new Error(`Test frontend failed to start: ${serverLog}`)
    await pause(250)
  }

  browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 } })
  const page = await context.newPage()
  page.setDefaultTimeout(15000)
  const runtimeErrors = []
  page.on('pageerror', (error) => runtimeErrors.push(error.message))
  const png = await sharp({ create: { width: 48, height: 32, channels: 3, background: '#2468ac' } }).png().toBuffer()
  await page.route('https://images.example.test/**', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: png }))

  let abortNextUpload = true
  let abortNextInlineUpload = false
  let heldUpload = null
  let delayedInlineUpload = null
  let mediaRequests = 0
  let mediaHeaders
  await page.route('**/api/admin/media', async (route) => {
    mediaRequests++
    mediaHeaders ??= await route.request().allHeaders()
    if (abortNextUpload) {
      abortNextUpload = false
      await route.abort('failed')
      return
    }
    if (abortNextInlineUpload) {
      abortNextInlineUpload = false
      await route.abort('failed')
      return
    }
    if (heldUpload) {
      const current = heldUpload
      heldUpload = null
      current.started.resolve()
      await current.release.promise
      await route.fulfill({ status: 201, json: { success: true, data: {
        id: 'f'.repeat(24), url: 'https://images.example.test/stale.png', width: 12, height: 8, format: 'png', bytes: 100,
      } } }).catch(() => {})
      return
    }
    if (delayedInlineUpload) {
      const current = delayedInlineUpload
      delayedInlineUpload = null
      const response = await route.fetch()
      current.started.resolve(await response.json())
      await current.release.promise
      await route.fulfill({ response }).catch(() => {})
      current.completed?.resolve()
      return
    }
    await route.continue()
  })

  await page.goto(`${base}/admin/login`)
  await page.getByLabel('Email address').fill(credentials.email)
  await page.getByLabel('Password', { exact: true }).fill(credentials.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.waitForURL('**/admin')
  await page.getByRole('link', { name: 'Blog', exact: true }).click()

  const legacyRow = page.getByRole('listitem').filter({ hasText: 'Legacy image fixture' })
  await legacyRow.getByRole('button', { name: 'Edit', exact: true }).click()
  let dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Current legacy image. Uploading a managed image will leave this fallback stored.')).toBeVisible()
  await expect(dialog.getByLabel('Cover image legacy fallback URL')).toHaveValue('/images/blog/blog1.jpg')
  await expect(dialog.locator('img')).toHaveAttribute('src', '/images/blog/blog1.jpg')
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()

  await page.getByRole('button', { name: 'New article', exact: true }).click()
  dialog = page.getByRole('dialog')
  await page.getByLabel('Article title', { exact: true }).fill('Managed media checkpoint three')
  await page.getByLabel('Article content', { exact: true }).fill('Image upload integration fixture.')
  await page.getByLabel('Category *', { exact: true }).selectOption('Web Development')
  await dialog.getByLabel('Cover image legacy fallback URL').fill('/images/blog/blog1.jpg')

  const fileInput = dialog.getByLabel('Cover image file')
  await fileInput.setInputFiles({ name: 'unsupported.heic', mimeType: 'image/heic', buffer: Buffer.from('not an image') })
  await expect(dialog.getByRole('alert')).toContainText('HEIC/HEIF is not supported')
  assert.equal(mediaRequests, 0, 'unsupported selection must not upload')

  const chooseImage = (name) => fileInput.setInputFiles({ name, mimeType: 'image/png', buffer: png })
  await chooseImage('first-local-preview.png')
  await expect(dialog.getByRole('status')).toContainText('Selected locally. Not uploaded yet.')
  await expect(dialog.locator('img')).toHaveAttribute('src', /^blob:/)
  assert.equal(mediaRequests, 0, 'selecting a file must not upload it')
  await expect(dialog.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled()

  await dialog.getByRole('button', { name: 'Upload image', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('could not reach the server')
  await dialog.getByRole('button', { name: 'Retry upload', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Image storage could not confirm the upload')

  const uploadButton = dialog.getByRole('button', { name: 'Retry upload', exact: true })
  const successfulRequest = page.waitForRequest((request) => new URL(request.url()).pathname === '/api/admin/media' && request.method() === 'POST')
  await uploadButton.click()
  const request = await successfulRequest
  assert.match(request.headers()['content-type'], /^multipart\/form-data; boundary=/)
  assert.match(request.headers().cookie, /admin_token=/, 'upload reuses the existing admin cookie')
  await expect(dialog.getByRole('button', { name: 'Uploading…', exact: true })).toBeDisabled()
  await expect(dialog.getByText('Uploaded as a media asset. Save this content to attach it.', { exact: true })).toBeVisible()
  assert.equal(await Post.exists({ title: 'Managed media checkpoint three' }), null, 'upload alone must not create/associate content')
  assert.equal(providerUploads, 2, 'network rejection never reaches storage; first server attempt fails safely')

  const held = { started: deferred(), release: deferred() }
  heldUpload = held
  const staleResponse = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/admin/media' && response.request().method() === 'POST')
  await chooseImage('stale-replacement.png')
  await dialog.getByRole('button', { name: 'Upload image', exact: true }).click()
  await held.started.promise
  await chooseImage('newer-replacement.png')
  await expect(dialog.getByRole('status')).toContainText('A previous upload is finishing')
  held.release.resolve()
  assert.equal((await staleResponse).status(), 201)
  await expect(dialog.getByRole('status')).toContainText('Selected locally. Not uploaded yet.')
  await expect(dialog.locator('img')).toHaveAttribute('src', /^blob:/)

  await dialog.getByRole('button', { name: 'Upload image', exact: true }).click()
  await expect(dialog.getByRole('status')).toContainText('Uploaded as a media asset. Save this content to attach it.')
  const initialAsset = await MediaAsset.findOne({ state: 'ready' }).sort({ createdAt: -1 }).lean()
  await dialog.getByLabel('Cover image alt text').fill('A clear view of the system map')
  await page.evaluate(() => {
    window.__mediaPublicationEvents = []
    window.addEventListener('publication-updated', (event) => window.__mediaPublicationEvents.push(event.detail))
  })
  stopWorker = startPublicationWorker()
  await dialog.getByRole('button', { name: 'Publish', exact: true }).click()
  const post = await until(() => Post.findOne({ title: 'Managed media checkpoint three' }), 'create managed media post')
  const postId = post._id
  const slug = post.slug
  assert.equal(String(post.coverMedia), String(initialAsset._id))
  assert.equal(post.coverAlt, 'A clear view of the system map')
  assert.equal(post.coverImage, '/images/blog/blog1.jpg', 'legacy image remains stored as fallback')
  assert.equal(mediaHeaders['content-type']?.startsWith('application/json'), false)
  await waitForPublished(`/blog/${slug}`)
  await expect.poll(async () => page.evaluate(() => window.__mediaPublicationEvents.some((event) => event.status === 'queued'))).toBe(true)

  async function verifyPublicImage(expectedUrl, expectedAlt) {
    const apiResponse = await fetch(`${apiUrl}/api/posts/${slug}`)
    assert.equal(apiResponse.status, 200)
    const { data } = await apiResponse.json()
    if (expectedUrl) {
      assert.equal(data.coverImage, expectedUrl)
      assert.equal(data.coverMedia.url, expectedUrl)
      assert.equal(data.coverMedia.alt, expectedAlt)
    } else {
      assert.equal(data.coverImage, '/images/blog/blog1.jpg')
      assert.equal(data.coverMedia, undefined)
    }
    const response = await fetch(`${base}/blog/${slug}`)
    assert.equal(response.status, 200)
    const html = await response.text()
    assert.ok(html.includes('data-public-version='), 'public page includes the current revision')
    assert.ok(html.includes(expectedUrl ?? '/images/blog/blog1.jpg'), 'published page renders the effective legacy/managed image')
    const renderedAlt = data.coverMedia?.alt ?? data.coverAlt ?? data.title
    assert.ok(html.includes(`alt="${renderedAlt}"`), 'public image uses the content-specific alt text')
  }
  await verifyPublicImage(initialAsset.url, 'A clear view of the system map')

  const editPost = async (imageUrl = initialAsset.url) => {
    await page.getByRole('listitem').filter({ hasText: 'Managed media checkpoint three' }).getByRole('button', { name: 'Edit', exact: true }).click()
    const editor = page.getByRole('dialog')
    await expect(editor.locator('img')).toHaveAttribute('src', imageUrl)
    return editor
  }
  dialog = await editPost()
  await dialog.getByLabel('Excerpt').fill('An unrelated text update')
  await dialog.getByRole('button', { name: 'Update', exact: true }).click()
  await until(async () => String((await Post.findById(postId))?.coverMedia) === String(initialAsset._id), 'preserve managed ID on unrelated edit')
  await waitForPublished(`/blog/${slug}`)

  dialog = await editPost()
  await dialog.getByLabel('Cover image alt text').fill('Updated system map description')
  await dialog.getByRole('button', { name: 'Update', exact: true }).click()
  await until(async () => (await Post.findById(postId))?.coverAlt === 'Updated system map description', 'save alt-only edit')
  assert.equal(String((await Post.findById(postId)).coverMedia), String(initialAsset._id))
  await waitForPublished(`/blog/${slug}`)
  await verifyPublicImage(initialAsset.url, 'Updated system map description')

  dialog = await editPost()
  await chooseImage('post-replacement.png')
  await dialog.getByRole('button', { name: 'Upload image', exact: true }).click()
  await expect(dialog.getByRole('status')).toContainText('Uploaded as a media asset. Save this content to attach it.')
  const replacementAsset = await MediaAsset.findOne({ state: 'ready' }).sort({ createdAt: -1 }).lean()
  await dialog.getByLabel('Cover image alt text').fill('Replacement system map')
  await dialog.getByRole('button', { name: 'Update', exact: true }).click()
  await until(async () => String((await Post.findById(postId))?.coverMedia) === String(replacementAsset._id), 'replace post managed media')
  assert.equal((await MediaAsset.findById(initialAsset._id)).state, 'ready', 'replacement preserves the old asset')
  await waitForPublished(`/blog/${slug}`)
  await verifyPublicImage(replacementAsset.url, 'Replacement system map')

  dialog = await editPost(replacementAsset.url)
  await dialog.getByRole('button', { name: 'Remove managed image', exact: true }).click()
  await expect(dialog.locator('img')).toHaveAttribute('src', '/images/blog/blog1.jpg')
  await dialog.getByRole('button', { name: 'Update', exact: true }).click()
  await until(async () => (await Post.findById(postId))?.coverMedia == null, 'remove post managed association')
  await waitForPublished(`/blog/${slug}`)
  await verifyPublicImage(null, '')
  assert.equal((await MediaAsset.findById(replacementAsset._id)).state, 'ready', 'removal preserves the asset')

  await page.getByRole('listitem').filter({ hasText: 'Managed media checkpoint three' }).getByRole('button', { name: 'Edit', exact: true }).click()
  dialog = page.getByRole('dialog')
  const articleBody = dialog.getByLabel('Article content', { exact: true })
  await articleBody.fill('The inline diagram is here.')
  await articleBody.press('End')
  const fileChooserPromise = page.waitForEvent('filechooser')
  await dialog.getByRole('button', { name: 'Insert image', exact: true }).click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles({ name: 'inline-diagram.png', mimeType: 'image/png', buffer: png })
  await dialog.getByLabel('Inline image alt text').fill('A [system] *map*')
  abortNextInlineUpload = true
  await dialog.getByRole('button', { name: 'Upload inline image', exact: true }).click()
  await expect(dialog.getByText('The upload could not reach the server. Check your connection and retry.', { exact: true })).toBeVisible()
  const firstInlineUpload = { started: deferred(), release: deferred() }
  delayedInlineUpload = firstInlineUpload
  await dialog.getByRole('button', { name: 'Retry upload', exact: true }).click()
  await firstInlineUpload.started.promise
  await expect(dialog.getByRole('button', { name: 'Save draft', exact: true })).toBeDisabled()
  await dialog.getByLabel('Inline image alt text').fill('Latest diagram alt')
  await articleBody.press('End')
  await articleBody.pressSequentially(' Continued prose.')
  await expect(dialog.getByText('Uploading image…', { exact: true })).toBeVisible()
  await expect.poll(async () => articleBody.inputValue()).toContain('Continued prose.')

  await articleBody.press('End')
  const secondFileChooserPromise = page.waitForEvent('filechooser')
  await dialog.getByRole('button', { name: 'Insert image', exact: true }).click()
  const secondFileChooser = await secondFileChooserPromise
  await secondFileChooser.setFiles({ name: 'inline-second.png', mimeType: 'image/png', buffer: png })
  await dialog.getByLabel('Inline image alt text').nth(1).fill('Second illustration')
  await dialog.getByRole('button', { name: 'Upload inline image', exact: true }).click()
  await expect.poll(async () => articleBody.inputValue()).toContain('![Second illustration](media:')
  assert.equal((await articleBody.inputValue()).split('portfolio-media-upload:').length - 1, 1)
  firstInlineUpload.release.resolve()
  await expect.poll(async () => articleBody.inputValue()).toContain('![Latest diagram alt](media:')
  await expect.poll(async () => articleBody.inputValue()).not.toContain('portfolio-media-upload:')
  assert.equal((await Post.findById(postId)).content, 'Image upload integration fixture.', 'upload alone does not mutate the saved Post')
  await page.getByRole('button', { name: 'Update', exact: true }).click()
  const inlinePost = await until(async () => {
    const saved = await Post.findById(postId)
    return saved?.content.includes('Second illustration') && saved.content.includes('Latest diagram alt') ? saved : null
  }, 'save managed inline media reference')
  const inlineIds = [...inlinePost.content.matchAll(/media:([a-f\d]{24})/gi)].map((match) => match[1])
  assert.equal(inlineIds.length, 2)
  assert.ok(inlinePost.content.indexOf(`media:${inlineIds[0]}`) < inlinePost.content.indexOf(`media:${inlineIds[1]}`))
  assert.equal(inlinePost.content.includes('portfolio-media-upload:'), false)
  const inlineAssets = await Promise.all(inlineIds.map((id) => MediaAsset.findById(id).lean()))
  assert.equal(inlineAssets.length, 2)
  const [firstInlineAsset, secondInlineAsset] = inlineAssets
  assert.ok(firstInlineAsset)
  assert.ok(secondInlineAsset)
  await waitForPublished(`/blog/${slug}`)

  let publicArticle = await fetch(`${apiUrl}/api/posts/${slug}`)
  let publicPost = (await publicArticle.json()).data
  assert.ok(publicPost.content.includes(firstInlineAsset.url))
  assert.ok(publicPost.content.includes(secondInlineAsset.url))
  assert.equal(publicPost.content.includes('media:'), false)
  const articlePage = await fetch(`${base}/blog/${slug}`)
  const articleHtml = await articlePage.text()
  assert.ok(articleHtml.includes(`src="${firstInlineAsset.url}"`))
  assert.ok(articleHtml.includes(`src="${secondInlineAsset.url}"`))
  assert.ok(articleHtml.includes('alt="Latest diagram alt"'))
  await page.goto(`${base}/blog/${slug}`)
  const publicInlineImage = page.getByRole('img', { name: 'Latest diagram alt', exact: true })
  await expect(publicInlineImage).toHaveAttribute('src', firstInlineAsset.url)
  await expect(page.getByRole('img', { name: 'Second illustration', exact: true })).toHaveAttribute('src', secondInlineAsset.url)
  await expect(page.locator('img[src^="media:"]')).toHaveCount(0)

  await page.goto(`${base}/admin`)
  await page.getByRole('link', { name: 'Blog', exact: true }).click()
  await page.getByRole('listitem').filter({ hasText: 'Managed media checkpoint three' }).getByRole('button', { name: 'Edit', exact: true }).click()
  dialog = page.getByRole('dialog')
  const savedBody = dialog.getByLabel('Article content', { exact: true })
  await expect(savedBody).toHaveValue(inlinePost.content)
  const editedContent = inlinePost.content.replace(/!\[Latest diagram alt\]\(media:/, '![Updated diagram alt](media:')
  assert.notEqual(editedContent, inlinePost.content, 'the E2E edits the managed image alt source')
  await savedBody.fill(editedContent)
  const altUpdateResponse = page.waitForResponse((response) => new URL(response.url()).pathname.startsWith('/api/admin/posts/') && response.request().method() === 'PUT')
  await dialog.getByRole('button', { name: 'Update', exact: true }).click()
  const altUpdate = await altUpdateResponse
  assert.equal(altUpdate.status(), 200, await altUpdate.text())
  await until(async () => (await Post.findById(postId))?.content.includes('Updated diagram alt'), 'save inline image alt edit')
  await waitForPublished(`/blog/${slug}`)
  publicArticle = await fetch(`${apiUrl}/api/posts/${slug}`)
  publicPost = (await publicArticle.json()).data
  assert.ok(publicPost.content.includes(firstInlineAsset.url))
  assert.ok(publicPost.content.includes(secondInlineAsset.url))
  assert.ok(publicPost.content.includes('Updated diagram alt'))
  const updatedArticle = await fetch(`${base}/blog/${slug}`)
  assert.ok((await updatedArticle.text()).includes('alt="Updated diagram alt"'))
  const persistedBodyAfterAltEdit = (await Post.findById(postId)).content

  await page.getByRole('listitem').filter({ hasText: 'Managed media checkpoint three' }).getByRole('button', { name: 'Edit', exact: true }).click()
  dialog = page.getByRole('dialog')
  const bodyWithDeletedPlaceholder = dialog.getByLabel('Article content', { exact: true })
  await bodyWithDeletedPlaceholder.press('End')
  const removedGate = { started: deferred(), release: deferred(), completed: deferred() }
  delayedInlineUpload = removedGate
  const removedPickerPromise = page.waitForEvent('filechooser')
  await dialog.getByRole('button', { name: 'Insert image', exact: true }).click()
  await (await removedPickerPromise).setFiles({ name: 'removed-placeholder.png', mimeType: 'image/png', buffer: png })
  await dialog.getByLabel('Inline image alt text').fill('This insertion is removed')
  const readyCountBeforeRemovedUpload = await MediaAsset.countDocuments({ state: 'ready' })
  await dialog.getByRole('button', { name: 'Upload inline image', exact: true }).click()
  await removedGate.started.promise
  const pendingBody = await bodyWithDeletedPlaceholder.inputValue()
  const removedMarker = pendingBody.match(/<!--portfolio-media-upload:[^>]+-->/)?.[0]
  assert.ok(removedMarker)
  await bodyWithDeletedPlaceholder.fill(pendingBody.replace(removedMarker, ''))
  await expect(dialog.getByLabel('Inline image alt text')).toHaveCount(0)
  removedGate.release.resolve()
  await removedGate.completed.promise
  assert.equal((await Post.findById(postId)).content, persistedBodyAfterAltEdit, 'deleting a pending marker prevents upload response insertion')
  assert.equal(await MediaAsset.countDocuments({ state: 'ready' }), readyCountBeforeRemovedUpload + 1, 'the successful but unreferenced upload remains registered')
  const documentedMarker = '<!--portfolio-media-upload:550e8400-e29b-41d4-a716-446655440000-->'
  const documentedExample = `${documentedMarker}\n\n\`\`\`md\n${documentedMarker}\n\`\`\`\n\n\` ${documentedMarker} \``
  await bodyWithDeletedPlaceholder.fill(`${documentedExample}\n${documentedMarker}`)
  await expect(dialog.getByRole('button', { name: 'Save draft', exact: true })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Remove unresolved markers', exact: true }).click()
  await expect(bodyWithDeletedPlaceholder).toHaveValue(`\n\n\`\`\`md\n${documentedMarker}\n\`\`\`\n\n\` ${documentedMarker} \`\n`)
  await expect(dialog.getByRole('button', { name: 'Save draft', exact: true })).toBeEnabled()

  const nestedFenceExample = `- * \`\`\`html\n    ${documentedMarker}\n    \`\`\``
  await bodyWithDeletedPlaceholder.fill(`${nestedFenceExample}\n\n${documentedMarker}`)
  await expect(dialog.getByRole('button', { name: 'Save draft', exact: true })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Remove unresolved markers', exact: true }).click()
  await expect(bodyWithDeletedPlaceholder).toHaveValue(`${nestedFenceExample}\n\n`)
  await expect(dialog.getByRole('button', { name: 'Save draft', exact: true })).toBeEnabled()
  for (const listMarker of ['-', '1.']) {
    const codeExample = `${listMarker}     ${documentedMarker}`
    await bodyWithDeletedPlaceholder.fill(codeExample)
    await expect(dialog.getByRole('button', { name: 'Save draft', exact: true })).toBeEnabled()
    await expect(dialog.getByRole('button', { name: 'Remove unresolved markers', exact: true })).toHaveCount(0)
    await expect(bodyWithDeletedPlaceholder).toHaveValue(codeExample)
  }

  const sameMarkerGate = { started: deferred(), release: deferred(), completed: deferred() }
  delayedInlineUpload = sameMarkerGate
  await bodyWithDeletedPlaceholder.fill('Completion fixture.\n\n')
  await bodyWithDeletedPlaceholder.press('End')
  const sameMarkerPickerPromise = page.waitForEvent('filechooser')
  await dialog.getByRole('button', { name: 'Insert image', exact: true }).click()
  await (await sameMarkerPickerPromise).setFiles({ name: 'same-marker.png', mimeType: 'image/png', buffer: png })
  await dialog.getByLabel('Inline image alt text').fill('Code-safe completion')
  await dialog.getByRole('button', { name: 'Upload inline image', exact: true }).click()
  const sameMarkerUpload = await sameMarkerGate.started.promise
  const sameMarkerBody = await bodyWithDeletedPlaceholder.inputValue()
  const activeMarkers = sameMarkerBody.match(/<!--portfolio-media-upload:[^>]+-->/g)
  assert.equal(activeMarkers?.length, 1, 'the clean fixture contains only the marker generated by this upload')
  const sameMarker = activeMarkers[0]
  const inlineExample = `\` ${sameMarker} \`\n`
  const collisionBody = `${inlineExample}${sameMarkerBody}`
  assert.equal(collisionBody.split(sameMarker).length - 1, 2)
  await bodyWithDeletedPlaceholder.fill(collisionBody)
  await expect(dialog.getByRole('button', { name: 'Save draft', exact: true })).toBeDisabled()
  const managedImage = `![Code\\-safe completion](media:${sameMarkerUpload.data.id})`
  const expectedCompletion = `${inlineExample}${sameMarkerBody.replace(sameMarker, managedImage)}`
  assert.notEqual(collisionBody.replace(sameMarker, managedImage), expectedCompletion, 'blind first-occurrence replacement must fail this regression')
  sameMarkerGate.release.resolve()
  await sameMarkerGate.completed.promise
  await expect(bodyWithDeletedPlaceholder).toHaveValue(expectedCompletion)
  await expect(dialog.getByRole('button', { name: 'Save draft', exact: true })).toBeEnabled()
  await dialog.getByRole('button', { name: 'Close editor' }).click()

  await page.getByRole('listitem').filter({ hasText: 'Managed media checkpoint three' }).getByRole('button', { name: 'Edit', exact: true }).click()
  dialog = page.getByRole('dialog')
  const closingBody = dialog.getByLabel('Article content', { exact: true })
  await closingBody.press('End')
  const closingGate = { started: deferred(), release: deferred(), completed: deferred() }
  delayedInlineUpload = closingGate
  const closingPickerPromise = page.waitForEvent('filechooser')
  await dialog.getByRole('button', { name: 'Insert image', exact: true }).click()
  await (await closingPickerPromise).setFiles({ name: 'closed-editor.png', mimeType: 'image/png', buffer: png })
  await dialog.getByLabel('Inline image alt text').fill('Closed editor image')
  await dialog.getByRole('button', { name: 'Upload inline image', exact: true }).click()
  await closingGate.started.promise
  await dialog.getByRole('button', { name: 'Close editor' }).click()
  await expect(dialog).not.toBeVisible()
  const legacyEditor = page.getByRole('listitem').filter({ hasText: 'Legacy image fixture' })
  await legacyEditor.getByRole('button', { name: 'Edit', exact: true }).click()
  dialog = page.getByRole('dialog')
  const nextPostBody = dialog.getByLabel('Article content', { exact: true })
  await expect(nextPostBody).toHaveValue('Legacy content')
  closingGate.release.resolve()
  await closingGate.completed.promise
  await expect(nextPostBody).toHaveValue('Legacy content')
  await dialog.getByRole('button', { name: 'Close editor' }).click()

  await page.getByRole('link', { name: 'Projects', exact: true }).click()
  await page.getByRole('button', { name: 'Add project', exact: true }).click()
  dialog = page.getByRole('dialog')
  await page.getByLabel('Title *', { exact: true }).fill('Managed image project')
  await page.getByLabel('Description *', { exact: true }).fill('Project image E2E fixture.')
  const projectAssetInput = dialog.getByLabel('Project image file')
  await projectAssetInput.setInputFiles({ name: 'project.png', mimeType: 'image/png', buffer: png })
  await dialog.getByRole('button', { name: 'Upload image', exact: true }).click()
  await expect(dialog.getByRole('status')).toContainText('Uploaded as a media asset. Save this content to attach it.')
  const projectAsset = await MediaAsset.findOne({ state: 'ready' }).sort({ createdAt: -1 }).lean()
  await dialog.getByLabel('Project image alt text').fill('Project preview image')
  await dialog.getByRole('button', { name: 'Create project', exact: true }).click()
  const project = await until(() => Project.findOne({ title: 'Managed image project' }), 'create managed image project')
  assert.equal(String(project.imageMedia), String(projectAsset._id))
  assert.equal(project.imageAlt, 'Project preview image')
  await waitForPublished('/')

  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  dialog = page.getByRole('dialog')
  await expect(dialog.locator('img')).toHaveAttribute('src', projectAsset.url)
  await dialog.getByLabel('Project image alt text').fill('Updated project image description')
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click()
  await until(async () => (await Project.findById(project._id))?.imageAlt === 'Updated project image description', 'save project alt-only edit')
  assert.equal(String((await Project.findById(project._id)).imageMedia), String(projectAsset._id))
  await waitForPublished('/')
  const home = await (await fetch(base)).text()
  assert.ok(home.includes(projectAsset.url), 'public project card renders the managed image')
  assert.ok(home.includes('alt="Updated project image description"'), 'public project image uses its content-specific alt text')

  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Remove managed image', exact: true }).click()
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click()
  await until(async () => (await Project.findById(project._id))?.imageMedia == null, 'remove project managed association')
  await waitForPublished('/')

  assert.equal(providerDeletes, 0, 'association replacement/removal never calls provider deletion')
  assert.deepEqual(runtimeErrors, [], 'media workflow has no browser runtime errors')
  assert.ok(mediaHeaders.cookie?.includes('admin_token='), 'upload uses the authenticated session')
  console.log(JSON.stringify({ mediaRequests, providerUploads, providerDeletes, result: 'passed' }))
} finally {
  stopWorker?.()
  await browser?.close()
  if (next && next.exitCode === null) { const exited = once(next, 'exit'); next.kill(); await exited }
  if (api) { api.closeAllConnections(); await new Promise((resolve) => api.close(resolve)) }
  await mongoose.disconnect()
  await replica.stop()
}
