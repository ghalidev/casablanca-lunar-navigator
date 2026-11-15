import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { aliveCount, landersForDay, type GhostGrid } from './ghosts.ts'

const DATA = new URL('../../public/data/', import.meta.url)
const sites = (JSON.parse(readFileSync(new URL('sites.json', DATA), 'utf8')) as { sites: { id: string }[] }).sites.map((s) => s.id)

for (const id of sites) {
  const gridUrl = new URL(`ghosts/${id}_grid.json`, DATA)
  test(`${id}: per-day ghosts agree with the pole percentage and the pipeline's own sample`, { skip: !existsSync(gridUrl) }, () => {
    const g = JSON.parse(readFileSync(gridUrl, 'utf8')) as GhostGrid
    const buf = readFileSync(new URL(`ghosts/${id}_${g.year}.bin`, DATA))
    const died = new Uint16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2)
    assert.equal(died.length, g.days * g.n_draws)
    const surv = JSON.parse(readFileSync(new URL(`survival/${id}.json`, DATA), 'utf8'))
    assert.equal(g.params_ref, surv.params_ref)
    // 1. The crash test's survivors on any day = the pole's percentage for that day (same 1,000 draws).
    for (let d = 0; d < g.days; d++) {
      assert.equal(aliveCount(g, died, d), Math.round(surv.windows[d].p_survive_14d * g.n_draws), `day ${d}`)
    }
    // 2. Geometry rebuilt in the browser = the pipeline's ghost sample of its best day, draw by draw.
    const day = Math.round((Date.parse(surv.ghost_window_utc) - Date.UTC(g.year, 0, 1)) / 86_400_000)
    const ours = landersForDay(g, died, day)
    surv.ghost_landers_sample.forEach((ref: { dx_m: number; dy_m: number; tilt_deg: number; yaw_deg: number; died_at_h: number | null }, i: number) => {
      const o = ours[i]
      assert.ok(Math.abs(o.dx_m - ref.dx_m) <= 0.051 && Math.abs(o.dy_m - ref.dy_m) <= 0.051, `draw ${i} position`)
      assert.ok(Math.abs(o.tilt_deg - ref.tilt_deg) <= 0.06, `draw ${i} tilt ${o.tilt_deg} vs ${ref.tilt_deg}`)
      assert.ok(Math.abs((((o.yaw_deg ?? 0) - ref.yaw_deg + 540) % 360) - 180) <= 0.051, `draw ${i} yaw`)
      assert.equal(o.died_at_h == null, ref.died_at_h == null, `draw ${i} alive`)
      if (ref.died_at_h != null) assert.ok(Math.abs((o.died_at_h as number) - ref.died_at_h) <= 0.06, `draw ${i} death hour`)
    })
  })
}
