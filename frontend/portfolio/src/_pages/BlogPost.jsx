'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { fadeUp } from '../lib/motion'
import CategoryPill from '../components/blog/CategoryPill'
import PostMeta from '../components/blog/PostMeta'
import GlowEffect from '../components/ui/GlowEffect'
import BlogCoverImage from '../components/blog/BlogCoverImage'

// ─── Main page ────────────────────────────────────────────────────────────────
function BlogPost({ post }) {

  const { title, content, excerpt, category, tags = [], publishedAt, readingTime, coverImage, coverMedia, coverAlt } = post
  const coverAltText = coverMedia?.alt ?? coverAlt ?? title

  // ─── Article ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-bg">
      <div className="relative overflow-hidden">
        <GlowEffect color="primary" size="md" className="-top-20 -right-20 opacity-20" />

        <article className="relative z-10 max-w-3xl mx-auto px-6 pt-32 pb-24">
          {/* Back link */}
          <motion.div variants={fadeUp} initial={false} animate="show">
            <Link
              href="/blog"
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
              initial={false}
              animate="show"
              className="flex items-center gap-3 mb-6"
            >
              <CategoryPill category={category} />
            </motion.div>

            <motion.h1
              variants={fadeUp}
              initial={false}
              animate="show"
              className="text-3xl md:text-5xl font-bold text-white leading-tight tracking-tight mb-6"
            >
              {title}
            </motion.h1>

            <motion.div variants={fadeUp} initial={false} animate="show">
              <p className="text-sm text-muted mb-3">By <Link href="/#about" className="text-primary">Mattia Giuliani</Link></p>
              <PostMeta publishedAt={publishedAt} readingTime={readingTime} />
            </motion.div>

            {excerpt && (
              <motion.p
                variants={fadeUp}
                initial={false}
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
              initial={false}
              animate="show"
              className="rounded-xl overflow-hidden mb-12 border border-white/5"
            >
              <BlogCoverImage
                src={coverImage}
                alt={coverAltText}
                className="w-full object-cover max-h-80"
                loading="lazy"
              />
            </motion.div>
          )}

          {/* Markdown content */}
          <motion.div
            variants={fadeUp}
            initial={false}
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
              initial={false}
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
              href="/blog"
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
