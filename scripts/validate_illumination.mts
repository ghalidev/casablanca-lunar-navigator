// Sunlight in 2020 at Bussey et al. (2010) reference points, with our ephemeris + LOLA horizons.
// Input: scripts/validation/bussey2010_points.json (from scripts/validate_illumination.py).
// Output: a table on stdout and scripts/validation/bussey2010_results.json.
// Run: node --experimental-strip-types scripts/validate_illumination.mts
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { computeTrack, horizonEl } from '../src/lib/ephemeris.ts'
import type { Site } from '../src/types.ts'

const here = dirname(fileURLToPath(import.meta.url))
const inPath = join(here, 'validation', 'bussey2010_points.json')
const { meta, points } = JSON.parse(readFileSync(inPath, 'utf8'))

const STEP_MIN = 30
const rows = points.map((p: any) => {
  const site: Site = { id: 'ref', name: p.name, lat: p.lat, lon: p.lon, heightM: p.heightM, horizon: p.horizon }
  const s = computeTrack(site, '2020-01-01T00:00:00Z', '2020-12-31T23:30:00Z', STEP_MIN)
  const anyPart = s.filter((x) => x.sunFrac > 0).length / s.length
  const centre = s.filter((x) => x.sunEl > horizonEl(p.horizon, x.sunAz)).length / s.length
  const meanDisc = s.reduce((a, x) => a + x.sunFrac, 0) / s.length
  return { name: p.name, where: p.where, mastM: p.mastM, movedKm: p.movedKm, refPct: p.refPct,
    anyPartPct: +(anyPart * 100).toFixed(1), centrePct: +(centre * 100).toFixed(1), meanDiscPct: +(meanDisc * 100).toFixed(1) }
})

console.log(`DEM ${meta.dem}; reference ${meta.reference}; 2020 at ${STEP_MIN} min steps`)
console.log('point                                where                 mast  ref  any  centre  disc')
for (const r of rows)
  console.log(`${r.name.padEnd(36)} ${r.where.padEnd(21)} ${String(r.mastM).padStart(3)}m  ${r.refPct}  ${r.anyPartPct.toFixed(0).padStart(3)}  ${r.centrePct.toFixed(0).padStart(5)}  ${r.meanDiscPct.toFixed(0).padStart(4)}`)
writeFileSync(join(here, 'validation', 'bussey2010_results.json'), JSON.stringify({ meta, stepMin: STEP_MIN, rows }, null, 1) + '\n')
