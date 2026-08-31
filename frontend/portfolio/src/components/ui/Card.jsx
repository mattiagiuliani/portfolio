import { motion } from 'framer-motion'

/**
 * Card — base surface component for project cards, skill groups, etc.
 *
 * Props:
 *  hover     — enables lift + border highlight on hover
 *  className — additional classes
 */
function Card({ children, hover = false, className = '', ...props }) {
  const base =
    'bg-surface border border-white/5 rounded-2xl transition-colors duration-300'
  const hoverClasses = hover
    ? 'hover:border-primary/30 cursor-pointer'
    : ''

  if (hover) {
    return (
      <motion.div
        className={`${base} ${hoverClasses} ${className}`}
        whileHover={{ y: -5, transition: { duration: 0.2 } }}
        {...props}
      >
        {children}
      </motion.div>
    )
  }

  return (
    <div className={`${base} ${className}`} {...props}>
      {children}
    </div>
  )
}

export default Card
