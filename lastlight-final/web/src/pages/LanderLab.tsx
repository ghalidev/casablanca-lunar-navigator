import { useEffect, useMemo, useState } from 'react'
import { ArrowCounterClockwise } from '@phosphor-icons/react'
import { loadSeries } from '../data/load'
import { REFERENCE, runLander, type LanderSpec } from '../data/lander'
import type { SeriesFile } from '../data/types'

/*
 * "Design your lander": the user's own battery, load, survival heater and panels, run hour by hour through the
 * real Sun and skyline of the chosen region and day (web/src/data/lander.ts mirrors pipeline/survival.py).
 * The 1,000-lander survival above always uses the reference lander; this panel says so.
 */

const DAYS = 14
const FACES = [0, 1, 2, 3, 4, 6, 8]
const facesLabel = (f: number) => (f === 0 ? 'Sun-tracking' : String(f))

// Compact URL form, so a design can be shared: battery-load-heater-faces-area-efficiency%
export function parseLander(v: string | null): LanderSpec {
  const n = (v ?? '').split('_').map(Number)
  if (n.length !== 6 || n.some((x) => !Number.isFinite(x))) return REFERENCE
  const c = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x))
  return { batteryWh: c(n[0], 200, 20000), loadW: c(n[1], 5, 500), heaterW: c(n[2], 0, 500), faces: FACES.includes(n[3]) ? n[3] : 4, areaM2: c(n[4], 0.05, 5), efficiency: c(n[5], 5, 45) / 100 }
}
export const formatLander = (L: LanderSpec) => [L.batteryWh, L.loadW, L.heaterW, L.faces, L.areaM2, Math.round(L.efficiency * 100)].join('_')
const same = (a: LanderSpec, b: LanderSpec) => formatLander(a) === formatLander(b)

/** Join a year's series with the next one, for windows that run past 31 December. */
function join(a: SeriesFile, b: SeriesFile | null): SeriesFile {
  if (!b) return a
  const k = ['sun_el', 'sun_az', 'earth_el', 'earth_az', 'sun_frac', 'earth_frac', 'irradiance_wm2'] as const
  const out = { ...a }
  for (const key of k) out[key] = a[key].concat(b[key])
  return out
}

function Slider({ label, unit, value, min, max, step, onChange }: { label: string; unit: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="ll-row">
      <span className="ll-lbl">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <b className="ll-val">
        {value.toLocaleString('en-US')}
        <small> {unit}</small>
      </b>
    </label>
  )
}

