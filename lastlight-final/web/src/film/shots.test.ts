import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isShot, legacyRedirect } from './shots.ts'

test('old pages redirect to their shot', () => {
  assert.equal(legacyRedirect('/sites', ''), '/?ch=pole')
  assert.equal(legacyRedirect('/sites/haworth', ''), '/?ch=site&site=haworth')
  assert.equal(legacyRedirect('/plan', '?date=2027-03-01&site=haworth'), '/?ch=verdict&site=haworth')
  assert.equal(legacyRedirect('/crash-test', '?site=mons-mouton'), '/?ch=crash&site=mons-mouton')
  assert.equal(legacyRedirect('/crash-test', ''), '/?ch=crash')
  assert.equal(legacyRedirect('/story', ''), '/')
})

test('live routes are left alone', () => {
  assert.equal(legacyRedirect('/method', ''), null)
  assert.equal(legacyRedirect('/', '?ch=pole'), null)
})

test('isShot accepts only known shots', () => {
  assert.equal(isShot('verdict'), true)
  assert.equal(isShot('plan'), false)
  assert.equal(isShot(undefined), false)
})
