import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ranksBySite, toCsv, verdictRows } from './verdict.ts'
import type { Top10File } from '../data/types.ts'

const top: Top10File = {
  generated_at: '2026-11-14T00:00:00Z',
  mock: true,
  params_ref: 'mock',
  criteria: { survive_days: 14, p_threshold: 0.95, year_start: 2027, year_end: 2030 },
  windows: [
    { rank: 2, site_id: 'haworth', landing_utc: '2027-02-07T00:00:00Z', p_survive_14d: 0.97, p_comm_ok: 0.5, median_days_alive: 14, slip_tolerance_days: 3 },
    { rank: 1, site_id: 'odd, "site"', landing_utc: '2027-01-09T00:00:00Z', p_survive_14d: 1, p_comm_ok: 0.6, median_days_alive: 14, slip_tolerance_days: 12 },
  ],
}

test('rows are sorted by rank and named', () => {
  const rows = verdictRows(top, { haworth: 'Haworth' })
  assert.deepEqual(rows.map((r) => r.rank), [1, 2])
  assert.equal(rows[1].siteName, 'Haworth')
  assert.equal(rows[0].siteName, 'odd, "site"')
})

test('csv escapes cells and flags mock data', () => {
  const csv = toCsv(verdictRows(top, {}), true)
  const lines = csv.trim().split('\n')
  assert.equal(lines[0], '# MOCK DATA: placeholder numbers, do not quote')
  assert.equal(lines[1].split(',')[0], 'rank')
  assert.ok(lines[2].startsWith('1,"odd, ""site""","odd, ""site""",2027-01-09T00:00:00Z,1,0.6,14,12'))
  assert.ok(!toCsv([], false).startsWith('#'))
})

test('ranks are grouped by site', () => {
  assert.deepEqual(ranksBySite(verdictRows(top, {})), { 'odd, "site"': [1], haworth: [2] })
})
