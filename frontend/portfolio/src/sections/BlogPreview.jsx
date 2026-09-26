'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { fadeUp, staggerContainer, viewport } from '../lib/motion'
import Section from '../components/layout/Section'
import SectionTitle from '../components/common/SectionTitle'
import PostCard from '../components/blog/PostCard'

function BlogPreview({ posts }) {
  if (posts.length === 0) return null

  return (
    <Section id="blog">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <p className="eyebrow section-index">04 / NOTES &amp; EXPLORATIONS</p>
          <SectionTitle>Engineering Journal</SectionTitle>
          <motion.p
            variants={fadeUp}
            initial={false}
            whileInView="show"
            viewport={viewport}
            className="mt-5 text-muted text-base leading-relaxed max-w-md"
          >
            What I build, what I learn, and what I would do differently next time.
            Notes from my projects and explorations in web development and computing.
          </motion.p>
        </div>

        <motion.div
          variants={fadeUp}
          initial={false}
          whileInView="show"
          viewport={viewport}
        >
          <Link
            href="/blog"
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
        <motion.div
          variants={staggerContainer(0.08)}
          initial={false}
          whileInView="show"
          viewport={viewport}
          className="grid grid-cols-1 md:grid-cols-3 gap-5"
        >
          {posts.map((post, i) => (
            <PostCard key={post._id} post={post} index={i} />
          ))}
        </motion.div>
      </div>
    </Section>
  )
}

export default BlogPreview
