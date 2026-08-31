/**
 * Badge — technology tag / label component.
 * Uses Geist Mono for the engineering/technical feel.
 *
 * Variants: default | accent | secondary | emerald
 */
const variants = {
  default:
    'bg-white/5 border border-white/8 text-muted hover:border-white/20 hover:text-white',
  accent: 'bg-primary/10 border border-primary/20 text-primary',
  secondary: 'bg-secondary/10 border border-secondary/20 text-secondary',
  emerald: 'bg-emerald/10 border border-emerald/20 text-emerald',
}

function Badge({ children, variant = 'default' }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors duration-200 ${variants[variant]}`}
    >
      {children}
    </span>
  )
}

export default Badge
