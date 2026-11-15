// The film's shots, in viewing order. One scene, one URL scheme: /?ch=<shot>&site=<id>.

export type ShotId = 'moon' | 'pole' | 'athena' | 'site' | 'plan' | 'verdict' | 'crash'

// 'crash' is kept as a type only: its landing simulation was never built, so the shot is not in the film.
export const ORDER: ShotId[] = ['moon', 'pole', 'athena', 'site', 'plan', 'verdict']

export const LABEL: Record<ShotId, string> = {
  moon: 'The Moon',
  pole: 'South pole',
  athena: 'Athena',
  site: 'On the ground',
  plan: 'Compare',
  crash: 'Crash test',
  verdict: 'The verdict',
}

export const isShot = (x: unknown): x is ShotId => typeof x === 'string' && (ORDER as string[]).includes(x)

/** Old multi-page routes land on the matching shot. Returns null for routes that still exist. */
export function legacyRedirect(pathname: string, search: string): string | null {
  const q = new URLSearchParams(search)
  const site = q.get('site')
  const withSite = (ch: ShotId, id: string | null) => `/?ch=${ch}${id ? `&site=${encodeURIComponent(id)}` : ''}`
  if (pathname === '/sites') return withSite('pole', null)
  const m = pathname.match(/^\/sites\/([^/]+)$/)
  if (m) return withSite('site', decodeURIComponent(m[1]))
  if (pathname === '/plan') return withSite('verdict', site)
  if (pathname === '/crash-test') return withSite('site', site)
  if (pathname === '/story') return '/'
  return null
}
