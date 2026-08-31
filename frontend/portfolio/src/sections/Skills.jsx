import { motion } from 'framer-motion'
import Section from '../components/layout/Section'
import SectionTitle from '../components/common/SectionTitle'
import Badge from '../components/ui/Badge'
import { staggerContainer, scaleIn, viewport } from '../lib/motion'
import { skills } from '../data/skills'

function Skills() {
  return (
    <Section id="skills" className="bg-surface/20">
      <SectionTitle>Skills</SectionTitle>
      <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {skills.map(({ category, items }, i) => (
          <motion.div
            key={category}
            className="bg-surface border border-white/5 rounded-2xl p-6 hover:border-primary/20 transition-colors duration-300"
            initial={{ opacity: 0, y: 30 }}
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
              initial="hidden"
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
