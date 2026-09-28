import { randomUUID } from 'node:crypto'
import PublicationJob from '../models/PublicationJob.js'
import { readPublicSnapshot } from './readPublicSnapshot.js'

const LEASE_MS = 120_000
const positiveInt = (value, fallback) => Math.max(1000, Number.parseInt(value, 10) || fallback)
const pollMs = () => positiveInt(process.env.PUBLICATION_POLL_MS, 15000)
const timeoutMs = () => positiveInt(process.env.PUBLICATION_REQUEST_TIMEOUT_MS, 15000)
const siteUrl = () => process.env.PUBLIC_SITE_URL?.replace(/\/$/, '')
const summarize = (job) => ({ id: String(job._id), status: job.status, attempts: job.attempts, paths: job.paths, lastError: job.lastError || undefined })

export function claimableFilter(now = new Date()) {
  return {
    status: { $in: ['queued', 'retrying', 'invalidated', 'warming'] },
    nextAttemptAt: { $lte: now },
    $or: [{ leaseUntil: null }, { leaseUntil: { $lte: now } }],
  }
}

export async function enqueuePublication({ paths }) {
  // Inserted in the same Mongo transaction as the content. Configuration/network
  // failures belong to the worker and never discard the durable publication intent.
  const job = await PublicationJob.create({ paths: [...new Set(paths)] })
  return summarize(job)
}

async function request(url, options = {}, asJson = false) {
  const response = await fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(timeoutMs()) })
  // Keep timeout active through reading the body, not just the response headers.
  const body = asJson ? await response.json() : await response.text()
  return { status: response.status, body }
}

export function verifySnapshot(response, expected, path) {
  if (response.status !== expected.status) throw new Error(`Public status mismatch for ${path}: ${response.status}, expected ${expected.status}`)
  if (expected.status === 200 && !response.body.includes(`data-public-version="${expected.revision}"`)) {
    throw new Error(`Public revision mismatch for ${path}`)
  }
}

export async function warmPaths(paths, { snapshot = readPublicSnapshot, fetchPage = (path) => request(`${siteUrl()}${path}`), heartbeat = async () => {} } = {}) {
  const expected = new Map()
  for (const path of paths) expected.set(path, await snapshot(path))
  for (const path of paths) {
    await heartbeat()
    for (let attempt = 0; ; attempt++) {
      try {
        verifySnapshot(await fetchPage(path), expected.get(path), path)
        break
      } catch (error) {
        if (attempt >= 4) throw error
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }
  }
  // A newer edit during warm-up requires another pass, never a false success.
  for (const path of paths) {
    const current = await snapshot(path)
    if (JSON.stringify(current) !== JSON.stringify(expected.get(path))) throw new Error('Content changed during publication; retrying latest revision')
  }
}

export async function processPublicationJob(id) {
  const token = randomUUID()
  const job = await PublicationJob.findOneAndUpdate(
    { _id: id, ...claimableFilter() },
    { $set: { leaseToken: token, leaseUntil: new Date(Date.now() + LEASE_MS) }, $inc: { attempts: 1 } },
    { new: true }
  )
  if (!job) return null
  const owned = { _id: id, leaseToken: token }
  const update = async (values) => {
    const result = await PublicationJob.updateOne(owned, { $set: values })
    if (!result.matchedCount) throw new Error('Publication lease lost')
  }
  try {
    if (!siteUrl() || !process.env.REVALIDATION_SECRET) throw new Error('Publication worker is not configured')
    const result = await request(process.env.FRONTEND_REVALIDATE_URL || `${siteUrl()}/api/internal/revalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-revalidation-secret': process.env.REVALIDATION_SECRET },
      body: JSON.stringify({ paths: job.paths }),
    }, true)
    if (result.status !== 200 || !result.body.accepted) throw new Error(`Revalidation rejected (${result.status})`)
    await update({ status: 'invalidated', invalidatedAt: new Date() })
    await update({ status: 'warming' })
    await warmPaths(job.paths, { heartbeat: () => update({ leaseUntil: new Date(Date.now() + LEASE_MS) }) })
    await update({ status: 'published', publishedAt: new Date(), lastError: '', leaseUntil: null, leaseToken: null })
    return { ...summarize(job), status: 'published' }
  } catch (error) {
    const delay = Math.min(15 * 60_000, 1000 * 2 ** Math.min(job.attempts, 10))
    await PublicationJob.updateOne(owned, { $set: {
      status: 'retrying', lastError: error.message.slice(0, 500), leaseUntil: null, leaseToken: null,
      nextAttemptAt: new Date(Date.now() + delay),
    } })
    return { ...summarize(job), status: 'retrying' }
  }
}

export async function processDuePublicationJobs() {
  const jobs = await PublicationJob.find(claimableFilter()).sort({ createdAt: 1 }).select('_id').limit(10).lean()
  // Serial warm-up avoids a burst of competing cache invalidations on one site.
  for (const job of jobs) await processPublicationJob(job._id)
}

let wakeWorker = null

// Best-effort local notification; persistent jobs and polling remain authoritative.
export function wakePublicationWorker() {
  wakeWorker?.()
}

export function startPublicationWorker() {
  if (wakeWorker) throw new Error('Publication worker already started')
  let running = false
  let pending = false
  let stopped = false
  const tick = async () => {
    if (stopped) return
    pending = true
    if (running) return
    running = true
    try {
      while (pending && !stopped) {
        pending = false
        try { await processDuePublicationJobs() }
        catch (error) { console.error('Publication worker:', error.message) }
      }
    } finally { running = false }
  }
  wakeWorker = () => { void tick() }
  void tick()
  const timer = setInterval(() => void tick(), pollMs())
  timer.unref()
  return () => {
    if (stopped) return
    stopped = true
    pending = false
    clearInterval(timer)
    wakeWorker = null
  }
}

export const getPublicationJobs = () => PublicationJob.find().sort({ createdAt: -1 }).limit(25).select('-leaseToken -checks').lean()

export async function retryPublicationJob(id) {
  const job = await PublicationJob.findOneAndUpdate(
    { _id: id, status: { $ne: 'published' }, $or: [{ leaseUntil: null }, { leaseUntil: { $lte: new Date() } }] },
    { $set: { status: 'queued', nextAttemptAt: new Date(), lastError: '' } },
    { new: true }
  )
  if (job) wakePublicationWorker()
  return job ? summarize(job) : null
}
