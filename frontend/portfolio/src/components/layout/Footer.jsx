import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { navLinks } from '../../data/navigation'

function Footer() {
  return (
    <motion.footer
      className="py-10 px-6 border-t border-white/5"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      viewport={{ once: true }}
    >
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="text-muted text-sm font-mono">
          <span className="text-white font-semibold not-mono">Mattia Giuliani</span>
          {' '}· Full Stack Developer
        </p>

        <nav className="flex gap-6">
          {navLinks.map(({ label, href }) =>
            href.startsWith('/') ? (
              <Link
                key={href}
                to={href}
                className="text-xs text-muted hover:text-white transition-colors duration-200 font-mono"
              >
                {label}
              </Link>
            ) : (
              <Link
                key={href}
                to={`/${href}`}
                className="text-xs text-muted hover:text-white transition-colors duration-200 font-mono"
              >
                {label}
              </Link>
            )
          )}
        </nav>

        <p className="text-muted text-xs font-mono">
          © {new Date().getFullYear()}
        </p>
      </div>
    </motion.footer>
  )
}

export default Footer
