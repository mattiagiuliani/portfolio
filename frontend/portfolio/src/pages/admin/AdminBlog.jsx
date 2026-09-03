import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { blogAdminApi } from '../../services/adminApi'
import { timeAgo, categoryStyles } from '../../lib/blogUtils'
import BlogEditorModal from '../../components/admin/BlogEditorModal'

// ─── Inline icons ─────────────────────────────────────────────────────────────
const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M9.5 2.5l2 2-7 7H2.5v-2l7-7Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
  </svg>
)
const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M2 4h10M5 4V2.5h4V4M5.5 6.5v4M8.5 6.5v4M3 4l.5 8a.5.5 0 0 0 .5.5h6a.5.5 0 0 0 .5-.5L11 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
)
const GlobeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M7 1.5C7 1.5 5 4 5 7s2 5.5 2 5.5M7 1.5C7 1.5 9 4 9 7s-2 5.5-2 5.5M1.5 7h11" stroke="currentColor" strokeWidth="1.4"/>
  </svg>
)
const StarIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M7 2l1.5 3 3.5.5L9.5 8l.5 3.5L7 10l-3 1.5.5-3.5L2.5 5.5 6 5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
  </svg>
)
const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

// ─── Filter tabs ──────────────────────────────────────────────────────────────
const FILTERS = [
  { label: 'All',       value: '' },
  { label: 'Published', value: 'true' },
  { label: 'Drafts',    value: 'false' },
]

// ─── Pagination ───────────────────────────────────────────────────────────────
function Pagination({ pagination, onPage }) {
  if (!pagination || pagination.pages <= 1) return null
  const { page, pages } = pagination
  return (
    <nav className="flex items-center justify-center gap-2 mt-6">
      <button onClick={() => onPage(page - 1)} disabled={!pagination.hasPrev}
        className="px-3 py-1.5 rounded-lg text-sm font-mono text-muted border border-white/8 hover:border-white/20 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-200">
        ← Prev
      </button>
      <span className="text-xs font-mono text-muted px-2">{page} / {pages}</span>
      <button onClick={() => onPage(page + 1)} disabled={!pagination.hasNext}
        className="px-3 py-1.5 rounded-lg text-sm font-mono text-muted border border-white/8 hover:border-white/20 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-200">
        Next →
      </button>
    </nav>
  )
}

// ─── Row skeleton ─────────────────────────────────────────────────────────────
function RowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
      <div className="h-4 w-52 rounded bg-white/8" />
      <div className="h-4 w-20 rounded bg-white/5 ml-auto" />
      <div className="h-4 w-16 rounded bg-white/5" />
      <div className="h-4 w-12 rounded bg-white/5" />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
