import { motion } from 'framer-motion'

function SectionTitle({ children, mono = false }) {
  return (
    <motion.h2
      className={`relative inline-block text-3xl md:text-4xl font-bold text-white ${mono ? 'font-mono' : ''}`}
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      viewport={{ once: true }}
    >
      {children}
      <span className="absolute -bottom-2 left-0 w-8 h-px bg-primary rounded-full" />
    </motion.h2>
  )
}

export default SectionTitle
