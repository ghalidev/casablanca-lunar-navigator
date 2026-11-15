// Camera state shared outside React's render loop: the agent waits on it, the letterbox reads it.

type Fn = () => void

let flying = false
const listeners = new Set<Fn>()
const waiters = new Set<Fn>()

export const camBus = {
  isFlying: () => flying,
  setFlying(v: boolean) {
    if (v === flying) return
    flying = v
    if (!v) {
      waiters.forEach((w) => w())
      waiters.clear()
    }
    listeners.forEach((l) => l())
  },
  subscribe(fn: Fn) {
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  },
  /** Resolves when the camera has landed on its shot, or after `timeoutMs` at most. */
  whenArrived(timeoutMs = 6000): Promise<void> {
    if (!flying) return Promise.resolve()
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer)
        waiters.delete(done)
        resolve()
      }
      const timer = setTimeout(done, timeoutMs)
      waiters.add(done)
    })
  },
}
