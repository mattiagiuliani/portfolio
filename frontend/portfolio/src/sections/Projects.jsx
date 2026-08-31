import Section from '../components/layout/Section'
import SectionTitle from '../components/common/SectionTitle'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Card from '../components/ui/Card'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { fadeUp, viewport } from '../lib/motion'
import { projects } from '../data/projects'
import { portfolioApi } from '../services/api'

function ProjectCard({ title, description, tags, github, live, index }) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={viewport}
      transition={{ delay: index * 0.1 }}
    >
      <Card hover className="p-7 flex flex-col gap-4 h-full">
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

function Projects() {
  const [visibleProjects, setVisibleProjects] = useState(projects)
  const [isEmpty, setIsEmpty] = useState(false)

  useEffect(() => {
    let active = true
    portfolioApi
      .fetchProjects()
      .then((res) => {
        if (!active) return
        if (res.data.length === 0) setIsEmpty(true)
        else setVisibleProjects(res.data)
      })
      .catch(() => {})

    return () => { active = false }
  }, [])

  return (
    <Section id="projects">
      <SectionTitle>Projects</SectionTitle>
      {isEmpty ? (
        <div className="mt-14 rounded-2xl border border-white/5 bg-surface p-8 text-center text-muted">
          Projects are being added soon. Check back later.
        </div>
      ) : (
        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-5">
          {visibleProjects.map((project, i) => (
            <ProjectCard
              key={project._id ?? project.id}
              {...project}
              tags={project.technologies ?? project.tags}
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