export function LanderLab({ series, siteId, year, startMs, spec, onSpec }: { series: SeriesFile | null; siteId: string | undefined; year: number; startMs: number; spec: LanderSpec; onSpec: (s: LanderSpec) => void }) {
  // Windows that start in late December need the first days of the next year.
  const needsNext = !!series && Math.round((startMs - Date.parse(series.t0)) / 3_600_000) + DAYS * 24 > series.sun_frac.length
  const [next, setNext] = useState<{ key: string; v: SeriesFile | null } | null>(null)
  const nextKey = `${siteId}:${year + 1}`
  useEffect(() => {
    if (!needsNext || !siteId) return
    let on = true
    loadSeries(siteId, year + 1).then((v) => on && setNext({ key: nextKey, v }), () => on && setNext({ key: nextKey, v: null }))
    return () => {
      on = false
    }
  }, [needsNext, siteId, year, nextKey])
  const nextSeries = next && next.key === nextKey ? next.v : null
  const ready = !!series && (!needsNext || (next != null && next.key === nextKey))
  const covered = !needsNext || !!nextSeries

  const run = useMemo(() => (ready && series ? runLander(join(series, needsNext ? nextSeries : null), startMs, DAYS, spec) : null), [ready, series, nextSeries, needsNext, startMs, spec])
  const set = (patch: Partial<LanderSpec>) => onSpec({ ...spec, ...patch })

  // hours with the Sun fully hidden, drawn behind the battery curve
  const dark = useMemo(() => {
    if (!ready || !series) return null
    const s = join(series, needsNext ? nextSeries : null)
    const i0 = Math.round((startMs - Date.parse(s.t0)) / 3_600_000)
    return Array.from({ length: DAYS * 24 }, (_, h) => (s.sun_frac[i0 + h] ?? 0) <= 0)
  }, [ready, series, nextSeries, needsNext, startMs])

  const W = DAYS * 24
  const path = run ? 'M0,0 L' + Array.from(run.soc, (v, i) => `${i + 1},${((1 - v) * 100).toFixed(1)}`).join(' ') : ''
  const alive = run && run.diedH == null

  return (
    <section className="ll" aria-labelledby="ll-h">
      <div className="ll-head">
        <h2 id="ll-h">Try your own lander</h2>
        <button className="ll-reset" onClick={() => onSpec(REFERENCE)} disabled={same(spec, REFERENCE)}>
          <ArrowCounterClockwise size={14} /> Reference lander
        </button>
      </div>

      <div className="ll-grid">
        <div className="ll-ctl">
          <Slider label="Battery" unit="Wh" value={spec.batteryWh} min={500} max={10000} step={100} onChange={(v) => set({ batteryWh: v })} />
          <Slider label="Constant load" unit="W" value={spec.loadW} min={10} max={200} step={5} onChange={(v) => set({ loadW: v })} />
          <Slider label="Heater, Sun hidden" unit="W" value={spec.heaterW} min={0} max={150} step={5} onChange={(v) => set({ heaterW: v })} />
          <Slider label="Panel size, each" unit="m²" value={spec.areaM2} min={0.1} max={3} step={0.05} onChange={(v) => set({ areaM2: Math.round(v * 100) / 100 })} />
          <Slider label="Cell efficiency" unit="%" value={Math.round(spec.efficiency * 100)} min={10} max={40} step={1} onChange={(v) => set({ efficiency: v / 100 })} />
          <div className="ll-row">
            <span className="ll-lbl">Vertical panels</span>
            <div className="ll-seg" role="radiogroup" aria-label="Vertical panels">
              {FACES.map((f) => (
                <button key={f} role="radio" aria-checked={spec.faces === f} className={spec.faces === f ? 'on' : ''} onClick={() => set({ faces: f })}>
                  {facesLabel(f)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="ll-out" aria-live="polite">
          <p className="ll-verdict">
            {!run ? (
              '…'
            ) : !covered ? (
              <span>These 14 days run past 2030, the end of our data.</span>
            ) : alive ? (
              <>
                <b className="ok">Still powered on day 14.</b> Battery never below {Math.round(run.minSoc * 100)}%.
              </>
            ) : (
              <>
                <b>Battery empty on day {Math.floor((run.diedH ?? 0) / 24) + 1}</b>, {Math.round(run.diedH ?? 0)} h after landing.
              </>
            )}
          </p>
          <svg className="ll-chart" viewBox={`0 -4 ${W} 108`} preserveAspectRatio="none" role="img" aria-label="Battery charge over the 14 days, worst heading">
            {dark?.map((d, i) => (d ? <rect key={i} x={i} y={-4} width={1.05} height={108} className="ll-night" /> : null))}
            {Array.from({ length: DAYS - 1 }, (_, d) => (
              <line key={d} x1={(d + 1) * 24} x2={(d + 1) * 24} y1={-4} y2={104} className="ll-tick" />
            ))}
            {run && <path d={path} className={'ll-line' + (alive ? ' ok' : '')} vectorEffect="non-scaling-stroke" />}
          </svg>
          <div className="ll-axis">
            <span>Landing</span>
            <span className="ll-key"><i /> Sun hidden</span>
            <span>Day 14</span>
          </div>
          {run && covered && (
            <p className="ll-note">
              {spec.faces === 0 ? 'Panel always faces the Sun.' : `Worst of 72 headings shown; ${run.aliveHeadings} of 72 headings last the 14 days.`} Upright on the target, no landing error. The 1,000-lander verdict above uses the reference lander (2,500 Wh, 60 W, 4 × 0.75 m², 28%).
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
