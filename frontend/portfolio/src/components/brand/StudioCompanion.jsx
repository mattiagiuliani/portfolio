'use client'

import { useState } from 'react'
import Image from 'next/image'

export default function StudioCompanion() {
  const [open, setOpen] = useState(false)
  return (
    <div className={`studio-companion ${open ? 'companion-active' : ''}`}>
      <div className="companion-halo" aria-hidden="true" />
      <span className="eyebrow companion-edition">THE PERSONAL SIDE / 02</span>
      <Image src="/brand/mattia-ares.webp" width={1254} height={1254} sizes="(max-width: 760px) 90vw, 460px" alt="Anime portrait of Mattia with curly brown hair and a black MG hoodie, holding his sleeping tabby cat Ares" className="companion-art" />
      <div className="companion-bottom">
        <span className="companion-name">Mattia <span>& Ares.</span></span>
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="ares-note" className="ares-button">{open ? 'Close' : 'Meet Ares'} <span aria-hidden="true">{open ? '−' : '+'}</span></button>
      </div>
      <div id="ares-note" className="ares-note" hidden={!open}>
        <span className="eyebrow">ARES / STUDIO COMPANION</span>
        <p>The other face of MG Universe. A small reminder that there’s a person — and a cat — behind the code.</p>
      </div>
    </div>
  )
}
