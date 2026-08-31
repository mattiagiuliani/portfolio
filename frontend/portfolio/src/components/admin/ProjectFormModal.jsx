import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { projectsApi } from '../../services/adminApi'

const CloseIcon = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
    <path d="M3 3l9 9M12 3l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

const inputCls =
  'w-full bg-bg border border-white/8 rounded-lg px-3 py-2 text-sm text-white placeholder:text-subtle focus:outline-none focus:border-primary/50 transition-colors duration-200'

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
      <span className="text-xs font-mono text-muted">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${checked ? 'bg-primary' : 'bg-white/10'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </button>
    </label>
  )
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-mono text-muted">{label}</p>
      {children}
    </div>
  )
}

const empty = {
  title: '', description: '', technologies: '', githubUrl: '',
  liveUrl: '', image: '', featured: false, published: true, order: 0,
}

function fromProject(p) {
  return {
    title:        p.title        ?? '',
    description:  p.description  ?? '',
    technologies: (p.technologies ?? []).join(', '),
    githubUrl:    p.githubUrl    ?? '',
    liveUrl:      p.liveUrl      ?? '',
    image:        p.image        ?? '',
    featured:     p.featured     ?? false,
    published:    p.published    ?? true,
    order:        p.order        ?? 0,
  }
}

function ProjectFormModal({ project, onClose, onSaved }) {
  const isNew = !project
  const [form,   setForm]   = useState(isNew ? empty : fromProject(project))
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const set = useCallback((k, v) => setForm((p) => ({ ...p, [k]: v })), [])

  const handleSave = async () => {
    if (!form.title.trim() || !form.description.trim()) {
      setError('Title and description are required.')
      return
    }
    setSaving(true)
    setError('')
    const payload = {
      title:        form.title.trim(),
      description:  form.description.trim(),
      technologies: form.technologies.split(',').map((t) => t.trim()).filter(Boolean),
      featured:     form.featured,
      published:    form.published,
      order:        Number(form.order) || 0,
      ...(form.githubUrl.trim() && { githubUrl: form.githubUrl.trim() }),
      ...(form.liveUrl.trim()   && { liveUrl:   form.liveUrl.trim()   }),
      ...(form.image.trim()     && { image:      form.image.trim()     }),
    }
    try {
      isNew
        ? await projectsApi.create(payload)
        : await projectsApi.update(project._id, payload)
      onSaved()
      onClose()
    } catch (err) {
      setError(err?.message ?? err?.errors?.[0]?.message ?? 'Failed to save project')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/65 backdrop-blur-sm overflow-y-auto py-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 10, opacity: 0 }} transition={{ duration: 0.2, ease: 'easeOut' }}
        className="w-full max-w-2xl bg-surface border border-white/8 rounded-2xl overflow-hidden shadow-2xl shadow-black/60"
        role="dialog" aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white">{isNew ? 'New project' : 'Edit project'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-white/8 transition-colors">
            <CloseIcon />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
          <Field label="Title *">
            <input type="text" value={form.title} onChange={(e) => set('title', e.target.value)}
              placeholder="Project name" autoFocus className={inputCls} />
          </Field>

          <Field label="Description *">
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)}
              placeholder="What does this project do?" rows={3}
              className={`${inputCls} resize-none`} />
          </Field>

          <Field label="Technologies (comma-separated)">
            <input type="text" value={form.technologies} onChange={(e) => set('technologies', e.target.value)}
              placeholder="React, Node.js, MongoDB" className={inputCls} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="GitHub URL">
              <input type="url" value={form.githubUrl} onChange={(e) => set('githubUrl', e.target.value)}
                placeholder="https://github.com/…" className={inputCls} />
            </Field>
            <Field label="Live Demo URL">
              <input type="url" value={form.liveUrl} onChange={(e) => set('liveUrl', e.target.value)}
                placeholder="https://…" className={inputCls} />
            </Field>
          </div>

          <Field label="Image URL">
            <input type="url" value={form.image} onChange={(e) => set('image', e.target.value)}
              placeholder="https://…" className={inputCls} />
            {form.image && (
              <img src={form.image} alt="Preview" onError={(e) => { e.target.style.display = 'none' }}
                className="w-full h-32 object-cover rounded-lg border border-white/8 mt-1" />
            )}
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Display order">
              <input type="number" min={0} value={form.order} onChange={(e) => set('order', e.target.value)}
                className={inputCls} />
            </Field>
            <div className="flex flex-col gap-3 justify-center pt-4">
              <Toggle label="Published" checked={form.published} onChange={(v) => set('published', v)} />
              <Toggle label="Featured"  checked={form.featured}  onChange={(v) => set('featured',  v)} />
            </div>
          </div>

          {error && (
            <p className="text-xs font-mono text-red-400 bg-red-400/8 border border-red-400/15 rounded-lg px-3.5 py-2.5">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2.5 px-6 py-4 border-t border-white/5 bg-bg/30">
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2 rounded-lg text-xs font-semibold border border-white/10 text-muted hover:text-white transition-colors disabled:opacity-40">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-primary hover:bg-primary/90 text-white transition-colors disabled:opacity-40 flex items-center gap-2">
            {saving && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
            {isNew ? 'Create project' : 'Save changes'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default ProjectFormModal
