'use client'

import Image from 'next/image'
import { useRef } from 'react'
import { useCinematic } from '../components/cinematic/cinematicContext'
import { FILM } from '../components/cinematic/cinematicMedia'

// The film itself lives in CinematicHome; this section is only the entry to the full-film presentation.
export default function Universe() {
  const { openFilm } = useCinematic()
  const triggerRef = useRef(null)

  return (
    <section id="universe" className="universe-section">
      <div className="brand-container">
        <div className="universe-panel">
          <div className="universe-copy">
            <p className="eyebrow"><span className="brand-status-dot" />THE WORLD BEHIND THE WORK</p>
            <h2>Inside<br /><span>MG Universe.</span></h2>
            <p className="universe-lead">Ideas. Code.<br />A brighter tomorrow.</p>
            <p className="universe-description">The imaginative side of my work: an anime version of me, my cat Ares, and a world inspired by technology. A personal space for the ideas that start before the code.</p>
            <div className="film-credit"><span>01</span><div>THE FIRST CHAPTER<small>Original film &middot; the same one playing behind this page</small></div></div>
            <button ref={triggerRef} type="button" className="film-open" onClick={() => openFilm(triggerRef.current)}>
              View full film <span aria-hidden="true">&#9654;</span>
            </button>
          </div>
          <div className="universe-poster">
            <Image src={FILM.poster} alt="" fill sizes="(max-width: 760px) 70vw, 280px" />
          </div>
        </div>
      </div>
    </section>
  )
}