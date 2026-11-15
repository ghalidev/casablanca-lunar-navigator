import * as THREE from 'three'
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { loadSurvival } from '../data/load'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowLeft, ArrowRight, CaretDown, CaretLeft, CaretRight, CaretUp, DownloadSimple, Pause, Play, SpeakerHigh, SpeakerSlash } from '@phosphor-icons/react'
import { useGhostDay, useSeries, useSites, useMockFlag, useSurvival, useTop10 } from '../data/hooks'
import { VISIBLE_FRAC, windowStats } from '../data/stats'
import { loadPoleTerrain, siteXZ, skyDir, type PoleTerrain } from './terrain'
import type { Crash, Light, Scrub, Shot } from './MissionScene'
import { Soundscape } from './sound'
import { Copilot } from '../copilot/Copilot'
import { TopBar } from '../components/TopBar'
import { HorizonRing } from '../components/HorizonRing'
import { prettyDate } from '../lib/geo'
import { DEFAULT_PLAN, getPlan, inFilmYear, setPlan } from '../lib/plan'
import type { GhostLander, SeriesFile, Site } from '../data/types'
import { LABEL, ORDER, isShot, type ShotId } from '../film/shots'
import { createClock, hourOfDate, sampleAt, sampleAzAt } from '../film/clock'
import { FilmContext, useClock, type FilmController } from '../film/controller'
import { camBus } from '../film/bus'
import { ranksBySite, toCsv, verdictRows } from '../film/verdict'
import { CompareBars, DayTrack, SurvivalChart, YearLabels, YearStrip, dayOfIso, heat, useSurvivalAll } from './charts'
import './mission.css'

// Start downloading the 3D code as soon as this page's code runs, in parallel with the terrain (not after it).
const sceneChunk = import('./MissionScene')
const MissionScene = lazy(() => sceneChunk.then((m) => ({ default: m.MissionScene })))

const CRASH_HOURS = 14 * 24
const CRASH_HOURS_PER_SECOND = 24 // two weeks in 14 seconds
const DROP_S = 2.6 // the ghosts fall in before the clock starts
const YEAR = 2027
const HOURS_PER_SECOND = 6 // one lunar day in about two minutes
// Athena (IM-2) touchdown, secondary source (see docs/data-sources.md); confirmed against LROC before submission.
const ATHENA = { lat: -84.7906, lon: 29.1957 }
const ease = [0.32, 0.72, 0, 1] as const
const nextFrames = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

const aliveAt = (landers: GhostLander[], h: number) => landers.filter((l) => l.died_at_h == null || l.died_at_h > h).length

/** Two regions side by side, 14 days from the ground clock's date. Numbers from the series files. */
function CompareCard({ a, b, startMs, names, pa, pb }: { a: string; b: string; startMs: number; names: Record<string, string>; pa?: number; pb?: number }) {
  const sa = useSeries(a, YEAR).data
  const sb = useSeries(b, YEAR).data
  const row = (s: SeriesFile | null | undefined) => (s ? windowStats(s, startMs, 14) : null)
  const ra = row(sa), rb = row(sb)
  const pct = (v?: number) => (v == null ? undefined : v * 100)
  return (
    <div className="mm-compare">
      <p className="mm-kicker">Landing on {prettyDate(startMs)}, 14 days</p>
      <CompareBars
        nameA={names[a]}
        nameB={names[b]}
        rows={[
          { label: 'Survives', color: '#ffb547', a: pct(pa), b: pct(pb) },
          { label: 'Sunlight', color: '#ffb547', a: ra?.sunPct, b: rb?.sunPct },
          { label: 'Earth in view', color: '#d8dbe2', a: ra?.earthPct, b: rb?.earthPct },
        ]}
      />
      <dl className="mm-facts">
        <div>
          <dt>Longest night</dt>
          <dd className="num">{ra ? `${Math.round(ra.longestDarkH)} h` : '…'}</dd>
          <dd className="num">{rb ? `${Math.round(rb.longestDarkH)} h` : '…'}</dd>
        </div>
        <div>
          <dt>Longest silence from Earth</dt>
          <dd className="num">{ra ? `${Math.round(ra.longestNoEarthH)} h` : '…'}</dd>
          <dd className="num">{rb ? `${Math.round(rb.longestNoEarthH)} h` : '…'}</dd>
        </div>
      </dl>
    </div>
  )
}

function initialShot(q: URLSearchParams): ShotId {
  const ch = q.get('ch')
  if (isShot(ch)) return ch
  if (ch === 'plan') return 'verdict'
  return 'moon'
}

/** The loading screen tells the whole story in one loop: the polar Sun skimming the horizon, slipping behind peaks.
 * The percentage is real: three.js's loading manager counts the terrain, textures and models as they arrive. */
