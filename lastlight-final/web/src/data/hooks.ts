import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { loadGhostDeaths, loadGhostGrid, loadSeries, loadSites, loadSurvival, loadTop10 } from './load'
import { landersForDay, type GhostGrid } from './ghosts'
import type { GhostLander } from './types'
import type { SeriesFile, SitesFile, SurvivalFile, Top10File } from './types'

// --- mock flag: any loaded file with mock: true lights the banner -------------
let mockSeen = false
const listeners = new Set<() => void>()
export function noteMock(m: boolean | undefined) {
  if (m && !mockSeen) {
    mockSeen = true
    listeners.forEach((l) => l())
  }
}
export function useMockFlag() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => mockSeen,
  )
}

type State<T> = { data: T | null; error: string | null }

function useAsync<T extends { mock?: boolean }>(fn: () => Promise<T>, key: string): State<T> {
  const [s, set] = useState<State<T> & { key: string }>({ data: null, error: null, key })
  useEffect(() => {
    let alive = true
    fn()
      .then((d) => {
        noteMock(d.mock)
        if (alive) set({ data: d, error: null, key })
      })
      .catch((e: Error) => alive && set({ data: null, error: e.message, key }))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return s.key === key ? s : { data: null, error: null }
}

export const useSites = () => useAsync<SitesFile>(loadSites, 'sites')
export const useSeries = (id: string | undefined, year: number) =>
  useAsync<SeriesFile>(() => (id ? loadSeries(id, year) : Promise.reject(new Error('no site'))), `series:${id}:${year}`)
export const useTop10 = () => useAsync<Top10File>(loadTop10, 'top10')
export const useSurvival = (id: string | undefined) =>
  useAsync<SurvivalFile>(() => (id ? loadSurvival(id) : Promise.reject(new Error('no site'))), `surv:${id}`)

/** The simulated landings of one site on one day of `year`: undefined while loading, null if the data has no per-day file. */
export function useGhostDay(id: string | undefined, year: number, day: number): GhostLander[] | null | undefined {
  type S = { key: string; g: GhostGrid; died: Uint16Array } | { key: string; missing: true }
  const [data, set] = useState<S | null>(null)
  const key = `${id}:${year}`
  useEffect(() => {
    if (!id) return
    let alive = true
    Promise.all([loadGhostGrid(id, year), loadGhostDeaths(id, year)])
      .then(([g, died]) => alive && set({ key, g, died }))
      .catch(() => alive && set({ key, missing: true }))
    return () => {
      alive = false
    }
  }, [id, year, key])
  return useMemo(() => {
    if (!id || !data || data.key !== key) return undefined
    return 'missing' in data ? null : landersForDay(data.g, data.died, day)
  }, [id, data, key, day])
}
