// Ghost landers for any landing day of the shipped year.
//
// The pipeline's Monte Carlo (pipeline/survival.py `_draw`) makes every random number a pure function of
// (seed, site, day, draw). Position, tilt and yaw depend only on that hash and the terrain slope grid, so the
// browser rebuilds them here with the same arithmetic. Only the death hour of each draw needs the Sun and the
// horizon; it ships as ghosts/{site}_{year}.bin (uint16 LE [days][draws], hour x 10, 65535 = alive).
// The share of alive draws in a day's row is exactly that day's p_survive_14d (checked by the pipeline and
// by ghosts.test.ts).
import type { GhostLander } from './types'

export interface GhostGrid {
  site_id: string
  params_ref: string
  year: number
  days: number
  n_draws: number
  seed: number
  site_index: number
  sigma_m: number
  tilt_noise_deg: number
  grid_half_m: number
  grid_step_m: number
  nx: number
  slope_deg: number[]
}

const M = (1n << 64n) - 1n
const C1 = 0x9e3779b97f4a7c15n
const C2 = 0xbf58476d1ce4e5b9n
const C3 = 0x94d049bb133111ebn
const INV53 = 1 / 9007199254740992

function mix(z: bigint): bigint {
  z = ((z ^ (z >> 30n)) * C2) & M
  z = ((z ^ (z >> 27n)) * C3) & M
  return z ^ (z >> 31n)
}
const uniform = (state: bigint, i: number) => Number(mix((state + BigInt(i + 1) * C1) & M) >> 11n) * INV53
function gauss(state: bigint, i: number) {
  const u1 = Math.max(uniform(state, i), 1e-12)
  const u2 = uniform(state, i + 1)
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}
// numba's round() on floats rounds half to even, like Python's.
function roundHalfEven(x: number) {
  const r = Math.round(x)
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r
}

/** One simulated landing's geometry: same formulas as `_draw` in pipeline/survival.py. */
export function drawGeometry(g: GhostGrid, day: number, draw: number) {
  const state = mix(
    BigInt(g.seed) ^ ((BigInt(g.site_index + 1) * C1) & M) ^ ((BigInt(day + 1) * C2) & M) ^ ((BigInt(draw + 1) * C3) & M),
  )
  const dx = gauss(state, 0) * g.sigma_m
  const dy = gauss(state, 2) * g.sigma_m
  const ix = Math.min(Math.max(roundHalfEven((dx + g.grid_half_m) / g.grid_step_m), 0), g.nx - 1)
  const iy = Math.min(Math.max(roundHalfEven((dy + g.grid_half_m) / g.grid_step_m), 0), g.nx - 1)
  const tilt = g.slope_deg[iy * g.nx + ix] + Math.abs(gauss(state, 4)) * g.tilt_noise_deg
  const yaw = uniform(state, 6) * 360
  return { dx_m: dx, dy_m: dy, tilt_deg: tilt, yaw_deg: yaw }
}

/** Every simulated landing of one day: geometry rebuilt here, death hour from the pipeline. */
export function landersForDay(g: GhostGrid, died: Uint16Array, day: number): GhostLander[] {
  if (day < 0 || day >= g.days) return []
  const out: GhostLander[] = new Array(g.n_draws)
  const row = day * g.n_draws
  for (let d = 0; d < g.n_draws; d++) {
    const v = died[row + d]
    out[d] = { ...drawGeometry(g, day, d), died_at_h: v === 65535 ? null : v / 10 }
  }
  return out
}

/** Alive count per day, straight from the death table (no geometry needed). */
export function aliveCount(g: GhostGrid, died: Uint16Array, day: number) {
  let n = 0
  const row = day * g.n_draws
  for (let d = 0; d < g.n_draws; d++) if (died[row + d] === 65535) n++
  return n
}
