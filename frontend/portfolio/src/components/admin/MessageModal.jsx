import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { formatDate } from '../../lib/blogUtils'

// ─── Inline icons ─────────────────────────────────────────────────────────────
const CloseIcon = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
    <path d="M3 3l9 9M12 3l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

const statusStyle = {
  unread:   'text-pink-400  bg-pink-400/8  border-pink-400/15',
  read:     'text-muted     bg-white/4     border-white/8',
  archived: 'text-subtle    bg-white/3     border-white/5',
}

/**
 * MessageModal — slide-up detail panel for a contact message.
 *
 * Props:
 *  message     — Contact document
 *  onClose     — close the modal
 *  onMarkRead  — (id) => void
 *  onArchive   — (id) => void
 *  onDelete    — (id) => void  (also closes modal)
 *  processing  — Set of IDs currently awaiting API response
 */
function MessageModal({ message, onClose, onMarkRead, onArchive, onDelete, processing }) {
  const busy = processing.has(message._id)

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleDelete = () => {
    onDelete(message._id)
    onClose()
  }

  return (
    // Backdrop — click outside to close
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0,  opacity: 1 }}
        exit={{ y: 12,    opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="w-full max-w-lg bg-surface border border-white/8 rounded-2xl overflow-hidden shadow-2xl shadow-black/50"
        role="dialog"
        aria-modal="true"
        aria-label={`Message from ${message.name}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-white/5">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-white truncate">{message.name}</h3>
            <a
              href={`mailto:${message.email}`}
              className="text-xs font-mono text-muted hover:text-primary transition-colors duration-150 truncate"
            >
              {message.email}
            </a>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg text-muted hover:text-white hover:bg-white/8 transition-colors duration-150"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-white/5">
          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-mono border ${statusStyle[message.status] ?? statusStyle.read}`}>
            {message.status}
          </span>
          <span className="text-xs font-mono text-subtle">
            {formatDate(message.createdAt)}
          </span>
        </div>

        {/* Message body */}
        <div className="px-6 py-5 max-h-64 overflow-y-auto">
          <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
            {message.message}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 px-6 py-4 border-t border-white/5 bg-bg/40">
          <a
            href={`mailto:${message.email}`}
            className="flex-1 min-w-[100px] py-2 rounded-lg text-xs font-semibold text-center bg-primary hover:bg-primary/90 text-white transition-colors duration-200"
          >
            Reply via email
          </a>

          {message.status !== 'read' && (
            <button
              onClick={() => onMarkRead(message._id)}
              disabled={busy}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold border border-white/10 text-muted hover:text-secondary hover:border-secondary/30 disabled:opacity-40 transition-colors duration-200"
            >
              Mark read
            </button>
          )}

          {message.status !== 'archived' && (
            <button
              onClick={() => onArchive(message._id)}
              disabled={busy}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold border border-white/10 text-muted hover:text-yellow-400 hover:border-yellow-400/30 disabled:opacity-40 transition-colors duration-200"
            >
              Archive
            </button>
          )}

          <button
            onClick={handleDelete}
            disabled={busy}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold border border-white/10 text-muted hover:text-red-400 hover:border-red-400/30 disabled:opacity-40 transition-colors duration-200"
          >
            Delete
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default MessageModal
