import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { navLinks } from '../../data/navigation'
import useActiveSection from '../../hooks/useActiveSection'
import useScrollDirection from '../../hooks/useScrollDirection'
import { sectionIds } from '../../data/navigation'

function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const scrollDirection = useScrollDirection()
  const activeSection = useActiveSection(sectionIds)
  const location = useLocation()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <motion.header
      className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 py-5 transition-all duration-300 ${
        scrolled
          ? 'bg-bg/80 backdrop-blur-md shadow-lg shadow-black/20 border-b border-white/5'
          : ''
      }`}
      initial={{ y: -30, opacity: 0 }}
      animate={{
        y: scrollDirection === 'down' ? -80 : 0,
        opacity: scrollDirection === 'down' ? 0 : 1,
      }}
      transition={{ duration: 0.35, ease: 'easeInOut' }}
    >
      <Link
        to="/"
        className="text-xl font-extrabold text-white tracking-tight select-none"
      >
        MG<span className="text-primary">.</span>
      </Link>

      {/* Desktop nav */}
      <nav className="hidden md:flex gap-8 items-center">
        {navLinks.map(({ label, href }) => {
          // Route-based link (e.g. /blog) — use React Router Link
          if (href.startsWith('/')) {
            const isActive = location.pathname.startsWith(href)
            return (
              <Link
                key={href}
                to={href}
                className={`text-sm font-medium transition-colors duration-200 ${
                  isActive ? 'text-white' : 'text-muted hover:text-white'
                }`}
              >
                {label}
                {isActive && (
                  <motion.span
                    layoutId="nav-indicator"
                    className="block h-px bg-primary mt-0.5 rounded-full"
                  />
                )}
              </Link>
            )
          }
          // Hash-based link (homepage sections)
          const id = href.replace('#', '')
          const isActive = activeSection === id
          return (
            <motion.div
              key={href}
              className={`text-sm font-medium transition-colors duration-200 ${
                isActive ? 'text-white' : 'text-muted hover:text-white'
              }`}
              whileHover={{ y: -1 }}
            >
              <Link to={`/${href}`}>{label}</Link>
              {isActive && (
                <motion.span
                  layoutId="nav-indicator"
                  className="block h-px bg-primary mt-0.5 rounded-full"
                />
              )}
            </motion.div>
          )
        })}
      </nav>

      {/* Burger */}
      <button
        className="md:hidden flex flex-col gap-1.5 p-1 cursor-pointer"
        onClick={() => setMenuOpen((o) => !o)}
        aria-label="Toggle menu"
        aria-expanded={menuOpen}
      >
        <motion.span
          className="block w-6 h-0.5 bg-white/80 rounded origin-center"
          animate={{ rotate: menuOpen ? 45 : 0, y: menuOpen ? 8 : 0 }}
          transition={{ duration: 0.2 }}
        />
        <motion.span
          className="block w-6 h-0.5 bg-white/80 rounded"
          animate={{ opacity: menuOpen ? 0 : 1, scaleX: menuOpen ? 0 : 1 }}
          transition={{ duration: 0.2 }}
        />
        <motion.span
          className="block w-6 h-0.5 bg-white/80 rounded origin-center"
          animate={{ rotate: menuOpen ? -45 : 0, y: menuOpen ? -8 : 0 }}
          transition={{ duration: 0.2 }}
        />
      </button>

      {/* Mobile dropdown */}
      <AnimatePresence>
        {menuOpen && (
          <motion.nav
            className="absolute top-full left-0 right-0 bg-surface/95 backdrop-blur-md border-b border-white/5 flex flex-col items-center gap-6 py-8"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {navLinks.map(({ label, href }) => {
              if (href.startsWith('/')) {
                return (
                  <Link
                    key={href}
                    to={href}
                    className="text-base font-medium text-muted hover:text-white transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    {label}
                  </Link>
                )
              }
              return (
                <Link
                  key={href}
                  to={`/${href}`}
                  className="text-base font-medium text-muted hover:text-white transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  {label}
                </Link>
              )
            })}
          </motion.nav>
        )}
      </AnimatePresence>
    </motion.header>
  )
}

export default Navbar