function Loader() {
  const [pct, setPct] = useState(0)
  useEffect(() => {
    const m = THREE.DefaultLoadingManager
    const prev = m.onProgress
    m.onProgress = (url, loaded, total) => {
      setPct(total ? Math.round((100 * loaded) / total) : 0)
      prev?.(url, loaded, total)
    }
    return () => {
      m.onProgress = prev
    }
  }, [])
  return (
    <div className="mm-loading">
      <svg className="mm-loader" viewBox="0 0 220 80" aria-hidden="true">
        <defs>
          <radialGradient id="mmGlow">
            <stop offset="0" stopColor="#ffb547" stopOpacity="0.55" />
            <stop offset="1" stopColor="#ffb547" stopOpacity="0" />
          </radialGradient>
        </defs>
        <line className="hz" x1="0" y1="58" x2="220" y2="58" />
        <g className="sun">
          <circle r="22" fill="url(#mmGlow)" />
          <circle r="7" fill="#ffb547" />
        </g>
        <path className="ridge" d="M0 80 V60 L24 54 L40 57 L58 44 L74 50 L92 41 L110 52 L128 47 L146 55 L162 46 L180 53 L198 50 L220 58 V80 Z" />
        <path className="crest" d="M0 60 L24 54 L40 57 L58 44 L74 50 L92 41 L110 52 L128 47 L146 55 L162 46 L180 53 L198 50 L220 58" />
      </svg>
      <span className="num">Loading the Moon{pct > 0 && pct < 100 ? ` · ${pct}%` : ''}</span>
    </div>
  )
}

