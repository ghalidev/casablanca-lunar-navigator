import { useEffect, useMemo, useRef, useState } from 'react'
import { dailySummaries } from '../data/stats'
import { loadSurvival } from '../data/load'
import type { GhostLander, SeriesFile, SurvivalFile } from '../data/types'

// Analysis graphics for the film. Every mark is drawn from a data file (series, survival, top10).
// Three colours only: space black, moon grey, sunlight amber. Amber = Sun / alive; moon white = Earth; dark = lost.

const AMBER = '#ffb547'
const EARTH = '#d8dbe2'
const GOOD = '#ffb547'
const INK = '#ecebe6'
const MUTED = '#6b6b69'

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
const MONTH_START = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]

/**
 * The time bar of the ground shot. Two rows of 365 days (Sun above, Earth below), brightness = share of
 * the day the body clears the horizon. It is also the slider: click or drag to travel through 2027.
 */
export function YearStrip({ series, hour, onSeek }: { series: SeriesFile; hour: number; onSeek: (h: number) => void }) {
  const days = useMemo(() => dailySummaries(series), [series])
  const ref = useRef<SVGSVGElement>(null)
  const W = 365
  const total = series.sun_el.length
  const seek = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    onSeek(Math.max(0, Math.min(total - 1, Math.round(((e.clientX - r.left) / r.width) * total))))
  }
  const x = (hour / total) * W
  return (
    <svg
      ref={ref}
      className="mm-year"
      viewBox={`0 0 ${W} 44`}
      preserveAspectRatio="none"
      role="slider"
      tabIndex={0}
      aria-label="Day of 2027"
      aria-valuemin={0}
      aria-valuemax={total - 1}
      aria-valuenow={Math.round(hour)}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        seek(e)
      }}
      onPointerMove={(e) => e.buttons === 1 && seek(e)}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 24 * 7 : 24
        if (e.key === 'ArrowRight') onSeek(Math.min(total - 1, hour + step))
        if (e.key === 'ArrowLeft') onSeek(Math.max(0, hour - step))
      }}
    >
      {days.map((d, i) => (
        <g key={i}>
          <rect x={i} y={0} width={1.05} height={15} fill={AMBER} opacity={0.08 + 0.92 * d.sun} />
          <rect x={i} y={17} width={1.05} height={15} fill={EARTH} opacity={0.08 + 0.92 * d.earth} />
        </g>
      ))}
      {MONTH_START.map((m, i) => (
        <g key={i}>
          <line x1={m} x2={m} y1={33} y2={37} stroke={MUTED} strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
        </g>
      ))}
      <line x1={x} x2={x} y1={-2} y2={34} stroke={INK} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function YearLabels() {
  return (
    <div className="mm-year-labels" aria-hidden="true">
      {MONTHS.map((m, i) => (
        <span key={i} style={{ left: `${(MONTH_START[i] / 365) * 100}%` }}>
          {m}
        </span>
      ))}
    </div>
  )
}

const aliveAt = (landers: GhostLander[], h: number) => landers.reduce((n, l) => n + (l.died_at_h == null || l.died_at_h > h ? 1 : 0), 0)

/**
 * Landers still alive, day by day. It is also the playback bar of the crash test: drag along the
 * curve to move through the two weeks. One green line, one amber dot.
 */
