import { useMemo } from 'react'
import type { SeriesFile, Site } from '../data/types'

const W = 1200
const H = 300
const PAD_B = 26

interface Props {
  site: Site
  series: SeriesFile
  idx: number // current hour index in the series
  trailHours?: number
}

/** 360° panorama of the terrain horizon seen from the site, with the Sun and Earth at time `idx`. */
export function HorizonRing({ site, series, idx, trailHours = 24 * 30 }: Props) {
  const hor = site.horizon.mast_2m

  const range = useMemo(() => {
    let lo = Math.min(...hor)
    let hi = Math.max(...hor)
    for (let k = 0; k < series.sun_el.length; k += 6) {
      hi = Math.max(hi, series.sun_el[k], series.earth_el[k])
      lo = Math.min(lo, Math.min(series.sun_el[k], series.earth_el[k]))
    }
    lo = Math.max(lo, -3)
    return { lo: Math.floor(lo - 0.5), hi: Math.ceil(hi + 1) }
  }, [hor, series])

  const x = (az: number) => (((az % 360) + 360) % 360) * (W / 360)
  const y = (el: number) => (H - PAD_B) - ((el - range.lo) / (range.hi - range.lo)) * (H - PAD_B - 10)

  const ground = useMemo(() => {
    const pts = hor.map((el, i) => `${(i * 0.5 * W) / 360},${y(el)}`)
    return `M0,${H} L${pts.join(' L')} L${W},${y(hor[0])} L${W},${H} Z`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hor, range])

  const trail = (azArr: number[], elArr: number[]) => {
    const segs: string[] = []
    let cur = ''
    let prevX = -1
    for (let k = idx; k < Math.min(idx + trailHours, azArr.length); k += 2) {
      const px = x(azArr[k])
      const py = y(elArr[k])
      if (prevX >= 0 && Math.abs(px - prevX) > W / 2) {
        segs.push(cur)
        cur = ''
      }
      cur += (cur ? ' L' : 'M') + `${px.toFixed(1)},${py.toFixed(1)}`
      prevX = px
    }
    if (cur) segs.push(cur)
    return segs
  }

  const sunVis = series.sun_frac[idx] ?? 0
  const sx = x(series.sun_az[idx])
  const sy = y(series.sun_el[idx])
  const ex = x(series.earth_az[idx])
  const ey = y(series.earth_el[idx])
  const lit = sunVis > 0.5

  const ticks = [
    [0, 'N'],
    [45, 'NE'],
    [90, 'E'],
    [135, 'SE'],
    [180, 'S'],
    [225, 'SW'],
    [270, 'W'],
    [315, 'NW'],
  ] as const

  return (
    <svg className={'horizon-ring' + (lit ? ' lit' : '')} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Horizon around ${site.name} with the Sun and Earth`}>
      <defs>
        <linearGradient id="sky-lit" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#05070d" />
          <stop offset="1" stopColor="#121316" />
        </linearGradient>
        <linearGradient id="ground-lit" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8d877c" />
          <stop offset="1" stopColor="#2a2a2e" />
        </linearGradient>
        <linearGradient id="ground-dark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3a40" />
          <stop offset="1" stopColor="#14141a" />
        </linearGradient>
        <radialGradient id="sun-glow">
          <stop offset="0" stopColor="#fff6dd" stopOpacity="1" />
          <stop offset="0.25" stopColor="#ffb547" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffb547" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill="url(#sky-lit)" />
      {[range.lo, 0, range.hi].filter((v, i, a) => a.indexOf(v) === i).map((el) => (
        <g key={el}>
          <line x1={0} x2={W} y1={y(el)} y2={y(el)} className="el-line" />
          <text x={6} y={y(el) - 4} className="el-label">
            {el > 0 ? '+' : el < 0 ? '−' : ''}
            {Math.abs(el)}°
          </text>
        </g>
      ))}
      {trail(series.sun_az, series.sun_el).map((d, i) => (
        <path key={`s${i}`} d={d} className="trail sun" />
      ))}
      {trail(series.earth_az, series.earth_el).map((d, i) => (
        <path key={`e${i}`} d={d} className="trail earth" />
      ))}
      <g transform={`translate(${ex} ${ey})`}>
        <circle r={11} fill="#d8dbe2" />
        <path d="M-6 -3 c3 2 5 -2 8 1 s0 5 3 6" stroke="#8d9099" strokeWidth="1.6" fill="none" />
      </g>
      <g transform={`translate(${sx} ${sy})`}>
        <circle r={34} fill="url(#sun-glow)" />
        <circle r={9} fill="#fffaf0" />
      </g>
      <path d={ground} fill={lit ? 'url(#ground-lit)' : 'url(#ground-dark)'} className="ground" />
      <path d={ground} fill="none" stroke={lit ? '#d9d2c4' : '#6b6b73'} strokeWidth="1.2" />
      {ticks.map(([az, l]) => (
        <text key={l} x={x(az) + (az === 0 ? 8 : 0)} y={H - 8} textAnchor={az === 0 ? 'start' : 'middle'} className="az-label">
          {l}
        </text>
      ))}
    </svg>
  )
}
