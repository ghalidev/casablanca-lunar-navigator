import type { SeriesFile } from './types'

/*
 * "Design your lander": the pipeline's energy model (pipeline/survival.py, _draw) re-run in the browser for
 * ONE lander standing upright on the target point, with the user's own numbers.
 *
 * Same physics as the pipeline: vertical panels, power = area x efficiency x flux x max(0, s.n) x visible
 * share of the Sun's disc, hourly steps, battery starts full and is capped, dead when it reaches 0.
 * The series already holds flux x cos(sun elevation) x visible share (irradiance_wm2, a vertical panel facing
 * the Sun), so a face whose normal points at azimuth a gets irradiance_wm2 x max(0, cos(sun_az - a)).
 *
 * What it adds on top of the pipeline: a survival heater that only draws power while the Sun is fully hidden,
 * a first-order stand-in for the thermal model we do not have (docs/limitations.md).
 * What it leaves out: landing error, slope and tip-over (those need the 1,000-draw Monte Carlo, which uses the
 * reference lander). The lander's heading is unknown, so we keep the worst of 72 headings.
 */

export interface LanderSpec {
  batteryWh: number
  loadW: number
  heaterW: number // extra draw while the Sun is fully hidden (0 = pipeline reference)
  faces: number // vertical panels evenly spread around the lander; 0 = one panel that turns to face the Sun
  areaM2: number // per face
  efficiency: number // 0..1
}

// Mirrors pipeline/config.py (PANEL_FACES, PANEL_AREA_M2, PANEL_EFFICIENCY, BATTERY_WH, LOAD_W).
export const REFERENCE: LanderSpec = { batteryWh: 2500, loadW: 60, heaterW: 0, faces: 4, areaM2: 0.75, efficiency: 0.28 }

export interface LanderRun {
  diedH: number | null // hours after landing when the battery hit 0 (null = alive at the end)
  minSoc: number // lowest state of charge over the window, 0..1
  soc: Float32Array // state of charge after each hour, 0..1
  headingDeg: number // the worst heading (the one reported)
  aliveHeadings: number // how many of the 72 headings survive the whole window
}

const HEADINGS = 72

function runHeading(s: SeriesFile, i0: number, n: number, L: LanderSpec, yaw: number, soc: Float32Array | null) {
  const rad = Math.PI / 180
  const k = L.areaM2 * L.efficiency
  let e = L.batteryWh
  let minE = e
  for (let h = 0; h < n; h++) {
    const i = i0 + h
    const irr = i >= 0 && i < s.irradiance_wm2.length ? s.irradiance_wm2[i] : 0
    let g = 0
    if (irr > 0) {
      if (L.faces <= 0) g = 1
      else
        for (let f = 0; f < L.faces; f++) {
          const c = Math.cos((s.sun_az[i] - yaw - (360 * f) / L.faces) * rad)
          if (c > 0) g += c
        }
    }
    const p = k * irr * g
    const load = L.loadW + ((s.sun_frac[i] ?? 0) <= 0 ? L.heaterW : 0)
    const prev = e
    e = Math.min(L.batteryWh, e + p - load)
    if (e <= 0) {
      if (soc) soc.fill(0, h)
      return { died: h + prev / Math.max(load - p, 1e-9), minE: 0 }
    }
    minE = Math.min(minE, e)
    if (soc) soc[h] = e / L.batteryWh
  }
  return { died: null as number | null, minE }
}

/** Run the lander for `days` days from `startMs` (UTC), every hour, at the series' site. */
export function runLander(s: SeriesFile, startMs: number, days: number, L: LanderSpec): LanderRun {
  const i0 = Math.round((startMs - Date.parse(s.t0)) / (s.step_h * 3_600_000))
  const n = Math.round((days * 24) / s.step_h)
  // Worst heading = earliest death, or lowest battery if every heading survives.
  let worst = { yaw: 0, died: null as number | null, minE: Infinity }
  let alive = 0
  const step = L.faces <= 0 ? 360 : 360 / HEADINGS
  const count = L.faces <= 0 ? 1 : HEADINGS
  for (let j = 0; j < count; j++) {
    const yaw = j * step
    const r = runHeading(s, i0, n, L, yaw, null)
    if (r.died == null) alive++
    const worse = r.died != null ? worst.died == null || r.died < worst.died : worst.died == null && r.minE < worst.minE
    if (worse) worst = { yaw, died: r.died, minE: r.minE }
  }
  const soc = new Float32Array(n)
  const r = runHeading(s, i0, n, L, worst.yaw, soc)
  return {
    diedH: r.died == null ? null : r.died * s.step_h,
    minSoc: r.minE / L.batteryWh,
    soc,
    headingDeg: worst.yaw,
    aliveHeadings: L.faces <= 0 ? (alive ? HEADINGS : 0) : alive,
  }
}
