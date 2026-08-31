import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { settingsApi } from '../../services/adminApi'
import { staggerContainer, fadeUp } from '../../lib/motion'

const inputCls =
  'w-full bg-bg border border-white/8 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder:text-subtle focus:outline-none focus:border-primary/50 transition-colors duration-200'

function Section({ title, description, children }) {
  return (
    <motion.section variants={fadeUp} className="flex flex-col gap-5">
      <div className="pb-4 border-b border-white/5">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {description && <p className="mt-0.5 text-xs font-mono text-muted">{description}</p>}
      </div>
      {children}
    </motion.section>
  )
}

function Field({ label, hint, children }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
      <div className="sm:pt-2.5">
        <p className="text-xs font-mono text-muted">{label}</p>
        {hint && <p className="text-xs text-subtle mt-0.5">{hint}</p>}
      </div>
      <div className="sm:col-span-2">{children}</div>
    </div>
  )
}

const defaultForm = {
  name: '', email: '', jobTitle: '',
  heroTagline: '', heroDescription: '',
  githubUrl: '', linkedinUrl: '', twitterUrl: '',
  resumeUrl: '', aboutText: '',
}

function AdminSettings() {
  const [form,    setForm]    = useState(defaultForm)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState('')
  const savedTimer = useRef(null)

  useEffect(() => {
    settingsApi.get()
      .then((res) => setForm({ ...defaultForm, ...res.data }))
      .catch(() => {})
      .finally(() => setLoading(false))

    return () => clearTimeout(savedTimer.current)
  }, [])

  const set = (k, v) => setForm((prev) => ({ ...prev, [k]: v }))

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true); setError(''); setSaved(false)
    try {
      await settingsApi.update(form)
      setSaved(true)
      savedTimer.current = setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err?.message ?? 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl space-y-10">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-4 animate-pulse">
            <div className="h-4 w-32 rounded bg-white/8" />
            <div className="h-10 rounded-lg bg-white/5" />
            <div className="h-10 rounded-lg bg-white/5" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <motion.form
      onSubmit={handleSave}
      variants={staggerContainer(0.08)}
      initial="hidden"
      animate="show"
      className="max-w-2xl"
    >
      <motion.div variants={fadeUp} className="mb-8">
        <h2 className="text-2xl font-bold text-white tracking-tight">Settings</h2>
        <p className="mt-1 text-sm text-muted">Manage your profile and site content.</p>
      </motion.div>

      <div className="flex flex-col gap-10">

        {/* Profile */}
        <Section title="Profile" description="Your public identity across the portfolio.">
          <Field label="Full name">
            <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)}
              placeholder="Mattia Giuliani" className={inputCls} />
          </Field>
          <Field label="Job title">
            <input type="text" value={form.jobTitle} onChange={(e) => set('jobTitle', e.target.value)}
              placeholder="Full Stack Developer" className={inputCls} />
          </Field>
          <Field label="Email" hint="Shown in contact section">
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)}
              placeholder="you@example.com" className={inputCls} />
          </Field>
        </Section>

        {/* Hero */}
        <Section title="Hero section" description="Text displayed in the top section of your portfolio.">
          <Field label="Tagline" hint="Monospaced label above your name">
            <input type="text" value={form.heroTagline} onChange={(e) => set('heroTagline', e.target.value)}
              placeholder="// full stack developer" className={`${inputCls} font-mono`} />
          </Field>
          <Field label="Description" hint="Short paragraph below your title">
            <textarea value={form.heroDescription} onChange={(e) => set('heroDescription', e.target.value)}
              placeholder="Building modern software today while exploring…" rows={3}
              className={`${inputCls} resize-none`} />
          </Field>
        </Section>

        {/* About */}
        <Section title="About" description="Longer text for the About section.">
          <Field label="About text">
            <textarea value={form.aboutText} onChange={(e) => set('aboutText', e.target.value)}
              placeholder="Write a few paragraphs about yourself…" rows={5}
              className={`${inputCls} resize-none`} />
          </Field>
        </Section>

        {/* Social */}
        <Section title="Social links">
          <Field label="GitHub">
            <input type="url" value={form.githubUrl} onChange={(e) => set('githubUrl', e.target.value)}
              placeholder="https://github.com/username" className={inputCls} />
          </Field>
          <Field label="LinkedIn">
            <input type="url" value={form.linkedinUrl} onChange={(e) => set('linkedinUrl', e.target.value)}
              placeholder="https://linkedin.com/in/username" className={inputCls} />
          </Field>
          <Field label="Twitter / X">
            <input type="url" value={form.twitterUrl} onChange={(e) => set('twitterUrl', e.target.value)}
              placeholder="https://x.com/username" className={inputCls} />
          </Field>
        </Section>

        {/* Resume */}
        <Section title="Resume">
          <Field label="Download URL" hint="Direct link to a PDF or hosted file">
            <input type="url" value={form.resumeUrl} onChange={(e) => set('resumeUrl', e.target.value)}
              placeholder="https://…/resume.pdf" className={inputCls} />
          </Field>
        </Section>

      </div>

      {/* Sticky footer */}
      <div className="sticky bottom-0 mt-10 pt-4 pb-2 bg-bg/90 backdrop-blur-sm border-t border-white/5 flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-primary hover:bg-primary/90 text-white transition-colors disabled:opacity-40 flex items-center gap-2"
        >
          {saving && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
          {saving ? 'Saving…' : 'Save settings'}
        </button>

        {saved && (
          <motion.span
            initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="text-xs font-mono text-emerald flex items-center gap-1.5"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
              <path d="M2 6.5l3.5 3.5 5.5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Saved
          </motion.span>
        )}

        {error && (
          <p className="text-xs font-mono text-red-400">{error}</p>
        )}
      </div>
    </motion.form>
  )
}

export default AdminSettings
