import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, CaretLeft, CaretRight, Check, DownloadSimple, LinkSimple, Pause, Play } from '@phosphor-icons/react'
import { TopBar } from '../components/TopBar'
import { NOTICE } from '../components/notice'
import { useSites } from '../data/hooks'
import { loadSeries } from '../data/load'
import { VISIBLE_FRAC, windowStats } from '../data/stats'
import type { SeriesFile, Site } from '../data/types'
import { heat, heatText } from '../mission/charts'
import { LanderLab, formatLander, parseLander } from './LanderLab'
import { REFERENCE } from '../data/lander'
import './explore.css'

/*
 * The Planner, in three steps anyone can follow: where (a region), when (a day on a calendar), and the verdict
 * (how many of 1,000 simulated landers are still powered after 14 days, and why).
 * Every number is the pipeline's: planner.json is a packed copy of web/public/data/survival/*.json
 * (scripts/build-planner.mjs), sunlight and Earth come from the hourly series, the skyline from sites.json.
 */

const DAY = 86_400_000
const T0 = Date.UTC(2027, 0, 1)
const YEARS = [2027, 2028, 2029, 2030]
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const GHOST_YEAR = 2027 // the 3D landing replay covers this year
const BAR = 950 // the 95% bar of the challenge result, per mille
const AMBER = '#ffb547'
const MOON = '#d8dbe2'

