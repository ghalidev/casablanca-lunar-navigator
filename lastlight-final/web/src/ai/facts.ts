// Shared between the browser and the serverless function: no DOM, no Node APIs.
// The AI only rephrases these facts. Every number it writes is checked against them.

export type Audience = 'kid' | 'public' | 'planner'

export interface Fact {
  key: string
  label: string
  value: number
  unit?: string
}

export interface FactSheet {
  site: string
  window: string // human date range, e.g. "1 Mar 2027 to 15 Mar 2027"
  days: number
  mock: boolean
  facts: Fact[]
}

export interface BriefResult {
  text: string
  model: string
  verified: boolean
  fallback: boolean
  numbers: { raw: string; key: string | null }[]
}

const NUM = /[-−]?\d+(?:[.,]\d+)?/g

/** Every way a fact may legitimately be written: rounded, one decimal, percent of a fraction. */
function forms(f: Fact): number[] {
  const v = f.value
  const out = [v, Math.round(v), Math.round(v * 10) / 10]
  if (f.unit === 'h') out.push(Math.round(v / 24), Math.round((v / 24) * 10) / 10) // hours to days
  if (f.unit === 'fraction') out.push(Math.round(v * 100), Math.round(v * 1000) / 10)
  return out
}

/** Numbers in the dates and the mission length are allowed too. */
function contextNumbers(sheet: FactSheet): number[] {
  const nums = (sheet.window.match(NUM) ?? []).map((n) => Number(n.replace(',', '.')))
  return [...nums, sheet.days, 1, 2, 3] // small counting words that carry no data
}

export function checkNumbers(text: string, sheet: FactSheet) {
  const ctx = contextNumbers(sheet)
  const found = (text.match(NUM) ?? []).map((raw) => {
    const n = Number(raw.replace('−', '-').replace(',', '.'))
    const fact = sheet.facts.find((f) => forms(f).some((x) => Math.abs(x - n) < 1e-9))
    const key = fact ? fact.key : ctx.some((x) => x === n) ? 'context' : null
    return { raw, key }
  })
  return { ok: found.every((f) => f.key !== null), numbers: found }
}

export function templateBrief(sheet: FactSheet): string {
  const g = (k: string) => sheet.facts.find((f) => f.key === k)?.value
  const sun = g('sun_pct'), earth = g('earth_pct'), night = g('longest_night_h'), p = g('p_survive_14d')
  const parts = [`From ${sheet.window}, ${sheet.site} sees the Sun ${Math.round(sun ?? 0)}% of the time and Earth ${Math.round(earth ?? 0)}% of the time.`]
  if (night != null) parts.push(`The longest stretch without sunlight is ${Math.round(night)} hours.`)
  if (p != null) parts.push(`In our landing simulation, ${Math.round(p * 100)}% of landers are still alive after 14 days.`)
  return parts.join(' ')
}

const STYLE: Record<Audience, string> = {
  kid: 'a curious 10-year-old. Very short sentences, one vivid everyday comparison, no jargon',
  public: 'a curious adult with no science background. Plain words, concrete, calm',
  planner: 'a lunar mission planner. Precise, terse, operational; mention risk drivers',
}

export function buildMessages(sheet: FactSheet, audience: Audience) {
  const factLines = sheet.facts.map((f) => `- ${f.label}: ${f.value}${f.unit && f.unit !== 'fraction' ? ' ' + f.unit : ''}`).join('\n')
  return [
    {
      role: 'system',
      content:
        'You turn verified numbers about a lunar south pole landing site into a short briefing. ' +
        'Rules: use ONLY the numbers given in FACTS (you may round them, or convert a fraction to a percent, or hours to whole days). ' +
        'Never invent, estimate or add any other number, date, distance or statistic. No lists, no headings, no emojis, no exclamation marks. ' +
        'Write at most 3 sentences, under 70 words. Do not mention that you are an AI.',
    },
    {
      role: 'user',
      content: `Audience: ${STYLE[audience]}.\nSite: ${sheet.site}\nWindow: ${sheet.window} (${sheet.days} days)\nFACTS:\n${factLines}\n\nWrite the briefing.`,
    },
  ]
}

export function validateSheet(x: unknown): FactSheet | null {
  if (!x || typeof x !== 'object') return null
  const s = x as FactSheet
  if (typeof s.site !== 'string' || s.site.length > 60) return null
  if (typeof s.window !== 'string' || s.window.length > 60) return null
  if (typeof s.days !== 'number' || s.days < 1 || s.days > 60) return null
  if (!Array.isArray(s.facts) || s.facts.length > 12) return null
  for (const f of s.facts) {
    if (typeof f.key !== 'string' || !/^[a-z0-9_]{1,40}$/.test(f.key)) return null
    if (typeof f.label !== 'string' || f.label.length > 80) return null
    if (typeof f.value !== 'number' || !Number.isFinite(f.value)) return null
  }
  return { site: s.site, window: s.window, days: s.days, mock: !!s.mock, facts: s.facts }
}
