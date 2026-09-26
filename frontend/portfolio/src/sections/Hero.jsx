import Image from 'next/image'
import Button from '../components/ui/Button'

export default function Hero({ settings }) {
  return (
    <section id="hero" className="brand-hero">
      <div className="hero-aura" aria-hidden="true" />
      <div className="brand-container hero-layout">
        <div className="hero-copy">
          <p className="eyebrow"><span className="brand-status-dot" />{settings.heroTagline}</p>
          <h1>{settings.name}</h1>
          <p className="hero-role">{settings.jobTitle}</p>
          <p className="hero-description">{settings.heroDescription}</p>
          <div className="hero-actions">
            <Button href="#projects">Explore my work <span aria-hidden="true">↗</span></Button>
            <Button href="#contact" variant="outline">Let’s talk <span aria-hidden="true">→</span></Button>
          </div>
          <a className="hero-universe-link" href="#universe"><span className="mini-play" aria-hidden="true">▷</span> Step inside MG Universe <span aria-hidden="true">↘</span></a>
        </div>
        <div className="hero-portrait-wrap">
          <span className="portrait-coordinate" aria-hidden="true">MG / THE PERSON BEHIND THE CODE</span>
          <div className="hero-portrait">
            <Image src="/brand/mattia-profile.webp" alt="Mattia Giuliani, in his signature black and electric-blue profile portrait" width={1254} height={1254} priority sizes="(max-width: 760px) 88vw, 440px" />
          </div>
          <div className="portrait-caption"><span className="caption-line" />A brighter tomorrow.<span className="caption-plus" aria-hidden="true">+</span></div>
        </div>
      </div>
      <div className="brand-container hero-bottom">
        <span className="eyebrow">ENGINEERING × CURIOSITY × IMAGINATION</span>
        <a href="#projects" className="scroll-cue">SCROLL TO EXPLORE <span aria-hidden="true">↓</span></a>
      </div>
    </section>
  )
}
