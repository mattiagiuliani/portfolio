import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { fadeUp } from '../../lib/motion'
import CategoryPill from './CategoryPill'
import PostMeta from './PostMeta'
import BlogCoverImage from './BlogCoverImage'

/**
 * PostCard — blog post preview card used in list and preview sections.
 *
 * Props:
 *  post     — Post object from API
 *  index    — position in list (used for staggered animation delay)
 *  featured — renders a larger horizontal layout
 */
function PostCard({ post, index = 0, featured = false }) {
  const { title, slug, excerpt, coverImage, category, tags = [], publishedAt, readingTime } = post

  if (featured) {
    return (
      <motion.article
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
        className="group relative rounded-2xl border border-white/5 bg-surface hover:border-primary/30 transition-colors duration-300 overflow-hidden"
      >
        <Link to={`/blog/${slug}`} className="flex flex-col md:flex-row gap-0">
          {/* Content */}
          <div className="flex-1 p-8 md:p-10 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <CategoryPill category={category} />
              <span className="text-xs font-mono text-subtle uppercase tracking-widest">
                Featured
              </span>
            </div>

            <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight group-hover:text-primary transition-colors duration-200">
              {title}
            </h2>

            {excerpt && (
              <p className="text-muted text-sm md:text-base leading-relaxed line-clamp-3">
                {excerpt}
              </p>
            )}

            <div className="mt-auto flex items-center justify-between pt-4">
              <PostMeta publishedAt={publishedAt} readingTime={readingTime} />
              <span className="text-primary text-sm font-medium font-mono group-hover:translate-x-1 transition-transform duration-200 inline-flex items-center gap-1">
                Read article
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            </div>
          </div>
          {coverImage && (
            <div className="md:w-2/5">
              <BlogCoverImage
                src={coverImage}
                alt={title}
                className="h-52 w-full object-cover md:h-full"
                loading="lazy"
              />
            </div>
          )}
        </Link>
      </motion.article>
    )
  }

  return (
    <motion.article
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true }}
      transition={{ delay: index * 0.06 }}
      className="group flex flex-col rounded-2xl border border-white/5 bg-surface hover:border-primary/30 hover:-translate-y-1 transition-all duration-300 overflow-hidden"
    >
      <Link to={`/blog/${slug}`} className="flex flex-col flex-1 p-6 gap-4">
        {coverImage && (
          <BlogCoverImage
            src={coverImage}
            alt={title}
            className="h-40 w-full rounded-xl object-cover"
            loading="lazy"
          />
        )}
        <div className="flex items-start justify-between gap-3">
          <CategoryPill category={category} size="sm" />
          <PostMeta publishedAt={publishedAt} readingTime={readingTime} />
        </div>

        <h3 className="text-lg font-semibold text-white leading-snug group-hover:text-primary transition-colors duration-200 line-clamp-2">
          {title}
        </h3>

        {excerpt && (
          <p className="text-muted text-sm leading-relaxed line-clamp-3 flex-1">
            {excerpt}
          </p>
        )}

        {tags.length > 0 && (
          <ul className="flex flex-wrap gap-1.5 mt-auto pt-2">
            {tags.slice(0, 3).map((tag) => (
              <li key={tag}>
                <span className="inline-flex px-2 py-0.5 rounded text-xs font-mono text-muted bg-white/4 border border-white/8">
                  {tag}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Link>
    </motion.article>
  )
}

export default PostCard