const msOf = (iso: string) => Date.parse(`${iso}T00:00:00Z`)
const isoOf = (ms: number) => new Date(ms).toISOString().slice(0, 10)
const dayOf = (iso: string) => Math.round((msOf(iso) - T0) / DAY)
const fmt = (iso: string) => new Date(msOf(iso)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const hrs = (h: number) => (h >= 48 ? `${(h / 24).toFixed(1)} days` : `${Math.round(h)} h`)

// ------------------------------------------------------------------------------------------------ data
interface PlannerSite {
  id: string
  name: string
  params_ref: string
  mock: boolean
  p: number[] // per mille, -1 = no data
  slip: number[]
  life: number[] // tenths of a day
  comm: number[] // per mille
}
interface PlannerFile {
  t0: string
  days: number
  sites: PlannerSite[]
}

let plannerP: Promise<PlannerFile> | null = null
const loadPlanner = () => (plannerP ??= fetch('/data/planner.json').then((r) => (r.ok ? r.json() : Promise.reject(r.status))))

function usePlanner() {
  const [f, setF] = useState<PlannerFile | null>(null)
  const [err, setErr] = useState(false)
  useEffect(() => {
    let on = true
    loadPlanner().then((v) => on && setF(v), () => on && setErr(true))
    return () => {
      on = false
    }
  }, [])
  return { f, err }
}

function useSeries(id: string | undefined, year: number) {
  const [s, setS] = useState<{ key: string; v: SeriesFile } | null>(null)
  const key = `${id}:${year}`
  useEffect(() => {
    if (!id) return
    let on = true
    loadSeries(id, year).then((v) => on && setS({ key, v }), () => {})
    return () => {
      on = false
    }
  }, [id, year, key])
  return s && s.key === key ? s.v : null
}

/** Best day of a region, optionally within one year: highest survival, then the most slack for a late launch. */
function bestDay(s: PlannerSite, year?: number) {
  const a = year ? dayOf(`${year}-01-01`) : 0
  const b = year ? dayOf(`${year + 1}-01-01`) : s.p.length
  let k = -1
  for (let d = a; d < b; d++) {
    if (s.p[d] < 0) continue
    if (k < 0 || s.p[d] > s.p[k] || (s.p[d] === s.p[k] && s.slip[d] > s.slip[k])) k = d
  }
  return k
}

function download(name: string, rows: (string | number)[][]) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' }))
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(el)
    setW(Math.round(el.getBoundingClientRect().width))
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

// ------------------------------------------------------------------------------------------------ pieces
/** 100 little landers, one per 10 simulated: lit = still powered on day 14. The verdict as a picture. */
function Landers({ alive }: { alive: number }) {
  const lit = Math.round(alive / 10)
  return (
    <div className="pl-dots" role="img" aria-label={`${alive} of 1,000 simulated landers still powered on day 14`}>
      {Array.from({ length: 100 }, (_, i) => (
        <i key={i} className={i < lit ? 'on' : ''} style={{ transitionDelay: `${(i % 20) * 6}ms` }} />
      ))}
    </div>
  )
}

/** The 360° skyline seen from the region, with the Sun's and Earth's paths over the 14 days. */
function Skyline({ site, series, h0, hour }: { site: Site; series: SeriesFile; h0: number; hour: number }) {
  const [ref, W] = useWidth<HTMLDivElement>()
  const H = W < 600 ? 140 : 170
  const prof = site.horizon.mast_2m
  const step = 360 / prof.length
  const i0 = Math.max(0, h0)
  const i1 = Math.min(series.sun_el.length, h0 + 14 * 24)
  let top = Math.max(...prof)
  for (let i = i0; i < i1; i++) top = Math.max(top, series.sun_el[i], series.earth_el[i])
  const elMin = Math.min(-1.5, Math.min(...prof) - 0.5)
  const elMax = Math.max(4, top + 1)
  const x = (az: number) => ((((az % 360) + 360) % 360) / 360) * W
  const y = (el: number) => 8 + (H - 8) * (1 - (el - elMin) / (elMax - elMin))
  if (!W) return <div ref={ref} className="pl-sky" style={{ height: H + 22 }} />
  const terrain = `M0,${H} ` + prof.map((e, i) => `L${x(i * step).toFixed(1)},${y(e).toFixed(1)}`).join(' ') + ` L${W},${y(prof[0]).toFixed(1)} L${W},${H} Z`
  const path = (az: number[], el: number[]) => {
    let d = ''
    let px = -1
    for (let i = i0; i < i1; i += 2) {
      const X = x(az[i]), Y = y(el[i])
      d += `${d && Math.abs(X - px) < W / 2 ? 'L' : 'M'}${X.toFixed(1)},${Y.toFixed(1)}`
      px = X
    }
    return d
  }
  const hi = Math.min(i1 - 1, i0 + hour)
  const sunOn = series.sun_frac[hi] >= VISIBLE_FRAC
  const earthOn = series.earth_frac[hi] >= VISIBLE_FRAC
  return (
    <div ref={ref} className="pl-sky">
      <svg width={W} height={H + 22} role="img" aria-label={`Skyline around ${site.name} with the Sun and Earth paths`}>
        <defs>
          <radialGradient id="plSun">
            <stop offset="0" stopColor={AMBER} stopOpacity="0.6" />
            <stop offset="1" stopColor={AMBER} stopOpacity="0" />
          </radialGradient>
        </defs>
        <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="rgba(236,235,230,0.2)" strokeDasharray="1 5" />
        <path d={path(series.earth_az, series.earth_el)} fill="none" stroke={MOON} strokeOpacity={0.35} strokeWidth={1.2} />
        <path d={path(series.sun_az, series.sun_el)} fill="none" stroke={AMBER} strokeOpacity={0.55} strokeWidth={1.4} />
        <path d={terrain} fill="#131418" stroke="rgba(236,235,230,0.7)" strokeWidth={1} />
        {/* The paths again over the rock, dashed: when the Sun goes behind a ridge you still see where it is. */}
        <path d={path(series.sun_az, series.sun_el)} fill="none" stroke={AMBER} strokeOpacity={0.4} strokeWidth={1.2} strokeDasharray="2 5" />
        <path d={path(series.earth_az, series.earth_el)} fill="none" stroke={MOON} strokeOpacity={0.25} strokeWidth={1} strokeDasharray="2 5" />
        {earthOn ? (
          <circle cx={x(series.earth_az[hi])} cy={y(series.earth_el[hi])} r={5} fill={MOON} />
        ) : (
          <circle cx={x(series.earth_az[hi])} cy={y(series.earth_el[hi])} r={5} fill="none" stroke={MOON} strokeOpacity={0.6} strokeDasharray="2 2" />
        )}
        {sunOn ? (
          <>
            <circle cx={x(series.sun_az[hi])} cy={y(series.sun_el[hi])} r={26} fill="url(#plSun)" />
            <circle cx={x(series.sun_az[hi])} cy={y(series.sun_el[hi])} r={6.5} fill={AMBER} />
          </>
        ) : (
          <g>
            <circle cx={x(series.sun_az[hi])} cy={y(series.sun_el[hi])} r={7} fill="#131418" stroke={AMBER} strokeWidth={1.5} strokeDasharray="3 3" />
            <text x={x(series.sun_az[hi])} y={y(series.sun_el[hi]) + 24} textAnchor="middle" className="pl-ax sunlbl">
              hidden by terrain
            </text>
          </g>
        )}
        {(['N', 'E', 'S', 'W'] as const).map((l, i) => (
          <text key={l} x={x(i * 90) + 4} y={H + 16} className="pl-ax">
            {l}
          </text>
        ))}
      </svg>
    </div>
  )
}

/** The year in one strip: a bar per day, brighter = more landers survive. Tap or drag to choose the day. */
function YearStrip({ site, year, day, onPick }: { site: PlannerSite; year: number; day: number; onPick: (d: number) => void }) {
  const [ref, W] = useWidth<HTMLDivElement>()
  const d0 = dayOf(`${year}-01-01`)
  const n = dayOf(`${year + 1}-01-01`) - d0
  const cw = W / n
  const pick = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    onPick(d0 + Math.max(0, Math.min(n - 1, Math.floor(((e.clientX - r.left) / r.width) * n))))
  }
  const sel = day - d0
  return (
    <div
      ref={ref}
      className="pl-strip"
      role="slider"
      tabIndex={0}
      aria-label={`Landing day in ${year}`}
      aria-valuemin={0}
      aria-valuemax={n - 1}
      aria-valuenow={sel}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        pick(e)
      }}
      onPointerMove={(e) => e.buttons && pick(e)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') onPick(Math.min(d0 + n - 1, day + 1))
        if (e.key === 'ArrowLeft') onPick(Math.max(d0, day - 1))
      }}
    >
      {W > 0 && (
        <svg width={W} height={52}>
          {Array.from({ length: n }, (_, k) => {
            const v = site.p[d0 + k]
            return <rect key={k} x={k * cw} y={0} width={cw + 0.4} height={34} fill={v < 0 ? '#0d0e11' : heat(v / 1000)} />
          })}
          {sel >= 0 && sel < n && <rect x={sel * cw - 1.5} y={-2} width={Math.max(3, 14 * cw)} height={38} fill="none" stroke="#fff" strokeWidth={1.5} rx={2} />}
          {MONTHS.map((m, i) => (
            <text key={m} x={((dayOf(isoOf(Date.UTC(year, i, 1))) - d0) / n) * W + 2} y={48} className="pl-ax">
              {W < 520 ? m[0] : m}
            </text>
          ))}
        </svg>
      )}
    </div>
  )
}

