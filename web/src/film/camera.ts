import * as THREE from 'three'

// Camera flights between shots. World in km, Moon centre at (0, -R, 0), south pole at the origin.

const R = 1737.4
export const MOON_CENTER = new THREE.Vector3(0, -R, 0)

export interface Pose {
  pos: THREE.Vector3
  look: THREE.Vector3
  up: THREE.Vector3
}

export interface Flight {
  from: Pose
  to: Pose
  path: THREE.CatmullRomCurve3
  /** Camera orientations at both ends; slerped, so the camera pitches and turns, never barrel-rolls. */
  qFrom: THREE.Quaternion
  qTo: THREE.Quaternion
  start: number
  duration: number
}

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/** 1.6 s for a short hop, up to 3.2 s for globe to ground (log of the distance in km). */
export function flightDuration(a: THREE.Vector3, b: THREE.Vector3) {
  const k = THREE.MathUtils.clamp(Math.log10(Math.max(a.distanceTo(b), 1)) / 4, 0, 1)
  return 1.6 + 1.6 * k
}

export const clonePose = (p: Pose): Pose => ({ pos: p.pos.clone(), look: p.look.clone(), up: p.up.clone() })

/** Rotation taking `from` onto `to`. Opposite vectors roll around `axis` (the view direction). */
function rotationBetween(from: THREE.Vector3, to: THREE.Vector3, axis: THREE.Vector3) {
  if (from.dot(to) < -0.999) return new THREE.Quaternion().setFromAxisAngle(axis.clone().normalize(), Math.PI)
  return new THREE.Quaternion().setFromUnitVectors(from.clone().normalize(), to.clone().normalize())
}

export function buildFlight(from: Pose, to: Pose, start: number): Flight {
  const d = from.pos.distanceTo(to.pos)
  // Mid-point lifted away from the Moon's centre: the camera arcs over the relief, never through it.
  const mid = from.pos.clone().lerp(to.pos, 0.5).sub(MOON_CENTER)
  const ra = from.pos.distanceTo(MOON_CENTER)
  const rb = to.pos.distanceTo(MOON_CENTER)
  mid.setLength(Math.max(mid.length(), (ra + rb) / 2) + 0.15 * d).add(MOON_CENTER)
  // A zero-length flight (same pose) breaks the centripetal parametrisation (NaN): use the uniform one.
  const path = new THREE.CatmullRomCurve3([from.pos.clone(), mid, to.pos.clone()], false, d < 1e-6 ? 'catmullrom' : 'centripetal')
  return { from: clonePose(from), to: clonePose(to), path, qFrom: orientation(from), qTo: orientation(to), start, duration: flightDuration(from.pos, to.pos) }
}

const _q = new THREE.Quaternion()
const _m = new THREE.Matrix4()
const Y = new THREE.Vector3(0, 1, 0)
const FWD = new THREE.Vector3(0, 0, -1)

/** The rotation a camera at `p.pos` looking at `p.look` with `p.up` ends up with. */
function orientation(p: Pose) {
  return new THREE.Quaternion().setFromRotationMatrix(_m.lookAt(p.pos, p.look, p.up))
}

export function sampleFlight(f: Flight, now: number): Pose & { done: boolean } {
  const t = THREE.MathUtils.clamp((now - f.start) / f.duration, 0, 1)
  if (t >= 1) return { pos: f.to.pos.clone(), look: f.to.look.clone(), up: f.to.up.clone(), done: true }
  return { ...sampleFlightAt(f, easeInOutCubic(t)), done: false }
}

/**
 * Pose at progress `u` (0..1) along the flight, no easing: the scroll wheel drives `u` directly.
 * One rotation drives both gaze and up, so the camera turns like a drone and never barrel-rolls.
 */
export function sampleFlightAt(f: Flight, u: number): Pose {
  const e = THREE.MathUtils.clamp(u, 0, 1)
  if (e >= 1) return { pos: f.to.pos.clone(), look: f.to.look.clone(), up: f.to.up.clone() }
  const pos = f.path.getPointAt(e)
  _q.slerpQuaternions(f.qFrom, f.qTo, e)
  const up = Y.clone().applyQuaternion(_q).normalize()
  const reach = THREE.MathUtils.lerp(f.from.pos.distanceTo(f.from.look), f.to.pos.distanceTo(f.to.look), e)
  const look = FWD.clone().applyQuaternion(_q).multiplyScalar(reach).add(pos)
  return { pos, look, up }
}

/** Follow mode (small target changes within one shot): move `up` a fraction `k` toward `target`. */
export function turnUp(up: THREE.Vector3, target: THREE.Vector3, k: number, view: THREE.Vector3) {
  up.applyQuaternion(_q.identity().slerp(rotationBetween(up, target, view), k)).normalize()
}
