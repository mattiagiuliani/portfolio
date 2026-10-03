export const FILM = {
  poster: '/brand/mg-universe-poster.webp',
  mp4: '/brand/mg-universe-bg.mp4?v=crf32-24fps',
  webm: '/brand/mg-universe.webm?v=trim-3s-opus',
  label: 'MG Universe, episode one: Mattia and Ares in a neon cyberpunk studio',
  width: 512,
  height: 910,
}

// The optimized MP4 is smaller than the existing WebM; WebM remains a compatibility fallback.
export function pickFilmSource(video) {
  if (video.canPlayType('video/mp4; codecs="avc1.64001f, mp4a.40.2"')) return FILM.mp4
  if (video.canPlayType('video/webm; codecs="vp9, opus"')) return FILM.webm
  return FILM.mp4
}

// Motion that starts without a user gesture must respect reduced-motion and constrained networks.
export function automaticPlaybackAllowed(reducedMotion, connection = globalThis.navigator?.connection) {
  if (reducedMotion) return false
  if (connection?.saveData) return false
  return !/^(slow-2g|2g|3g)$/.test(connection?.effectiveType || '')
}

export const formatTime = (seconds) => {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  return `${Math.floor(safe / 60).toString().padStart(2, '0')}:${Math.floor(safe % 60).toString().padStart(2, '0')}`
}
