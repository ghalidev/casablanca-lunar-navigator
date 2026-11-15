import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { buildFlight, easeInOutCubic, flightDuration, sampleFlight, sampleFlightAt, MOON_CENTER, type Pose } from './camera.ts'

const R = 1737.4
const pose = (pos: number[], look: number[], up: number[]): Pose => ({
  pos: new THREE.Vector3(...pos),
  look: new THREE.Vector3(...look),
  up: new THREE.Vector3(...up),
})
const globe = pose([0, 2100 - R, -5800], [-1150, -R, 0], [0, -1, 0])
const pole = pose([40, 165, 245], [10, -25, -25], [0, 1, 0])

test('easing is pinned at 0 and 1 and monotonic', () => {
  assert.equal(easeInOutCubic(0), 0)
  assert.equal(easeInOutCubic(1), 1)
  let last = 0
  for (let t = 0.05; t <= 1; t += 0.05) {
    const v = easeInOutCubic(t)
    assert.ok(v >= last)
    last = v
  }
})

test('flight duration grows with distance between 1.6 and 3.2 s', () => {
  const a = new THREE.Vector3()
  assert.ok(Math.abs(flightDuration(a, new THREE.Vector3(0.5, 0, 0)) - 1.6) < 1e-9)
  assert.ok(flightDuration(a, new THREE.Vector3(6000, 0, 0)) <= 3.2)
  assert.ok(flightDuration(a, new THREE.Vector3(6000, 0, 0)) > flightDuration(a, new THREE.Vector3(60, 0, 0)))
})

test('a flight starts on the start pose and ends exactly on the target', () => {
  const f = buildFlight(globe, pole, 10)
  const s0 = sampleFlight(f, 10)
  assert.ok(s0.pos.distanceTo(globe.pos) < 1e-6)
  assert.equal(s0.done, false)
  const s1 = sampleFlight(f, 10 + f.duration + 0.01)
  assert.ok(s1.pos.distanceTo(pole.pos) < 1e-6)
  assert.ok(s1.up.distanceTo(pole.up) < 1e-6)
  assert.equal(s1.done, true)
})

test('globe to pole never passes through the Moon and up stays a unit vector', () => {
  const f = buildFlight(globe, pole, 0)
  for (let i = 0; i <= 50; i++) {
    const s = sampleFlight(f, (i / 50) * f.duration)
    assert.ok(s.pos.distanceTo(MOON_CENTER) > R - 1, `step ${i} inside the Moon`)
    assert.ok(Math.abs(s.up.length() - 1) < 1e-6, `step ${i} up not unit`)
    assert.ok(Number.isFinite(s.up.x + s.up.y + s.up.z))
  }
})

test('opposite up vectors roll around the view axis (up stays perpendicular to the view)', () => {
  const a = pose([0, 0, -10], [0, 0, 0], [0, -1, 0])
  const b = pose([0, 0, -10], [0, 0, 0], [0, 1, 0])
  const f = buildFlight(a, b, 0)
  const mid = sampleFlight(f, f.duration / 2)
  assert.ok(Math.abs(mid.up.z) < 1e-6)
})

test('globe to pole pitches over the pole instead of rolling the image', () => {
  const f = buildFlight(globe, pole, 0)
  for (let i = 1; i < 10; i++) {
    const s = sampleFlight(f, (i / 10) * f.duration)
    // Screen "right" vector: a barrel roll would swing it up toward ±y.
    const fwd = s.look.clone().sub(s.pos).normalize()
    const right = fwd.clone().cross(s.up).normalize()
    assert.ok(Math.abs(right.y) < 0.5, `step ${i}: image rolled (right.y=${right.y.toFixed(2)})`)
  }
})

test('sampleFlightAt follows the path linearly and matches sampleFlight at the ends', () => {
  const f = buildFlight(globe, pole, 0)
  assert.ok(sampleFlightAt(f, 0).pos.distanceTo(globe.pos) < 1e-6)
  assert.ok(sampleFlightAt(f, 1).pos.distanceTo(pole.pos) < 1e-6)
  const a = sampleFlightAt(f, 0.25).pos.distanceTo(globe.pos)
  const b = sampleFlightAt(f, 0.5).pos.distanceTo(globe.pos)
  assert.ok(b > a)
  assert.ok(Math.abs(sampleFlightAt(f, 0.5).up.length() - 1) < 1e-6)
})