function AdminBlog() {
  const [posts,       setPosts]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [pagination,  setPagination]  = useState(null)
  const [pubFilter,   setPubFilter]   = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [activeSearch,setActiveSearch]= useState('')
  const [page,        setPage]        = useState(1)
  const [editorPost,  setEditorPost]  = useState(undefined) // undefined=closed, null=new, obj=edit
  const [deletingId,  setDeletingId]  = useState(null)      // inline confirm delete
  const [processing,  setProcessing]  = useState(new Set())

  const fetchPosts = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const params = { page, limit: 20, sort: '-createdAt' }
      if (pubFilter)    params.published = pubFilter
      if (activeSearch) params.search    = activeSearch
      const res = await blogAdminApi.getAll(params)
      setPosts(res.data)
      setPagination(res.pagination)
    } catch (err) {
      setError(err?.message ?? 'Failed to load posts')
    } finally {
      setLoading(false)
    }
  }, [page, pubFilter, activeSearch])

  useEffect(() => { fetchPosts() }, [fetchPosts])

  // ─── Search ────────────────────────────────────────────────────────────────
  const handleSearch = (e) => { e.preventDefault(); setActiveSearch(searchInput.trim()); setPage(1) }
  const clearSearch  = ()  => { setSearchInput(''); setActiveSearch(''); setPage(1) }

  // ─── Processing helper ─────────────────────────────────────────────────────
  const withProcessing = async (id, fn) => {
    if (processing.has(id)) return
    setProcessing((p) => new Set(p).add(id))
    try { await fn() } catch { fetchPosts() }
    finally { setProcessing((p) => { const s = new Set(p); s.delete(id); return s }) }
  }

  // ─── Toggle published ──────────────────────────────────────────────────────
  const handleTogglePublish = (id, current) => {
    setPosts((prev) => prev.map((p) => p._id === id ? { ...p, published: !current } : p))
    withProcessing(id, () => blogAdminApi.togglePublish(id))
  }

  // ─── Toggle featured ───────────────────────────────────────────────────────
  const handleToggleFeature = (id, current) => {
    setPosts((prev) => prev.map((p) => p._id === id ? { ...p, featured: !current } : p))
    withProcessing(id, () => blogAdminApi.toggleFeature(id))
  }

  // ─── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = (id) => {
    setPosts((prev) => prev.filter((p) => p._id !== id))
    setDeletingId(null)
    withProcessing(id, () => blogAdminApi.remove(id))
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="max-w-5xl">

      {/* Page header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Blog</h2>
          {pagination && (
            <p className="mt-1 text-sm text-muted font-mono">
              {pagination.total} article{pagination.total !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <button
          onClick={() => setEditorPost(null)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-semibold transition-colors duration-200"
        >
          <PlusIcon /> New article
        </button>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <form onSubmit={handleSearch} className="relative flex-1 max-w-xs">
          <input type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search articles…"
            className="w-full bg-surface border border-white/8 rounded-lg px-3.5 py-2 pr-20 text-sm text-white placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors duration-200" />
          {activeSearch && (
            <button type="button" onClick={clearSearch}
              className="absolute right-14 top-1/2 -translate-y-1/2 text-muted hover:text-white text-xs transition-colors">✕</button>
          )}
          <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary/15 hover:bg-primary/25 text-primary text-xs font-mono px-2.5 py-1 rounded-md transition-colors duration-200">Go</button>
        </form>

        <div className="flex gap-1">
          {FILTERS.map(({ label, value }) => (
            <button key={value} onClick={() => { setPubFilter(value); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors duration-200 ${
                pubFilter === value ? 'bg-primary/12 border-primary/30 text-primary' : 'border-white/8 text-muted hover:border-white/20 hover:text-white'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="mb-4 text-xs font-mono text-red-400 bg-red-400/8 border border-red-400/15 rounded-lg px-4 py-3">{error}</p>
      )}

      {/* Table */}
      <div className="bg-surface border border-white/5 rounded-xl overflow-hidden">

        {/* Column headers */}
        {!loading && posts.length > 0 && (
          <div className="flex items-center gap-4 px-5 py-2.5 border-b border-white/5">
            <span className="flex-1 text-xs font-mono text-subtle uppercase tracking-wider">Title</span>
            <span className="w-32 text-xs font-mono text-subtle uppercase tracking-wider hidden md:block">Category</span>
            <span className="w-20 text-xs font-mono text-subtle uppercase tracking-wider">Status</span>
            <span className="w-20 text-xs font-mono text-subtle uppercase tracking-wider hidden sm:block">Date</span>
            <span className="w-24 text-xs font-mono text-subtle uppercase tracking-wider text-right">Actions</span>
          </div>
        )}

        {loading ? (
          <div className="divide-y divide-white/5">
            {Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} />)}
          </div>
        ) : posts.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-3xl mb-3">📝</p>
            <p className="text-sm font-semibold text-white mb-1">No articles yet</p>
            <p className="text-xs font-mono text-muted mb-5">
              {pubFilter || activeSearch ? 'Try adjusting your filters.' : 'Start writing your first article.'}
            </p>
            {!pubFilter && !activeSearch && (
              <button onClick={() => setEditorPost(null)}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary hover:bg-primary/90 text-white transition-colors duration-200">
                Write first article
              </button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {posts.map((post) => {
              const catColor = categoryStyles[post.category]?.split(' ')[0] ?? 'text-muted'
              const isProcessing = processing.has(post._id)
              const isDeleting   = deletingId === post._id

              return (
                <li key={post._id}
                  className={`group flex items-center gap-4 px-5 py-3.5 hover:bg-white/2 transition-colors duration-150 ${isProcessing ? 'opacity-50' : ''}`}>

                  {/* Title */}
                  <div className="flex-1 min-w-0 flex items-center gap-2.5">
                    {post.featured && (
                      <span className="text-yellow-400 shrink-0" title="Featured"><StarIcon /></span>
                    )}
                    <span className={`text-sm truncate ${post.published ? 'text-white' : 'text-white/60'}`}>
                      {post.title}
                    </span>
                  </div>

                  {/* Category */}
                  <span className={`w-32 text-xs font-mono truncate hidden md:block ${catColor}`}>
                    {post.category}
                  </span>

                  {/* Status badge */}
                  <span className={`w-20 inline-flex items-center text-xs font-mono ${
                    post.published ? 'text-emerald' : 'text-muted'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${post.published ? 'bg-emerald' : 'bg-muted'}`} />
                    {post.published ? 'Live' : 'Draft'}
                  </span>

                  {/* Date */}
                  <span className="w-20 text-xs font-mono text-subtle hidden sm:block">
                    {timeAgo(post.createdAt)}
                  </span>

                  {/* Actions */}
                  <div className="w-24 flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-150">
                    {isDeleting ? (
                      // Inline delete confirm
                      <>
                        <button onClick={() => handleDelete(post._id)}
                          className="text-xs font-mono text-red-400 hover:text-red-300 px-2 py-1 rounded bg-red-400/10 transition-colors">
                          Delete
                        </button>
                        <button onClick={() => setDeletingId(null)}
                          className="text-xs font-mono text-muted hover:text-white px-2 py-1 rounded hover:bg-white/8 transition-colors">
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        {/* Edit */}
                        <button onClick={() => setEditorPost(post)} title="Edit"
                          className="p-1.5 rounded-md text-muted hover:text-primary hover:bg-primary/10 transition-colors duration-150">
                          <EditIcon />
                        </button>
                        {/* Toggle publish */}
                        <button onClick={() => handleTogglePublish(post._id, post.published)} title={post.published ? 'Unpublish' : 'Publish'}
                          className={`p-1.5 rounded-md transition-colors duration-150 ${post.published ? 'text-emerald hover:text-muted hover:bg-white/5' : 'text-muted hover:text-emerald hover:bg-emerald/10'}`}>
                          <GlobeIcon />
                        </button>
                        {/* Toggle featured */}
                        <button onClick={() => handleToggleFeature(post._id, post.featured)} title={post.featured ? 'Unfeature' : 'Feature'}
                          className={`p-1.5 rounded-md transition-colors duration-150 ${post.featured ? 'text-yellow-400 hover:text-muted hover:bg-white/5' : 'text-muted hover:text-yellow-400 hover:bg-yellow-400/10'}`}>
                          <StarIcon />
                        </button>
                        {/* Delete */}
                        <button onClick={() => setDeletingId(post._id)} title="Delete"
                          className="p-1.5 rounded-md text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors duration-150">
                          <TrashIcon />
                        </button>
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {!loading && <Pagination pagination={pagination} onPage={(p) => setPage(p)} />}

      {/* Blog editor modal */}
      <AnimatePresence>
        {editorPost !== undefined && (
          <BlogEditorModal
            key={editorPost?._id ?? 'new'}
            post={editorPost}
            onClose={() => setEditorPost(undefined)}
            onSaved={fetchPosts}
          />
        )}
      </AnimatePresence>

    </motion.div>
  )
}

export default AdminBlog
