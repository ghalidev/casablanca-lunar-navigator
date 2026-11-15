// Real south-pole relief from NASA's CGI Moon Kit (LOLA, 16 px/deg), prepared by
// web/scripts/prepare_moon.py. World units are kilometres; the pole is at the origin,
// +y is up (away from the Moon), 0° longitude points to -z, 90° E to +x.

export const MOON_R_KM = 1737.4
export const EXAG = 2.5 // vertical exaggeration of the relief (not of the curvature)

export interface PoleMeta {
  size_px: number
  lat_edge_deg: number
  radius_km: number
  height_min_m: number
  height_max_m: number
}

export interface PoleTerrain {
  meta: PoleMeta
  /** Relief height in km (no exaggeration, no curvature) at tile pixel grid. */
  heights: Float32Array
  n: number
  heightKmAt: (x: number, z: number) => number
  /** World y of the surface (relief × EXAG, minus Moon curvature). */
  surfaceY: (x: number, z: number) => number
}

export function siteXZ(latDeg: number, lonDeg: number) {
  const r = ((90 + latDeg) * Math.PI * MOON_R_KM) / 180
  const a = (lonDeg * Math.PI) / 180
  return { x: r * Math.sin(a), z: -r * Math.cos(a), r }
}

export function curvatureDrop(x: number, z: number) {
  const d2 = x * x + z * z
  return d2 / (2 * MOON_R_KM)
}

export async function loadPoleTerrain(): Promise<PoleTerrain> {
  const meta = (await (await fetch('/moon/meta.json')).json()).pole as PoleMeta
  const img = new Image()
  img.src = '/moon/pole_height.png'
  await img.decode()
  const n = img.width
  const c = document.createElement('canvas')
  c.width = n
  c.height = n
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0)
  const px = ctx.getImageData(0, 0, n, n).data
  const heights = new Float32Array(n * n)
  const span = (meta.height_max_m - meta.height_min_m) / 1000
  const lo = meta.height_min_m / 1000
  for (let i = 0; i < n * n; i++) heights[i] = lo + ((px[i * 4] * 256 + px[i * 4 + 1]) / 65535) * span

  const size = meta.radius_km * 2
  const heightKmAt = (x: number, z: number) => {
    const fx = (x / size + 0.5) * n - 0.5
    const fz = (z / size + 0.5) * n - 0.5
    const x0 = Math.max(0, Math.min(n - 2, Math.floor(fx)))
    const z0 = Math.max(0, Math.min(n - 2, Math.floor(fz)))
    const tx = Math.min(1, Math.max(0, fx - x0))
    const tz = Math.min(1, Math.max(0, fz - z0))
    const h = (i: number, j: number) => heights[j * n + i]
    return (h(x0, z0) * (1 - tx) + h(x0 + 1, z0) * tx) * (1 - tz) + (h(x0, z0 + 1) * (1 - tx) + h(x0 + 1, z0 + 1) * tx) * tz
  }
  const surfaceY = (x: number, z: number) => heightKmAt(x, z) * EXAG - curvatureDrop(x, z)
  return { meta, heights, n, heightKmAt, surfaceY }
}

/** Local north (away from the pole) and east unit vectors at a point, in the xz plane. */
export function localFrame(x: number, z: number) {
  const r = Math.hypot(x, z) || 1
  const north = { x: x / r, z: z / r }
  const lon = Math.atan2(x, -z)
  const east = { x: Math.cos(lon), z: Math.sin(lon) }
  return { north, east }
}

/**
 * Direction to a body at azimuth `azDeg` (from local north, clockwise) and elevation `elDeg`.
 * Elevation is scaled so occlusion by the ×EXAG relief matches occlusion by the real relief
 * (stretching heights by k is the same as stretching tan(elevation) by k).
 */
export function skyDir(x: number, z: number, azDeg: number, elDeg: number) {
  const { north, east } = localFrame(x, z)
  const az = (azDeg * Math.PI) / 180
  const el = Math.atan(EXAG * Math.tan((elDeg * Math.PI) / 180))
  const hx = north.x * Math.cos(az) + east.x * Math.sin(az)
  const hz = north.z * Math.cos(az) + east.z * Math.sin(az)
  return { x: hx * Math.cos(el), y: Math.sin(el), z: hz * Math.cos(el) }
}
