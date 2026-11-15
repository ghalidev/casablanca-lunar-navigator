import type { SeriesFile, SitesFile, WindowsFile } from './types'
import { normalizeSurvival, normalizeTop10 } from './normalize'

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
export const loadWindows = () => load<WindowsFile>('windows.json')
