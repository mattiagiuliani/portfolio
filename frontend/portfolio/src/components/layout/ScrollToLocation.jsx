'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

const HEADER_OFFSET = 96

function ScrollToLocation() {
  const pathname = usePathname()

  useEffect(() => {
    const sectionId = window.location.hash ? decodeURIComponent(window.location.hash.slice(1)) : ''

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
  }, [pathname])

  return null
}

export default ScrollToLocation
