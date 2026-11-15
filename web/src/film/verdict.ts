import type { Top10File } from '../data/types'

export interface VerdictRow {
  rank: number
  siteId: string
  siteName: string
  landingUtc: string
  pSurvive: number // 0..1
  pComm: number // 0..1
  medianDays: number
  slipDays: number
}

export function verdictRows(top: Top10File, names: Record<string, string>): VerdictRow[] {
  return [...top.windows]
    .sort((a, b) => a.rank - b.rank)
    .map((w) => ({
      rank: w.rank,
      siteId: w.site_id,
      siteName: names[w.site_id] ?? w.site_id,
      landingUtc: w.landing_utc,
      pSurvive: w.p_survive_14d,
      pComm: w.p_comm_ok,
      medianDays: w.median_days_alive,
      slipDays: w.slip_tolerance_days,
    }))
}

const cell = (v: string | number) => {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** CSV for mission planners. `mock` adds a first comment line so a mock file is never mistaken for results. */
export function toCsv(rows: VerdictRow[], mock: boolean) {
  const head = ['rank', 'site_id', 'site_name', 'landing_utc', 'p_survive_14d', 'p_comm_ok', 'median_days_alive', 'slip_tolerance_days']
  const lines = rows.map((r) => [r.rank, r.siteId, r.siteName, r.landingUtc, r.pSurvive, r.pComm, r.medianDays, r.slipDays].map(cell).join(','))
  return [...(mock ? ['# MOCK DATA: placeholder numbers, do not quote'] : []), head.join(','), ...lines].join('\n') + '\n'
}

/** Sites in the ranking, each with its ranks (for pins on the relief). */
export function ranksBySite(rows: VerdictRow[]) {
  const out: Record<string, number[]> = {}
  for (const r of rows) (out[r.siteId] ??= []).push(r.rank)
  return out
}