export function SurvivalChart({ landers, hour, hours, onSeek }: { landers: GhostLander[]; hour: number; hours: number; onSeek?: (h: number) => void }) {
  const W = 760, H = 84
  const n = landers.length
  const ref = useRef<SVGSVGElement>(null)
  const sx = (h: number) => (h / hours) * W
  const curve = useMemo(() => {
    const pts: [number, number][] = []
    for (let h = 0; h <= hours; h += 3) pts.push([h, aliveAt(landers, h) / n])
    return pts
  }, [landers, hours, n])
  const lowest = Math.min(...curve.map((c) => c[1]))
  const floor = lowest > 0.7 ? Math.max(0, Math.floor(lowest * 10) / 10 - 0.1) : 0
  const sy = (f: number) => 8 + (1 - (f - floor) / (1 - floor)) * (H - 16)
  const d = (pts: [number, number][]) => pts.map(([h, f], i) => `${i ? 'L' : 'M'}${sx(h).toFixed(1)},${sy(f).toFixed(1)}`).join(' ')
  const done = curve.filter(([h]) => h <= hour)
  const nowF = aliveAt(landers, hour) / n
  if (done.length && done[done.length - 1][0] < hour) done.push([hour, nowF])
  const seek = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    onSeek?.(Math.max(0, Math.min(hours, Math.round(((e.clientX - r.left) / r.width) * hours))))
  }
  return (
    <svg
      ref={ref}
      className="mm-surv"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="slider"
      tabIndex={0}
      aria-label="Hours since landing"
      aria-valuemin={0}
      aria-valuemax={hours}
      aria-valuenow={Math.round(hour)}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        seek(e)
      }}
      onPointerMove={(e) => e.buttons === 1 && seek(e)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') onSeek?.(Math.min(hours, hour + 12))
        if (e.key === 'ArrowLeft') onSeek?.(Math.max(0, hour - 12))
      }}
    >
      <defs>
        <linearGradient id="sv-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={GOOD} stopOpacity="0.45" />
          <stop offset="1" stopColor={GOOD} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={`${d(curve)} L${W},${H} L0,${H} Z`} fill="rgba(236,235,230,0.06)" />
      {done.length > 1 && <path d={`${d(done)} L${sx(hour)},${H} L0,${H} Z`} fill="url(#sv-fill)" />}
      {done.length > 1 && <path d={d(done)} fill="none" stroke={GOOD} strokeWidth={2.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
      <line x1={sx(hour)} x2={sx(hour)} y1={0} y2={H} stroke={INK} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export interface BarRow {
  label: string
  color: string
  a: number | undefined
  b: number | undefined
}

/** Two regions, one pair of bars per metric. Values are percentages from the series files. */
export function CompareBars({ rows, nameA, nameB }: { rows: BarRow[]; nameA: string; nameB: string }) {
  return (
    <div className="mm-bars">
      <div className="mm-bars-key">
        <span>
          <i className="solid" /> {nameA}
        </span>
        <span>
          <i /> {nameB}
        </span>
      </div>
      {rows.map((r) => (
        <div className="mm-bars-row" key={r.label} style={{ ['--c' as string]: r.color }}>
          <span className="lbl">{r.label}</span>
          <div className="pair">
            {[r.a, r.b].map((v, i) => (
              <div className="track" key={i}>
                <div className={'fill' + (i ? ' outline' : '')} style={{ width: v == null ? 0 : `${Math.max(1.5, v)}%`, animationDelay: `${0.35 + i * 0.1}s` }} />
                <span className="num val">{v == null ? '…' : `${Math.round(v)}%`}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

const mix = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t))
/** 0 = lander dies, 1 = survives: survival is light. Dark moon grey, brightening into sunlight amber near the top. */
export const heat = (p: number) => {
  const t = Math.max(0, Math.min(1, (p - 0.3) / 0.66))
  const c = mix([62, 63, 68], [255, 181, 71], Math.pow(t, 1.8))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

/** Same scale for text: never darker than readable grey on black, amber at the top. */
export const heatText = (p: number) => {
  const t = Math.max(0, Math.min(1, (p - 0.3) / 0.66))
  const c = mix([150, 150, 154], [255, 181, 71], Math.pow(t, 1.6))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

export type SurvivalByDay = Record<string, Map<number, { p: number; slip: number }>>

const T0 = Date.UTC(2027, 0, 1)
export const dayOfIso = (iso: string) => Math.floor((Date.parse(iso) - T0) / 86_400_000)

/** All nine regions' survival files, indexed by landing day of 2027. Loaded once, only when asked. */
export function useSurvivalAll(ids: string[], enabled: boolean): SurvivalByDay {
  const [files, setFiles] = useState<Record<string, SurvivalFile>>({})
  useEffect(() => {
    if (!enabled || !ids.length) return
    let alive = true
    Promise.all(ids.map((id) => loadSurvival(id).then((f) => [id, f] as const).catch(() => null))).then((all) => {
      if (alive) setFiles(Object.fromEntries(all.filter((x): x is readonly [string, SurvivalFile] => !!x)))
    })
    return () => {
      alive = false
    }
  }, [ids, enabled])
  return useMemo(() => {
    const out: SurvivalByDay = {}
    for (const [id, f] of Object.entries(files)) {
      const m = new Map<number, { p: number; slip: number }>()
      for (const w of f.windows) m.set(dayOfIso(w.landing_utc), { p: w.p_survive_14d, slip: w.slip_tolerance_days })
      out[id] = m
    }
    return out
  }, [files])
}

/**
 * The date control of the pole shot. Rows are the nine regions, columns the days of 2027, colour is the
 * chance of surviving 14 days. Drag along it: the beacons on the 3D pole change colour with the day.
 */
export function DateScrubber({
  siteIds,
  names,
  data,
  day,
  selected,
  onScrub,
}: {
  siteIds: string[]
  names: Record<string, string>
  data: SurvivalByDay
  day: number
  selected: string | null
  onScrub: (day: number) => void
}) {
  const ref = useRef<SVGSVGElement>(null)
  const LABEL_W = 128, ROW = 15, GAP = 3, TOP = 2, W = 700
  const cols = 365
  const cw = (W - LABEL_W) / cols
  const H = TOP + siteIds.length * (ROW + GAP) + 16
  const at = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * W
    return { day: Math.max(0, Math.min(cols - 1, Math.floor((x - LABEL_W) / cw))) }
  }
  const cx = LABEL_W + (day + 0.5) * cw
  return (
    <svg
      ref={ref}
      className="mm-scrub"
      viewBox={`0 0 ${W} ${H}`}
      role="slider"
      tabIndex={0}
      aria-label="Landing day in 2027"
      aria-valuemin={0}
      aria-valuemax={cols - 1}
      aria-valuenow={day}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        onScrub(at(e).day)
      }}
      onPointerMove={(e) => e.buttons === 1 && onScrub(at(e).day)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') onScrub(Math.min(cols - 1, day + (e.shiftKey ? 7 : 1)))
        if (e.key === 'ArrowLeft') onScrub(Math.max(0, day - (e.shiftKey ? 7 : 1)))
      }}
    >
      {siteIds.map((id, r) => {
        const y = TOP + r * (ROW + GAP)
        const m = data[id]
        return (
          <g key={id}>
            <text x={LABEL_W - 8} y={y + ROW - 3} textAnchor="end" className={'wf-name' + (id === selected ? ' on' : '')}>
              {names[id] ?? id}
            </text>
            <rect x={LABEL_W} y={y} width={W - LABEL_W} height={ROW} fill="rgba(236,235,230,0.05)" />
            {m && Array.from(m.entries()).map(([d, v]) => (d >= 0 && d < cols ? <rect key={d} x={LABEL_W + d * cw} y={y} width={cw + 0.4} height={ROW} fill={heat(v.p)} shapeRendering="crispEdges" /> : null))}
            {id === selected && <rect x={LABEL_W - 0.5} y={y - 0.5} width={W - LABEL_W + 1} height={ROW + 1} fill="none" stroke={AMBER} strokeWidth={1} vectorEffect="non-scaling-stroke" />}
          </g>
        )
      })}
      {MONTH_START.map((m, i) => (
        <text key={i} x={LABEL_W + (m + 2) * cw} y={H - 2} className="ax">
          {MONTHS[i]}
        </text>
      ))}
      <line x1={cx} x2={cx} y1={0} y2={H - 12} stroke={INK} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/**
 * The pole's date control, reduced to a line: the selected region's 2027 as a thin strip of light
 * (bright = a landing that day survives 14 days), a playhead and the date. The terrain stays visible.
 */
export function DayTrack({ data, day, onScrub, label }: { data: Map<number, { p: number }> | undefined; day: number; onScrub: (day: number) => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const cols = 365
  const at = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    return Math.max(0, Math.min(cols - 1, Math.floor(((e.clientX - r.left) / r.width) * cols)))
  }
  const cells = useMemo(() => {
    if (!data) return null
    return Array.from(data.entries()).map(([d, v]) => (d >= 0 && d < cols ? <rect key={d} x={d} y={0} width={1.02} height={1} fill={heat(v.p)} /> : null))
  }, [data])
  const x = ((day + 0.5) / cols) * 100
  return (
    <div
      ref={ref}
      className="daytrack"
      role="slider"
      tabIndex={0}
      aria-label="Landing day in 2027"
      aria-valuemin={0}
      aria-valuemax={cols - 1}
      aria-valuenow={day}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        onScrub(at(e))
      }}
      onPointerMove={(e) => e.buttons === 1 && onScrub(at(e))}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') onScrub(Math.min(cols - 1, day + (e.shiftKey ? 7 : 1)))
        if (e.key === 'ArrowLeft') onScrub(Math.max(0, day - (e.shiftKey ? 7 : 1)))
      }}
    >
      <div className="daytrack-head" style={{ left: `${Math.min(82, Math.max(18, x))}%` }}>
        <b className="num">{label}</b>
      </div>
      <svg viewBox={`0 0 ${cols} 1`} preserveAspectRatio="none" className="daytrack-strip">
        <rect x={0} y={0} width={cols} height={1} fill="rgba(236,235,230,0.08)" />
        {cells}
      </svg>
      <i className="daytrack-head-line" style={{ left: `${x}%` }} />
      <div className="daytrack-months num" aria-hidden="true">
        {MONTHS.map((m, i) => (
          <span key={i} style={{ left: `${(MONTH_START[i] / cols) * 100}%` }}>
            {m}
          </span>
        ))}
      </div>
    </div>
  )
}
