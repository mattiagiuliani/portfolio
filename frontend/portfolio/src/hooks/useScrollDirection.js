import { useState, useEffect, useRef } from 'react'

/**
 * Returns 'up' or 'down' based on scroll direction.
 * Used by Navbar to auto-hide on scroll down.
 */
function useScrollDirection() {
  const [direction, setDirection] = useState('up')
  const lastY = useRef(0)

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      // Only trigger 'down' after scrolling past 80px to avoid jitter at top
      if (y > lastY.current && y > 80) {
        setDirection('down')
      } else {
        setDirection('up')
      }
      lastY.current = y
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return direction
}

export default useScrollDirection
