import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { blogApi } from '../services/api'
import { fadeUp } from '../lib/motion'
import CategoryPill from '../components/blog/CategoryPill'
import PostMeta from '../components/blog/PostMeta'
import GlowEffect from '../components/ui/GlowEffect'
import BlogCoverImage from '../components/blog/BlogCoverImage'

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function ArticleSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-6 pt-32 pb-24 animate-pulse">
      <div className="h-4 w-16 rounded bg-white/8 mb-10" />
      <div className="h-5 w-24 rounded bg-white/8 mb-6" />
      <div className="h-12 w-full rounded bg-white/10 mb-3" />
      <div className="h-12 w-3/4 rounded bg-white/10 mb-8" />
      <div className="h-4 w-40 rounded bg-white/5 mb-16" />
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className={`h-4 rounded bg-white/5 ${i % 4 === 3 ? 'w-2/3' : 'w-full'}`} />
        ))}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
function BlogPost() {
  const { slug } = useParams()
  const [post,    setPost]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    blogApi
      .fetchPost(slug)
      .then((res) => setPost(res.data))
      .catch((err) => setError(err?.message ?? 'Post not found'))
      .finally(() => setLoading(false))
  }, [slug])

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (loading) return <ArticleSkeleton />

  // ─── Error / not found ───────────────────────────────────────────────────────
  if (error || !post) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-6 text-center px-6">
        <p className="text-5xl">✦</p>
        <h1 className="text-2xl font-bold text-white">Article not found</h1>
        <p className="text-muted text-sm font-mono">{error ?? 'This post does not exist or has been removed.'}</p>
        <Link
          to="/blog"
          className="text-primary font-mono text-sm hover:underline"
        >
          ← Back to Blog
        </Link>
      </div>
    )
  }

  const { title, content, excerpt, category, tags = [], publishedAt, readingTime, coverImage } = post

  // ─── Article ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-bg">
      <div className="relative overflow-hidden">
        <GlowEffect color="primary" size="md" className="-top-20 -right-20 opacity-20" />

        <article className="relative z-10 max-w-3xl mx-auto px-6 pt-32 pb-24">
          {/* Back link */}
          <motion.div variants={fadeUp} initial="hidden" animate="show">
            <Link
              to="/blog"
              className="inline-flex items-center gap-2 text-muted hover:text-white font-mono text-sm transition-colors duration-200 mb-10 group"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden="true"
                className="group-hover:-translate-x-0.5 transition-transform duration-200"
              >
                <path d="M11 7H3M7 3L3 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back to Blog
            </Link>
          </motion.div>

          {/* Header */}
          <header>
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="flex items-center gap-3 mb-6"
            >
              <CategoryPill category={category} />
            </motion.div>

            <motion.h1
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="text-3xl md:text-5xl font-bold text-white leading-tight tracking-tight mb-6"
            >
              {title}
            </motion.h1>

            <motion.div variants={fadeUp} initial="hidden" animate="show">
              <PostMeta publishedAt={publishedAt} readingTime={readingTime} />
            </motion.div>

            {excerpt && (
              <motion.p
                variants={fadeUp}
                initial="hidden"
                animate="show"
                className="mt-6 text-lg leading-relaxed text-muted"
              >
                {excerpt}
              </motion.p>
            )}

            {/* Divider */}
            <div className="h-px bg-white/5 my-10" />
          </header>

          {/* Cover image */}
          {coverImage && (
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="rounded-xl overflow-hidden mb-12 border border-white/5"
            >
              <BlogCoverImage
                src={coverImage}
                alt={title}
                className="w-full object-cover max-h-80"
                loading="lazy"
              />
            </motion.div>
          )}

          {/* Markdown content */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="prose prose-invert prose-violet max-w-none
              prose-headings:font-bold prose-headings:tracking-tight
              prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl
              prose-p:text-[#b0b0c8] prose-p:leading-relaxed
              prose-a:text-primary prose-a:no-underline hover:prose-a:underline
              prose-code:text-primary prose-code:bg-surface prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
              prose-pre:bg-surface prose-pre:border prose-pre:border-white/8 prose-pre:rounded-xl
              prose-blockquote:border-primary/40 prose-blockquote:text-muted
              prose-strong:text-white
              prose-hr:border-white/8
              prose-img:rounded-xl prose-img:border prose-img:border-white/8
              prose-li:text-[#b0b0c8]
              prose-th:text-white prose-th:border-white/10
              prose-td:text-muted prose-td:border-white/8"
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </motion.div>

          {/* Tags */}
          {tags.length > 0 && (
            <motion.footer
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="mt-14 pt-8 border-t border-white/5"
            >
              <p className="text-xs font-mono text-muted mb-3 uppercase tracking-widest">Tags</p>
              <ul className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <li key={tag}>
                    <span className="inline-flex px-3 py-1 rounded-lg text-xs font-mono text-muted bg-surface border border-white/8">
                      {tag}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.footer>
          )}

          {/* Bottom back link */}
          <div className="mt-14 pt-8 border-t border-white/5">
            <Link
              to="/blog"
              className="inline-flex items-center gap-2 text-muted hover:text-white font-mono text-sm transition-colors duration-200 group"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden="true"
                className="group-hover:-translate-x-0.5 transition-transform duration-200"
              >
                <path d="M11 7H3M7 3L3 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back to Blog
            </Link>
          </div>
        </article>
      </div>
    </div>
  )
}

export default BlogPost
