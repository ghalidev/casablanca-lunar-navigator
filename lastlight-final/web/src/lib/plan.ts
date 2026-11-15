/*
 * One plan for the whole site: the region and the landing day the visitor is looking at.
 * The film (2027) and the Planner (2027–2030) both read it when their URL does not say otherwise and write it
 * when it changes, and the top bar's links carry it, so moving between pages never changes the day or the %.
 */
export interface Plan {
  site: string
  date: string // YYYY-MM-DD, UTC
}
const KEY = 'll:plan'
// The film's opening plan: the best-ranked 2027 window (top10.json rank 3, Malapert Massif, 95.8%).
export const DEFAULT_PLAN: Plan = { site: 'malapert-massif', date: '2027-10-08' }

export function getPlan(): Plan | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as Plan | null
    return v && typeof v.site === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.date) ? v : null
  } catch {
    return null
  }
}
export function setPlan(p: Plan) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    /* private mode: links simply carry nothing */
  }
}
export const inFilmYear = (date: string) => date.startsWith('2027')
