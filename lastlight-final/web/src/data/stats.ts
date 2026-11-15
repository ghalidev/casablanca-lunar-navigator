import type { SeriesFile, SurvivalFile, SurvivalWindow } from './types'

// Display convention (UI only, not a science parameter): a body counts as
// "in view" for an hour when at least half its disk is above the terrain horizon.
export const VISIBLE_FRAC = 0.5

export type DayState = 'both' | 'sun' | 'earth' | 'night'

export interface DaySummary {
  sun: number // fraction of the day's hours with the Sun in view, 0..1
  earth: number
  state: DayState
}

const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

export function hoursPerStep(s: SeriesFile) {
  return s.step_h
}

export function seriesStartMs(s: SeriesFile) {
  return Date.parse(s.t0)
}

export function dayState(sun: number, earth: number): DayState {
  const s = sun >= 0.5
  const e = earth >= 0.5
  return s && e ? 'both' : s ? 'sun' : e ? 'earth' : 'night'
}

export function dailySummaries(s: SeriesFile): DaySummary[] {
  const perDay = Math.round(24 / s.step_h)
  const days = Math.floor(s.sun_frac.length / perDay)
  const out: DaySummary[] = []
  for (let d = 0; d < days; d++) {
    let sun = 0
    let earth = 0
    for (let k = d * perDay; k < (d + 1) * perDay; k++) {
      if (s.sun_frac[k] >= VISIBLE_FRAC) sun++
      if (s.earth_frac[k] >= VISIBLE_FRAC) earth++
    }
    out.push({ sun: sun / perDay, earth: earth / perDay, state: dayState(sun / perDay, earth / perDay) })
  }
  return out
}

export interface WindowStats {
  sunPct: number
  earthPct: number
  bothPct: number
  longestDarkH: number
  longestNoEarthH: number
  meanIrradiance: number
  covered: boolean // false when the window runs past the end of the loaded series
}

export function windowStats(s: SeriesFile, startMs: number, durationDays: number): WindowStats {
  const i0 = Math.round((startMs - seriesStartMs(s)) / (s.step_h * HOUR_MS))
  const n = Math.round((durationDays * 24) / s.step_h)
  const i1 = Math.min(i0 + n, s.sun_frac.length)
  let sun = 0, earth = 0, both = 0, irr = 0
  let dark = 0, longestDark = 0, noEarth = 0, longestNoEarth = 0
  for (let k = Math.max(0, i0); k < i1; k++) {
    const sv = s.sun_frac[k] >= VISIBLE_FRAC
    const ev = s.earth_frac[k] >= VISIBLE_FRAC
    if (sv) sun++
    if (ev) earth++
    if (sv && ev) both++
    irr += s.irradiance_wm2[k]
    dark = sv ? 0 : dark + 1
    noEarth = ev ? 0 : noEarth + 1
    longestDark = Math.max(longestDark, dark)
    longestNoEarth = Math.max(longestNoEarth, noEarth)
  }
  const len = Math.max(1, i1 - Math.max(0, i0))
  return {
    sunPct: (100 * sun) / len,
    earthPct: (100 * earth) / len,
    bothPct: (100 * both) / len,
    longestDarkH: longestDark * s.step_h,
    longestNoEarthH: longestNoEarth * s.step_h,
    meanIrradiance: irr / len,
    covered: i0 >= 0 && i0 + n <= s.sun_frac.length,
  }
}

export function survivalFor(f: SurvivalFile | undefined, startMs: number): SurvivalWindow | undefined {
  if (!f) return undefined
  const day = Math.floor(startMs / DAY_MS)
  return f.windows.find((w) => Math.floor(Date.parse(w.landing_utc) / DAY_MS) === day)
}

/** One plain-English sentence for the public. Thresholds are wording choices, not science. */
export function verdict(w: WindowStats): string {
  if (!w.covered) return 'The window runs past the end of the loaded data.'
  if (w.sunPct < 30) return 'Mostly dark. A solar-powered lander would not last.'
  if (w.longestDarkH >= 72)
    return `Sunlit ${Math.round(w.sunPct)}% of the time, but one night lasts ${Math.round(w.longestDarkH / 24)} days.`
  if (w.earthPct < 30) return 'Good sunlight, but Earth is hidden most of the time, so direct contact is rare.'
  if (w.sunPct >= 80 && w.earthPct >= 60) return 'Long sunlight and frequent contact with Earth.'
  return 'Usable, with gaps in sunlight or in contact with Earth.'
}