/**
 * The film's ground shot, live: real LOLA terrain around the region, the Sun and Earth placed from the hourly
 * series. Loaded only once the page is idle, then driven hour by hour by the Planner's clock (no reload).
 */
function GroundView({ siteId, year, hour }: { siteId: string; year: number; hour: number }) {
  const ref = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)
  const [go, setGo] = useState(false)
  useEffect(() => {
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback
    if (ric) ric(() => setGo(true), { timeout: 1500 })
    else window.setTimeout(() => setGo(true), 600)
  }, [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const src = useMemo(() => `/?ch=site&site=${encodeURIComponent(siteId)}&gy=${year}&t=${hour}&clean`, [siteId, year])
  useEffect(() => setReady(false), [src])
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin === window.location.origin && (e.data as { type?: string })?.type === 'll:ready' && e.source === ref.current?.contentWindow) setReady(true)
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])
  useEffect(() => {
    if (ready) ref.current?.contentWindow?.postMessage({ type: 'll:t', t: hour }, window.location.origin)
  }, [hour, ready])
  return (
    <div className={'pl-ground' + (ready ? ' on' : '')}>
      {go && <iframe ref={ref} src={src} title="Live 3D view from the landing site" tabIndex={-1} />}
      <span className="pl-ground-wait">
        <svg viewBox="0 0 120 60" aria-hidden="true">
          <circle className="sun" cx="60" cy="40" r="9" />
          <path className="ridge" d="M2 50 L30 36 L44 42 L62 28 L80 40 L96 34 L118 50 Z" />
        </svg>
        Loading the real terrain
      </span>
    </div>
  )
}

