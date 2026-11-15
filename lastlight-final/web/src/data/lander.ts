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
 * What it adds on top of the pipeline (optional, off for the reference lander): a one-node thermal balance of the
 * warm electronics box. Heat in = the electrical load (all of it ends up as heat inside) + sunlight absorbed by
 * the box's sides (same Sun and skyline as the panels); heat out = radiation to space from a radiator,
 * eps * sigma * A * T^4 (cold sky, terrain ignored); a thermostat heater keeps the box at or above a minimum
 * temperature and draws its power from the battery. It answers "how much battery does staying warm cost here, on
 * this day", not a vehicle thermal design (docs/assumptions.md, docs/limitations.md).
 * What it leaves out: landing error, slope and tip-over (those need the 1,000-draw Monte Carlo, which uses the
 * reference lander). The lander's heading is unknown, so we keep the worst of 72 headings.
 */

export interface LanderSpec {
  batteryWh: number
  loadW: number
  radiatorM2: number // thermal model: radiator area; 0 = no thermal model (pipeline reference)
  tMinC: number // thermal model: thermostat setpoint of the electronics box, °C
  faces: number // vertical panels evenly spread around the lander; 0 = one panel that turns to face the Sun
  areaM2: number // per face
  efficiency: number // 0..1
}

// Mirrors pipeline/config.py (PANEL_FACES, PANEL_AREA_M2, PANEL_EFFICIENCY, BATTERY_WH, LOAD_W).
export const REFERENCE: LanderSpec = { batteryWh: 2500, loadW: 60, radiatorM2: 0, tMinC: -20, faces: 4, areaM2: 0.75, efficiency: 0.28 }

// Thermal constants (docs/assumptions.md). Illustrative of a small lander's warm box, not of any vehicle.
export const THERMAL = {
  emissivity: 0.85, // white-paint / OSR radiator
  heatCapacityJK: 50_000, // ~60 kg of aluminium and electronics
  sunAbsorbM2: 0.1, // absorptivity x box side area facing the Sun
  startC: 20,
  heaterMaxW: 300,
}
const SIGMA = 5.670374419e-8

export interface LanderRun {
  diedH: number | null // hours after landing when the battery hit 0 (null = alive at the end)
  minSoc: number // lowest state of charge over the window, 0..1
  soc: Float32Array // state of charge after each hour, 0..1
  temp: Float32Array // electronics box temperature after each hour, °C (thermal model on)
  heaterWh: number // energy the thermostat heater took from the battery
  headingDeg: number // the worst heading (the one reported)
  aliveHeadings: number // how many of the 72 headings survive the whole window
}

const HEADINGS = 72

function runHeading(s: SeriesFile, i0: number, n: number, L: LanderSpec, yaw: number, out: { soc: Float32Array; temp: Float32Array } | null) {
  const rad = Math.PI / 180
  const k = L.areaM2 * L.efficiency
  const thermal = L.radiatorM2 > 0
  const tMin = L.tMinC + 273.15
  const radK = THERMAL.emissivity * SIGMA * L.radiatorM2
  const dt = 600 // thermal sub-steps of 10 min inside each hour (stable for these time constants)
  let T = THERMAL.startC + 273.15
  let e = L.batteryWh
  let minE = e
  let heatWh = 0
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
    let heater = 0
    if (thermal) {
      const qIn = L.loadW + THERMAL.sunAbsorbM2 * irr
      let hJ = 0
      for (let t = 0; t < 3600; t += dt) {
        let next = T + ((qIn - radK * T ** 4) * dt) / THERMAL.heatCapacityJK
        if (next < tMin) {
          const need = Math.min(THERMAL.heaterMaxW, ((tMin - next) * THERMAL.heatCapacityJK) / dt)
          next += (need * dt) / THERMAL.heatCapacityJK
          hJ += need * dt
        }
        T = next
      }
      heater = hJ / 3600
      heatWh += heater
    }
    const load = L.loadW + heater
    const prev = e
    e = Math.min(L.batteryWh, e + p - load)
    if (e <= 0) {
      if (out) {
        out.soc.fill(0, h)
        out.temp.fill(T - 273.15, h)
      }
      return { died: h + prev / Math.max(load - p, 1e-9), minE: 0, heatWh }
    }
    minE = Math.min(minE, e)
    if (out) {
      out.soc[h] = e / L.batteryWh
      out.temp[h] = T - 273.15
    }
  }
  return { died: null as number | null, minE, heatWh }
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
  const temp = new Float32Array(n)
  const r = runHeading(s, i0, n, L, worst.yaw, { soc, temp })
  return {
    diedH: r.died == null ? null : r.died * s.step_h,
    minSoc: r.minE / L.batteryWh,
    soc,
    temp,
    heaterWh: r.heatWh,
    headingDeg: worst.yaw,
    aliveHeadings: L.faces <= 0 ? (alive ? HEADINGS : 0) : alive,
  }
}
