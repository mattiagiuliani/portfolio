/**
 * GlowEffect — decorative ambient light blob.
 * Absolutely positioned, pointer-events-none.
 * Use inside a relative-positioned container.
 *
 * Props:
 *  color     — 'primary' | 'secondary' | 'emerald'
 *  size      — 'sm' | 'md' | 'lg' | 'xl'
 *  className — positioning classes (e.g. "-top-40 -left-20")
 */
const colors = {
  primary: 'bg-primary/8',
  secondary: 'bg-secondary/6',
  emerald: 'bg-emerald/6',
}

const sizes = {
  sm: 'w-64 h-64',
  md: 'w-96 h-96',
  lg: 'w-[600px] h-[600px]',
  xl: 'w-[800px] h-[800px]',
}

function GlowEffect({ color = 'primary', size = 'md', className = '' }) {
  return (
    <div
      aria-hidden="true"
      className={`absolute rounded-full blur-3xl pointer-events-none select-none ${colors[color]} ${sizes[size]} ${className}`}
    />
  )
}

export default GlowEffect
