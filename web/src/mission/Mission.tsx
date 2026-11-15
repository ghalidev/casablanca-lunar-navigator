import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowRight, DownloadSimple, Pause, Play, SpeakerHigh, SpeakerSlash } from '@phosphor-icons/react'
import { useSeries, useSites, useMockFlag, useSurvival, useWindows } from '../data/hooks'
import { VISIBLE_FRAC, dailySummaries, windowStats, type WindowStats } from '../data/stats'
import { loadPoleTerrain, siteXZ, skyDir, type PoleTerrain } from './terrain'
import type { Crash, Light, Scrub, Shot } from './MissionScene'
import { Soundscape } from './sound'
import { Copilot } from '../copilot/Copilot'
import { TopBar } from '../components/TopBar'
import { HorizonRing } from '../components/HorizonRing'
import { rememberMission } from '../lib/missionMemory'
import { prettyDate } from '../lib/geo'
import type { GhostLander, SeriesFile, Site } from '../data/types'
import { LABEL, ORDER, isShot, type ShotId } from '../film/shots'
import { createClock, hourOfDate, sampleAt, sampleAzAt } from '../film/clock'
import { FilmContext, useClock, type FilmController } from '../film/controller'
import { camBus } from '../film/bus'
import type { WindowRow } from '../data/types'
import './mission.css'

const MissionScene = lazy(() => import('./MissionScene').then((m) => ({ default: m.MissionScene })))

const CRASH_HOURS = 14 * 24
const CRASH_HOURS_PER_SECOND = 24 // two weeks in 14 seconds
const DROP_S = 2.6 // the ghosts fall in before the clock starts
const YEAR = 2027
const HOURS_PER_SECOND = 6 // one lunar day in about two minutes
// Athena (IM-2) touchdown, secondary source (see docs/data-sources.md); confirmed against LROC before submission.
const ATHENA = { lat: -84.7906, lon: 29.1957 }
const ease = [0.16, 1, 0.3, 1] as const
const nextFrames = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

const aliveAt = (landers: GhostLander[], h: number) => landers.filter((l) => l.died_at_h == null || l.died_at_h > h).length

function Survival({ landers, hour }: { landers: GhostLander[]; hour: number }) {
  const W = 300, H = 56
  const pts = useMemo(() => {
    const out: string[] = []
    for (let h = 0; h <= CRASH_HOURS; h += 6) out.push(`${(h / CRASH_HOURS) * W},${H - (aliveAt(landers, h) / landers.length) * H}`)
    return out.join(' ')
  }, [landers])
  const x = (hour / CRASH_HOURS) * W
  return (
    <svg className="mm-curve" viewBox={`0 -4 ${W} ${H + 8}`} role="img" aria-label="Share of landers still alive over 14 days">
      <polyline points={pts} />
      <line x1={x} x2={x} y1={-4} y2={H + 4} />
    </svg>
  )
}

