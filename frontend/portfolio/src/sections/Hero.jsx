import { motion } from 'framer-motion'
import Button from '../components/ui/Button'
import GlowEffect from '../components/ui/GlowEffect'
import { staggerContainer, fadeUp } from '../lib/motion'

function Hero({ settings }) {
  return (
    <section
      id="hero"
      className="relative min-h-dvh flex items-center pt-28 pb-16 overflow-hidden bg-grid"
    >
      {/* Ambient glows */}
      <GlowEffect color="primary" size="lg" className="-top-40 -left-40 opacity-50" />
      <GlowEffect color="secondary" size="md" className="top-1/3 right-0 opacity-30" />

      <div className="relative z-10 w-full max-w-5xl mx-auto px-6">
        <motion.div
          variants={staggerContainer(0.13, 0.1)}
          initial="hidden"
          animate="show"
        >
          <motion.p
            variants={fadeUp}
            className="text-primary font-mono text-sm font-medium mb-4 tracking-widest uppercase"
          >
            {settings?.heroTagline || '// full stack developer'}
          </motion.p>

          <motion.h1
            variants={fadeUp}
            className="text-5xl md:text-7xl font-bold text-white tracking-tight leading-[1.05]"
          >
            {settings?.name || 'Mattia Giuliani'}
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="text-xl md:text-2xl font-medium text-muted mt-4"
          >
            {settings?.jobTitle || 'Full Stack Developer'}
          </motion.p>

          <motion.p
            variants={fadeUp}
            className="max-w-lg text-muted/80 text-base md:text-lg mt-6 leading-relaxed"
          >
            {settings?.heroDescription || 'Building modern software today while exploring the technologies shaping tomorrow: Cloud Computing, Artificial Intelligence, and Quantum Computing.'}
          </motion.p>

          <motion.div variants={fadeUp} className="flex flex-wrap gap-4 mt-10">
            <Button href="#projects">View my work</Button>
            <Button href="#contact" variant="outline">
             Contact me
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

export default Hero
