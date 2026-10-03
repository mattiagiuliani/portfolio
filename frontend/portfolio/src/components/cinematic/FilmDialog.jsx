'use client'

import { useEffect, useRef, useState } from 'react'
import { formatTime } from './cinematicMedia'

const FOCUSABLE = 'button:not([disabled]), input:not([disabled])'

// Controls rendered inside the persistent stage, which carries the dialog semantics while presenting.
export default function FilmDialog({ videoRef, onClose, onUserPause }) {
  const dialogRef = useRef(null)
  const closeRef = useRef(null)
  const [state, setState] = useState({ time: 0, duration: 0, playing: false, muted: true })
  const [message, setMessage] = useState('')

  useEffect(() => {
    const video = videoRef.current
    const read = () => setState({
      time: video.currentTime,
      duration: Number.isFinite(video.duration) ? video.duration : 0,
      playing: !video.paused,
      muted: video.muted,
    })
    const events = ['timeupdate', 'durationchange', 'loadedmetadata', 'play', 'pause', 'volumechange']
    const onError = () => setMessage('The film could not load. Please try again later.')
    const onKey = (event) => { if (event.key === 'Escape') { event.preventDefault(); onClose() } }
    events.forEach((name) => video.addEventListener(name, read))
    video.addEventListener('error', onError)
    document.addEventListener('keydown', onKey)
    const frame = requestAnimationFrame(read)
    closeRef.current?.focus()
    return () => {
      cancelAnimationFrame(frame)
      events.forEach((name) => video.removeEventListener(name, read))
      video.removeEventListener('error', onError)
      document.removeEventListener('keydown', onKey)
    }
  }, [videoRef, onClose])

  const trapTab = (event) => {
    if (event.key !== 'Tab') return
    const items = [...dialogRef.current.querySelectorAll(FOCUSABLE)]
    const first = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }

  const togglePlayback = async () => {
    const video = videoRef.current
    if (!video.paused) { onUserPause(true); video.pause(); return }
    onUserPause(false)
    try { await video.play(); setMessage('') }
    catch { setMessage('Playback was blocked by the browser. Press play to try again.') }
  }

  const toggleAudio = async () => {
    const video = videoRef.current
    video.muted = !video.muted
    video.volume = 1
    if (!video.muted && video.paused) await togglePlayback()
  }

  const { time, duration, playing, muted } = state
  return (
    <div ref={dialogRef} className="cine-dialog" onKeyDown={trapTab}>
      <button ref={closeRef} type="button" className="cine-close" onClick={onClose} aria-label="Close full film">
        <span aria-hidden="true">&times;</span> Close
      </button>
      <div className="cine-controls">
        <div className="cine-buttons">
          <button type="button" onClick={togglePlayback} aria-label={playing ? 'Pause film' : 'Play film'}>
            <span aria-hidden="true">{playing ? '||' : '\u25B6'}</span> {playing ? 'Pause' : 'Play'}
          </button>
          <button type="button" onClick={toggleAudio} aria-pressed={!muted} aria-label="Film sound">
            {muted ? 'Sound off' : 'Sound on'}
          </button>
          <span className="cine-time">{formatTime(time)} / {formatTime(duration)}</span>
        </div>
        <input
          className="cine-seek"
          type="range"
          min="0"
          max={duration || 0}
          step="0.1"
          value={Math.min(time, duration || 0)}
          disabled={!duration}
          aria-label="Film position"
          aria-valuetext={`${formatTime(time)} of ${formatTime(duration)}`}
          onChange={(event) => { videoRef.current.currentTime = Number(event.target.value) }}
        />
        {message && <p role="status" className="cine-message">{message}</p>}
      </div>
    </div>
  )
}
