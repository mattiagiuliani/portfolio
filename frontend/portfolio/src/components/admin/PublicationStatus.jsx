'use client'

import { useCallback, useEffect, useState } from 'react'
import { publicationApi } from '../../services/adminApi'

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
  const refresh = useCallback(async () => {
    try {
      const result = await publicationApi.getAll()
      setJobs(result.data)
      setError('')
    } catch { setError('Publication status is temporarily unavailable.') }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = setInterval(refresh, 15000)
    window.addEventListener('publication-updated', refresh)
    return () => {
      clearInterval(timer)
      window.removeEventListener('publication-updated', refresh)
    }
  }, [refresh])

  const retry = async (id) => {
    setBusy(id)
    try { await publicationApi.retry(id); await refresh() }
    catch { setError('Retry unavailable. A worker may already be processing this job.') }
    finally { setBusy(null) }
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
