import { loadSeries, loadSites, loadSurvival } from '../data/load'
import { survivalFor, windowStats } from '../data/stats'
import { DAY_MS } from '../lib/geo'

import type { Need } from './actions'
export type { Need }

export interface Best {
  siteId: string
  siteName: string
  date: string
  days: number
  need: Need
  value: number // percent (0..100)
  label: string
}

const LABEL: Record<Need, string> = {
  sun: 'of the time in sunlight',
  earth: 'of the time with Earth in view',
  both: 'of the time with both Sun and Earth',
  survival: 'of simulated landers survive 14 days',
}

/** Deterministic search over the data: the copilot asks, this code answers. */
export async function findBest(opts: { site?: string; days: number; from: string; to: string; need?: Need }): Promise<Best | null> {
  const sites = await loadSites()
  const year = Number(opts.from.slice(0, 4))
  let need: Need = opts.need ?? 'both'
  if (need === 'survival' && opts.days !== 14) need = 'both'
  const candidates = sites.sites.filter((s) => !opts.site || s.id === opts.site)
  let best: Best | null = null
  for (const s of candidates) {
    const ser = await loadSeries(s.id, year).catch(() => null)
    if (!ser) continue
    const surv = need === 'survival' ? await loadSurvival(s.id).catch(() => undefined) : undefined
    const from = Date.parse(`${opts.from}T00:00:00Z`)
    const to = Date.parse(`${opts.to}T00:00:00Z`)
    for (let t = from; t <= to; t += DAY_MS) {
      const w = windowStats(ser, t, opts.days)
      if (!w.covered) continue
      let v: number
      if (need === 'survival') {
        const p = survivalFor(surv, t)
        if (!p) continue
        v = p.p_survive_14d * 100
      } else v = need === 'sun' ? w.sunPct : need === 'earth' ? w.earthPct : w.bothPct
      if (!best || v > best.value) {
        best = { siteId: s.id, siteName: s.name, date: new Date(t).toISOString().slice(0, 10), days: opts.days, need, value: v, label: LABEL[need] }
      }
    }
  }
  return best
}
