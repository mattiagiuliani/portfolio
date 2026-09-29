'use client'

import Section from '../components/layout/Section'
import SectionTitle from '../components/common/SectionTitle'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Card from '../components/ui/Card'
import { motion } from 'framer-motion'
import { fadeUp, viewport } from '../lib/motion'

function ProjectCard({ title, description, tags, github, live, image, imageMedia, imageAlt, index }) {
  return (
    <motion.div
      variants={fadeUp}
      initial={false}
      whileInView="show"
      viewport={viewport}
      transition={{ delay: index * 0.1 }}
    >
      <Card hover className="project-card p-7 flex flex-col gap-4 h-full">
        <span className="project-number">{String(index + 1).padStart(2, '0')} <span aria-hidden="true">↗</span></span>
        {image && (
          <img
            src={image}
            alt={imageMedia?.alt ?? imageAlt ?? title}
            className="w-full aspect-video rounded-md border border-white/8 object-cover"
            loading="lazy"
          />
        )}
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="text-muted text-sm leading-relaxed flex-1">{description}</p>
        <ul className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <li key={tag}>
              <Badge variant="accent">{tag}</Badge>
            </li>
          ))}
        </ul>
        <div className="flex gap-3 flex-wrap pt-2">
          {github && (
            <Button href={github} variant="outline" target="_blank" rel="noreferrer">
              GitHub
            </Button>
          )}
          {live && (
            <Button href={live} target="_blank" rel="noreferrer">
              Live
            </Button>
          )}
        </div>
      </Card>
    </motion.div>
  )
}

function Projects({ projects }) {
  const isEmpty = projects.length === 0

  return (
    <Section id="projects">
      <p className="eyebrow section-index">01 / SELECTED WORK</p>
      <div className="section-heading-row"><SectionTitle>Ideas, built into reality.</SectionTitle><span className="section-aside">SELECTED PROJECTS ↙</span></div>
      <p className="mt-5 max-w-2xl text-muted leading-relaxed">From interface to API, these projects show how I put ideas into practice. Explore the code, try the applications, and see the decisions behind the work.</p>
      {isEmpty ? (
        <div className="mt-14 rounded-2xl border border-white/5 bg-surface p-8 text-center text-muted">
          Projects are being added soon. Check back later.
        </div>
      ) : (
        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-5">
          {projects.map((project, i) => (
            <ProjectCard
              key={project._id ?? project.id}
              {...project}
              tags={project.technologies ?? project.tags ?? []}
              github={project.githubUrl ?? project.github}
              live={project.liveUrl ?? project.live}
              index={i}
            />
          ))}
        </div>
      )}
    </Section>
  )
}

export default Projects
