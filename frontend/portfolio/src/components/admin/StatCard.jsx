import { motion } from 'framer-motion'
import { fadeUp } from '../../lib/motion'

const colorMap = {
  default:   'text-white',
  primary:   'text-primary',
  secondary: 'text-secondary',
  emerald:   'text-emerald',
  pink:      'text-pink-400',
  yellow:    'text-yellow-400',
}

/**
 * StatCard — metric tile used on the Dashboard Home.
 *
 * Props:
 *  label       — short metric name shown above the value
 *  value       — number or string to display (large)
 *  description — secondary hint shown below the value
 *  icon        — inline SVG JSX shown top-right
 *  color       — value colour token
 *  loading     — renders a pulse skeleton while data is in-flight
 */
function StatCard({ label, value, description, icon, color = 'default', loading = false }) {
  return (
    <motion.div
      variants={fadeUp}
      className="bg-surface border border-white/5 rounded-xl p-5 flex flex-col gap-3 hover:border-white/10 transition-colors duration-200"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-mono text-muted leading-none">{label}</p>
        {icon && <span className="text-muted shrink-0">{icon}</span>}
      </div>

      {loading ? (
        <div className="h-9 w-14 rounded-md bg-white/8 animate-pulse" />
      ) : (
        <p className={`text-3xl font-bold tabular-nums leading-none ${colorMap[color]}`}>
          {value ?? '—'}
        </p>
      )}

      {description && (
        <p className="text-xs font-mono text-subtle leading-none">
          {loading ? <span className="inline-block h-3 w-20 rounded bg-white/5 animate-pulse" /> : description}
        </p>
      )}
    </motion.div>
  )
}

export default StatCard
