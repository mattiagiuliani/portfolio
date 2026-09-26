'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'

const film = '/brand/mg-universe.webm?v=trim-3s-opus'
const mp4Film = '/brand/mg-universe.mp4?v=trim-3s'
const filmSource = (video) => video.canPlayType('video/webm; codecs="vp9, opus"') ? film : mp4Film
const formatTime = (seconds) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`

export default function Universe() {
  const videoRef = useRef(null)
  const frameRef = useRef(null)
  const userPaused = useRef(false)
  const inView = useRef(false)
  const manualPlayback = useRef(false)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)
  const [duration, setDuration] = useState(50.6)
  const [time, setTime] = useState(0)
  const [message, setMessage] = useState('')

  const load = () => {
    const video = videoRef.current
    if (!video.getAttribute('src')) { video.src = filmSource(video); video.load() }
    return video
  }

  useEffect(() => {
    const video = videoRef.current
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePlayback = () => {
      const automaticAllowed = !reducedMotion.matches && !navigator.connection?.saveData
      if (inView.current && !document.hidden && !userPaused.current && (automaticAllowed || manualPlayback.current)) {
        if (!video.getAttribute('src')) { video.src = filmSource(video); video.load() }
        video.play().catch(() => { /* Controls remain available if autoplay is blocked. */ })
      } else video.pause()
    }
    const observer = new IntersectionObserver(([entry]) => {
      // Keep the controls usable when only the bottom of the player is visible.
      inView.current = entry.isIntersecting && entry.intersectionRatio > 0
      updatePlayback()
    }, { threshold: [0, 0.01] })
    observer.observe(frameRef.current)
    document.addEventListener('visibilitychange', updatePlayback)
    reducedMotion.addEventListener('change', updatePlayback)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', updatePlayback)
      reducedMotion.removeEventListener('change', updatePlayback)
      video.pause()
    }
  }, [])

  const togglePlayback = async () => {
    const video = load()
    if (!video.paused) { userPaused.current = true; video.pause(); return }
    userPaused.current = false
    manualPlayback.current = true
    try { await video.play(); setMessage('') }
    catch { setMessage('Playback unavailable. You can open the film directly below.') }
  }

  const toggleAudio = async () => {
    const video = load()
    const nextMuted = !video.muted
    video.muted = nextMuted
    video.volume = 1
    setMuted(nextMuted)
    if (!nextMuted) {
      userPaused.current = false
      manualPlayback.current = true
      try { await video.play(); setMessage('') }
      catch {
        video.muted = true
        setMuted(true)
        setMessage('Audio playback was blocked. Press Enable audio to try again, or open the full film.')
      }
    }
  }

  return (
    <section id="universe" className="universe-section">
      <div className="brand-container">
        <div className="universe-panel">
          <Image src="/brand/mg-universe-poster.webp" alt="" fill sizes="(max-width: 760px) 100vw, 1184px" className="universe-atmosphere" />
          <div className="universe-copy">
            <p className="eyebrow"><span className="brand-status-dot" />THE WORLD BEHIND THE WORK</p>
            <h2>Inside<br /><span>MG Universe.</span></h2>
            <p className="universe-lead">Ideas. Code.<br />A brighter tomorrow.</p>
            <p className="universe-description">The imaginative side of my work: an anime version of me, my cat Ares, and a world inspired by technology. A personal space for the ideas that start before the code.</p>
            <div className="film-credit"><span>01</span><div>THE FIRST CHAPTER<small>Original film · {formatTime(duration)}</small></div></div>
            <a href={film} target="_blank" rel="noreferrer" className="text-link">Open the full film <span aria-hidden="true">↗</span></a>
          </div>
          <div className="universe-player" ref={frameRef}>
            <div className="film-topline"><span className="film-live-dot" data-playing={playing} />MG UNIVERSE <span>EP. 01</span></div>
            <div className="film-screen">
              <video ref={videoRef} poster="/brand/mg-universe-poster.webp" width="512" height="910" playsInline loop muted={muted} preload="none" aria-label="MG Universe, episode one: Mattia and Ares in a neon cyberpunk studio"
                onPlaying={() => setPlaying(true)} onPause={() => setPlaying(false)}
                onLoadedMetadata={(event) => { if (Number.isFinite(event.currentTarget.duration)) setDuration(event.currentTarget.duration) }}
                onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
                onVolumeChange={(event) => setMuted(event.currentTarget.muted)}
                onError={() => setMessage('The film could not load. Try opening it directly.')} />
              {!playing && <button type="button" className="film-play-overlay" onClick={togglePlayback} aria-label="Play MG Universe"><span aria-hidden="true">▷</span></button>}
            </div>
            <div className="film-controls">
              <div className="film-buttons">
                <button type="button" onClick={togglePlayback} aria-label={playing ? 'Pause film' : 'Play film'}><span aria-hidden="true">{playing ? 'Ⅱ' : '▷'}</span>{playing ? 'Pause' : 'Play'}</button>
                <button type="button" onClick={toggleAudio} aria-label={muted ? 'Enable film audio' : 'Mute film audio'} aria-pressed={!muted} className={!muted ? 'sound-active' : ''}><span aria-hidden="true">{muted ? '♩' : '♫'}</span>{muted ? 'Enable audio' : 'Mute audio'}</button>
                <span className="film-time">{formatTime(time)} / {formatTime(duration)}</span>
              </div>
              <input className="film-seek" type="range" min="0" max={duration} step="0.1" value={time} aria-label="Film position" aria-valuetext={`${formatTime(time)} of ${formatTime(duration)}`} onChange={(event) => { const video = load(); video.currentTime = Number(event.target.value); setTime(video.currentTime) }} />
            </div>
            {message && <p role="status" className="film-message">{message}</p>}
          </div>
        </div>
      </div>
    </section>
  )
}
