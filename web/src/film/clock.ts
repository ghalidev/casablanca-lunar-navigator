// Animation time kept outside React: the scene reads it every frame, React hears about it
// at most `hz` times a second (readouts, sliders). Mission no longer re-renders at 60 Hz.

export interface Clock {
  get(): number
  set(v: number): void
  subscribe(fn: () => void): () => void
}

export function createClock(initial: number, hz = 10, now: () => number = () => Date.now()): Clock {
  let value = initial
  let lastEmit = -Infinity
  let timer: ReturnType<typeof setTimeout> | null = null
  const listeners = new Set<() => void>()
  const period = 1000 / hz
  const emit = () => {
    timer = null
    lastEmit = now()
    listeners.forEach((l) => l())
  }
  return {
    get: () => value,
    set(v) {
      if (v === value) return
      value = v
      const wait = period - (now() - lastEmit)
      if (wait <= 0) emit()
      else if (!timer) timer = setTimeout(emit, wait)
    },
    subscribe(fn) {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
  }
}

/** Linear interpolation of an hourly series at a fractional index (clamped). */
export function sampleAt(arr: ArrayLike<number>, h: number) {
  const n = arr.length
  if (!n) return NaN
  const x = Math.min(n - 1, Math.max(0, h))
  const i = Math.floor(x)
  const j = Math.min(n - 1, i + 1)
  return arr[i] + (arr[j] - arr[i]) * (x - i)
}

/** Azimuth interpolation the short way round (degrees, result in [0, 360)). */
export function sampleAzAt(arr: ArrayLike<number>, h: number) {
  const n = arr.length
  if (!n) return NaN
  const x = Math.min(n - 1, Math.max(0, h))
  const i = Math.floor(x)
  const j = Math.min(n - 1, i + 1)
  const d = ((((arr[j] - arr[i]) % 360) + 540) % 360) - 180
  return (((arr[i] + d * (x - i)) % 360) + 360) % 360
}

/** Hour index of a UTC date (YYYY-MM-DD) in a series starting at `t0`, clamped to [0, n - 1]. */
export function hourOfDate(date: string, t0: string, n: number) {
  const h = (Date.parse(`${date}T00:00:00Z`) - Date.parse(t0)) / 3_600_000
  return Number.isFinite(h) ? Math.min(n - 1, Math.max(0, h)) : 0
}
