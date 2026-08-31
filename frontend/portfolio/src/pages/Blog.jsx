import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { blogApi } from '../services/api'
import { CATEGORIES } from '../lib/blogUtils'
import { fadeUp, staggerContainer } from '../lib/motion'
import PostCard from '../components/blog/PostCard'
import GlowEffect from '../components/ui/GlowEffect'

// ─── Skeleton loader ──────────────────────────────────────────────────────────
function PostSkeleton() {
  return (
    <div className="rounded-2xl border border-white/5 bg-surface p-6 flex flex-col gap-4 animate-pulse">
      <div className="flex justify-between">
        <div className="h-5 w-24 rounded bg-white/8" />
        <div className="h-4 w-20 rounded bg-white/5" />
      </div>
      <div className="h-6 w-3/4 rounded bg-white/8" />
      <div className="space-y-2">
        <div className="h-4 w-full rounded bg-white/5" />
        <div className="h-4 w-5/6 rounded bg-white/5" />
        <div className="h-4 w-2/3 rounded bg-white/5" />
      </div>
    </div>
  )
}

// ─── Pagination ───────────────────────────────────────────────────────────────
function Pagination({ pagination, onPage }) {
  if (!pagination || pagination.pages <= 1) return null
  const { page, pages } = pagination
  const pageNumbers = Array.from({ length: pages }, (_, i) => i + 1)

  return (
    <nav className="flex items-center justify-center gap-2 mt-12" aria-label="Pagination">
      <button
        onClick={() => onPage(page - 1)}
        disabled={!pagination.hasPrev}
        className="px-3 py-1.5 rounded-lg text-sm font-mono text-muted border border-white/8 hover:border-white/20 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-200"
      >
        ← Prev
      </button>

      {pageNumbers.map((n) => (
        <button
          key={n}
          onClick={() => onPage(n)}
          aria-current={n === page ? 'page' : undefined}
          className={`px-3 py-1.5 rounded-lg text-sm font-mono transition-colors duration-200 ${
            n === page
              ? 'bg-primary text-white border border-primary'
              : 'text-muted border border-white/8 hover:border-white/20 hover:text-white'
          }`}
        >
          {n}
        </button>
      ))}

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

// ─── Main page ────────────────────────────────────────────────────────────────
function Blog() {
  const [searchParams, setSearchParams] = useSearchParams()

  // Sync state with URL search params for shareable/bookmarkable filters
  const currentCategory = searchParams.get('category') ?? ''
  const currentSearch   = searchParams.get('search') ?? ''
  const currentPage     = parseInt(searchParams.get('page') ?? '1', 10)

  const [posts,       setPosts]       = useState([])
  const [featured,    setFeatured]    = useState(null)
  const [pagination,  setPagination]  = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [searchInput, setSearchInput] = useState(currentSearch)

  // Fetch featured post once on mount
  useEffect(() => {
    blogApi
      .fetchPosts({ featured: 'true', limit: 1 })
      .then((res) => setFeatured(res.data[0] ?? null))
      .catch(() => {}) // silently ignore — featured is optional
  }, [])

  // Fetch posts whenever URL params change
  const fetchPosts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = { page: currentPage, limit: 9 }
      if (currentCategory) params.category = currentCategory
      if (currentSearch)   params.search   = currentSearch

      const res = await blogApi.fetchPosts(params)
      setPosts(res.data)
      setPagination(res.pagination)
    } catch (err) {
      setError(err?.message ?? 'Failed to load posts')
    } finally {
      setLoading(false)
    }
  }, [currentPage, currentCategory, currentSearch])

  useEffect(() => { fetchPosts() }, [fetchPosts])

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const handleCategory = (cat) => {
    const next = new URLSearchParams(searchParams)
    if (cat) next.set('category', cat)
    else next.delete('category')
    next.delete('page')
    setSearchParams(next)
  }

  const handleSearch = (e) => {
    e.preventDefault()
    const next = new URLSearchParams(searchParams)
    if (searchInput.trim()) next.set('search', searchInput.trim())
    else next.delete('search')
    next.delete('page')
    setSearchParams(next)
  }

  const handleClearSearch = () => {
    setSearchInput('')
    const next = new URLSearchParams(searchParams)
    next.delete('search')
    next.delete('page')
    setSearchParams(next)
  }

  const handlePage = (page) => {
    const next = new URLSearchParams(searchParams)
    next.set('page', page)
    setSearchParams(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-bg">
      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-16 overflow-hidden">
        <GlowEffect color="primary" size="md" className="-top-20 left-1/2 -translate-x-1/2 opacity-25" />
        <div className="relative z-10 max-w-5xl mx-auto px-6">
          <motion.div variants={staggerContainer(0.1)} initial="hidden" animate="show">
            <motion.p
              variants={fadeUp}
              className="text-primary font-mono text-sm font-medium mb-3 tracking-widest uppercase"
            >
              {'// engineering journal'}
            </motion.p>
            <motion.h1 variants={fadeUp} className="text-4xl md:text-6xl font-bold text-white tracking-tight">
              The Blog
            </motion.h1>
            <motion.p variants={fadeUp} className="mt-4 text-muted text-base md:text-lg max-w-xl leading-relaxed">
              Deep dives into web development, cloud infrastructure, AI systems,
              and the technologies shaping the future.
            </motion.p>
          </motion.div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-6 pb-24">
        {/* ── Featured post ──────────────────────────────────────────────────── */}
        {featured && !currentCategory && !currentSearch && currentPage === 1 && (
          <section className="mb-14">
            <PostCard post={featured} featured />
          </section>
        )}

        {/* ── Search + filter ────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-5 mb-10">
          {/* Search bar */}
          <form onSubmit={handleSearch} className="relative max-w-md">
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search articles…"
              className="w-full bg-surface border border-white/8 rounded-xl px-4 py-2.5 pr-24 text-sm text-white placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors duration-200"
            />
            {currentSearch && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-16 top-1/2 -translate-y-1/2 text-muted hover:text-white text-xs font-mono transition-colors"
              >
                ✕
              </button>
            )}
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary hover:bg-primary/90 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors duration-200"
            >
              Search
            </button>
          </form>

          {/* Category filter */}
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
            <button
              onClick={() => handleCategory('')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors duration-200 ${
                !currentCategory
                  ? 'bg-primary/15 border-primary/40 text-primary'
                  : 'border-white/8 text-muted hover:border-white/20 hover:text-white'
              }`}
            >
              All
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors duration-200 ${
                  currentCategory === cat
                    ? 'bg-primary/15 border-primary/40 text-primary'
                    : 'border-white/8 text-muted hover:border-white/20 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Active filters indicator */}
          {(currentSearch || currentCategory) && (
            <p className="text-xs font-mono text-muted">
              {pagination?.total ?? 0} result{pagination?.total !== 1 ? 's' : ''}
              {currentSearch && <span> for &ldquo;<span className="text-white">{currentSearch}</span>&rdquo;</span>}
              {currentCategory && <span> in <span className="text-primary">{currentCategory}</span></span>}
            </p>
          )}
        </div>

        {/* ── Post grid ──────────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <PostSkeleton key={i} />
              ))}
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-24"
            >
              <p className="text-muted text-sm font-mono mb-4">{error}</p>
              <button
                onClick={fetchPosts}
                className="text-primary text-sm font-mono hover:underline"
              >
                Try again
              </button>
            </motion.div>
          ) : posts.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-24"
            >
              <p className="text-4xl mb-4">✦</p>
              <p className="text-white font-semibold mb-2">No articles yet</p>
              <p className="text-muted text-sm font-mono">
                {currentCategory || currentSearch
                  ? 'Try a different filter or search term.'
                  : 'Check back soon — articles are on their way.'}
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="posts"
              variants={staggerContainer(0.06)}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
            >
              {posts.map((post, i) => (
                <PostCard key={post._id} post={post} index={i} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Pagination ─────────────────────────────────────────────────────── */}
        {!loading && !error && (
          <Pagination pagination={pagination} onPage={handlePage} />
        )}
      </div>
    </div>
  )
}

export default Blog
