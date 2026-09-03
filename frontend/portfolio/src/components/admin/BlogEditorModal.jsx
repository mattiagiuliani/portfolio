import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { blogAdminApi } from '../../services/adminApi'
import { CATEGORIES } from '../../lib/blogUtils'
import { isValidBlogCoverImage } from '../../lib/blogCoverImage'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const CloseIcon = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
    <path d="M3 3l9 9M12 3l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

function toSlugPreview(title) {
  return title
    .toLowerCase().trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
}

const emptyForm = {
  title:      '',
  category:   '',
  tags:       '',
  excerpt:    '',
  coverImage: '',
  content:    '',
  published:  false,
  featured:   false,
}

function fieldFromPost(post) {
  return {
    title:      post.title      ?? '',
    category:   post.category   ?? '',
    tags:       (post.tags ?? []).join(', '),
    excerpt:    post.excerpt    ?? '',
    coverImage: post.coverImage ?? '',
    content:    post.content    ?? '',
    published:  post.published  ?? false,
    featured:   post.featured   ?? false,
  }
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
      <span className="text-xs font-mono text-muted">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
          checked ? 'bg-primary' : 'bg-white/10'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </label>
  )
}

// ─── Label + field wrapper ────────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-mono text-muted">{label}</p>
      {children}
    </div>
  )
}

const inputCls =
  'w-full bg-bg border border-white/8 rounded-lg px-3 py-2 text-sm text-white placeholder:text-subtle focus:outline-none focus:border-primary/50 transition-colors duration-200'

// ─── Main component ───────────────────────────────────────────────────────────
/**
 * BlogEditorModal — full-screen overlay for creating and editing blog posts.
 *
 * Props:
 *  post    — null for "new post", Post object for "edit"
 *  onClose — close without saving
 *  onSaved — called after a successful create or update (triggers list refresh)
 */
