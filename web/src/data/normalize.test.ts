import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSurvival, normalizeTop10 } from './normalize.ts'

const lander = { dx_m: 1, dy_m: 2, tilt_deg: 3, yaw_deg: 4, died_at_h: null }
const base = { site_id: 'haworth', mock: true, params_ref: 'mock', windows: [] }

test('v1 survival (array + ghost_window_utc) passes through', () => {
  const out = normalizeSurvival({ ...base, ghost_landers_sample: [lander], ghost_window_utc: '2027-03-01T00:00:00Z' })
  assert.deepEqual(out.ghost_landers_sample, [lander])
  assert.equal(out.ghost_window_utc, '2027-03-01T00:00:00Z')
})

test('v2 survival (object with landers) is flattened, window and duration kept', () => {
  const out = normalizeSurvival({ ...base, ghost_landers_sample: { landing_utc: '2029-02-11T00:00:00Z', sim_duration_h: 336, landers: [lander, lander] } })
  assert.equal(out.ghost_landers_sample.length, 2)
  assert.equal(out.ghost_window_utc, '2029-02-11T00:00:00Z')
  assert.equal(out.sim_duration_h, 336)
})

test('v2 survival with an empty sample never crashes the UI', () => {
  // @ts-expect-error deliberately malformed
  const out = normalizeSurvival({ ...base, ghost_landers_sample: undefined })
  assert.deepEqual(out.ghost_landers_sample, [])
})

const w = { rank: 1, site_id: 'haworth', landing_utc: '2028-05-02T00:00:00Z', p_survive_14d: 1, p_comm_ok: 1, median_days_alive: 14, slip_tolerance_days: 0 }

test('v1 top10 criteria keep their explicit years', () => {
  const out = normalizeTop10({ generated_at: 'x', mock: true, params_ref: 'm', criteria: { survive_days: 14, p_threshold: 0.95, year_start: 2027, year_end: 2030 }, windows: [w] })
  assert.deepEqual([out.criteria.year_start, out.criteria.year_end], [2027, 2030])
})

test('v2 top10 criteria derive the years from from_utc / to_utc', () => {
  const out = normalizeTop10({ generated_at: 'x', mock: true, params_ref: 'm', criteria: { survive_days: 14, p_threshold: 0.95, from_utc: '2027-01-01T00:00:00Z', to_utc: '2030-12-31T00:00:00Z' }, windows: [w] })
  assert.deepEqual([out.criteria.year_start, out.criteria.year_end], [2027, 2030])
  assert.equal(out.criteria.from_utc, '2027-01-01T00:00:00Z')
})

test('v2 top10 to_utc is an exclusive end bound: 2031-01-01 means the search ends in 2030', () => {
  const out = normalizeTop10({ generated_at: 'x', mock: true, params_ref: 'm', criteria: { survive_days: 14, p_threshold: 0.95, from_utc: '2027-01-01T00:00:00Z', to_utc: '2031-01-01T00:00:00Z' }, windows: [w] })
  assert.deepEqual([out.criteria.year_start, out.criteria.year_end], [2027, 2030])
})

test('v2 top10 with an inclusive last day still reads as that year', () => {
  const out = normalizeTop10({ generated_at: 'x', mock: true, params_ref: 'm', criteria: { survive_days: 14, p_threshold: 0.95, from_utc: '2027-01-01T00:00:00Z', to_utc: '2030-12-31T00:00:00Z' }, windows: [w] })
  assert.equal(out.criteria.year_end, 2030)
})
