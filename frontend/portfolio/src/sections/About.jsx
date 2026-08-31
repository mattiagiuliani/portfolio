import { motion } from 'framer-motion'
import Section from '../components/layout/Section'
import SectionTitle from '../components/common/SectionTitle'
import { fadeUp, viewport } from '../lib/motion'

function About({ settings }) {
  return (
    <Section id="about">
      <SectionTitle>About me</SectionTitle>
      <motion.div
        className="max-w-2xl mt-14 space-y-5 text-base md:text-lg leading-relaxed"
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={viewport}
      >
        {settings?.aboutText ? (
          <p className="text-text">{settings.aboutText}</p>
        ) : (
          <>
            <p className="text-text">
              I&apos;m a Full Stack Developer with a Professional Master in Web Development,
              passionate about building modern web applications and exploring the future of Cloud Computing,
              Artificial Intelligence, and Quantum Computing.
            </p>
            <p className="text-muted">
              I approach software as engineering, focusing on clean architecture, scalable solutions, and maintainable code.
              Beyond full stack development, I'm continuously expanding my expertise in Cloud Computing, Artificial Intelligence,
              and Quantum Computing, driven by a passion for building the technologies of tomorrow.
            </p>
          </>
        )}
      </motion.div>
    </Section>
  )
}

export default About
