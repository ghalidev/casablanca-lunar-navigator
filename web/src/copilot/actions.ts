// Shared by the browser and the serverless function. The copilot can only emit these
// actions; it never states a number itself (its narration may not contain digits).

export const SITE_IDS = [
  'peak-near-cabeus-b',
  'haworth',
  'malapert-massif',
  'mons-mouton-plateau',
  'mons-mouton',
  'nobile-rim-1',
  'nobile-rim-2',
  'de-gerlache-rim-2',
  'slater-plain',
] as const
export type SiteId = (typeof SITE_IDS)[number]
export const DURATIONS = [6, 7, 14, 21, 28] as const
export const FLY_SHOTS = ['moon', 'pole', 'athena', 'site', 'plan', 'verdict'] as const
export type FlyShot = (typeof FLY_SHOTS)[number]
export type Need = 'sun' | 'earth' | 'both' | 'survival'

export type Action =
  | { type: 'fly'; shot: FlyShot; site?: SiteId }
  | { type: 'set_time'; date: string }
  | { type: 'find_best'; site?: SiteId; days: number; from: string; to: string; need?: Need }
  | { type: 'compare'; a: SiteId; b: SiteId }
  | { type: 'open_method' }

export interface CopilotPlan {
  say: string
  actions: Action[]
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const isSite = (x: unknown): x is SiteId => typeof x === 'string' && (SITE_IDS as readonly string[]).includes(x)
const isDate = (x: unknown): x is string => typeof x === 'string' && DATE.test(x) && Number.isFinite(Date.parse(`${x}T00:00:00Z`))

/** Strict whitelist: anything not understood is dropped, never executed. */
export function sanitizePlan(raw: unknown): CopilotPlan {
  const r = (raw ?? {}) as { say?: unknown; actions?: unknown }
  let say = typeof r.say === 'string' ? r.say.slice(0, 280) : ''
  // No numbers from the model: digits are removed from the narration.
  if (/\d/.test(say)) say = say.replace(/[\d.,%]+/g, '').replace(/\s{2,}/g, ' ').trim()
  const actions: Action[] = []
  for (const a of Array.isArray(r.actions) ? r.actions.slice(0, 6) : []) {
    const t = (a ?? {}) as Record<string, unknown>
    if (t.type === 'fly' && (FLY_SHOTS as readonly string[]).includes(t.shot as string)) {
      const shot = t.shot as FlyShot
      if (shot === 'site' && !isSite(t.site)) continue
      actions.push({ type: 'fly', shot, ...(isSite(t.site) ? { site: t.site } : {}) })
    } else if (t.type === 'set_time' && isDate(t.date)) {
      actions.push({ type: 'set_time', date: t.date })
    } else if (t.type === 'find_best' && isDate(t.from) && isDate(t.to)) {
      const days = (DURATIONS as readonly number[]).includes(t.days as number) ? (t.days as number) : 14
      const need = ['sun', 'earth', 'both', 'survival'].includes(t.need as string) ? (t.need as Need) : undefined
      actions.push({ type: 'find_best', days, from: t.from, to: t.to, ...(isSite(t.site) ? { site: t.site } : {}), ...(need ? { need } : {}) })
    } else if (t.type === 'compare' && isSite(t.a) && isSite(t.b) && t.a !== t.b) {
      actions.push({ type: 'compare', a: t.a, b: t.b })
    } else if (t.type === 'open_method') {
      actions.push({ type: 'open_method' })
    }
  }
  return { say, actions }
}
