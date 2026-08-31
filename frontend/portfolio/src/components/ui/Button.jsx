import { motion } from 'framer-motion'

const base =
  'inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition-colors duration-200 select-none'

const variants = {
  primary: 'bg-primary hover:bg-primary/90 text-white',
  outline:
    'border border-primary/40 text-primary hover:bg-primary/10 hover:border-primary',
  ghost: 'text-muted hover:text-white hover:bg-white/5',
}

function Button({ children, href, variant = 'primary', ...props }) {
  const className = `${base} ${variants[variant]}`

  if (href) {
    return (
      <motion.a
        href={href}
        className={className}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.96 }}
        {...props}
      >
        {children}
      </motion.a>
    )
  }

  return (
    <motion.button
      className={className}
      type="button"
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.96 }}
      {...props}
    >
      {children}
    </motion.button>
  )
}

export default Button