/** Two regions side by side, 14 days from the ground clock's date. Numbers from the series files. */
function CompareCard({ a, b, startMs, names }: { a: string; b: string; startMs: number; names: Record<string, string> }) {
  const sa = useSeries(a, YEAR).data
  const sb = useSeries(b, YEAR).data
  const row = (s: SeriesFile | null | undefined) => (s ? windowStats(s, startMs, 14) : null)
  const ra = row(sa), rb = row(sb)
  const cell = (v: number | undefined) => (v == null ? '…' : `${Math.round(v)}%`)
  return (
    <div className="mm-compare">
      <p className="mm-kicker">14 days from {prettyDate(startMs)}</p>
      <table>
        <thead>
          <tr>
            <th />
            <th>{names[a]}</th>
            <th>{names[b]}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="sun">
            <td>Sunlight</td>
            <td className="num">{cell(ra?.sunPct)}</td>
            <td className="num">{cell(rb?.sunPct)}</td>
          </tr>
          <tr className="earth">
            <td>Earth in view</td>
            <td className="num">{cell(ra?.earthPct)}</td>
            <td className="num">{cell(rb?.earthPct)}</td>
          </tr>
          <tr className="both">
            <td>Both</td>
            <td className="num">{cell(ra?.bothPct)}</td>
            <td className="num">{cell(rb?.bothPct)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function initialShot(q: URLSearchParams): ShotId {
  const ch = q.get('ch')
  if (isShot(ch)) return ch
  if (ch === 'crash') return 'site'
  return 'moon'
}

// ---- Real planning tools (data from web/scripts/gen-real-data.mts) ----------------------------

const csvCell = (v: string | number) => {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function saveCsv(name: string, lines: (string | number)[][]) {
  const blob = new Blob([lines.map((l) => l.map(csvCell).join(',')).join('\n') + '\n'], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

/** One coloured stripe per day for the next N days: green both, amber Sun only, blue Earth only, dark neither. */
function DayStripe({ series, startIdx, days }: { series: SeriesFile; startIdx: number; days: number }) {
  const all = useMemo(() => dailySummaries(series), [series])
  const d0 = Math.floor(startIdx / 24)
  const slice = all.slice(d0, d0 + days)
  return (
    <div className="mm-stripe" role="img" aria-label={`Day by day for the next ${days} days: sunlight and Earth in view`}>
      {slice.map((d, i) => (
        <span key={i} className={'d-' + d.state} title={`Day ${i + 1}: Sun ${Math.round(d.sun * 100)}% · Earth ${Math.round(d.earth * 100)}%`} />
      ))}
    </div>
  )
}

const METRICS: { key: keyof WindowStats; label: string; unit: string; lower?: boolean; tone?: string }[] = [
  { key: 'sunPct', label: 'Sunlight', unit: '%', tone: 'sun' },
  { key: 'longestDarkH', label: 'Longest night', unit: 'h', lower: true },
  { key: 'earthPct', label: 'Earth in view', unit: '%', tone: 'earth' },
  { key: 'longestNoEarthH', label: 'Longest silence', unit: 'h', lower: true },
  { key: 'bothPct', label: 'Sun + Earth', unit: '%', tone: 'both' },
]

/** Loads one site's series and reports its stats for the window (hooks stay per site). */
function StatsProbe({ id, startMs, days, onStats }: { id: string; startMs: number; days: number; onStats: (id: string, s: WindowStats | null) => void }) {
  const s = useSeries(id, YEAR).data
  useEffect(() => {
    onStats(id, s ? windowStats(s, startMs, days) : null)
  }, [id, s, startMs, days, onStats])
  return null
}

/** Up to four regions side by side over `days` days from the ground clock's date. Best value per row in green. */
function CompareMany({ ids, startMs, days, names }: { ids: string[]; startMs: number; days: number; names: Record<string, string> }) {
  const [stats, setStats] = useState<Record<string, WindowStats | null>>({})
  const onStats = useCallback((id: string, s: WindowStats | null) => setStats((p) => (p[id] === s ? p : { ...p, [id]: s })), [])
  const fmt = (v: number | undefined, unit: string) => (v == null ? '…' : unit === '%' ? `${Math.round(v)}%` : `${Math.round(v)} h`)
  return (
    <div className="mm-compare mm-compare-many">
      {ids.map((id) => (
        <StatsProbe key={id} id={id} startMs={startMs} days={days} onStats={onStats} />
      ))}
      <table>
        <thead>
          <tr>
            <th />
            {ids.map((id) => (
              <th key={id}>{names[id]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {METRICS.map((m) => {
            const vals = ids.map((id) => stats[id]?.[m.key] as number | undefined)
            const known = vals.filter((v): v is number => v != null)
            const best = known.length ? (m.lower ? Math.min(...known) : Math.max(...known)) : null
            const tie = known.length > 1 && known.every((v) => Math.abs(v - known[0]) < 0.5)
            return (
              <tr key={m.key} className={m.tone}>
                <td>{m.label}</td>
                {vals.map((v, i) => (
                  <td key={ids[i]} className={'num' + (!tie && best != null && v != null && Math.abs(v - best) < 1e-9 ? ' best' : '')}>
                    {fmt(v, m.unit)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function Mission() {
  const reduce = useReducedMotion()
  const mock = useMockFlag()
  const sites = useSites()
  const winFile = useWindows().data
  const [days, setDays] = useState<6 | 14>(6)
  const [planIds, setPlanIds] = useState<string[]>(['malapert-massif', 'haworth', 'mons-mouton-plateau'])
  const [terrain, setTerrain] = useState<PoleTerrain | null>(null)
  // ?ch=pole&site=haworth opens a shot directly (shareable, and used to record the video).
  const q = useMemo(() => new URLSearchParams(window.location.search), [])
  const [chapter, setChapter] = useState<ShotId>(() => initialShot(q))
  const ci = ORDER.indexOf(chapter)
  const [siteId, setSiteId] = useState<string>(() => q.get('site') ?? 'malapert-massif')
  const [compare, setCompare] = useState<[string, string] | null>(null)
  const site = sites.data?.sites.find((s) => s.id === siteId) ?? sites.data?.sites[0]
  const names = useMemo(() => Object.fromEntries((sites.data?.sites ?? []).map((s) => [s.id, s.name])), [sites.data])
  const series = useSeries(site?.id, YEAR).data
  // ?clean hides all interface (video capture); ?t=<hour of year> sets the ground time.
  const clean = q.has('clean')
  const ground = useMemo(() => createClock(q.get('t') ? Number(q.get('t')) : 24 * 59), [q])
  const crashClock = useMemo(() => createClock(0), [])
  const [playing, setPlaying] = useState(!clean)
  const [soundOn, setSoundOn] = useState(false)
  const survival = useSurvival(chapter === 'crash' ? site?.id : undefined).data
  const landers = useMemo(() => survival?.ghost_landers_sample ?? [], [survival])
  const [dropAt, setDropAt] = useState(0)
  const sound = useRef<Soundscape | null>(null)
  const light = useRef<Light>({ dir: { x: 1, y: 0.25, z: 0.3 } })
  const earthDir = useRef({ x: -0.3, y: 0.15, z: -1 })
  const flying = useSyncExternalStore(camBus.subscribe, camBus.isFlying)

  useEffect(() => {
    loadPoleTerrain().then(setTerrain)
  }, [])

  // The lander's "Launch the ascent stage" button (SpaceExtras) rings a soft low bell.
  useEffect(() => {
    const h = () => sound.current?.thud()
    window.addEventListener('lastlight:launch', h)
    return () => window.removeEventListener('lastlight:launch', h)
  }, [])

  // In-app links to "/?ch=…" (top bar, old routes) land on the shot they name.
  const loc = useLocation()
  const firstLoc = useRef(loc.key)
  useEffect(() => {
    if (loc.key === firstLoc.current) return
    const p = new URLSearchParams(loc.search)
    const c = p.get('ch')
    setChapter(isShot(c) ? c : 'moon')
    const sid = p.get('site')
    if (sid) setSiteId(sid)
  }, [loc.key, loc.search])

  useEffect(() => {
    rememberMission(`/?ch=${chapter}${chapter === 'site' || chapter === 'crash' ? `&site=${siteId}` : ''}`)
  }, [chapter, siteId])

  const go = useCallback((c: ShotId) => {
    setCompare(null)
    setChapter(c)
    sound.current?.whoosh()
  }, [])

  // Scroll scrubbing: the wheel (or a swipe) moves the camera along the path to the next shot
  // in real time. Let go past a third of the way and it lands there; otherwise it springs back.
  const scrub = useRef<Scrub>({ current: 0 }).current
  const root = useRef<HTMLDivElement>(null)
  const settleTimer = useRef(0)
  const spring = useRef(0)
  const setScrub = useCallback(
    (v: number) => {
      scrub.current = v
      root.current?.style.setProperty('--scrub', String(Math.min(1, Math.abs(v))))
    },
    [scrub],
  )
  useEffect(() => {
    const canGo = (d: number) => ci + d >= 0 && ci + d < ORDER.length
    const commit = (d: number) => {
      window.clearTimeout(settleTimer.current)
      cancelAnimationFrame(spring.current)
      setScrub(0)
      go(ORDER[ci + d])
    }
    const springBack = () => {
      let last = performance.now()
      const tick = (t: number) => {
        const v = scrub.current * Math.exp(-((t - last) / 1000) * 9)
        last = t
        setScrub(Math.abs(v) < 0.002 ? 0 : v)
        if (scrub.current) spring.current = requestAnimationFrame(tick)
      }
      spring.current = requestAnimationFrame(tick)
    }
    const release = () => {
      const v = scrub.current
      const d = Math.sign(v)
      if (Math.abs(v) >= 0.3 && canGo(d)) commit(d)
      else springBack()
    }
    const push = (delta: number) => {
      if (camBus.isFlying()) return
      cancelAnimationFrame(spring.current)
      let v = scrub.current + delta
      // A little rubber band at the first and last shot.
      if (!canGo(1)) v = Math.min(v, 0.06)
      if (!canGo(-1)) v = Math.max(v, -0.06)
      v = Math.max(-1, Math.min(1, v))
      setScrub(v)
      if (Math.abs(v) >= 1) return commit(Math.sign(v))
      window.clearTimeout(settleTimer.current)
      settleTimer.current = window.setTimeout(release, 180)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || camBus.isFlying()) return
      if ((e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') && canGo(1)) commit(1)
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') && canGo(-1)) commit(-1)
    }
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('.mm-panel, .copilot-dock')) return
      push(e.deltaY / (e.deltaMode === 1 ? 24 : 700))
    }
    let touchY: number | null = null
    const onTouchStart = (e: TouchEvent) => {
      touchY = (e.target as HTMLElement).closest('.mm-panel, .copilot-dock, .mm-time') ? null : e.touches[0].clientY
    }
    const onTouchMove = (e: TouchEvent) => {
      if (touchY == null) return
      const y = e.touches[0].clientY
      push((touchY - y) / 420)
      touchY = y
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.clearTimeout(settleTimer.current)
      cancelAnimationFrame(spring.current)
    }
  }, [ci, go, scrub, setScrub])

  // Crash test: the ghosts drop, then two weeks play out. Restart whenever the sample changes.
  useEffect(() => {
    if (chapter !== 'crash' || !landers.length) return
    setDropAt(performance.now())
    crashClock.set(reduce ? CRASH_HOURS : 0)
    setPlaying(!reduce && !clean)
    if (!reduce) sound.current?.thud()
  }, [chapter, landers, reduce, clean, crashClock])

  // One playback loop: advances the ground clock or the crash clock, outside React.
  useEffect(() => {
    if (!playing || reduce || (chapter !== 'site' && chapter !== 'crash')) return
    let raf = 0
    let last = performance.now()
    const loop = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000)
      last = t
      if (chapter === 'site' && series) ground.set((ground.get() + dt * HOURS_PER_SECOND) % series.sun_el.length)
      if (chapter === 'crash' && t - dropAt > DROP_S * 1000) crashClock.set(Math.min(CRASH_HOURS, crashClock.get() + dt * CRASH_HOURS_PER_SECOND))
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [chapter, playing, reduce, series, dropAt, ground, crashClock])

  const crashStartMs = survival ? Date.parse(survival.ghost_window_utc ?? survival.windows[0]?.landing_utc ?? '') : NaN
  const crashH0 = series && Number.isFinite(crashStartMs) ? (crashStartMs - Date.parse(series.t0)) / 3_600_000 : 0

  // Light direction per shot, every frame. Only ground and crash shots claim to be data;
  // between hourly samples the Sun and Earth are interpolated, so they glide instead of jumping.
  useEffect(() => {
    let raf = 0
    const t0 = performance.now()
    const loop = (t: number) => {
      const s = (t - t0) / 1000
      if (chapter === 'moon') {
        light.current.dir = { x: 0.66, y: 0.23, z: -0.66 } // side light: a sharp day/night line across the disc
        earthDir.current = { x: 0, y: 0, z: -1 } // behind the camera: no tiny Earth beside the globe
      } else if ((chapter === 'site' || chapter === 'crash') && site && series) {
        const h = chapter === 'site' ? ground.get() : crashH0 + crashClock.get()
        const { x, z } = siteXZ(site.lat, site.lon)
        light.current.dir = skyDir(x, z, sampleAzAt(series.sun_az, h), sampleAt(series.sun_el, h))
        earthDir.current = skyDir(x, z, sampleAzAt(series.earth_az, h), sampleAt(series.earth_el, h))
      } else if (chapter === 'athena') {
        // Overview lighting (not data): low raking light from the north-east for readable relief.
        light.current.dir = { x: 0.55, y: 0.24, z: -0.8 }
        earthDir.current = { x: 0.2, y: 0.3, z: -1 }
      } else {
        // Overview lighting for the map (not data): a raking light circling slowly at about 14°.
        const a = reduce ? 1 : s * 0.08
        const el = (14 * Math.PI) / 180
        light.current.dir = { x: Math.cos(a) * Math.cos(el), y: Math.sin(el), z: Math.sin(a) * Math.cos(el) }
        earthDir.current = { x: 0.2, y: 0.35, z: -1 }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [chapter, site, series, reduce, ground, crashClock, crashH0])

  // React only hears the clocks when the selected value changes.
  const sunSample = useClock(ground, (v) => Math.floor(v / 6) * 6)
  const idx = useClock(ground, Math.floor)
  const crashH = useClock(crashClock, (v) => Math.floor(v))
  const sunOn = !!series && series.sun_frac[idx] >= VISIBLE_FRAC
  const earthOn = !!series && series.earth_frac[idx] >= VISIBLE_FRAC
  const crashIdx = Math.min((series?.sun_el.length ?? 1) - 1, Math.max(0, Math.floor(crashH0 + crashH)))
  const alive = aliveAt(landers, crashH)

  useEffect(() => {
    if (chapter === 'site') sound.current?.setSun(sunOn)
    else sound.current?.setSun(true)
  }, [sunOn, chapter])

  // Camera framing of any shot (the current one, and its neighbours for scroll scrubbing).
  const shotOf = useCallback(
    (c: ShotId | undefined): Shot | null => {
      if (!c) return null
      if (c === 'moon') return { kind: 'globe' }
      if (c === 'pole' || c === 'verdict' || c === 'plan') return { kind: 'pole' }
      if (c === 'crash') {
        if (!site) return null
        const p = siteXZ(site.lat, site.lon)
        // Look across the ellipse with the Sun behind the camera's shoulder, so the ghosts are lit.
        const i0 = series ? Math.min(series.sun_az.length - 1, Math.max(0, Math.floor(crashH0))) : 0
        const viewAz = series && Number.isFinite(crashStartMs) ? series.sun_az[i0] + 150 : 30
        return { kind: 'crash', x: p.x, z: p.z, viewAz }
      }
      const p = c === 'athena' ? siteXZ(ATHENA.lat, ATHENA.lon) : site ? siteXZ(site.lat, site.lon) : { x: 0, z: 0 }
      // The camera turns slowly with the Sun (sampled every 6 h, followed smoothly by the director).
      const lookAz = c === 'site' && series ? series.sun_az[sunSample] - 22 : 200
      return { kind: 'surface', x: p.x, z: p.z, lookAz }
    },
    [site, series, sunSample, crashStartMs, crashH0],
  )
  const shot = useMemo(() => shotOf(chapter) ?? { kind: 'globe' as const }, [shotOf, chapter])
  // Two neighbouring overview shots share one camera pose: no scrub path between them (a zero-length flight is NaN).
  const samePose = (a: Shot | null, b: Shot) => !!a && a.kind === 'pole' && b.kind === 'pole'
  const prevShot = useMemo(() => {
    const p = shotOf(ORDER[ci - 1])
    return samePose(p, shot) ? null : p
  }, [shotOf, ci, shot])
  const nextShot = useMemo(() => {
    const n = shotOf(ORDER[ci + 1])
    return samePose(n, shot) ? null : n
  }, [shotOf, ci, shot])

  const crash: Crash | null = useMemo(
    () =>
      chapter === 'crash' && site && landers.length
        ? {
            ...siteXZ(site.lat, site.lon),
            landers,
            hour: {
              get current() {
                return crashClock.get()
              },
            },
            dropAt,
          }
        : null,
    [chapter, site, landers, dropAt, crashClock],
  )

  const rows: WindowRow[] = useMemo(() => winFile?.windows[String(days)] ?? [], [winFile, days])
  const badges = useMemo(() => {
    if (chapter === 'verdict') {
      const by: Record<string, number[]> = {}
      for (const r of rows) (by[r.site_id] ??= []).push(r.rank)
      return Object.fromEntries(Object.entries(by).map(([id, r]) => [id, r.map((k) => `#${k}`).join(' ')]))
    }
    if (chapter === 'plan') return Object.fromEntries(planIds.map((id, i) => [id, 'ABCD'[i]]))
    if (compare) return { [compare[0]]: 'A', [compare[1]]: 'B' }
    return undefined
  }, [chapter, rows, compare, planIds])

  const pick = useCallback(
    (s: Site) => {
      // On the Compare shot a pin adds or removes the region; elsewhere it lands on it.
      if (chapter === 'plan') {
        setPlanIds((ids) => (ids.includes(s.id) ? (ids.length > 1 ? ids.filter((x) => x !== s.id) : ids) : ids.length >= 4 ? [...ids.slice(1), s.id] : [...ids, s.id]))
        return
      }
      setSiteId(s.id)
      go('site')
    },
    [go, chapter],
  )

  // The agent's handle on the film: every call is something the user watches happen.
  const controller: FilmController = useMemo(
    () => ({
      async fly(shotId, sid) {
        if (sid) setSiteId(sid)
        setCompare(null)
        setChapter(shotId)
        sound.current?.whoosh()
        await nextFrames()
        await camBus.whenArrived()
      },
      setTime(date) {
        ground.set(hourOfDate(date, `${YEAR}-01-01T00:00:00Z`, 365 * 24))
        setPlaying(false)
      },
      async compare(a, b) {
        setChapter('pole')
        setCompare([a, b])
        await nextFrames()
        await camBus.whenArrived()
      },
      context: () => `${chapter}${chapter === 'site' || chapter === 'crash' ? `:${siteId}` : ''}`,
    }),
    [chapter, siteId, ground],
  )

  const downloadCsv = () =>
    saveCsv(`lastlight-best-${days}-day-windows-${YEAR}.csv`, [
      ['rank', 'site_id', 'site_name', 'landing_utc', 'end_utc', 'sunlight_pct', 'earth_in_view_pct', 'sun_and_earth_pct', 'longest_darkness_h', 'longest_comms_gap_h', 'energy_kwh_per_kw', 'score'],
      ...rows.map((r) => [r.rank, r.site_id, names[r.site_id] ?? r.site_id, r.landing_utc, r.end_utc, r.sun_pct, r.earth_pct, r.both_pct, r.longest_dark_h, r.longest_comm_gap_h, r.energy_kwh_per_kw, r.score]),
    ])

  const downloadSiteCsv = () => {
    if (!series || !site) return
    const t0 = Date.parse(series.t0)
    saveCsv(`lastlight-${site.id}-${YEAR}-hourly.csv`, [
      ['utc', 'sun_az_deg', 'sun_el_deg', 'sun_visible_fraction', 'earth_az_deg', 'earth_el_deg', 'earth_visible_fraction', 'panel_irradiance_wm2'],
      ...series.sun_el.map((_, i) => [
        new Date(t0 + i * series.step_h * 3_600_000).toISOString(),
        series.sun_az[i],
        series.sun_el[i],
        series.sun_frac[i],
        series.earth_az[i],
        series.earth_el[i],
        series.earth_frac[i],
        series.irradiance_wm2[i],
      ]),
    ])
  }

  const togglePlan = (id: string) =>
    setPlanIds((ids) => (ids.includes(id) ? (ids.length > 1 ? ids.filter((x) => x !== id) : ids) : ids.length >= 4 ? [...ids.slice(1), id] : [...ids, id]))

  const toggleSound = () => {
    if (!sound.current) sound.current = new Soundscape()
    if (soundOn) {
      sound.current.stop()
      setSoundOn(false)
    } else {
      sound.current.start()
      setSoundOn(true)
    }
  }

  const utc = series ? new Date(Date.parse(series.t0) + idx * 3_600_000) : null
  const ready = !!terrain && !!sites.data
  const groundStartMs = series ? Date.parse(series.t0) + idx * 3_600_000 : Date.UTC(YEAR, 2, 1)

  return (
    <FilmContext.Provider value={controller}>
      <div ref={root} className={'mm' + (clean ? ' is-clean' : '') + (flying ? ' is-flying' : '')}>
        <div className="mm-stage">
          {ready && (
            <Suspense fallback={null}>
              <MissionScene
                terrain={terrain!}
                sites={sites.data!.sites}
                shot={shot}
                light={light}
                earthDir={earthDir}
                onPick={pick}
                activeSite={chapter === 'site' ? siteId : null}
                showPins={chapter === 'pole' || chapter === 'verdict' || chapter === 'plan'}
                badges={badges}
                athena={chapter === 'athena' ? ATHENA : null}
                crash={crash}
                scrub={scrub}
                prev={prevShot}
                next={nextShot}
              />
            </Suspense>
          )}
          <div className={'mm-veil' + (ready ? ' gone' : '')}>
            <span>Loading the Moon</span>
          </div>
        </div>
        <div className="mm-letterbox" aria-hidden="true" />

          <>
            <div className="mm-top">
              <TopBar
                variant="mission"
                right={
                  <>
                    {mock && <span className="mm-mock">Mock data</span>}
                    <button className="mm-icon" onClick={toggleSound} aria-label={soundOn ? 'Mute' : 'Sound on'} title={soundOn ? 'Mute' : 'Sound on'}>
                      {soundOn ? <SpeakerHigh size={18} weight="regular" /> : <SpeakerSlash size={18} weight="regular" />}
                    </button>
                  </>
                }
              />
            </div>

            <nav className="mm-rail" aria-label="Shots">
              {ORDER.map((c) => (
                <button key={c} className={c === chapter ? 'on' : ''} onClick={() => go(c)}>
                  <span className="bar" />
                  <span className="label">{c === 'site' && site ? site.name : LABEL[c]}</span>
                </button>
              ))}
            </nav>

            <AnimatePresence mode="popLayout">
              <motion.section
                key={chapter + (chapter === 'site' ? siteId : '') + (compare ? 'cmp' : '')}
                className={'mm-panel is-' + chapter}
                initial={reduce ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
                transition={{ duration: 0.8, ease, delay: 0.5 }}
              >
                {compare && (
                  <>
                    <p className="mm-kicker">Side by side</p>
                    <h2>
                      {names[compare[0]]} <span className="mm-vs">or</span> {names[compare[1]]}
                    </h2>
                    <CompareCard a={compare[0]} b={compare[1]} startMs={groundStartMs} names={names} />
                  </>
                )}
                {!compare && chapter === 'moon' && (
                  <>
                    <h1>The Sun never sets here. It never rises either.</h1>
                    <p>At the Moon’s south pole the Sun slides along the horizon. One ridge can switch a lander off for days.</p>
                    <button className="mm-cta" onClick={() => go('pole')}>
                      Go to the pole <ArrowRight size={16} />
                    </button>
                  </>
                )}
                {!compare && chapter === 'pole' && (
                  <>
                    <p className="mm-kicker">Artemis III candidate regions</p>
                    <h2>Nine places to land.</h2>
                    <p>On terrain measured by laser from orbit. Pick one, or watch what happened to the last lander first.</p>
                    <button className="mm-cta" onClick={() => go('athena')}>
                      First, a warning <ArrowRight size={16} />
                    </button>
                  </>
                )}
                {chapter === 'athena' && (
                  <>
                    <p className="mm-kicker">Intuitive Machines IM-2 · 6 March 2025</p>
                    <h2>Athena landed here.</h2>
                    <p>It tipped over in a crater, its panels missed the Sun, and it went silent 13 hours later.</p>
                    <button className="mm-cta" onClick={() => go('site')}>
                      Stand on the ground <ArrowRight size={16} />
                    </button>
                  </>
                )}
                {chapter === 'site' && site && (
                  <>
                    <p className="mm-kicker">On the ground</p>
                    <h2>{site.name}</h2>
                    <div className="mm-readout">
                      <div className={sunOn ? 'sun' : 'off'}>
                        <span>Sun</span>
                        <b>{series ? (sunOn ? 'Visible' : 'Behind terrain') : '…'}</b>
                      </div>
                      <div className={earthOn ? 'earth' : 'off'}>
                        <span>Earth</span>
                        <b>{series ? (earthOn ? 'In view' : 'Hidden') : '…'}</b>
                      </div>
                      <div>
                        <span>Panel power</span>
                        <b className="num">{series ? `${Math.round(series.irradiance_wm2[idx])} W/m²` : '…'}</b>
                      </div>
                    </div>
                    {series && (
                      <div className="mm-ring">
                        <HorizonRing site={site} series={series} idx={idx} />
                      </div>
                    )}
                    {series && (() => {
                      const w = windowStats(series, groundStartMs, 14)
                      return (
                        <div className="mm-next">
                          <p className="mm-kicker mm-sub">Next 14 days from {prettyDate(groundStartMs)}</p>
                          <DayStripe series={series} startIdx={idx} days={14} />
                          <div className="mm-readout mm-five">
                            <div className="sun"><span>Sunlight</span><b className="num">{Math.round(w.sunPct)}%</b></div>
                            <div><span>Longest night</span><b className="num">{Math.round(w.longestDarkH)} h</b></div>
                            <div className="earth"><span>Earth in view</span><b className="num">{Math.round(w.earthPct)}%</b></div>
                            <div><span>Longest silence</span><b className="num">{Math.round(w.longestNoEarthH)} h</b></div>
                            <div className="both"><span>Sun + Earth</span><b className="num">{Math.round(w.bothPct)}%</b></div>
                          </div>
                        </div>
                      )
                    })()}
                    <div className="mm-actions">
                      <button className="mm-cta" onClick={() => { setPlanIds((ids) => (ids.includes(site.id) ? ids : [site.id, ...ids].slice(0, 4))); go('plan') }}>
                        Compare sites <ArrowRight size={16} />
                      </button>
                      <button className="mm-cta ghost" onClick={downloadSiteCsv}>
                        <DownloadSimple size={16} /> Hourly CSV
                      </button>
                      <button className="mm-cta ghost" onClick={() => go('pole')}>
                        Pick another site
                      </button>
                    </div>
                  </>
                )}
                {!compare && chapter === 'plan' && (
                  <>
                    <p className="mm-kicker">Compare · {days} days from {prettyDate(groundStartMs)}</p>
                    <h2>Which region, which date?</h2>
                    <p>Tap the pins, or the names below, to compare up to four regions. Green is the best value in each row.</p>
                    <div className="mm-chips">
                      {(sites.data?.sites ?? []).map((s) => (
                        <button key={s.id} className={planIds.includes(s.id) ? 'on' : ''} onClick={() => togglePlan(s.id)}>
                          {s.name}
                        </button>
                      ))}
                    </div>
                    <div className="mm-seg" role="group" aria-label="Mission length">
                      {([6, 14] as const).map((d) => (
                        <button key={d} className={days === d ? 'on' : ''} onClick={() => setDays(d)}>
                          {d} days
                        </button>
                      ))}
                    </div>
                    <CompareMany ids={planIds} startMs={groundStartMs} days={days} names={names} />
                    <div className="mm-actions">
                      <button className="mm-cta" onClick={() => go('verdict')}>
                        Find the best dates <ArrowRight size={16} />
                      </button>
                    </div>
                  </>
                )}
                {chapter === 'crash' && site && (
                  <>
                    {landers.length > 0 && survival ? (
                      <>
                        <p className="mm-kicker">
                          {site.name} · landing {prettyDate(crashStartMs)}
                        </p>
                        <h2>Land {landers.length} times before anyone flies.</h2>
                        <p>Each mark is one simulated landing: off target and tilted, as real landers are. It turns red when its battery runs out.</p>
                        <div className="mm-readout">
                          <div className={alive / landers.length >= 0.5 ? 'alive' : 'dead'}>
                            <span>Still alive</span>
                            <b className="num">
                              {alive} / {landers.length}
                            </b>
                          </div>
                          <div>
                            <span>Since landing</span>
                            <b className="num">day {Math.floor(crashH / 24)}</b>
                          </div>
                          <div className={series && series.sun_frac[crashIdx] >= VISIBLE_FRAC ? 'sun' : 'off'}>
                            <span>Sun</span>
                            <b>{series ? (series.sun_frac[crashIdx] >= VISIBLE_FRAC ? 'Visible' : 'Behind terrain') : '…'}</b>
                          </div>
                        </div>
                        <Survival landers={landers} hour={crashH} />
                        <div className="mm-actions">
                          <button className="mm-cta" onClick={() => go('verdict')}>
                            See the safest windows <ArrowRight size={16} />
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <h2>No crash test for {site.name} yet.</h2>
                        <p>The landing simulation for this site has not been computed. Pick another site to watch it.</p>
                        <button className="mm-cta ghost" onClick={() => go('pole')}>
                          Pick another site
                        </button>
                      </>
                    )}
                  </>
                )}
                {chapter === 'verdict' && (
                  <>
                    <p className="mm-kicker">{winFile ? `${winFile.year} · every landing time at every region, ranked` : 'Loading'}</p>
                    <h2>The best landing windows.</h2>
                    <div className="mm-seg" role="group" aria-label="Mission length">
                      {([6, 14] as const).map((d) => (
                        <button key={d} className={days === d ? 'on' : ''} onClick={() => setDays(d)}>
                          {d}-day mission{d === 6 ? ' (Artemis III)' : ''}
                        </button>
                      ))}
                    </div>
                    <div className="mm-verdict-head">
                      <span>#</span>
                      <span>Region</span>
                      <span>Landing (UTC)</span>
                      <span>Sun</span>
                      <span>Earth</span>
                    </div>
                    <ol className="mm-verdict">
                      {rows.map((r) => (
                        <li key={r.rank}>
                          <button
                            title={`Stand on the ground on this date · longest night ${r.longest_dark_h} h · longest silence ${r.longest_comm_gap_h} h`}
                            onClick={() => {
                              setSiteId(r.site_id)
                              ground.set(hourOfDate(r.landing_utc.slice(0, 10), `${YEAR}-01-01T00:00:00Z`, 365 * 24))
                              setPlaying(false)
                              go('site')
                            }}
                          >
                            <span className="num rank">{String(r.rank).padStart(2, '0')}</span>
                            <span className="name">{names[r.site_id] ?? r.site_id}</span>
                            <span className="num date">{r.landing_utc.slice(0, 16).replace('T', ' ')}</span>
                            <span className="num p">{Math.round(r.sun_pct)}%</span>
                            <span className="num slip">{Math.round(r.earth_pct)}%</span>
                          </button>
                        </li>
                      ))}
                    </ol>
                    <p className="mm-fine">Score: sunlight % + 0.5 × Earth-in-view % − 2 × longest night (h). Terrain horizons from NASA LOLA; each region is one point (its highest ground).</p>
                    <div className="mm-actions">
                      <button className="mm-cta ghost" onClick={downloadCsv} disabled={!rows.length}>
                        <DownloadSimple size={16} /> Export CSV
                      </button>
                    </div>
                  </>
                )}
              </motion.section>
            </AnimatePresence>

            {chapter === 'site' && series && utc && (
              <div className="mm-time">
                <button className="mm-icon" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'}>
                  {playing ? <Pause size={16} weight="fill" /> : <Play size={16} weight="fill" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={series.sun_el.length - 1}
                  value={idx}
                  onChange={(e) => {
                    setPlaying(false)
                    ground.set(Number(e.target.value))
                  }}
                  aria-label="Time"
                />
                <span className="num">
                  {utc.toISOString().slice(0, 10)} {utc.toISOString().slice(11, 16)} UTC
                </span>
              </div>
            )}

            {chapter === 'crash' && landers.length > 0 && (
              <div className="mm-time">
                <button
                  className="mm-icon"
                  onClick={() => {
                    if (crashH >= CRASH_HOURS) {
                      crashClock.set(0)
                      setPlaying(true)
                    } else setPlaying((p) => !p)
                  }}
                  aria-label={playing && crashH < CRASH_HOURS ? 'Pause' : 'Play'}
                >
                  {playing && crashH < CRASH_HOURS ? <Pause size={16} weight="fill" /> : <Play size={16} weight="fill" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={CRASH_HOURS}
                  value={crashH}
                  onChange={(e) => {
                    setPlaying(false)
                    crashClock.set(Number(e.target.value))
                  }}
                  aria-label="Hours since landing"
                />
                <span className="num">day {(crashH / 24).toFixed(1)} of 14</span>
              </div>
            )}

            <p className="mm-note">
              {chapter === 'crash'
                ? 'Ghost landers drawn 3× real size; positions and failures from the landing simulation. Relief ×2.5, real LOLA terrain.'
                : chapter === 'site'
                  ? 'Sun and Earth: our ephemeris, checked against NASA JPL Horizons (max 0.004°). Horizon: NASA LOLA terrain (474 m grid). Relief ×2.5 is visual only.'
                  : chapter === 'plan' || chapter === 'verdict'
                    ? 'Real hourly Sun and Earth data for 2027 from our validated ephemeris, against NASA LOLA terrain horizons.'
                  : chapter === 'moon'
                    ? 'LROC colour, LOLA relief: NASA SVS CGI Moon Kit.'
                    : 'Relief ×2.5, overview lighting. Terrain and colour: LRO (LOLA, LROC), NASA SVS CGI Moon Kit.'}
            </p>
            {!clean && <Copilot />}
          </>
      </div>
    </FilmContext.Provider>
  )
}
