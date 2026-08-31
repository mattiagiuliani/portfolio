import { categoryStyles } from '../../lib/blogUtils'

/**
 * CategoryPill — colored inline badge for a blog category.
 *
 * Props:
 *  category  — string matching CATEGORIES enum
 *  size      — 'sm' | 'md' (default: 'md')
 *  className — additional classes
 */
function CategoryPill({ category, size = 'md', className = '' }) {
  const colors = categoryStyles[category] ?? 'text-muted bg-white/5 border-white/10'
  const sizeClass = size === 'sm'
    ? 'px-2 py-0.5 text-xs'
    : 'px-2.5 py-1 text-xs'

  return (
    <span
      className={`inline-flex items-center rounded border font-mono font-medium ${colors} ${sizeClass} ${className}`}
    >
      {category}
    </span>
  )
}

export default CategoryPill
