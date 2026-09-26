'use client'

import { motion } from 'framer-motion'
import Section from '../components/layout/Section'
import SectionTitle from '../components/common/SectionTitle'
import Badge from '../components/ui/Badge'
import { staggerContainer, scaleIn, viewport } from '../lib/motion'
import { skills } from '../data/skills'

function Skills() {
  return (
    <Section id="skills" className="bg-surface/20">
      <p className="eyebrow section-index">03 / THE TOOLKIT</p>
      <SectionTitle>Tools of the craft.</SectionTitle>
      <p className="mt-5 max-w-2xl text-muted leading-relaxed">The languages and tools I use to build, test and ship web applications, from React interfaces to Node.js APIs and cloud deployment.</p>
      <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {skills.map(({ category, items }, i) => (
          <motion.div
            key={category}
            className="bg-surface border border-white/5 rounded-2xl p-6 hover:border-primary/20 transition-colors duration-300"
            initial={false}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            viewport={viewport}
          >
            <p className="text-xs font-mono font-semibold uppercase tracking-widest text-primary mb-5">
              {category}
            </p>
            <motion.ul
              className="flex flex-wrap gap-2"
              variants={staggerContainer(0.06, i * 0.08 + 0.15)}
              initial={false}
              whileInView="show"
              viewport={viewport}
            >
              {items.map((skill) => (
                <motion.li key={skill} variants={scaleIn}>
                  <Badge>{skill}</Badge>
                </motion.li>
              ))}
            </motion.ul>
          </motion.div>
        ))}
      </div>
    </Section>
  )
}

export default Skills
