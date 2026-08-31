/**
 * Section — layout wrapper used by every page section.
 * Provides consistent vertical padding and max-width container.
 *
 * Props:
 *  id        — anchors for navbar links
 *  className — extra classes (e.g. alternate bg)
 *  tight     — removes top padding (for sections immediately after hero)
 */
function Section({ id, children, className = '', tight = false }) {
  return (
    <section
      id={id}
      className={`${tight ? 'pt-0' : 'pt-24'} pb-24 ${className}`}
    >
      <div className="max-w-5xl mx-auto px-6">{children}</div>
    </section>
  )
}

export default Section
