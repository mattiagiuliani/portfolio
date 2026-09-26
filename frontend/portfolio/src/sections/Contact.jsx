'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'
import Section from '../components/layout/Section'
import SectionTitle from '../components/common/SectionTitle'
import GlowEffect from '../components/ui/GlowEffect'
import { fadeUp, viewport } from '../lib/motion'
import { contactApi } from '../services/api'

function Contact({ settings }) {
  const publicContacts = [
    settings.email && { label: 'Email', value: settings.email, href: `mailto:${settings.email}`, external: false },
    settings.linkedinUrl && { label: 'LinkedIn', value: settings.linkedinUrl, href: settings.linkedinUrl, external: true },
  ].filter(Boolean)

  const socialLinks = [
    ['GitHub', settings?.githubUrl],
    ['Twitter / X', settings?.twitterUrl],
    ['Resume', settings?.resumeUrl],
  ].filter(([, url]) => url)

  return (
    <Section id="contact" className="relative overflow-hidden">
      <GlowEffect
        color="primary"
        size="lg"
        className="-bottom-40 left-1/2 -translate-x-1/2 opacity-40"
      />

      <div className="relative z-10 flex flex-col items-center text-center">
        <p className="eyebrow section-index">05 / THE NEXT CONVERSATION</p>
        <SectionTitle>Let’s build what’s next.</SectionTitle>

        <motion.p
          className="max-w-md text-muted mt-8 mb-12 text-base md:text-lg leading-relaxed"
          variants={fadeUp}
          initial={false}
          whileInView="show"
          viewport={viewport}
        >
          Looking for a junior full stack developer who learns by doing? I am open to
          opportunities where I can contribute, learn from a team, and keep improving
          the software we build. Tell me what you are working on.
        </motion.p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-3xl">
          {publicContacts.map((contact, i) => (
            <motion.a
              key={contact.label}
              href={contact.href}
              target={contact.external ? '_blank' : undefined}
              rel={contact.external ? 'noopener noreferrer' : undefined}
              className="group flex flex-col items-center gap-3 p-6 rounded-2xl bg-surface border border-white/5 hover:border-primary/30 transition-all duration-300 cursor-pointer"
              variants={fadeUp}
              initial={false}
              whileInView="show"
              viewport={viewport}
              custom={i}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              whileTap={{ scale: 0.97 }}
            >
              <span className="text-xs uppercase tracking-widest text-muted font-medium">
                {contact.label}
              </span>
              <span className="text-sm md:text-base font-semibold text-foreground group-hover:text-primary transition-colors duration-300 break-all">
                {contact.value}
              </span>
            </motion.a>
          ))}
        </div>

        {socialLinks.length > 0 && (
          <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm">
            {socialLinks.map(([label, url]) => (
              <a key={label} href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-secondary transition-colors">
                {label}
              </a>
            ))}
          </div>
        )}

        <ContactForm />
      </div>
    </Section>
  )
}

// ─── Contact Form ─────────────────────────────────────────────────────────────

const INITIAL_FORM = { name: '', email: '', message: '' }

const inputClass =
  'w-full bg-surface border border-white/5 rounded-xl px-4 py-3 text-sm placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors duration-200'

function ContactForm() {
  const [form, setForm] = useState(INITIAL_FORM)
  const [status, setStatus] = useState('idle') // 'idle' | 'loading' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('')

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('loading')
    setErrorMsg('')
    try {
      await contactApi.submit(form)
      setStatus('success')
      setForm(INITIAL_FORM)
    } catch (err) {
      setStatus('error')
      setErrorMsg(
        err?.errors?.[0]?.message ??
          err?.message ??
          'Something went wrong. Please try again.'
      )
    }
  }

  if (status === 'success') {
    return (
      <motion.div
        className="w-full max-w-xl mx-auto mt-14 p-8 rounded-2xl bg-surface border border-emerald/30 text-center"
        variants={fadeUp}
        initial={false}
        animate="show"
      >
        <p className="text-emerald font-semibold text-lg">Message sent!</p>
        <p className="text-muted mt-2 text-sm">
          I&apos;ll get back to you as soon as possible.
        </p>
        <button
          onClick={() => setStatus('idle')}
          className="mt-6 text-sm text-primary hover:text-secondary transition-colors duration-200"
        >
          Send another message
        </button>
      </motion.div>
    )
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="w-full max-w-xl mx-auto mt-14 flex flex-col gap-5"
      variants={fadeUp}
      initial={false}
      whileInView="show"
      viewport={viewport}
    >
      <p className="text-center text-muted text-xs uppercase tracking-widest mb-1">
        Or send me a message
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="name" className="text-xs text-muted uppercase tracking-widest">
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            maxLength={100}
            value={form.name}
            onChange={handleChange}
            placeholder="John Doe"
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="text-xs text-muted uppercase tracking-widest">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            value={form.email}
            onChange={handleChange}
            placeholder="john@example.com"
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="message" className="text-xs text-muted uppercase tracking-widest">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          required
          minLength={10}
          maxLength={2000}
          rows={5}
          value={form.message}
          onChange={handleChange}
          placeholder="I'd love to chat about..."
          className={`${inputClass} resize-none`}
        />
      </div>

      {status === 'error' && (
        <p className="text-red-400 text-sm text-center">{errorMsg}</p>
      )}

      <div className="flex justify-center">
        <motion.button
          type="submit"
          disabled={status === 'loading'}
          className="inline-flex items-center gap-2 px-10 py-2.5 rounded-lg text-sm font-semibold bg-primary hover:bg-primary/90 text-white transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          whileHover={{ y: status === 'loading' ? 0 : -2 }}
          whileTap={{ scale: 0.97 }}
        >
          {status === 'loading' ? 'Sending…' : 'Send Message'}
        </motion.button>
      </div>
    </motion.form>
  )
}

export default Contact
