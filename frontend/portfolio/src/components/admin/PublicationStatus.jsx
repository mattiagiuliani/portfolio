'use client'

import { useEffect, useRef, useState } from 'react'
import { publicationApi } from '../../services/adminApi'

const FALLBACK_POLL_MS = 15000
const OBSERVATION_POLL_MS = 750
const OBSERVATION_WINDOW_MS = 8000
const activeStatuses = new Set(['queued', 'invalidated', 'warming'])

const labels = {
  queued: 'Saved — awaiting publication',
  invalidated: 'Saved — preparing publication',
  warming: 'Saved — verifying public pages',
  retrying: 'Saved — publication delayed; automatic retry scheduled',
  published: 'Public pages verified',
}

export default function PublicationStatus() {
  const [jobs, setJobs] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(null)
  const lifecycle = useRef(null)
  const requests = useRef({ inFlight: null, queued: false, refresh: null })

  useEffect(() => {
    const currentLifecycle = { active: true }
    lifecycle.current = currentLifecycle
    const isCurrent = () => currentLifecycle.active
    const requestState = requests.current
    let fallbackTimer
    let observationTimer
    let observationEndsAt = 0
    const trackedJobs = new Set()

    const stopObservation = () => {
      clearTimeout(observationTimer)
      observationTimer = undefined
      trackedJobs.clear()
      observationEndsAt = 0
    }

    const scheduleObservation = () => {
      clearTimeout(observationTimer)
      observationTimer = undefined
      if (!isCurrent() || !trackedJobs.size) return
      const remaining = observationEndsAt - Date.now()
      if (remaining <= 0) {
        stopObservation()
        return
      }
      observationTimer = setTimeout(() => {
        observationTimer = undefined
        if (Date.now() >= observationEndsAt) {
          stopObservation()
          return
        }
        void refresh()
      }, Math.min(OBSERVATION_POLL_MS, remaining))
    }

    const updateTrackedJobs = (jobs) => {
      const byId = new Map(jobs.map((job) => [String(job._id ?? job.id), job]))
      for (const id of trackedJobs) {
        const job = byId.get(id)
        if (job && !activeStatuses.has(job.status)) trackedJobs.delete(id)
      }
      if (!trackedJobs.size) stopObservation()
    }

    const refresh = () => {
      if (!isCurrent()) return Promise.resolve()
      if (requestState.inFlight) {
        requestState.queued = true
        return requestState.inFlight
      }

      const operation = (async () => {
        do {
          requestState.queued = false
          let result
          try {
            result = await publicationApi.getAll()
          } catch {
            if (isCurrent() && !requestState.queued) setError('Publication status is temporarily unavailable.')
          }
          if (!isCurrent()) return
          if (requestState.queued) continue
          if (result) {
            setJobs(result.data)
            setError('')
            updateTrackedJobs(result.data)
          }
        } while (requestState.queued && isCurrent())
      })()
      requestState.inFlight = operation
      void operation.then(() => {
        if (requestState.inFlight === operation) requestState.inFlight = null
        if (requestState.queued) {
          requestState.queued = false
          void requestState.refresh?.()
        }
        if (isCurrent()) scheduleObservation()
      }, () => {
        if (requestState.inFlight === operation) requestState.inFlight = null
        if (requestState.queued) {
          requestState.queued = false
          void requestState.refresh?.()
        }
        if (isCurrent()) scheduleObservation()
      })
      return operation
    }

    const handlePublicationUpdated = (event) => {
      const { jobId, status } = event.detail ?? {}
      if (!jobId || status !== 'queued') return
      const now = Date.now()
      const id = String(jobId)
      if (!trackedJobs.size || now >= observationEndsAt) {
        stopObservation()
        observationEndsAt = now + OBSERVATION_WINDOW_MS
      }
      trackedJobs.add(id)
      void refresh()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && trackedJobs.size) void refresh()
    }

    requestState.refresh = refresh
    void refresh()
    fallbackTimer = setInterval(() => { void refresh() }, FALLBACK_POLL_MS)
    window.addEventListener('publication-updated', handlePublicationUpdated)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      currentLifecycle.active = false
      clearInterval(fallbackTimer)
      clearTimeout(observationTimer)
      trackedJobs.clear()
      window.removeEventListener('publication-updated', handlePublicationUpdated)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (requestState.refresh === refresh) requestState.refresh = null
    }
  }, [])

  const retry = async (id) => {
    const currentLifecycle = lifecycle.current
    setBusy(id)
    try { await publicationApi.retry(id) }
    catch { if (currentLifecycle?.active) setError('Retry unavailable. A worker may already be processing this job.') }
    finally { if (currentLifecycle?.active) setBusy(null) }
  }

  if (!jobs.length && !error) return null
  const pending = jobs.filter((job) => job.status !== 'published')
  const visible = pending.length ? pending : jobs.slice(0, 1)
  return (
    <section className="mb-6 rounded-xl border border-white/10 p-4 text-sm" aria-label="Publication status">
      <p className="font-semibold text-white" role="status">
        {pending.length ? `${pending.length} recent publication job(s) pending` : 'Latest publication completed'}
      </p>
      {error && <p role="alert" className="mt-2 text-amber-300">{error}</p>}
      <details className="mt-2 text-muted">
        <summary className="cursor-pointer">Publication details</summary>
        {visible.map((job) => (
          <div key={job._id} className="mt-3 border-t border-white/5 pt-3">
            <p>{labels[job.status] ?? job.status}</p>
            <p className="break-all text-xs">{job.paths.join(', ')}</p>
            {job.lastError && <p className="mt-1 text-amber-300">{job.lastError}</p>}
            {job.status === 'retrying' && <button type="button" disabled={busy === job._id} onClick={() => retry(job._id)} className="mt-2 text-primary disabled:opacity-50">Retry publication</button>}
          </div>
        ))}
      </details>
    </section>
  )
}
