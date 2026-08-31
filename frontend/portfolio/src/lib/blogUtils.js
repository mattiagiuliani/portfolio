/**
 * Shared blog utilities — category styles, date formatting.
 * Import from here to keep category mapping as a single source of truth.
 */

export const CATEGORIES = [
  'Web Development',
  'React',
  'JavaScript',
  'Backend',
  'Cloud',
  'Artificial Intelligence',
  'Quantum Computing',
  'Career',
]

/** Tailwind classes per category — matches backend CATEGORIES enum */
export const categoryStyles = {
  'Web Development':    'text-primary   bg-primary/10   border-primary/20',
  'React':             'text-secondary  bg-secondary/10  border-secondary/20',
  'JavaScript':        'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  'Backend':           'text-emerald    bg-emerald/10    border-emerald/20',
  'Cloud':             'text-sky-400    bg-sky-400/10    border-sky-400/20',
  'Artificial Intelligence': 'text-pink-400 bg-pink-400/10 border-pink-400/20',
  'Quantum Computing': 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  'Career':            'text-orange-400 bg-orange-400/10 border-orange-400/20',
}

/** Format an ISO date string to a human-readable form, e.g. "July 4, 2025" */
export const formatDate = (dateString) =>
  new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

/**
 * Return a short relative time string.
 * Falls back to formatDate for anything older than 30 days.
 */
export const timeAgo = (dateString) => {
  const seconds = Math.floor((Date.now() - new Date(dateString)) / 1000)
  if (seconds < 60)  return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60)  return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24)    return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30)     return `${days}d ago`
  return formatDate(dateString)
}
