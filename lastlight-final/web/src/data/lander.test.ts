import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { REFERENCE, THERMAL, runLander } from './lander.ts'
import type { SeriesFile } from './types.ts'

const fake = (n: number, irr: number, frac: number): SeriesFile => ({
  site_id: 'x', mock: true, t0: '2027-01-01T00:00:00Z', step_h: 1,
  sun_el: Array(n).fill(1), sun_az: Array.from({ length: n }, (_, i) => (i * 15) % 360),
  earth_el: Array(n).fill(0), earth_az: Array(n).fill(0),
  sun_frac: Array(n).fill(frac), earth_frac: Array(n).fill(0), irradiance_wm2: Array(n).fill(irr),
})
const T0 = Date.parse('2027-01-01T00:00:00Z')

test('in the dark, the battery lasts exactly capacity / load', () => {
  const r = runLander(fake(400, 0, 0), T0, 14, REFERENCE)
  assert.ok(r.diedH != null)
  assert.ok(Math.abs(r.diedH - 2500 / 60) < 1e-6)
  assert.equal(r.aliveHeadings, 0)
})

test('thermal model: in the dark the heater settles at eps*sigma*A*Tmin^4 minus the load', () => {
  const L = { ...REFERENCE, radiatorM2: 0.5, tMinC: -20, batteryWh: 100000 }
  const r = runLander(fake(400, 0, 0), T0, 14, L)
  const steady = THERMAL.emissivity * 5.670374419e-8 * 0.5 * 253.15 ** 4 - 60 // ~38.7 W
  const lastHours = r.heaterWh // total, includes the initial cool-down from 20 °C with no heater
  assert.ok(lastHours > steady * 300 && lastHours < steady * 336, `heater ${lastHours} Wh vs steady ${steady} W`)
  assert.ok(Math.abs(r.temp[335] - -20) < 0.01)
})

test('thermal model: sunlight on the box can replace the heater', () => {
  const L = { ...REFERENCE, radiatorM2: 0.5, tMinC: -20 }
  const lit = runLander(fake(400, 1300, 1), T0, 14, L)
  assert.equal(lit.diedH, null)
  assert.equal(lit.heaterWh, 0)
})

test('thermal model off = the pipeline reference (no heater energy)', () => {
  const r = runLander(fake(400, 0, 0), T0, 14, REFERENCE)
  assert.equal(r.heaterWh, 0)
})

test('a Sun-tracking panel gets area x efficiency x irradiance', () => {
  // 1 m2 x 10% x 500 W/m2 = 50 W against a 60 W load: loses 10 Wh per hour
  const r = runLander(fake(400, 500, 1), T0, 14, { ...REFERENCE, faces: 0, areaM2: 1, efficiency: 0.1 })
  assert.ok(Math.abs((r.diedH ?? 0) - 250) < 1e-6)
})

test('reference lander, upright on Malapert Massif on its best day (15 Oct 2029), is alive after 14 days', () => {
  const s = JSON.parse(readFileSync(new URL('../../public/data/series/malapert-massif_2029.json', import.meta.url), 'utf8')) as SeriesFile
  const r = runLander(s, Date.parse('2029-10-15T00:00:00Z'), 14, REFERENCE)
  assert.equal(r.diedH, null)
})

test('upright-on-target verdict agrees with the 1,000-draw Monte Carlo majority on most days (all regions, every 7th day)', () => {
  const DATA = new URL('../../public/data/', import.meta.url)
  const pl = JSON.parse(readFileSync(new URL('planner.json', DATA), 'utf8')) as { sites: { id: string; p: number[] }[] }
  const t0 = Date.UTC(2027, 0, 1)
  let agree = 0, total = 0
  for (const site of pl.sites) {
    const cache = new Map<number, SeriesFile>()
    for (let d = 0; d < site.p.length; d += 7) {
      if (site.p[d] < 0) continue
      const ms = t0 + d * 86_400_000
      const y = new Date(ms).getUTCFullYear()
      if (!cache.has(y)) cache.set(y, JSON.parse(readFileSync(new URL(`series/${site.id}_${y}.json`, DATA), 'utf8')))
      const r = runLander(cache.get(y)!, ms, 14, REFERENCE)
      if ((r.diedH == null) === site.p[d] >= 500) agree++
      total++
    }
  }
  console.log(`agreement ${agree}/${total} = ${((100 * agree) / total).toFixed(1)}%`)
  assert.ok(agree / total > 0.85)
})
