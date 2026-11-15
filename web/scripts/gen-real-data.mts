// Generates the film app's REAL data files (web/public/data/) from the validated calculator in
// the root app (src/lib/ephemeris.ts, checked against NASA JPL Horizons: docs/validation.md).
//   cd web && node --experimental-strip-types scripts/gen-real-data.mts
//
// Writes: sites.json (Adam's NASA-map positions + LOLA terrain horizons), series/{id}_2027.json (hourly),
// windows.json (best landing windows, real ranking from src/lib/windows.ts).
// No survival / crash-test files in this intermediate root copy. The final submission's landing simulation is
// lastlight-final/pipeline/ (survival.py), and its outputs are lastlight-final/web/public/data/survival/ and ghosts/.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { computeTrack, discFraction } from '../../src/lib/ephemeris.ts'
import { findBestWindowsAcross } from '../../src/lib/windows.ts'
import type { Site } from '../../src/types.ts'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, '..', '..')
const OUT = join(here, '..', 'public', 'data')
const YEAR = 2027
const EARTH_RADIUS_DEG = 0.95 // mean apparent radius of Earth from the Moon
const SOLAR_CONSTANT = 1361 // W/m²
const PARAMS = 'astronomy-engine IAU lunar model; LOLA terrain horizons (scripts/terrain_horizons.py); validated vs JPL Horizons, max 0.004° (docs/validation.md)'
const r3 = (x: number) => Math.round(x * 1000) / 1000

interface RawSite {
  id: string
  name: string
  lat: number
  lon: number
  source: string
  approximate?: boolean
  heightM?: number
  horizon?: number[] // terrain horizon elevation (deg), one value per azimuth step from 0° (north), clockwise
  horizonSource?: string
}

const raw = JSON.parse(readFileSync(join(ROOT, 'public', 'data', 'sites.json'), 'utf8')) as { sites: RawSite[] }
const sites: Site[] = raw.sites.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lon: s.lon, heightM: s.heightM, source: s.source, approximate: s.approximate, horizon: s.horizon }))
const flat = new Array(720).fill(0)
/** Resample a horizon (any number of azimuth steps) to the film's 720 values at 0.5°, linear and wrapping. */
function to720(h: number[] | undefined): number[] {
  if (!h || !h.length) return flat
  const n = h.length
  return Array.from({ length: 720 }, (_, i) => {
    const x = ((i * 0.5) / 360) * n
    const i0 = Math.floor(x) % n
    const f = x - Math.floor(x)
    return r3(h[i0] * (1 - f) + h[(i0 + 1) % n] * f)
  })
}
const now = new Date().toISOString()

mkdirSync(join(OUT, 'series'), { recursive: true })

writeFileSync(
  join(OUT, 'sites.json'),
  JSON.stringify({
    generated_at: now,
    mock: false,
    params_ref: PARAMS,
    sites: raw.sites.map((s) => ({
      id: s.id,
      name: s.name,
      lat: s.lat,
      lon: s.lon,
      position_source: 'digitized',
      position_note: s.source,
      horizon_source: s.horizonSource ?? (s.horizon ? 'terrain' : 'flat'),
      elevation_m: s.heightM ?? 0,
      horizon: { az_step_deg: 0.5, mast_2m: to720(s.horizon), mast_10m: to720(s.horizon) },
      validation: { lroc_illum_pct: null, model_illum_pct: null },
    })),
  }),
)
console.log(`sites.json: ${sites.length} sites`)

for (const site of sites) {
  const t0 = `${YEAR}-01-01T00:00:00Z`
  const track = computeTrack(site, t0, `${YEAR}-12-31T23:00:00Z`, 60)
  const file = {
    site_id: site.id,
    mock: false,
    params_ref: PARAMS,
    mast_m: 2,
    t0,
    step_h: 1,
    sun_el: track.map((s) => r3(s.sunEl)),
    sun_az: track.map((s) => r3(s.sunAz)),
    earth_el: track.map((s) => r3(s.earthEl)),
    earth_az: track.map((s) => r3(s.earthAz)),
    sun_frac: track.map((s) => r3(s.sunFrac)),
    earth_frac: track.map((s) => r3(discFraction(s.earthEl, EARTH_RADIUS_DEG))),
    // vertical panel turned to the Sun's azimuth: solar constant x visible disc x cos(elevation)
    irradiance_wm2: track.map((s) => Math.round(SOLAR_CONSTANT * s.sunFrac * Math.cos((s.sunEl * Math.PI) / 180))),
  }
  writeFileSync(join(OUT, 'series', `${site.id}_${YEAR}.json`), JSON.stringify(file))
  console.log(`series/${site.id}_${YEAR}.json: ${track.length} hours`)
}

const windows: Record<string, unknown[]> = {}
for (const days of [6, 14]) {
  const best = findBestWindowsAcross(sites, `${YEAR}-01-01T00:00:00Z`, `${YEAR}-12-31T00:00:00Z`, days)
  windows[String(days)] = best
    .filter((w) => Date.parse(w.end) <= Date.parse(`${YEAR + 1}-01-01T00:00:00Z`))
    .map((w, i) => ({
      rank: i + 1,
      site_id: w.site.id,
      landing_utc: w.start,
      end_utc: w.end,
      sun_pct: r3(w.metrics.illumPct),
      earth_pct: r3(w.metrics.earthVisPct),
      both_pct: r3(w.metrics.bothPct),
      longest_dark_h: w.metrics.longestDarkH,
      longest_comm_gap_h: w.metrics.longestCommGapH,
      energy_kwh_per_kw: r3(w.metrics.energyKWhPerKW),
      score: r3(w.score),
    }))
  console.log(`windows ${days} d: ${windows[String(days)].length}`)
}
writeFileSync(
  join(OUT, 'windows.json'),
  JSON.stringify(
    {
      generated_at: now,
      mock: false,
      params_ref: PARAMS,
      year: YEAR,
      score: 'sunlight % + 0.5 x Earth-in-view % - 2 x longest darkness (h); ties broken by energy (docs/assumptions.md A13)',
      windows,
    },
    null,
    1,
  ),
)
console.log('windows.json written')
