import { test } from 'node:test'
import assert from 'node:assert/strict'
import { camBus } from './bus.ts'

test('whenArrived resolves at once when the camera is still', async () => {
  camBus.setFlying(false)
  await camBus.whenArrived()
})

test('whenArrived waits for the landing and notifies subscribers', async () => {
  let calls = 0
  const off = camBus.subscribe(() => calls++)
  camBus.setFlying(true)
  let landed = false
  const p = camBus.whenArrived().then(() => (landed = true))
  await Promise.resolve()
  assert.equal(landed, false)
  camBus.setFlying(false)
  await p
  assert.equal(landed, true)
  assert.equal(calls, 2)
  off()
})

test('whenArrived never hangs', async () => {
  camBus.setFlying(true)
  await camBus.whenArrived(20)
  camBus.setFlying(false)
})
