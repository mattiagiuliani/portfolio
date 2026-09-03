import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { messagesApi } from '../../services/adminApi'
import { timeAgo } from '../../lib/blogUtils'
import { fadeUp } from '../../lib/motion'
import MessageModal from '../../components/admin/MessageModal'

// ─── Inline icons ─────────────────────────────────────────────────────────────
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M2.5 7l3 3 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const ArchiveIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M1.5 4h11v8a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V4ZM1.5 4V2.5a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 .5.5V4" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M5 7h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
)
const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M2 4h10M5 4V2.5h4V4M5.5 6.5v4M8.5 6.5v4M3 4l.5 8a.5.5 0 0 0 .5.5h6a.5.5 0 0 0 .5-.5L11 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
)

// ─── Status tabs ──────────────────────────────────────────────────────────────
const STATUS_TABS = [
  { label: 'All',      value: '' },
  { label: 'Unread',   value: 'unread' },
  { label: 'Read',     value: 'read' },
  { label: 'Archived', value: 'archived' },
]

// ─── Pagination ───────────────────────────────────────────────────────────────
function Pagination({ pagination, onPage }) {
  if (!pagination || pagination.pages <= 1) return null
  const { page, pages } = pagination
  return (
    <nav className="flex items-center justify-center gap-2 mt-6" aria-label="Pagination">
      <button
        onClick={() => onPage(page - 1)}
        disabled={!pagination.hasPrev}
        className="px-3 py-1.5 rounded-lg text-sm font-mono text-muted border border-white/8 hover:border-white/20 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-200"
      >
        ← Prev
      </button>
      <span className="text-xs font-mono text-muted px-2">{page} / {pages}</span>
      <button
        onClick={() => onPage(page + 1)}
        disabled={!pagination.hasNext}
        className="px-3 py-1.5 rounded-lg text-sm font-mono text-muted border border-white/8 hover:border-white/20 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-200"
      >
        Next →
      </button>
    </nav>
  )
}

