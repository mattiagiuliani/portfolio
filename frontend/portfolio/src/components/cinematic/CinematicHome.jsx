'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { CinematicContext } from './cinematicContext'
import { FILM, automaticPlaybackAllowed, pickFilmSource } from './cinematicMedia'
import FilmDialog from './FilmDialog'

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'
const subscribeReducedMotion = (notify) => {
  const query = window.matchMedia(REDUCED_MOTION)
  query.addEventListener('change', notify)
  return () => query.removeEventListener('change', notify)
}
const readReducedMotion = () => window.matchMedia(REDUCED_MOTION).matches

function attachSource(video) {
  if (video.getAttribute('src')) return
  video.src = pickFilmSource(video)
  video.dataset.film = video.src.includes('.mp4') ? 'mp4' : 'webm'
  video.load()
}

// Owns the one long-lived <video> for Home: a fixed background layer that is reframed, never remounted, for the full film.
export default function CinematicHome({ children }) {
  const videoRef = useRef(null)
  const returnFocusRef = useRef(null)
  const presentationPaused = useRef(false)
  const [presenting, setPresenting] = useState(false)
  const [backgroundPreference, setBackgroundPreference] = useState('auto')
  const [playing, setPlaying] = useState(false)
  // Only a re-render trigger: the hydration pass sees the server snapshot, so playback decisions read the live query.
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, readReducedMotion, () => false)

  const syncPlayback = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (!presenting) video.muted = true
    const wanted = presenting
      ? !presentationPaused.current
      : backgroundPreference === 'play' || (backgroundPreference === 'auto' && automaticPlaybackAllowed(readReducedMotion()))
    if (wanted && !document.hidden) {
      attachSource(video)
      video.play().catch(() => { /* Autoplay can be refused; the poster stays and the control offers play. */ })
    } else video.pause()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reducedMotion re-runs sync when the preference changes
  }, [presenting, backgroundPreference, reducedMotion])

  useEffect(() => {
    syncPlayback()
    document.addEventListener('visibilitychange', syncPlayback)
    return () => document.removeEventListener('visibilitychange', syncPlayback)
  }, [syncPlayback])

  useEffect(() => {
    if (!presenting) return undefined
    const root = document.documentElement
    const previousOverflow = root.style.overflow
    root.style.overflow = 'hidden'
    return () => {
      root.style.overflow = previousOverflow
      const target = returnFocusRef.current
      if (target?.isConnected) target.focus()
    }
  }, [presenting])

  const openFilm = useCallback((trigger) => {
    returnFocusRef.current = trigger || document.activeElement
    presentationPaused.current = false
    setPresenting(true)
  }, [])
  const closeFilm = useCallback(() => setPresenting(false), [])
  const setUserPause = useCallback((paused) => { presentationPaused.current = paused }, [])

  const toggleBackground = () => {
    const video = videoRef.current
    if (playing) { setBackgroundPreference('pause'); return }
    setBackgroundPreference('play')
    attachSource(video)
    video.play().catch(() => { /* Reported through the control staying in its play state. */ })
  }

  const value = useMemo(() => ({ presenting, openFilm, closeFilm }), [presenting, openFilm, closeFilm])

  return (
    <CinematicContext.Provider value={value}>
      <div
        className="cine-stage"
        data-cinematic-stage=""
        data-mode={presenting ? 'presenting' : 'background'}
        role={presenting ? 'dialog' : undefined}
        aria-modal={presenting ? true : undefined}
        aria-label={presenting ? 'MG Universe, full film' : undefined}
        aria-hidden={presenting ? undefined : true}
      >
        <video
          ref={videoRef}
          className="cine-video"
          data-cinematic-video=""
          poster={FILM.poster}
          width={FILM.width}
          height={FILM.height}
          playsInline
          loop
          muted
          preload="none"
          tabIndex={-1}
          aria-label={presenting ? FILM.label : undefined}
          aria-hidden={presenting ? undefined : true}
          onPlaying={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />
        <div className="cine-scrim" />
        {presenting && <FilmDialog videoRef={videoRef} onClose={closeFilm} onUserPause={setUserPause} />}
      </div>
      <div className="cine-content" inert={presenting}>
        {children}
        <button type="button" className="cine-toggle" onClick={toggleBackground} data-playing={playing}>
          <span aria-hidden="true">{playing ? '||' : '\u25B6'}</span>
          <span className="sr-only">{playing ? 'Pause background film' : 'Play background film'}</span>
        </button>
      </div>
    </CinematicContext.Provider>
  )
}
