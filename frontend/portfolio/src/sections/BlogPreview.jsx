import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { blogApi } from '../services/api'
import { fadeUp, staggerContainer, viewport } from '../lib/motion'
import Section from '../components/layout/Section'
import SectionTitle from '../components/common/SectionTitle'
import PostCard from '../components/blog/PostCard'

function BlogPreview() {
  const [posts,   setPosts]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    blogApi
      .fetchPosts({ limit: 3, sort: '-publishedAt' })
      .then((res) => setPosts(res.data))
      .catch(() => {}) // section is non-critical — fail silently
      .finally(() => setLoading(false))
  }, [])

  // Don't render the section at all if no posts and not loading
  if (!loading && posts.length === 0) return null

  return (
    <Section id="blog">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <SectionTitle>Engineering Journal</SectionTitle>
          <motion.p
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={viewport}
            className="mt-5 text-muted text-base leading-relaxed max-w-md"
          >
            Thoughts on web development, cloud, AI, and the journey of building
            modern software.
          </motion.p>
        </div>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={viewport}
        >
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-sm font-mono text-primary hover:text-white transition-colors duration-200 group"
          >
            View all articles
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden="true"
              className="group-hover:translate-x-0.5 transition-transform duration-200"
            >
              <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </motion.div>
      </div>

      <div className="mt-12">
        {loading ? (
          // Skeleton grid while fetching
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/5 bg-surface p-6 flex flex-col gap-4 animate-pulse"
              >
                <div className="flex justify-between">
                  <div className="h-5 w-24 rounded bg-white/8" />
                  <div className="h-4 w-16 rounded bg-white/5" />
                </div>
                <div className="h-6 w-4/5 rounded bg-white/8" />
                <div className="space-y-2">
                  <div className="h-4 w-full rounded bg-white/5" />
                  <div className="h-4 w-3/4 rounded bg-white/5" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <motion.div
            variants={staggerContainer(0.08)}
            initial="hidden"
            whileInView="show"
            viewport={viewport}
            className="grid grid-cols-1 md:grid-cols-3 gap-5"
          >
            {posts.map((post, i) => (
              <PostCard key={post._id} post={post} index={i} />
            ))}
          </motion.div>
        )}
      </div>
    </Section>
  )
}

export default BlogPreview
