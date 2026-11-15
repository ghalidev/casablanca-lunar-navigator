import { createContext, useContext, useSyncExternalStore } from 'react'
import type { ShotId } from './shots'
import type { Clock } from './clock'

/** What the agent can do to the film. Every call is visible: the camera flies, the clock moves. */
export interface FilmController {
  /** Resolves once the camera has landed on the shot. */
  fly(shot: ShotId, site?: string): Promise<void>
  /** Moves the ground clock (Sun and Earth) to a UTC date, YYYY-MM-DD. */
  setTime(date: string): void
  compare(a: string, b: string): Promise<void>
  /** Short description of the current shot, sent to the model as context. */
  context(): string
}

export const FilmContext = createContext<FilmController | null>(null)
export const useFilm = () => useContext(FilmContext)

/** Read a clock from React, re-rendering only when the selected value changes. */
export function useClock<T>(clock: Clock, select: (v: number) => T): T {
  return useSyncExternalStore(clock.subscribe, () => select(clock.get()))
}
