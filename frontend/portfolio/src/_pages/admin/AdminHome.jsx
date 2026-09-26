import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { dashboardApi } from '../../services/adminApi'
import { staggerContainer, fadeUp } from '../../lib/motion'
import { timeAgo } from '../../lib/blogUtils'
import { categoryStyles } from '../../lib/blogUtils'
import StatCard from '../../components/admin/StatCard'
import useAuth from '../../hooks/useAuth'

// ─── Inline SVG icons ─────────────────────────────────────────────────────────
const MailIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M2 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4Z" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M2 4l6 4.5L14 4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
  </svg>
)
const ArticleIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3 3h10M3 7h10M3 11h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
)
const FolderIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M2 5a1 1 0 0 1 1-1h3l1.5 1.5H13a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5Z" stroke="currentColor" strokeWidth="1.4"/>
  </svg>
)
const StarIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M8 2l1.5 3.5L13 6l-2.5 2.5.6 3.5L8 10.5 4.9 12l.6-3.5L3 6l3.5-.5L8 2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
  </svg>
)

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    unread:   'text-pink-400  bg-pink-400/8  border-pink-400/15',
    read:     'text-muted     bg-white/4     border-white/8',
    archived: 'text-subtle    bg-white/3     border-white/5',
  }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-mono border ${map[status] ?? map.read}`}>
      {status}
    </span>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
function AdminHome() {
  const { user } = useAuth()
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    dashboardApi
      .getStats()
      .then((res) => setStats(res.data))
      .catch((err) => setError(err?.message ?? 'Failed to load stats'))
      .finally(() => setLoading(false))
  }, [])

  const statCards = [
    {
      label:       'Unread Messages',
      value:       stats?.unreadMessages,
      description: stats?.unreadMessages === 1 ? '1 awaiting reply' : `${stats?.unreadMessages ?? '—'} awaiting reply`,
      icon:        <MailIcon />,
      color:       stats?.unreadMessages > 0 ? 'pink' : 'default',
    },
    {
      label:       'Published Articles',
      value:       stats?.publishedPosts,
      description: `${stats?.draftPosts ?? '—'} drafts`,
      icon:        <ArticleIcon />,
      color:       'primary',
    },
    {
      label:       'Portfolio Projects',
      value:       stats?.totalProjects,
      description: `${stats?.featuredProjects ?? '—'} featured`,
      icon:        <FolderIcon />,
      color:       'secondary',
    },
    {
      label:       'Featured Projects',
      value:       stats?.featuredProjects,
      description: 'Highlighted on homepage',
      icon:        <StarIcon />,
      color:       'emerald',
    },
  ]

  return (
    <motion.div
      variants={staggerContainer(0.07)}
      initial="hidden"
      animate="show"
      className="max-w-5xl"
    >
      {/* Welcome */}
      <motion.div variants={fadeUp} className="mb-8">
        <h2 className="text-2xl font-bold text-white tracking-tight">
          Good to see you, {user?.name?.split(' ')[0]}
        </h2>
        <p className="mt-1 text-sm text-muted">
          Here&apos;s what&apos;s happening on your portfolio.
        </p>
      </motion.div>

      {error && (
        <motion.p
          variants={fadeUp}
          className="mb-6 text-xs font-mono text-red-400 bg-red-400/8 border border-red-400/15 rounded-lg px-4 py-3"
        >
          {error}
        </motion.p>
      )}

      {/* ── Stat cards ──────────────────────────────────────────────────────── */}
      <motion.div
        variants={staggerContainer(0.06)}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10"
      >
        {statCards.map((card) => (
          <StatCard key={card.label} {...card} loading={loading} />
        ))}
      </motion.div>

      {/* ── Activity feed: two-column grid ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent messages */}
        <motion.section variants={fadeUp} className="flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Recent Messages</h3>
            <Link
              to="/admin/messages"
              className="text-xs font-mono text-muted hover:text-primary transition-colors duration-150"
            >
              View all →
            </Link>
          </div>

          <div className="bg-surface border border-white/5 rounded-xl divide-y divide-white/5 overflow-hidden">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-4 py-3.5 flex flex-col gap-2 animate-pulse">
                  <div className="flex justify-between">
                    <div className="h-3.5 w-28 rounded bg-white/8" />
                    <div className="h-3 w-12 rounded bg-white/5" />
                  </div>
                  <div className="h-3 w-full rounded bg-white/5" />
                </div>
              ))
            ) : !stats?.recentMessages?.length ? (
              <p className="px-4 py-6 text-xs font-mono text-muted text-center">
                No unread messages
              </p>
            ) : (
              stats.recentMessages.map((msg) => (
                <div key={msg._id} className="px-4 py-3.5 hover:bg-white/2 transition-colors duration-150">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-white truncate">{msg.name}</span>
                      <StatusBadge status={msg.status} />
                    </div>
                    <span className="text-xs font-mono text-subtle shrink-0">
                      {timeAgo(msg.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-muted truncate">{msg.message}</p>
                </div>
              ))
            )}
          </div>
        </motion.section>

        {/* Recent posts */}
        <motion.section variants={fadeUp} className="flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Recent Articles</h3>
            <Link
              to="/admin/blog"
              className="text-xs font-mono text-muted hover:text-primary transition-colors duration-150"
            >
              View all →
            </Link>
          </div>

          <div className="bg-surface border border-white/5 rounded-xl divide-y divide-white/5 overflow-hidden">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-4 py-3.5 flex flex-col gap-2 animate-pulse">
                  <div className="flex justify-between">
                    <div className="h-3.5 w-36 rounded bg-white/8" />
                    <div className="h-3 w-14 rounded bg-white/5" />
                  </div>
                  <div className="h-3 w-20 rounded bg-white/5" />
                </div>
              ))
            ) : !stats?.recentPosts?.length ? (
              <p className="px-4 py-6 text-xs font-mono text-muted text-center">
                No articles yet
              </p>
            ) : (
              stats.recentPosts.map((post) => {
                const catStyle = categoryStyles[post.category]?.split(' ')[0] ?? 'text-muted'
                return (
                  <div key={post._id} className="px-4 py-3.5 hover:bg-white/2 transition-colors duration-150">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <span className="text-sm font-medium text-white truncate leading-snug">
                        {post.title}
                      </span>
                      <span className={`text-xs font-mono shrink-0 ${post.published ? 'text-emerald' : 'text-muted'}`}>
                        {post.published ? 'live' : 'draft'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-mono ${catStyle}`}>{post.category}</span>
                      <span className="text-subtle text-xs">·</span>
                      <span className="text-xs font-mono text-subtle">
                        {timeAgo(post.createdAt)}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </motion.section>

      </div>

      {/* ── Quick actions ────────────────────────────────────────────────────── */}
      <motion.div variants={fadeUp} className="mt-10">
        <p className="text-xs font-mono text-muted uppercase tracking-widest mb-4">
          Quick actions
        </p>
        <div className="flex flex-wrap gap-2.5">
          {[
            { label: '+ Write article',  to: '/admin/blog' },
            { label: '+ Add project',    to: '/admin/projects' },
            { label: 'View messages',    to: '/admin/messages' },
            { label: 'Edit settings',    to: '/admin/settings' },
          ].map(({ label, to }) => (
            <Link
              key={to}
              to={to}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-white/8 text-muted hover:text-white hover:border-white/20 transition-colors duration-200"
            >
              {label}
            </Link>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}

export default AdminHome
