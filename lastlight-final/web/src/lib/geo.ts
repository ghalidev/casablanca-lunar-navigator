/** South polar map projection (azimuthal equidistant around the pole), 0° at top, 90° E to the right. */
export function polarXY(lat: number, lon: number, radiusPx: number, latEdge = -80) {
  const r = ((90 + lat) / (90 + latEdge)) * radiusPx
  const a = (lon * Math.PI) / 180
  return { x: r * Math.sin(a), y: -r * Math.cos(a) }
}

export const fmtLat = (lat: number) => `${Math.abs(lat).toFixed(2)}° S`
export const fmtLon = (lon: number) => {
  const l = ((lon + 540) % 360) - 180
  return `${Math.abs(l).toFixed(2)}° ${l >= 0 ? 'E' : 'W'}`
}

export const DAY_MS = 86_400_000
export const HOUR_MS = 3_600_000
export const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10)
export const prettyDate = (ms: number) =>
  new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
export const prettyDateTime = (ms: number) =>
  new Date(ms).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }) + ' UTC'

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