function BlogEditorModal({ post, onClose, onSaved }) {
  const isNew = !post
  const [form,   setForm]   = useState(isNew ? emptyForm : fieldFromPost(post))
  const [loadingPost, setLoadingPost] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const [coverImageFailed, setCoverImageFailed] = useState(false)

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    if (isNew) return undefined

    let cancelled = false
    blogAdminApi
      .getById(post._id)
      .then((res) => {
        if (!cancelled) setForm(fieldFromPost(res.data))
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? 'Failed to load post content')
      })
      .finally(() => {
        if (!cancelled) setLoadingPost(false)
      })

    return () => { cancelled = true }
  }, [isNew, post])

  const set = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (key === 'coverImage') setCoverImageFailed(false)
  }, [])

  const handleSave = async (publishOverride = null) => {
    if (loadingPost) return
    if (!form.title.trim() || !form.content.trim() || !form.category) {
      setError('Title, content, and category are required.')
      return
    }
    setSaving(true)
    setError('')

    const payload = {
      title:      form.title.trim(),
      category:   form.category,
      content:    form.content,
      published:  publishOverride !== null ? publishOverride : form.published,
      featured:   form.featured,
      tags:       form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      ...(form.excerpt.trim()    && { excerpt:    form.excerpt.trim() }),
      coverImage: form.coverImage.trim(),
    }

    try {
      if (isNew) {
        await blogAdminApi.create(payload)
      } else {
        await blogAdminApi.update(post._id, payload)
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err?.message ?? err?.errors?.[0]?.message ?? 'Failed to save post')
    } finally {
      setSaving(false)
    }
  }

  const slugPreview = toSlugPreview(form.title)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-start justify-center pt-2 sm:pt-4 px-2 sm:px-4 pb-2 sm:pb-4 bg-black/70 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0,  opacity: 1 }}
        exit={{ y: 10,    opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="w-full max-w-5xl bg-surface border border-white/8 rounded-2xl overflow-hidden shadow-2xl shadow-black/60 flex flex-col"
        style={{ minHeight: 'calc(100vh - 2rem)' }}
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? 'New article' : `Edit: ${post.title}`}
      >
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-subtle px-2 py-0.5 rounded border border-white/8">
              {isNew ? 'NEW' : 'EDIT'}
            </span>
            <p className="text-sm font-semibold text-white truncate max-w-xs">
              {form.title || (isNew ? 'Untitled article' : post.title)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-white/8 transition-colors"
            aria-label="Close editor"
          >
            <CloseIcon />
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col sm:flex-row min-h-0 overflow-y-auto sm:overflow-hidden">

          {/* Left: title + content */}
          <div className="flex-1 min-w-0 flex flex-col p-4 sm:p-6 gap-4 overflow-y-auto">
            {/* Title */}
            <input
              type="text"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Article title…"
              autoFocus
              className="w-full bg-transparent border-none outline-none text-2xl font-bold text-white placeholder:text-subtle/50 resize-none"
            />

            {/* Slug preview under title */}
            {form.title && (
              <p className="text-xs font-mono text-subtle -mt-2">
                /blog/<span className="text-muted">{slugPreview || '…'}</span>
              </p>
            )}

            {/* Markdown content */}
            <textarea
              value={form.content}
              onChange={(e) => set('content', e.target.value)}
              placeholder={'Write your article in Markdown…\n\n# Heading\n\n**bold**, *italic*, `code`\n\n```js\nconsole.log("hello")\n```'}
              className="flex-1 w-full min-h-[320px] sm:min-h-[400px] bg-bg/50 border border-white/5 rounded-xl px-5 py-4 text-sm text-white/85 placeholder:text-subtle/50 font-mono leading-relaxed resize-none focus:outline-none focus:border-primary/30 transition-colors duration-200"
              spellCheck={false}
            />

            {error && (
              <p className="text-xs font-mono text-red-400 bg-red-400/8 border border-red-400/15 rounded-lg px-3.5 py-2.5">
                {error}
              </p>
            )}
          </div>

          {/* Right: metadata sidebar */}
          <aside className="w-full sm:w-64 shrink-0 border-t sm:border-t-0 sm:border-l border-white/5 flex flex-col gap-5 p-4 sm:p-5 overflow-y-auto">

            {/* Status toggles */}
            <div className="flex flex-col gap-3 pb-5 border-b border-white/5">
              <Toggle label="Published" checked={form.published} onChange={(v) => set('published', v)} />
              <Toggle label="Featured"  checked={form.featured}  onChange={(v) => set('featured',  v)} />
            </div>

            {/* Category */}
            <Field label="Category *">
              <select
                value={form.category}
                onChange={(e) => set('category', e.target.value)}
                className={`${inputCls} appearance-none`}
              >
                <option value="" disabled>Select category</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>

            {/* Tags */}
            <Field label="Tags (comma-separated)">
              <input
                type="text"
                value={form.tags}
                onChange={(e) => set('tags', e.target.value)}
                placeholder="react, nodejs, css"
                className={inputCls}
              />
            </Field>

            {/* Excerpt */}
            <Field label="Excerpt">
              <textarea
                value={form.excerpt}
                onChange={(e) => set('excerpt', e.target.value)}
                placeholder="Short summary shown in lists…"
                rows={3}
                className={`${inputCls} resize-none`}
              />
            </Field>

            {/* Cover image */}
            <Field label="Cover image">
              <input
                type="text"
                value={form.coverImage}
                onChange={(e) => set('coverImage', e.target.value)}
                placeholder="/images/blog/my-post.webp"
                className={inputCls}
              />
              {form.coverImage && isValidBlogCoverImage(form.coverImage) && !coverImageFailed && (
                <img
                  src={form.coverImage}
                  alt={form.title ? `Cover preview for ${form.title}` : 'Cover image preview'}
                  className="w-full h-24 object-cover rounded-lg border border-white/8 mt-1"
                  onError={() => setCoverImageFailed(true)}
                />
              )}
              {form.coverImage && !isValidBlogCoverImage(form.coverImage) && (
                <p className="text-xs font-mono text-red-400">Use /images/blog/filename.webp, .jpg, or .png, or an HTTPS URL.</p>
              )}
              {form.coverImage && isValidBlogCoverImage(form.coverImage) && coverImageFailed && (
                <p className="text-xs font-mono text-red-400">Image preview could not be loaded. You can still save the post.</p>
              )}
            </Field>

          </aside>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-6 py-4 border-t border-white/5 shrink-0 bg-bg/30">
          {/* Word count */}
          <p className="text-xs font-mono text-subtle">
            {form.content.trim().split(/\s+/).filter(Boolean).length} words
            {' · '}
            {Math.max(1, Math.ceil(form.content.trim().split(/\s+/).filter(Boolean).length / 200))} min read
          </p>

          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving || loadingPost}
              className="px-4 py-2 rounded-lg text-xs font-semibold border border-white/10 text-muted hover:text-white transition-colors duration-200 disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={saving || loadingPost}
              className="px-4 py-2 rounded-lg text-xs font-semibold border border-white/10 text-muted hover:text-white hover:border-white/20 transition-colors duration-200 disabled:opacity-40"
            >
              {loadingPost ? 'Loading…' : saving ? 'Saving…' : 'Save draft'}
            </button>
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={saving || loadingPost}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-primary hover:bg-primary/90 text-white transition-colors duration-200 disabled:opacity-40 flex items-center gap-2"
            >
              {saving && (
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              )}
              {post?.published ? 'Update' : 'Publish'}
            </button>
          </div>
        </div>

      </motion.div>
    </motion.div>
  )
}

export default BlogEditorModal
