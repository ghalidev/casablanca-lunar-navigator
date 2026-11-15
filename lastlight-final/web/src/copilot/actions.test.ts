import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizePlan } from './actions.ts'

test('keeps whitelisted actions and strips digits from the narration', () => {
  const p = sanitizePlan({
    say: 'Flying to Haworth, 87% sunlit',
    actions: [
      { type: 'fly', shot: 'site', site: 'haworth' },
      { type: 'set_time', date: '2027-03-01' },
      { type: 'find_best', days: 14, from: '2027-01-01', to: '2027-12-31', need: 'survival' },
      { type: 'compare', a: 'haworth', b: 'malapert-massif' },
      { type: 'open_method' },
    ],
  })
  assert.equal(p.say, 'Flying to Haworth sunlit')
  assert.deepEqual(p.actions.map((a) => a.type), ['fly', 'set_time', 'find_best', 'compare', 'open_method'])
})

test('drops anything it does not understand', () => {
  const p = sanitizePlan({
    say: 42,
    actions: [
      { type: 'fly', shot: 'site' }, // site shot needs a site
      { type: 'fly', shot: 'mars' },
      { type: 'set_time', date: '2027-13-45' },
      { type: 'compare', a: 'haworth', b: 'haworth' },
      { type: 'eval', code: 'alert(1)' },
      null,
    ],
  })
  assert.equal(p.say, '')
  assert.deepEqual(p.actions, [])
})

test('find_best falls back to a 14-day mission', () => {
  const p = sanitizePlan({ actions: [{ type: 'find_best', days: 3, from: '2027-01-01', to: '2027-02-01' }] })
  assert.deepEqual(p.actions[0], { type: 'find_best', days: 14, from: '2027-01-01', to: '2027-02-01' })
})
