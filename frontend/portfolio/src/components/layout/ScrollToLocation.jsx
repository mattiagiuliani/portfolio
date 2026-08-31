import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const HEADER_OFFSET = 96

function ScrollToLocation() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    const sectionId = hash ? decodeURIComponent(hash.slice(1)) : ''

    const frame = requestAnimationFrame(() => {
      const section = sectionId && document.getElementById(sectionId)

      if (section) {
        window.scrollTo({
          top: Math.max(0, section.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET),
          behavior: 'smooth',
        })
        return
      }

      window.scrollTo({ top: 0, behavior: 'smooth' })
    })

    return () => cancelAnimationFrame(frame)
  }, [pathname, hash])

  return null
}

export default ScrollToLocation