export function Mission() {
  const reduce = useReducedMotion()
  const mock = useMockFlag()
  const sites = useSites()
  const top10 = useTop10().data
  const [terrain, setTerrain] = useState<PoleTerrain | null>(null)
  // ?ch=pole&site=haworth opens a shot directly (shareable, and used to record the video).
  const q = useMemo(() => new URLSearchParams(window.location.search), [])
  const [chapter, setChapter] = useState<ShotId>(() => initialShot(q))
  const ci = ORDER.indexOf(chapter)
  // The shared plan (lib/plan.ts) fills in what the link leaves out, when its day is one the film can show.
  const stored = useMemo(() => {
    const p = getPlan()
    return p && inFilmYear(p.date) ? p : null
  }, [])
  const [siteId, setSiteId] = useState<string>(() => q.get('site') ?? stored?.site ?? 'malapert-massif')
  // True once the visitor changes the day or the region here (then the film's plan wins over an older one).
  const touched = useRef(false)
  const [compare, setCompare] = useState<[string, string] | null>(null)
  // Compare mode on the pole: tap two sites. `cmpFirst` is the first one tapped (shown as A).
  const [cmpMode, setCmpMode] = useState(false)
  const [cmpFirst, setCmpFirst] = useState<string | null>(null)
  const site = sites.data?.sites.find((s) => s.id === siteId) ?? sites.data?.sites[0]
  const names = useMemo(() => Object.fromEntries((sites.data?.sites ?? []).map((s) => [s.id, s.name])), [sites.data])
  const siteIdList = useMemo(() => (sites.data?.sites ?? []).map((x) => x.id), [sites.data])
  // ?gy=2028..2030 shows the ground shot in another year of the pipeline's series (the Planner embeds it).
  const groundYear = (() => {
    const g = Number(q.get('gy'))
    return g >= 2027 && g <= 2030 ? g : YEAR
  })()
  const series = useSeries(site?.id, groundYear).data
  // ?clean hides all interface (video capture, Planner embed); ?t=<hour of year> sets the ground time; ?play runs it.
  const clean = q.has('clean')
  // Start the ground clock on the linked day (or 1 March): it must never overwrite the date of a shared link.
  const ground = useMemo(() => {
    if (q.get('t')) return createClock(Number(q.get('t')))
    const qd = q.get('date') ?? stored?.date
    const d = qd ? dayOfIso(`${qd}T00:00:00Z`) : NaN
    return createClock(Number.isFinite(d) && d >= 0 && d < 365 ? d * 24 + 12 : dayOfIso(`${DEFAULT_PLAN.date}T00:00:00Z`) * 24 + 12)
  }, [q])
  const crashClock = useMemo(() => createClock(0), [])
  const [playing, setPlaying] = useState(!clean || q.has('play'))
  const [soundOn, setSoundOn] = useState(false)
  // The story has one thread: pick a day on the pole, the film tests the best site that day, then
  // stands on it. `userPicked` means a pin was clicked; otherwise the best site of the day is used.
  // ?date=YYYY-MM-DD (in the shipped year) makes a shared link land on the same landing day.
  const [pickDay, setPickDay] = useState(() => {
    const d = q.get('date') ?? stored?.date
    const day = d ? dayOfIso(`${d}T00:00:00Z`) : NaN
    return Number.isFinite(day) && day >= 0 && day < 365 ? day : dayOfIso(`${DEFAULT_PLAN.date}T00:00:00Z`)
  })
  const survival = useSurvival(chapter === 'crash' ? site?.id : undefined).data
  // The crash test replays the picked day: 1,000 simulated landings, the same draws as the pole's percentage.
  // Older data ships only the site's best day (`ghost_window_utc`); then the picked day moves there, said on screen.
  const dayGhosts = useGhostDay(chapter === 'crash' ? site?.id : undefined, YEAR, pickDay)
  const ghostDay = survival?.ghost_window_utc ? dayOfIso(survival.ghost_window_utc) : null
  const allLanders = useMemo(() => dayGhosts ?? (dayGhosts === null ? survival?.ghost_landers_sample ?? [] : []), [dayGhosts, survival])
  const crashDay = dayGhosts ? pickDay : ghostDay
  // What-if: a lander that can only take `tiltMax` degrees of tilt fails on touchdown beyond it.
  // 90 = the simulation as computed. Lower values only filter the same simulated landings.
  const [tiltMax, setTiltMax] = useState(90)
  useEffect(() => setTiltMax(90), [survival])
  const landers = useMemo(() => (tiltMax >= 90 ? allLanders : allLanders.map((l) => (l.tilt_deg > tiltMax ? { ...l, died_at_h: 0 } : l))), [allLanders, tiltMax])
  const tiltNeeded = useMemo(() => {
    if (!allLanders.length) return null
    const need = Math.ceil(0.95 * allLanders.length)
    const base = allLanders.filter((l) => l.died_at_h == null || l.died_at_h > CRASH_HOURS - 1)
    if (base.length < need) return -1
    return Math.ceil(base.map((l) => l.tilt_deg).sort((a, b) => a - b)[need - 1])
  }, [allLanders])
  const [dropAt, setDropAt] = useState(0)
  const sound = useRef<Soundscape | null>(null)
  const light = useRef<Light>({ dir: { x: 1, y: 0.25, z: 0.3 } })
  const earthDir = useRef({ x: -0.3, y: 0.15, z: -1 })
  const flying = useSyncExternalStore(camBus.subscribe, camBus.isFlying)

  const userPicked = useRef(!!q.get('site') || !!stored)
  const surv = useSurvivalAll(siteIdList, chapter === 'pole' || chapter === 'crash' || chapter === 'verdict')
  const bestOfDay = useMemo(() => {
    let b: { id: string; p: number; slip: number } | null = null
    for (const id of siteIdList) {
      const v = surv[id]?.get(pickDay)
      if (v && (!b || v.p > b.p || (v.p === b.p && v.slip > b.slip))) b = { id, p: v.p, slip: v.slip }
    }
    return b
  }, [surv, pickDay, siteIdList])
  // The film opens on the best region of the opening day, once. After that the region is yours:
  // changing the date never swaps it behind your back.
  useEffect(() => {
    if (!userPicked.current && bestOfDay) {
      setSiteId(bestOfDay.id)
      userPicked.current = true
    }
  }, [bestOfDay])
  const tones = useMemo(
    () => (chapter === 'pole' ? Object.fromEntries(siteIdList.flatMap((id) => { const v = surv[id]?.get(pickDay); return v ? [[id, v.p]] : [] })) : undefined),
    [chapter, siteIdList, surv, pickDay],
  )
  const pickMs = Date.UTC(YEAR, 0, 1) + pickDay * 86_400_000
  // Fallback for data without per-day ghosts: the sample belongs to one day, so the picked day moves there
  // and the panel says so. With per-day ghosts the picked day never changes here.
  useEffect(() => {
    if (chapter === 'crash' && dayGhosts === null && ghostDay != null && ghostDay >= 0 && ghostDay < 365) setPickDay(ghostDay)
  }, [chapter, dayGhosts, ghostDay])
  useEffect(() => {
    if (!q.has('t')) ground.set(pickDay * 24 + 12)
  }, [pickDay, ground, q])
  // Start on the best window of the whole dataset (rank 1) unless the link says otherwise.
  // Embedded in the Planner (?clean): the parent page drives the ground clock, hour by hour.
  useEffect(() => {
    if (!clean) return
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      const d = e.data as { type?: string; t?: number }
      if (d?.type === 'll:t' && typeof d.t === 'number' && Number.isFinite(d.t)) ground.set(Math.max(0, d.t))
    }
    window.addEventListener('message', onMsg)
    window.parent?.postMessage({ type: 'll:ready' }, window.location.origin)
    return () => window.removeEventListener('message', onMsg)
  }, [clean, ground])

  // Capture hook for the video: ?clean lets a script drive the picked day.
  useEffect(() => {
    if (clean) (window as unknown as { __ll?: unknown }).__ll = { setDay: (d: number) => setPickDay(Math.max(0, Math.min(364, Math.round(d)))) }
  }, [clean])
  const startDone = useRef(false)
  useEffect(() => {
    if (startDone.current || !top10 || q.get('site') || q.get('date') || stored) return
    // The ground series covers 2027: start on the best ranked window that falls in that year.
    const first = [...top10.windows].sort((a, b) => a.rank - b.rank).find((w) => w.landing_utc.startsWith(String(YEAR)))
    if (first) {
      startDone.current = true
      setPickDay(Math.max(0, Math.min(364, dayOfIso(first.landing_utc))))
    }
  }, [top10, q])

  // Safety net: a flight never leaves the interface hidden for more than a few seconds.
  useEffect(() => {
    if (!flying) return
    const t = window.setTimeout(() => camBus.setFlying(false), 7000)
    return () => window.clearTimeout(t)
  }, [flying])

  useEffect(() => {
    loadPoleTerrain().then(setTerrain)
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
    const d = p.get('date') ? dayOfIso(`${p.get('date')}T00:00:00Z`) : NaN
    if (Number.isFinite(d) && d >= 0 && d < 365) setPickDay(d)
  }, [loc.key, loc.search])

  // The address bar follows the film (replace, never push), so reload and share land on the same shot.
  useEffect(() => {
    if (clean) return
    const u = new URL(window.location.href)
    u.searchParams.set('ch', chapter)
    // Keep the chosen region and day from the pole onwards (verdict included), so a shared link never loses them.
    // The Moon and Athena shots come before any choice: they carry neither.
    if (chapter === 'moon' || chapter === 'athena') {
      u.searchParams.delete('site')
      u.searchParams.delete('date')
    } else {
      u.searchParams.set('site', siteId)
      u.searchParams.set('date', new Date(pickMs).toISOString().slice(0, 10))
    }
    window.history.replaceState(null, '', u)
    // Share the plan with the Planner, unless it holds a 2028–2030 day the visitor has not changed here.
    const prev = getPlan()
    if (touched.current || !prev || inFilmYear(prev.date) || (chapter !== 'moon' && chapter !== 'athena' && q.get('date')))
      setPlan({ site: siteId, date: new Date(pickMs).toISOString().slice(0, 10) })
  }, [chapter, siteId, clean, pickMs])

  // One landing day drives the whole film: the pole's lights, the crash test and the ground clock.
  const moveDay = (d: number) => {
    if (!Number.isFinite(d)) return
    touched.current = true
    const day = Math.max(0, Math.min(364, Math.round(d)))
    setPickDay(day)
    ground.set(day * 24)
  }

  const go = useCallback((c: ShotId) => {
    setCompare(null)
    setCmpMode(false)
    setCmpFirst(null)
    setChapter(c)
    sound.current?.whoosh()
  }, [])

  // Scroll scrubbing: the wheel (or a swipe) moves the camera along the path to the next shot
  // in real time. Let go past a fifth of the way (one mouse-wheel notch) and it lands there; otherwise it springs back.
  const scrub = useRef<Scrub>({ current: 0 }).current
  const root = useRef<HTMLDivElement>(null)
  const settleTimer = useRef(0)
  const spring = useRef(0)
  const gestureLock = useRef(false)
  const unlockTimer = useRef(0)
  const setScrub = useCallback(
    (v: number) => {
      scrub.current = v
      root.current?.style.setProperty('--scrub', String(Math.min(1, Math.abs(v))))
    },
    [scrub],
  )
  useEffect(() => {
    const canGo = (d: number) => ci + d >= 0 && ci + d < ORDER.length
    // One gesture = one shot. A trackpad keeps sending wheel events for a second or more after the fingers
    // lift (inertia); without this lock that tail scrubs straight into the next shot, and the next.
    const lockGesture = () => {
      gestureLock.current = true
      window.clearTimeout(unlockTimer.current)
      unlockTimer.current = window.setTimeout(() => (gestureLock.current = false), 420)
    }
    const commit = (d: number) => {
      lockGesture()
      window.clearTimeout(settleTimer.current)
      cancelAnimationFrame(spring.current)
      // Hide the interface in the same render as the shot change (no one-frame flash of the old text),
      // and leave scrub.current alone: the camera reads it to finish the same path, then clears it.
      camBus.setFlying(true)
      root.current?.style.setProperty('--scrub', '0')
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
      if (Math.abs(v) >= 0.2 && canGo(d)) commit(d)
      else springBack()
    }
    const push = (delta: number) => {
      if (gestureLock.current) return lockGesture() // still the same gesture: extend the lock
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
      push(e.deltaY / (e.deltaMode === 1 ? 16 : 480))
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
    // Embedded (?clean): the page around it owns the scroll; only the keyboard can change shot.
    if (!clean) {
      window.addEventListener('wheel', onWheel, { passive: true })
      window.addEventListener('touchstart', onTouchStart, { passive: true })
      window.addEventListener('touchmove', onTouchMove, { passive: true })
    }
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.clearTimeout(settleTimer.current)
      cancelAnimationFrame(spring.current)
    }
  }, [ci, go, scrub, setScrub, clean])

  // Crash test: the ghosts drop, then two weeks play out. Restart whenever the sample changes.
  useEffect(() => {
    if (chapter !== 'crash' || !allLanders.length) return
    setDropAt(performance.now())
    crashClock.set(reduce ? CRASH_HOURS : 0)
    setPlaying(!reduce && (!clean || q.has('play')))
    if (!reduce) sound.current?.thud()
  }, [chapter, allLanders, reduce, clean, crashClock])

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

  const finalPct = useMemo(() => (allLanders.length ? Math.round((100 * allLanders.filter((l) => l.died_at_h == null).length) / allLanders.length) : 0), [allLanders])
  const crashStartMs = crashDay != null ? Date.UTC(YEAR, 0, 1) + crashDay * 86_400_000 : NaN
  const crashH0 = series && Number.isFinite(crashStartMs) ? (crashStartMs - Date.parse(series.t0)) / 3_600_000 : 0

  // Light direction per shot, every frame. Only ground and crash shots claim to be data;
  // between hourly samples the Sun and Earth are interpolated, so they glide instead of jumping.
  useEffect(() => {
    let raf = 0
    const t0 = performance.now()
    let last = t0
    // Every shot sets a target; the light glides to it, so it never snaps when the camera changes shot.
    const glide = (want: { x: number; y: number; z: number }, dt: number) => {
      const c = light.current.dir
      const k = reduce ? 1 : 1 - Math.exp(-dt * 5)
      const x = c.x + (want.x - c.x) * k, y = c.y + (want.y - c.y) * k, z = c.z + (want.z - c.z) * k
      const n = Math.hypot(x, y, z) || 1
      light.current.dir = { x: x / n, y: y / n, z: z / n }
    }
    const loop = (t: number) => {
      const s = (t - t0) / 1000
      const dt = Math.min(0.1, (t - last) / 1000)
      last = t
      const set = (d: { x: number; y: number; z: number }) => glide(d, dt)
      if (chapter === 'moon') {
        set({ x: 0.98, y: 0.06, z: -0.17 }) // light from the side: a half Moon, craters raised along the day/night line
        earthDir.current = { x: 0, y: 0, z: -1 } // behind the camera: no tiny Earth beside the globe
      } else if ((chapter === 'site' || chapter === 'crash') && site && series) {
        const h = chapter === 'site' ? ground.get() : crashH0 + crashClock.get()
        const { x, z } = siteXZ(site.lat, site.lon)
        set(skyDir(x, z, sampleAzAt(series.sun_az, h), sampleAt(series.sun_el, h)))
        earthDir.current = skyDir(x, z, sampleAzAt(series.earth_az, h), sampleAt(series.earth_el, h))
      } else if (chapter === 'athena') {
        // Overview lighting (not data): low raking light from the north-east for readable relief.
        set({ x: 0.55, y: 0.24, z: -0.8 })
        earthDir.current = { x: 0.2, y: 0.3, z: -1 }
      } else {
        // Overview lighting for the map (not data): a low raking light circling slowly at 7°, as at the pole
        // (the real Sun never climbs above ~1.5°; 7° keeps the relief readable).
        const a = reduce ? 1 : s * 0.05
        const el = (7 * Math.PI) / 180
        set({ x: Math.cos(a) * Math.cos(el), y: Math.sin(el), z: Math.sin(a) * Math.cos(el) })
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
  // One clock for the whole film. On the ground the time runs; the landing day (top bar, pole lights,
  // day track, crash test) follows it. Arriving on the ground starts the clock at the landing day.
  const groundDay = useClock(ground, (v) => Math.floor(v / 24))
  useEffect(() => {
    if (chapter !== 'site' || groundYear !== YEAR) return
    if (groundDay !== pickDay && groundDay >= 0 && groundDay < 365) setPickDay(groundDay)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groundDay])
  useEffect(() => {
    if (chapter === 'site' && groundYear === YEAR && Math.floor(ground.get() / 24) !== pickDay) ground.set(pickDay * 24)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter])
  const crashH = useClock(crashClock, (v) => Math.floor(v))
  const sunOn = !!series && series.sun_frac[idx] >= VISIBLE_FRAC
  const earthOn = !!series && series.earth_frac[idx] >= VISIBLE_FRAC
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
      if (c === 'pole' || c === 'verdict') return { kind: 'pole' }
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
  const prevShot = useMemo(() => shotOf(ORDER[ci - 1]), [shotOf, ci])
  const nextShot = useMemo(() => shotOf(ORDER[ci + 1]), [shotOf, ci])

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

  const rows = useMemo(() => (top10 ? verdictRows(top10, names) : []), [top10, names])
  // The verdict: each region's single best landing day over every year of the data (objective, one row per region).
  const [bestPerRegion, setBestPerRegion] = useState<{ siteId: string; landingUtc: string; p: number; slip: number }[]>([])
  useEffect(() => {
    if (chapter !== 'verdict' || bestPerRegion.length || !siteIdList.length) return
    Promise.all(
      siteIdList.map((id) =>
        loadSurvival(id)
          .then((f) => {
            const b = f.windows.reduce((a, w) => (w.p_survive_14d > a.p_survive_14d ? w : a))
            return { siteId: id, landingUtc: b.landing_utc, p: b.p_survive_14d, slip: b.slip_tolerance_days }
          })
          .catch(() => null),
      ),
    ).then((r) => setBestPerRegion(r.filter((x): x is NonNullable<typeof x> => !!x).sort((a, b) => b.p - a.p)))
  }, [chapter, bestPerRegion.length, siteIdList])
  const badges = useMemo(() => {
    if (chapter === 'verdict') return Object.fromEntries(Object.entries(ranksBySite(rows)).map(([id, r]) => [id, r.map((k) => `#${k}`).join(' ')]))
    if (compare) return { [compare[0]]: 'A', [compare[1]]: 'B' }
    if (cmpMode && cmpFirst) return { [cmpFirst]: 'A' }
    return undefined
  }, [chapter, rows, compare, cmpMode, cmpFirst])

  const pick = useCallback(
    (s: Site) => {
      if (chapter === 'pole' && cmpMode) {
        if (!cmpFirst) setCmpFirst(s.id)
        else if (s.id !== cmpFirst) {
          setCompare([cmpFirst, s.id])
          setCmpMode(false)
          setCmpFirst(null)
        }
        return
      }
      userPicked.current = true
      touched.current = true
      setSiteId(s.id)
      if (chapter !== 'pole') go('site')
    },
    [go, chapter, cmpMode, cmpFirst],
  )

  // The agent's handle on the film: every call is something the user watches happen.
  const controller: FilmController = useMemo(
    () => ({
      async fly(shotId, sid) {
        // A site named by the agent stays: the "best site of the day" rule must not replace it.
        if (sid) {
          userPicked.current = true
          touched.current = true
          setSiteId(sid)
        }
        setCompare(null)
        setChapter(shotId)
        sound.current?.whoosh()
        await nextFrames()
        await Promise.race([camBus.whenArrived(), new Promise((r) => setTimeout(r, 8000))])
      },
      setTime(date) {
        // One date for the whole film: the pole, the crash test and the ground view all move to it.
        const d = dayOfIso(`${date}T00:00:00Z`)
        touched.current = true
        if (d >= 0 && d < 365) setPickDay(d)
        ground.set(hourOfDate(date, `${YEAR}-01-01T00:00:00Z`, 365 * 24))
        setPlaying(false)
      },
      async compare(a, b) {
        setChapter('pole')
        setCompare([a, b])
        await nextFrames()
        await Promise.race([camBus.whenArrived(), new Promise((r) => setTimeout(r, 8000))])
      },
      context: () => `${chapter}${chapter === 'site' || chapter === 'crash' ? `:${siteId}` : ''}`,
      day: () => new Date(pickMs).toISOString().slice(0, 10),
      site: () => siteId,
    }),
    [chapter, siteId, ground, pickMs],
  )

  const downloadCsv = () => {
    const blob = new Blob([toCsv(rows, !!top10?.mock)], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'lastlight-safest-windows.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

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
                activeSite={chapter === 'site' || chapter === 'pole' ? siteId : null}
                showPins={chapter === 'pole'}
                badges={badges}
                tones={tones}
                athena={chapter === 'athena' ? ATHENA : null}
                skyLabels={clean && chapter === 'site'}
                crash={crash}
                scrub={scrub}
                prev={prevShot}
                next={nextShot}
              />
            </Suspense>
          )}
          {/* No loading screen: the page stays dark and the Moon emerges (MissionScene's Globe). The loader only
              shows if the network is slow (after 3 s), so nobody stares at a black screen. */}
          <div className={'mm-veil quiet' + (ready ? ' gone' : '')}>
            <Loader />
          </div>
        </div>

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

            {/* The landing day appears where it changes what you see: the pole, the crash test, the ground, the verdict. */}
            <div className={'mm-when' + (chapter === 'moon' || chapter === 'athena' || chapter === 'verdict' ? ' off' : '')} role="group" aria-label="Landing day">
              <span className="mm-when-l">Landing day</span>
              <button className="mm-when-b" aria-label="Previous day" onClick={() => moveDay(pickDay - 1)}>
                <CaretLeft size={14} />
              </button>
              <label className="mm-when-d">
                <b className="num">{prettyDate(pickMs)}</b>
                <input
                  type="date"
                  min="2027-01-01"
                  max="2027-12-31"
                  value={new Date(pickMs).toISOString().slice(0, 10)}
                  onChange={(e) => e.target.value && moveDay(dayOfIso(`${e.target.value}T00:00:00Z`))}
                  onClick={(e) => {
                    // Open the calendar on any click, in every browser that supports it.
                    try {
                      ;(e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.()
                    } catch {
                      /* not allowed here: the native control still works */
                    }
                  }}
                  aria-label="Choose the landing day"
                />
              </label>
              <button className="mm-when-b" aria-label="Next day" onClick={() => moveDay(pickDay + 1)}>
                <CaretRight size={14} />
              </button>
            </div>

            <nav className="mm-rail" aria-label="Shots">
              <button className="step" aria-label="Previous shot" title="Previous shot (scroll up, ↑)" disabled={ci <= 0} onClick={() => ci > 0 && go(ORDER[ci - 1])}>
                <CaretUp size={14} weight="bold" />
              </button>
              {ORDER.map((c) => (
                <button key={c} className={c === chapter ? 'on' : ''} onClick={() => go(c)}>
                  <span className="bar" />
                  <span className="label">{c === 'site' && site ? site.name : LABEL[c]}</span>
                </button>
              ))}
              <button className="step" aria-label="Next shot" title="Next shot (scroll down, ↓)" disabled={ci >= ORDER.length - 1} onClick={() => ci < ORDER.length - 1 && go(ORDER[ci + 1])}>
                <CaretDown size={14} weight="bold" />
              </button>
            </nav>
            {ci === 0 && !clean && (
              <button className="mm-scrollhint" onClick={() => go(ORDER[1])} aria-label="Next shot">
                <CaretDown size={14} weight="bold" /> <span className="d">Scroll down for the next shot, up to go back</span><span className="m">Swipe up for the next shot</span>
              </button>
            )}

            <div className="mm-panelwrap">
            <AnimatePresence mode="popLayout">
              <motion.section
                key={chapter + (chapter === 'site' ? siteId : '') + (compare ? 'cmp' : '') + (cmpMode ? 'pick' : '')}
                className={'mm-panel is-' + chapter + (compare ? ' has-compare' : '')}
                initial={reduce ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
                transition={{ duration: 0.7, ease, delay: 0.1 }}
              >
                {compare && (
                  <>
                    <p className="mm-kicker">Side by side</p>
                    <h2>
                      {names[compare[0]]} <span className="mm-vs">or</span> {names[compare[1]]}
                    </h2>
                    <CompareCard a={compare[0]} b={compare[1]} startMs={pickMs} names={names} pa={surv[compare[0]]?.get(pickDay)?.p} pb={surv[compare[1]]?.get(pickDay)?.p} />
                    <p className="mm-sub">Drag the date below: both sites update.</p>
                    <div className="mm-actions">
                      <button className="mm-cta" onClick={() => { userPicked.current = true; touched.current = true; setSiteId((surv[compare[0]]?.get(pickDay)?.p ?? 0) >= (surv[compare[1]]?.get(pickDay)?.p ?? 0) ? compare[0] : compare[1]); setCompare(null); go('crash') }}>
                        Crash-test the safer one <ArrowRight size={16} />
                      </button>
                      <button className="mm-cta ghost" onClick={() => setCompare(null)}>
                        Back to all nine
                      </button>
                    </div>
                  </>
                )}
                {!compare && chapter === 'moon' && (
                  <>
                    <h1>Water ice, and almost no sunlight.</h1>
                    <p>At the lunar south pole the Sun only skims the horizon. Craters that never see it keep ice. Landers that lose it die.</p>
                    <button className="mm-cta" onClick={() => go('athena')}>
                      What went wrong <ArrowRight size={16} />
                    </button>
                  </>
                )}
                {chapter === 'athena' && (
                  <>
                    <p className="mm-kicker">Intuitive Machines IM-2 · 6 March 2025</p>
                    <h2>Athena landed here.</h2>
                    <p>March 2025. It tipped over in a shadowed crater and went silent in less than 13 hours.</p>
                    <button className="mm-cta" onClick={() => go('pole')}>
                      Where should the next one land? <ArrowRight size={16} />
                    </button>
                  </>
                )}
                {!compare && chapter === 'pole' && (
                  <>
                    <p className="mm-kicker">Landing on {prettyDate(pickMs)}</p>
                    <h2>{cmpMode ? (cmpFirst ? 'Now pick the second site.' : 'Pick two sites.') : 'Same day, nine fates.'}</h2>
                    <p>{cmpMode ? 'Tap a site on the pole. A and B appear side by side.' : 'The brighter a region glows, the more landers last two weeks.'}</p>
                    <div className="mm-actions">
                      {!cmpMode && (
                        <button className="mm-cta" onClick={() => go('crash')} disabled={!site}>
                          Crash-test {site?.name ?? '…'} <ArrowRight size={16} />
                        </button>
                      )}
                      <button className="mm-cta ghost" onClick={() => { setCmpMode((m) => !m); setCmpFirst(null) }}>
                        {cmpMode ? 'Cancel' : 'Compare two sites'}
                      </button>
                    </div>
                    {!cmpMode && (
                      <Link className="mm-textlink" to="/explore">
                        Or start from the safest landing days, 2027–2030 <ArrowRight size={14} />
                      </Link>
                    )}
                  </>
                )}
                {chapter === 'site' && site && (
                  <>
                    <p className="mm-kicker">On the ground · {utc ? utc.toISOString().slice(0, 10) : ''}</p>
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
                        <span>Sunlight on panels</span>
                        <b className="num">{series ? `${Math.round(series.irradiance_wm2[idx])} W/m²` : '…'}</b>
                      </div>
                    </div>
                    <div className="mm-actions">
                      <button className="mm-cta" onClick={() => go('pole')}>
                        <ArrowLeft size={16} /> Back to the nine regions
                      </button>
                      <Link className="mm-cta ghost" to={`/explore?site=${siteId}&date=${new Date(pickMs).toISOString().slice(0, 10)}`}>
                        Open in the Planner
                      </Link>
                    </div>
                  </>
                )}
                {chapter === 'crash' && site && (
                  <>
                    {landers.length > 0 ? (
                      <>
                        <p className="mm-kicker">
                          {site.name} · landing {prettyDate(crashStartMs)}
                        </p>
                        <h2 className="mm-hero">
                          <span className={'num ' + (alive / landers.length >= 0.5 ? 'alive' : 'dead')}>{alive}</span>
                          <span className="of"> of {landers.length} landers still alive · {Math.round((100 * alive) / landers.length)}%</span>
                        </h2>
                        <p>
                          {site.name}, {prettyDate(crashStartMs)}. {landers.length.toLocaleString('en-US')} simulated landings, off target and tilted. On day 14, <b className="num">{finalPct}%</b> still glow.
                        </p>
                        {dayGhosts === null && ghostDay != null && <p className="mm-design-note">This data has one simulated day per site: its best day.</p>}
                        <div className="mm-design">
                          <label htmlFor="tilt">
                            Your lander <span>{tiltMax >= 90 ? <>survives <b className="num">any</b> tilt</> : <>survives up to <b className="num">{tiltMax}°</b> of tilt</>}</span>
                          </label>
                          <input
                            id="tilt"
                            type="range"
                            min={5}
                            max={90}
                            step={5}
                            value={tiltMax}
                            onChange={(e) => {
                              setTiltMax(Number(e.target.value))
                              setPlaying(false)
                              crashClock.set(CRASH_HOURS)
                            }}
                          />
                          <p className="mm-design-note">
                            {tiltNeeded == null ? '' : tiltNeeded < 0 ? 'No tilt tolerance reaches 95% on this date.' : `To stay at 95% or more, it must survive at least ${tiltNeeded}° of tilt.`}
                          </p>
                        </div>
                        <div className="mm-actions">
                          <button className="mm-cta" onClick={() => go('site')}>
                            Stand on the ground <ArrowRight size={16} />
                          </button>
                        </div>
                      </>
                    ) : dayGhosts === undefined || (dayGhosts === null && !survival) ? (
                      <p>Loading the landings at {site.name}…</p>
                    ) : (
                      <>
                        <h2>No crash test for {site.name} yet.</h2>
                        <p>This site has no landing simulation. Pick another on the pole.</p>
                        <button className="mm-cta" onClick={() => go('pole')}>
                          Back to the pole <ArrowRight size={16} />
                        </button>
                      </>
                    )}
                  </>
                )}
                {chapter === 'verdict' && (
                  <>
                    <p className="mm-kicker">
                      {top10 ? `${top10.criteria.year_start}–${top10.criteria.year_end} · ${top10.criteria.survive_days}-day survival · 1,000 landings per day` : 'Loading'}
                    </p>
                    <h2>The best landing day of each region{top10 ? `, ${top10.criteria.year_start}–${top10.criteria.year_end}` : ''}.</h2>
                    <ol className="mm-verdict">
                      {bestPerRegion.map((r, i) => {
                        const inFilm = r.landingUtc.startsWith(String(YEAR))
                        const iso = r.landingUtc.slice(0, 10)
                        const row = (
                          <>
                            <span className="num rank">{String(i + 1).padStart(2, '0')}</span>
                            <span className="who">
                              <span className="name">{names[r.siteId] ?? r.siteId}</span>
                              <span className="num date">{prettyDate(Date.parse(r.landingUtc))}</span>
                            </span>
                            <span className="meter" aria-hidden="true">
                              <i style={{ width: `${r.p * 100}%`, background: heat(r.p), animationDelay: `${0.25 + i * 0.04}s` }} />
                            </span>
                            <span className="num p">{(r.p * 100).toFixed(1)}%</span>
                          </>
                        )
                        return (
                          <li key={r.siteId}>
                            {inFilm ? (
                              <button
                                title="Watch the 1,000 landings of this day"
                                onClick={() => {
                                  userPicked.current = true
                                  touched.current = true
                                  setSiteId(r.siteId)
                                  setPickDay(dayOfIso(r.landingUtc))
                                  go('crash')
                                }}
                              >
                                {row}
                              </button>
                            ) : (
                              <Link to={`/explore?site=${r.siteId}&date=${iso}`} title="Test this day in the Planner">
                                {row}
                              </Link>
                            )}
                          </li>
                        )
                      })}
                    </ol>
                    <p className="mm-design-note">Only Malapert Massif reaches 95% with this generic lander. Every window, every region: the Planner.</p>
                    <div className="mm-actions">
                      <Link className="mm-cta" to="/explore">
                        All windows, filterable <ArrowRight size={16} />
                      </Link>
                      <button className="mm-cta ghost" onClick={downloadCsv} disabled={!rows.length}>
                        <DownloadSimple size={16} /> Top 10 CSV
                      </button>
                    </div>
                  </>
                )}
              </motion.section>
            </AnimatePresence>
            </div>

            {chapter === 'pole' && Object.keys(surv).length > 0 && (
              <div className="mm-time daytrack-wrap">
                <DayTrack data={site ? surv[site.id] : undefined} day={pickDay} label={site?.name ?? ''} onScrub={moveDay} />
              </div>
            )}

            {chapter === 'site' && series && utc && (
              <>
                <div className="mm-hud">
                  <HorizonRing site={site!} series={series} idx={idx} />
                </div>
                <div className="mm-time">
                  <button className="mm-icon" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'}>
                    {playing ? <Pause size={16} weight="fill" /> : <Play size={16} weight="fill" />}
                  </button>
                  <div className="mm-year-wrap">
                    <YearStrip
                      series={series}
                      hour={idx}
                      onSeek={(h) => {
                        setPlaying(false)
                        ground.set(h)
                      }}
                    />
                    <YearLabels />
                  </div>
                  <span className="num">
                    {utc.toISOString().slice(0, 10)} {utc.toISOString().slice(11, 16)} UTC
                  </span>
                </div>
              </>
            )}

            {chapter === 'crash' && landers.length > 0 && (
              <div className="mm-time wide">
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
                <div className="mm-year-wrap">
                  <SurvivalChart
                    landers={landers}
                    hour={crashH}
                    hours={CRASH_HOURS}
                    onSeek={(h) => {
                      setPlaying(false)
                      crashClock.set(h)
                    }}
                  />
                  <div className="sv-axis" aria-hidden="true">
                    <span>Landing</span>
                    <span>Day 7</span>
                    <span>Day 14</span>
                  </div>
                </div>
                <span className="num">day {(crashH / 24).toFixed(1)}</span>
              </div>
            )}

            <p className="mm-note">
              {chapter === 'crash'
                ? 'Ghost landers drawn 3× real size; positions and failures from the landing simulation. Relief ×2.5, real LOLA terrain.'
                : chapter === 'site'
                  ? 'Sun and Earth positions from our ephemeris data. Relief ×2.5, LOLA terrain.'
                  : chapter === 'moon'
                    ? 'LROC colour, LOLA relief: NASA SVS CGI Moon Kit.'
                    : 'Relief ×2.5, low overview light (7°). Terrain and colour: LRO (LOLA, LROC), NASA SVS CGI Moon Kit.'}
            </p>
            {!clean && <Copilot />}
          </>
      </div>
    </FilmContext.Provider>
  )
}
