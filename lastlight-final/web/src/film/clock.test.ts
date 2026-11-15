import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { createClock, hourOfDate, sampleAt, sampleAzAt } from './clock.ts'

test('clock value updates at once, listeners are throttled but get the last value', () => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'] })
  const c = createClock(0, 10)
  let calls = 0
  c.subscribe(() => calls++)
  c.set(1)
  assert.equal(calls, 1)
  for (let i = 2; i < 30; i++) c.set(i)
  assert.equal(c.get(), 29)
  assert.equal(calls, 1)
  mock.timers.tick(100)
  assert.equal(calls, 2)
  mock.timers.reset()
})

test('sampleAt interpolates and clamps', () => {
  assert.equal(sampleAt([0, 10, 20], 0.5), 5)
  assert.equal(sampleAt([0, 10, 20], -3), 0)
  assert.equal(sampleAt([0, 10, 20], 9), 20)
})

test('sampleAzAt goes the short way across north', () => {
  assert.ok(Math.abs(sampleAzAt([350, 10], 0.5) - 0) < 1e-9)
  assert.ok(Math.abs(sampleAzAt([10, 350], 0.25) - 5) < 1e-9)
})

test('hourOfDate counts hours from t0 and clamps to the series', () => {
  assert.equal(hourOfDate('2027-01-02', '2027-01-01T00:00:00Z', 8760), 24)
  assert.equal(hourOfDate('2031-01-01', '2027-01-01T00:00:00Z', 8760), 8759)
  assert.equal(hourOfDate('nope', '2027-01-01T00:00:00Z', 8760), 0)
})