// ─── Row skeleton ─────────────────────────────────────────────────────────────
function RowSkeleton() {
  return (
    <div className="flex items-start gap-4 px-5 py-4 animate-pulse">
      <div className="w-2 h-2 rounded-full bg-white/10 mt-1.5 shrink-0" />
      <div className="flex-1 flex flex-col gap-2">
        <div className="flex justify-between">
          <div className="h-4 w-32 rounded bg-white/8" />
          <div className="h-3.5 w-16 rounded bg-white/5" />
        </div>
        <div className="h-3.5 w-48 rounded bg-white/5" />
        <div className="h-3 w-3/4 rounded bg-white/4" />
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
function AdminMessages() {
  const [messages,     setMessages]     = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [pagination,   setPagination]   = useState(null)
  const [activeStatus, setActiveStatus] = useState('')
  const [searchInput,  setSearchInput]  = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [page,         setPage]         = useState(1)
  const [selectedMsg,  setSelectedMsg]  = useState(null)
  // Track which message IDs are mid-request to prevent double actions
  const [processing,   setProcessing]   = useState(new Set())

  const fetchMessages = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = { page, limit: 20 }
      if (activeStatus) params.status = activeStatus
      if (activeSearch) params.search = activeSearch
      const res = await messagesApi.getAll(params)
      setMessages(res.data)
      setPagination(res.pagination)
    } catch (err) {
      setError(err?.message ?? 'Failed to load messages')
    } finally {
      setLoading(false)
    }
  }, [page, activeStatus, activeSearch])

  useEffect(() => { fetchMessages() }, [fetchMessages])

  // ─── Filter helpers ──────────────────────────────────────────────────────────
  const handleStatusFilter = (status) => { setActiveStatus(status); setPage(1) }

  const handleSearch = (e) => {
    e.preventDefault()
    setActiveSearch(searchInput.trim())
    setPage(1)
  }

  const handleClearSearch = () => {
    setSearchInput('')
    setActiveSearch('')
    setPage(1)
  }

  // ─── Optimistic status update ────────────────────────────────────────────────
  const applyStatus = (id, status) => {
    setMessages((prev) => prev.map((m) => (m._id === id ? { ...m, status } : m)))
    setSelectedMsg((prev) => (prev?._id === id ? { ...prev, status } : prev))
  }

  const withProcessing = async (id, apiFn, fallbackFn) => {
    if (processing.has(id)) return
    setProcessing((prev) => new Set(prev).add(id))
    try {
      await apiFn()
    } catch {
      fallbackFn?.()
    } finally {
      setProcessing((prev) => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  const handleMarkRead = (id) => {
    applyStatus(id, 'read')
    withProcessing(id, () => messagesApi.markRead(id), fetchMessages)
  }

  const handleArchive = (id) => {
    applyStatus(id, 'archived')
    withProcessing(id, () => messagesApi.archive(id), fetchMessages)
  }

  const handleDelete = (id) => {
    setMessages((prev) => prev.filter((m) => m._id !== id))
    if (selectedMsg?._id === id) setSelectedMsg(null)
    withProcessing(id, () => messagesApi.remove(id), fetchMessages)
  }

  const handleRowClick = (msg) => {
    setSelectedMsg(msg)
    // Auto-mark as read when opening an unread message
    if (msg.status === 'unread') handleMarkRead(msg._id)
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="max-w-4xl"
    >
      {/* Page header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Messages</h2>
          {pagination && (
            <p className="mt-1 text-sm text-muted font-mono">
              {pagination.total} message{pagination.total !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      {/* Search + filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <form onSubmit={handleSearch} className="relative flex-1 max-w-xs">
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search messages…"
            className="w-full bg-surface border border-white/8 rounded-lg px-3.5 py-2 pr-20 text-sm text-white placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors duration-200"
          />
          {activeSearch && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-14 top-1/2 -translate-y-1/2 text-muted hover:text-white text-xs transition-colors"
            >
              ✕
            </button>
          )}
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary/15 hover:bg-primary/25 text-primary text-xs font-mono px-2.5 py-1 rounded-md transition-colors duration-200"
          >
            Go
          </button>
        </form>

        {/* Status tabs */}
        <div className="flex gap-1 flex-wrap" role="group" aria-label="Filter by status">
          {STATUS_TABS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => handleStatusFilter(value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors duration-200 ${
                activeStatus === value
                  ? 'bg-primary/12 border-primary/30 text-primary'
                  : 'border-white/8 text-muted hover:border-white/20 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <motion.p
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="mb-4 text-xs font-mono text-red-400 bg-red-400/8 border border-red-400/15 rounded-lg px-4 py-3"
        >
          {error}
        </motion.p>
      )}

      {/* Message list */}
      <div className="bg-surface border border-white/5 rounded-xl overflow-hidden">
        {loading ? (
          <div className="divide-y divide-white/5">
            {Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} />)}
          </div>
        ) : messages.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-3xl mb-3">✉️</p>
            <p className="text-sm font-semibold text-white mb-1">No messages</p>
            <p className="text-xs font-mono text-muted">
              {activeStatus || activeSearch
                ? 'Try adjusting your filters.'
                : 'Messages from your contact form appear here.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {messages.map((msg) => (
              <li
                key={msg._id}
                onClick={() => handleRowClick(msg)}
                className={`group flex items-start gap-4 px-5 py-4 cursor-pointer hover:bg-white/2 transition-colors duration-150 ${
                  processing.has(msg._id) ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                {/* Unread indicator dot */}
                <span
                  className={`w-2 h-2 rounded-full mt-[7px] shrink-0 transition-colors duration-200 ${
                    msg.status === 'unread'
                      ? 'bg-pink-400'
                      : msg.status === 'archived'
                      ? 'bg-subtle/40'
                      : 'bg-subtle'
                  }`}
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3 mb-0.5">
                    <span
                      className={`text-sm font-medium truncate ${
                        msg.status === 'unread' ? 'text-white' : 'text-white/60'
                      }`}
                    >
                      {msg.name}
                    </span>
                    <span className="text-xs font-mono text-muted shrink-0">
                      {timeAgo(msg.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-muted/70 mb-0.5 truncate">{msg.email}</p>
                  <p className={`text-xs truncate ${msg.status === 'unread' ? 'text-muted' : 'text-subtle'}`}>
                    {msg.message}
                  </p>
                </div>

                {/* Hover actions */}
                <div
                  className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-150 shrink-0 mt-0.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  {msg.status !== 'read' && (
                    <button
                      onClick={() => handleMarkRead(msg._id)}
                      title="Mark as read"
                      className="p-1.5 rounded-md text-muted hover:text-secondary hover:bg-secondary/10 transition-colors duration-150"
                    >
                      <CheckIcon />
                    </button>
                  )}
                  {msg.status !== 'archived' && (
                    <button
                      onClick={() => handleArchive(msg._id)}
                      title="Archive"
                      className="p-1.5 rounded-md text-muted hover:text-yellow-400 hover:bg-yellow-400/10 transition-colors duration-150"
                    >
                      <ArchiveIcon />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(msg._id)}
                    title="Delete"
                    className="p-1.5 rounded-md text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors duration-150"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!loading && <Pagination pagination={pagination} onPage={(p) => setPage(p)} />}

      {/* Message detail modal */}
      <AnimatePresence>
        {selectedMsg && (
          <MessageModal
            key={selectedMsg._id}
            message={selectedMsg}
            onClose={() => setSelectedMsg(null)}
            onMarkRead={handleMarkRead}
            onArchive={handleArchive}
            onDelete={handleDelete}
            processing={processing}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default AdminMessages
