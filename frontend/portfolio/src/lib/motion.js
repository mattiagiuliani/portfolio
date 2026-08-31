/**
 * Shared Framer Motion variant presets.
 * Import these instead of redefining animations in every component.
 *
 * Usage:
 *   import { fadeUp, staggerContainer } from '../lib/motion'
 *   <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
 */

const ease = [0.25, 0.1, 0.25, 1] // cubic-bezier — smooth easeInOut

// ─── Base variants ────────────────────────────────────────────────────────────

export const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease },
  },
}

export const fadeIn = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

export const fadeLeft = {
  hidden: { opacity: 0, x: -20 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease },
  },
}

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, ease },
  },
}

// ─── Container (orchestrates children stagger) ────────────────────────────────

/**
 * @param {number} stagger   - delay between each child (default 0.1s)
 * @param {number} delay     - initial delay before first child (default 0s)
 */
export const staggerContainer = (stagger = 0.1, delay = 0) => ({
  hidden: {},
  show: {
    transition: {
      staggerChildren: stagger,
      delayChildren: delay,
    },
  },
})

// ─── Viewport defaults ────────────────────────────────────────────────────────

/** Standard viewport options — fire once when element is 10% visible */
export const viewport = { once: true, margin: '-60px' }
