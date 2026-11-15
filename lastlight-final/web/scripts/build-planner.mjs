// Builds web/public/data/planner.json: a compact copy of the pipeline's survival files for the Planner page.
// Nothing is recomputed: each value is the pipeline's own number, packed as integers (per mille, tenths of a day).
// Run: node scripts/build-planner.mjs  (from web/)
import fs from 'node:fs'

const DATA = 'public/data'
const sites = JSON.parse(fs.readFileSync(`${DATA}/sites.json`, 'utf8')).sites
const T0 = Date.UTC(2027, 0, 1)
const N = Math.round((Date.UTC(2031, 0, 1) - T0) / 86_400_000)

const out = { source: 'web/public/data/survival/*.json (pipeline Monte Carlo, 1,000 landers per day)', t0: '2027-01-01', days: N, sites: [] }
for (const s of sites) {
  const f = JSON.parse(fs.readFileSync(`${DATA}/survival/${s.id}.json`, 'utf8'))
  const p = new Array(N).fill(-1)
  const slip = new Array(N).fill(-1)
  const life = new Array(N).fill(-1)
  const comm = new Array(N).fill(-1)
  for (const w of f.windows) {
    const d = Math.round((Date.parse(w.landing_utc) - T0) / 86_400_000)
    if (d < 0 || d >= N) continue
    p[d] = Math.round(w.p_survive_14d * 1000)
    slip[d] = w.slip_tolerance_days
    life[d] = Math.round(w.median_days_alive * 10)
    comm[d] = Math.round(w.p_comm_ok * 1000)
  }
  out.sites.push({ id: s.id, name: s.name, lat: s.lat, lon: s.lon, params_ref: f.params_ref, mock: !!f.mock, p, slip, life, comm })
}
fs.writeFileSync(`${DATA}/planner.json`, JSON.stringify(out))
console.log(`planner.json: ${out.sites.length} regions × ${N} days, ${(fs.statSync(`${DATA}/planner.json`).size / 1024).toFixed(0)} KB`)
