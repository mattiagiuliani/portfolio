import Section from '../components/layout/Section'
import StudioCompanion from '../components/brand/StudioCompanion'

export default function About({ settings }) {
  return (
    <Section id="about" className="brand-about">
      <div className="about-layout">
        <div>
          <p className="eyebrow section-index">02 / BEHIND THE CODE</p>
          <h2 className="editorial-title">Same mind.<br /><span>Different possibilities.</span></h2>
          {settings.aboutText && settings.aboutText.split(/\n\s*\n/).map((paragraph, index) => <p key={index} className="about-description">{paragraph}</p>)}
          <div className="brand-principles"><span>Build.</span><span>Learn.</span><span>Improve.</span><span>Repeat.</span></div>
          <a href="#contact" className="text-link">Start a conversation <span aria-hidden="true">↗</span></a>
        </div>
        <StudioCompanion />
      </div>
    </Section>
  )
}
