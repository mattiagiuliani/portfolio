import { useState, useEffect } from 'react'

/**
 * Tracks which section is currently in view.
 * Returns the ID of the active section (string).
 *
 * @param {string[]} sectionIds - Array of section element IDs to observe
 */
function useActiveSection(sectionIds) {
  const [active, setActive] = useState('')

  useEffect(() => {
    const observers = sectionIds.map((id) => {
      const el = document.getElementById(id)
      if (!el) return null

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActive(id)
        },
        { threshold: 0.4 }
      )

      observer.observe(el)
      return observer
    })

    return () => observers.forEach((o) => o?.disconnect())
  }, [sectionIds])

  return active
}

export default useActiveSection
