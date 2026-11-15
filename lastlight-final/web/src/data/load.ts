import type { SeriesFile, SitesFile } from './types'
import { normalizeSurvival, normalizeTop10 } from './normalize'
import type { GhostGrid } from './ghosts'

// Real pipeline output lives in /data (web/public/data). Until it exists we fall
// back to /mock (synced from contracts/mock). Every file carries `mock`; the UI
// shows the MOCK DATA banner whenever any loaded file says mock: true.
const BASES = ['/data', '/mock'] as const

let resolvedBase: string | null = null
const cache = new Map<string, Promise<unknown>>()

async function fetchJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url)
  // Vite dev server answers unknown paths with index.html: check the type.
  if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return null
  return (await res.json()) as T
}

async function base(): Promise<string> {
  if (resolvedBase) return resolvedBase
  for (const b of BASES) {
    if (await fetchJson<SitesFile>(`${b}/sites.json`)) {
      resolvedBase = b
      return b
    }
  }
  throw new Error('No data found in /data or /mock')
}

function load<T, R = T>(path: string, transform?: (raw: R) => T): Promise<T> {
  if (!cache.has(path)) {
    cache.set(
      path,
      base().then(async (b) => {
        const data = await fetchJson<R>(`${b}/${path}`)
        if (!data) throw new Error(`Missing data file: ${b}/${path}`)
        return transform ? transform(data) : (data as unknown as T)
      }),
    )
  }
  return cache.get(path) as Promise<T>
}

export const loadSites = () => load<SitesFile>('sites.json')
export const loadSeries = (siteId: string, year: number) => load<SeriesFile>(`series/${siteId}_${year}.json`)
export const loadSurvival = (siteId: string) => load(`survival/${siteId}.json`, normalizeSurvival)
export const loadTop10 = () => load('top10.json', normalizeTop10)

// Per-day ghost landers (optional: older data has only the one-day sample in the survival file).
const binCache = new Map<string, Promise<Uint16Array>>()
export const loadGhostGrid = (siteId: string, year: number) => load<GhostGrid>(`ghosts/${siteId}_grid.json`).then((g) => {
  if (g.year !== year) throw new Error(`ghost grid is for ${g.year}`)
  return g
})
export function loadGhostDeaths(siteId: string, year: number): Promise<Uint16Array> {
  const path = `ghosts/${siteId}_${year}.bin`
  if (!binCache.has(path)) {
    binCache.set(
      path,
      base().then(async (b) => {
        const res = await fetch(`${b}/${path}`)
        const type = res.headers.get('content-type') ?? ''
        if (!res.ok || type.includes('html')) throw new Error(`Missing data file: ${b}/${path}`)
        return new Uint16Array(await res.arrayBuffer()) // little-endian, like every browser
      }),
    )
  }
  return binCache.get(path) as Promise<Uint16Array>
}