// ------------------------------------------------------------------------------------------------ page
export function Explore() {
  const [q, setQ] = useSearchParams()
  const { f: plan, err } = usePlanner()
  const sitesData = useSites().data
  const geo = useMemo(() => new Map((sitesData?.sites ?? []).map((s) => [s.id, s])), [sitesData])

  // Regions ranked by their best landing day, the same ranking as the film's verdict.
  const regions = useMemo(() => (plan ? [...plan.sites].map((s) => ({ s, best: bestDay(s) })).sort((a, b) => b.s.p[b.best] - a.s.p[a.best]) : []), [plan])
  const siteId = q.get('site') ?? regions[0]?.s.id ?? 'malapert-massif'
  const site = plan?.sites.find((s) => s.id === siteId) ?? regions[0]?.s
  const qDate = q.get('date')
  const day = site ? (qDate && site.p[dayOf(qDate)] >= 0 ? dayOf(qDate) : bestDay(site)) : -1
  const iso = day >= 0 ? isoOf(T0 + day * DAY) : '2029-10-15'
  const year = Number(iso.slice(0, 4))
  const set = (kv: Record<string, string | null>) =>
    setQ(
      (p) => {
        const n = new URLSearchParams(p)
        for (const [k, v] of Object.entries(kv)) {
          if (v == null) n.delete(k)
          else n.set(k, v)
        }
        return n
      },
      { replace: true },
    )
  const pickDay = (d: number) => site && site.p[d] >= 0 && set({ date: isoOf(T0 + d * DAY) })
  const pickSite = (id: string) => set({ site: id, date: q.get('date') })
  const step = (dir: number) => {
    if (!site) return
    for (let d = day + dir; d >= 0 && d < site.p.length; d += dir) if (site.p[d] >= 0) return pickDay(d)
  }

  const series = useSeries(site?.id, year)
  const landerQ = q.get('lander')
  const lander = useMemo(() => parseLander(landerQ), [landerQ])
  const g = site ? geo.get(site.id) : undefined
  const st = series ? windowStats(series, msOf(iso), 14) : null
  const h0 = Math.round((msOf(iso) - Date.UTC(year, 0, 1)) / 3_600_000)
  const [hour, setHour] = useState(0)
  const [playing, setPlaying] = useState(false)
  useEffect(() => setHour(0), [iso, siteId])
  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    let acc = 0
    const tick = (t: number) => {
      acc += ((t - last) / 1000) * 42 // 14 days in 8 seconds
      last = t
      if (acc >= 1) {
        const n = Math.floor(acc)
        acc -= n
        setHour((h) => (h + n) % 336)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  const [copied, setCopied] = useState(false)
  const share = () => {
    navigator.clipboard?.writeText(window.location.href).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    })
  }

  const p = site && day >= 0 ? site.p[day] : -1
  const alive = p >= 0 ? p : null
  const meets = p >= BAR
  const hi = h0 + hour

  const csv = () =>
    site &&
    download(`lastlight_${site.id}_2027-2030.csv`, [
      ['landing_utc', 'p_survive_14d', 'median_days_alive', 'slip_tolerance_days', 'p_comm_ok', 'params_ref'],
      ...site.p.flatMap((v, d) => (v < 0 ? [] : [[`${isoOf(T0 + d * DAY)}T00:00:00Z`, v / 1000, site.life[d] / 10, site.slip[d], site.comm[d] / 1000, site.params_ref]])),
    ])

  return (
    <div className="pl">
      <TopBar variant="page" />
      <main className="pl-main">
        {err && <p className="pl-empty">The planning data could not be loaded. Check your connection and reload.</p>}

        {/* where: nine regions, each showing its survival on the chosen day (the comparison is the picker) */}
        <div className="pl-regions" role="radiogroup" aria-label="Region">
          {(regions.length ? regions : Array.from({ length: 9 }, () => null)).map((r, i) => {
            if (!r) return <span key={i} className="pl-chip skel" />
            const v = day >= 0 ? r.s.p[day] : -1
            return (
              <button key={r.s.id} role="radio" aria-checked={r.s.id === site?.id} className={'pl-chip' + (r.s.id === site?.id ? ' on' : '')} onClick={() => pickSite(r.s.id)}>
                <span className="nm">{r.s.name}</span>
                <b style={{ color: heatText(Math.max(0, v) / 1000) }}>{v < 0 ? '–' : `${Math.round(v / 10)}%`}</b>
                <i style={{ width: `${Math.max(0, v) / 10}%`, background: heat(Math.max(0, v) / 1000) }} />
              </button>
            )
          })}
        </div>

        {/* when: the year as one strip, brighter = more landers survive */}
        <div className="pl-when">
          <div className="pl-years" role="tablist" aria-label="Year">
            {YEARS.map((y) => (
              <button key={y} role="tab" aria-selected={y === year} className={y === year ? 'on' : ''} onClick={() => site && pickDay(bestDay(site, y))}>
                {y}
              </button>
            ))}
          </div>
          {site ? <YearStrip site={site} year={year} day={day} onPick={pickDay} /> : <div className="pl-strip skel" />}
          <div className="pl-daynav">
            <button className="pl-ib" aria-label="Previous day" onClick={() => step(-1)}>
              <CaretLeft size={16} />
            </button>
            <b>{day >= 0 ? fmt(iso) : '…'}</b>
            <button className="pl-ib" aria-label="Next day" onClick={() => step(1)}>
              <CaretRight size={16} />
            </button>
          </div>
        </div>

        {/* the verdict, over the live 3D view from the site */}
        <section className="pl-stage" aria-live="polite">
          {site && <GroundView siteId={site.id} year={year} hour={hi} />}
          <div className="pl-verdict">
            <p className="pl-big">
              <b style={{ color: alive != null ? heatText(alive / 1000) : undefined }}>{alive != null ? alive.toLocaleString('en-US') : '…'}</b>
              <span>of 1,000 landers alive after 14 days</span>
            </p>
            <Landers alive={alive ?? 0} />
            <p className={'pl-badge' + (meets ? ' ok' : '')}>{alive == null ? ' ' : meets ? 'Safe: above the 95% bar' : 'Risky: below the 95% bar'}</p>
          </div>
          <div className="pl-tools">
            <button className="pl-ib" onClick={csv} title="Every day of this region, CSV" aria-label="Download every day of this region as CSV">
              <DownloadSimple size={16} />
            </button>
            <button className="pl-ib" onClick={share} title={copied ? 'Link copied' : 'Copy a link to this plan'} aria-label="Copy a link to this plan">
              {copied ? <Check size={16} /> : <LinkSimple size={16} />}
            </button>
          </div>
        </section>

        <dl className="pl-facts">
          <div>
            <dt>Sun in view</dt>
            <dd className="sun">{st ? `${Math.round(st.sunPct)}%` : '…'}</dd>
          </div>
          <div>
            <dt>Earth in view</dt>
            <dd>{st ? `${Math.round(st.earthPct)}%` : '…'}</dd>
          </div>
          <div>
            <dt>Longest night</dt>
            <dd>{st ? hrs(st.longestDarkH) : '…'}</dd>
          </div>
          <div>
            <dt>Launch can slip</dt>
            <dd title='How many of the following landing days also stay at or above 95%'>{site && day >= 0 && alive != null ? (!meets ? 'No (below 95%)' : site.slip[day] === 0 ? 'No: the next day drops below 95%' : `Up to ${site.slip[day]} day${site.slip[day] === 1 ? '' : 's'}`) : '…'}</dd>
          </div>
        </dl>

        <LanderLab
          series={series}
          siteId={site?.id}
          year={year}
          startMs={msOf(iso)}
          spec={lander}
          onSpec={(L) => set({ lander: formatLander(L) === formatLander(REFERENCE) ? null : formatLander(L) })}
        />

        {/* the skyline: what the panels see, and the clock that drives the 3D view */}
        <section className="pl-skywrap">
          {g && series ? <Skyline site={g} series={series} h0={h0} hour={hour} /> : <div className="pl-sky skel" />}
          <div className="pl-play">
            <button className="pl-ib play" onClick={() => setPlaying((v) => !v)} aria-label={playing ? 'Pause' : 'Play the 14 days'}>
              {playing ? <Pause size={14} weight="fill" /> : <Play size={14} weight="fill" />}
            </button>
            <input
              type="range"
              min={0}
              max={335}
              value={hour}
              onChange={(e) => {
                setPlaying(false)
                setHour(Number(e.target.value))
              }}
              aria-label="Hour of the 14 days"
            />
            <span className="pl-now">
              Day {Math.floor(hour / 24) + 1}
              {series && (
                <>
                  <i className={series.sun_frac[hi] >= VISIBLE_FRAC ? 'sun on' : 'sun'} /> Sun
                  <i className={series.earth_frac[hi] >= VISIBLE_FRAC ? 'earth on' : 'earth'} /> Earth
                </>
              )}
            </span>
          </div>
        </section>

        <div className="pl-actions">
          {year === GHOST_YEAR ? (
            <Link className="pl-go" to={`/?ch=crash&site=${site?.id}&date=${iso}`}>
              Watch the 1,000 landings <ArrowRight size={16} />
            </Link>
          ) : (
            <Link className="pl-go" to={`/?ch=pole&date=${iso}`}>
              See this day on the pole <ArrowRight size={16} />
            </Link>
          )}
          <Link className="pl-go ghost" to="/method">
            How we compute it <ArrowRight size={16} />
          </Link>
        </div>
      </main>
      <footer className="pl-foot">{NOTICE}</footer>
    </div>
  )
}
