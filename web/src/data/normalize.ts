import type { GhostLander, SurvivalFile, Top10File } from './types'

/*
 * The shared data contract (contracts/schema.json) has two shapes in the wild:
 *   v1  survival.ghost_landers_sample = GhostLander[]  + survival.ghost_window_utc
 *       top10.criteria = { survive_days, p_threshold, year_start, year_end }
 *   v2  survival.ghost_landers_sample = { landing_utc, sim_duration_h, landers: GhostLander[] }
 *       top10.criteria = { survive_days, p_threshold, from_utc, to_utc }
 * The app only ever sees the normalized shape (types.ts), whichever file the pipeline wrote.
 */

type RawSurvival = Omit<SurvivalFile, 'ghost_landers_sample'> & {
  ghost_landers_sample: GhostLander[] | { landing_utc: string; sim_duration_h?: number; landers: GhostLander[] }
}

type RawTop10 = Omit<Top10File, 'criteria'> & {
  criteria: { survive_days: number; p_threshold: number; ranking?: string; year_start?: number; year_end?: number; from_utc?: string; to_utc?: string }
}

export function normalizeSurvival(raw: RawSurvival): SurvivalFile {
  const g = raw.ghost_landers_sample
  if (Array.isArray(g)) return { ...raw, ghost_landers_sample: g }
  return {
    ...raw,
    ghost_landers_sample: g?.landers ?? [],
    ghost_window_utc: raw.ghost_window_utc ?? g?.landing_utc,
    sim_duration_h: raw.sim_duration_h ?? g?.sim_duration_h,
  }
}

const yearOf = (utc: string | undefined, fallback: number, endBound = false) => {
  // to_utc is an exclusive end bound ("2031-01-01T00:00:00Z" ends the search on 2030-12-31), so step back
  // one millisecond: the year shown is then the last year actually covered, whichever convention is used.
  const t = utc ? Date.parse(utc) - (endBound ? 1 : 0) : NaN
  const y = Number.isFinite(t) ? new Date(t).getUTCFullYear() : NaN
  return Number.isFinite(y) ? y : fallback
}

export function normalizeTop10(raw: RawTop10): Top10File {
  const c = raw.criteria
  const first = raw.windows[0]?.landing_utc
  const year_start = c.year_start ?? yearOf(c.from_utc, yearOf(first, 2027))
  const year_end = c.year_end ?? yearOf(c.to_utc, year_start, true)
  return { ...raw, criteria: { ...c, year_start, year_end } }
}
