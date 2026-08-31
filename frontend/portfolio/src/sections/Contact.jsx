import { motion } from 'framer-motion'
import { useState } from 'react'
import Section from '../components/layout/Section'
import SectionTitle from '../components/common/SectionTitle'
import GlowEffect from '../components/ui/GlowEffect'
import { fadeUp, viewport } from '../lib/motion'
import { contactApi } from '../services/api'

const contacts = [
  {
    label: 'Email',
    value: 'mattiaggt02@gmail.com',
    href: 'mailto:mattiaggt02@gmail.com',
    external: false,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25H4.5a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5H4.5a2.25 2.25 0 0 0-2.25 2.25m19.5 0-9.75 6.75L2.25 6.75" />
      </svg>
    ),
  },
  {
    label: 'Phone',
    value: '+39 353 207 5125',
    href: 'tel:+393532075125',
    external: false,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
      </svg>
    ),
  },
  {
    label: 'LinkedIn',
    value: 'mattia-giuliani-dev',
    href: 'https://www.linkedin.com/in/mattia-giuliani-dev',
    external: true,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path d="M20.447 20.452H16.89v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a1.983 1.983 0 1 1 0-3.966 1.983 1.983 0 0 1 0 3.966zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
  },
]

function Contact({ settings }) {
  const publicContacts = contacts.map((contact) => {
    if (contact.label === 'Email' && settings?.email) {
      return { ...contact, value: settings.email, href: `mailto:${settings.email}` }
    }
    if (contact.label === 'LinkedIn' && settings?.linkedinUrl) {
      return { ...contact, value: settings.linkedinUrl, href: settings.linkedinUrl }
    }
    return contact
  })

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
        <SectionTitle>Contact</SectionTitle>

        <motion.p
          className="max-w-md text-muted mt-8 mb-12 text-base md:text-lg leading-relaxed"
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={viewport}
        >
          Open to junior Full Stack Developer roles and opportunities to build modern,
          scalable web applications with forward-thinking teams.
        </motion.p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl">
          {publicContacts.map((contact, i) => (
            <motion.a
              key={contact.label}
              href={contact.href}
              target={contact.external ? '_blank' : undefined}
              rel={contact.external ? 'noopener noreferrer' : undefined}
              className="group flex flex-col items-center gap-3 p-6 rounded-2xl bg-surface border border-white/5 hover:border-primary/30 transition-all duration-300 cursor-pointer"
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={viewport}
              custom={i}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              whileTap={{ scale: 0.97 }}
            >
              <span className="text-primary group-hover:text-secondary transition-colors duration-300">
                {contact.icon}
              </span>
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
        initial="hidden"
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
      initial="hidden"
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
