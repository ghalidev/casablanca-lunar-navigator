import React, { useEffect, useRef } from 'react'
import { AbsoluteFill, Audio, Easing, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import timings from '../public/voice-timings.json'
import X from '../public/explainer.json'

/*
 * LASTLIGHT explainer, 30 s, 1920x1080. One illustrated idea per spoken line; the only running text is the subtitle.
 * Every curve and number is real pipeline output (video/public/explainer.json, made by scripts/explainer_data.py
 * from web/public/data). Audio is mixed offline (scripts/mix.py -> public/mix.wav): voice first, music 20 dB under it.
 */

const FPS = 30
const W = 1920
const H = 1080
const S = (s: number) => Math.round(s * FPS)
const BG = '#0e1014'
const FG = '#ecebe6'
const DIM = 'rgba(236,235,230,0.58)'
const SUN = '#ffb547'
const EARTH = '#ecebe6'
const GOOD = '#ffb547'
const FAIL = '#6b6e76'
const sans = "'IBM Plex Sans', system-ui, sans-serif"
const mono = "'IBM Plex Sans', system-ui, sans-serif" // figures: tabular Plex Sans, no monospace
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
const soft = Easing.bezier(0.33, 0, 0.2, 1)
const lerp = (f: number, a: number[], b: number[], e: (t: number) => number = soft) => interpolate(f, a, b, { ...clamp, easing: e })
const pop = (f: number, at: number, fps = FPS) => spring({ frame: f - at, fps, config: { damping: 14, mass: 0.6, stiffness: 140 } })

// ------------------------------------------------------------------------------------------------ shared art
/** A generic lander, drawn flat: gold body, four legs, one dark solar panel, a status light. */
function Lander({ x, y, scale = 1, rot = 0, light = GOOD, panelLit = 1 }: { x: number; y: number; scale?: number; rot?: number; light?: string; panelLit?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${scale})`}>
      {/* legs: origin = ground under the lander */}
      <path d="M-34 0 L-22 -30 M34 0 L22 -30 M-14 0 L-10 -28 M14 0 L10 -28" stroke="#c9ccd6" strokeWidth={4} strokeLinecap="round" />
      <rect x={-44} y={-3} width={18} height={5} rx={2} fill="#c9ccd6" />
      <rect x={26} y={-3} width={18} height={5} rx={2} fill="#c9ccd6" />
      <rect x={-30} y={-70} width={60} height={42} rx={8} fill="#e2a93b" />
      <path d="M-30 -56 H30 M-30 -42 H30" stroke="#b9822a" strokeWidth={2} />
      {/* panel on the side, its colour shows whether light reaches it */}
      <rect x={30} y={-74} width={40} height={50} rx={4} fill={panelLit > 0.5 ? '#c98f2e' : '#24262c'} stroke="#9a9da6" strokeWidth={2} />
      <path d="M43 -74 V-24 M56 -74 V-24 M30 -57 H70 M30 -41 H70" stroke="#9a9da6" strokeWidth={1.2} opacity={0.8} />
      <circle cx={0} cy={-80} r={6} fill={light} />
      <path d="M0 -86 V-100" stroke="#c9ccd6" strokeWidth={3} />
      <circle cx={0} cy={-102} r={4} fill="#c9ccd6" />
    </g>
  )
}

function SunDisc({ x, y, r = 22, glow = 1 }: { x: number; y: number; r?: number; glow?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r * 3.2} fill={SUN} opacity={0.12 * glow} />
      <circle cx={x} cy={y} r={r * 1.8} fill={SUN} opacity={0.22 * glow} />
      <circle cx={x} cy={y} r={r} fill="#ffd27a" />
    </g>
  )
}

function Stars() {
  const f = useCurrentFrame()
  const pts = React.useMemo(() => {
    let s = 3
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    return Array.from({ length: 140 }, () => ({ x: r() * W, y: r() * H, a: 0.2 + r() * 0.6, z: 0.4 + r() * 1.4 }))
  }, [])
  return (
    <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
      {pts.map((p, i) => (
        <circle key={i} cx={(p.x - f * 0.15 * p.z + W) % W} cy={p.y} r={p.z} fill="#fff" opacity={p.a} />
      ))}
    </svg>
  )
}

/** A white card with a soft shadow, the house style for any label that is not the subtitle. */
function Card({ children, x, y, at, style }: { children: React.ReactNode; x: number; y: number; at: number; style?: React.CSSProperties }) {
  const f = useCurrentFrame()
  const k = pop(f, at)
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: `scale(${k})`, transformOrigin: 'center', opacity: Math.min(1, k * 1.5), background: 'rgba(22,24,29,0.92)', color: FG, border: '1px solid rgba(236,235,230,0.14)', borderRadius: 18, padding: '18px 26px', boxShadow: '0 18px 50px rgba(0,0,0,0.45)', fontFamily: sans, ...style }}>
      {children}
    </div>
  )
}

// ------------------------------------------------------------------------------------------------ subtitles
const KEY: Record<number, [string, string]> = {
  0: ['2025', SUN],
  1: ['south pole', SUN],
  2: ['dead', SUN],
  3: ['never rises', SUN],
  4: ['circles', SUN],
  5: ['dark', SUN],
  6: ['crash', SUN],
  7: ['real terrain', SUN],
  8: ['survives', SUN],
  9: ['Open source', SUN],
}
const LINES = timings.segments.map((s: { start: number; end: number; text: string }) => ({
  ...s,
  text: s.text.replace('Last Light', 'LASTLIGHT').replace('South Pole', 'south pole').replace('the sun', 'the Sun'),
}))

function Subtitle() {
  const f = useCurrentFrame()
  const t = f / FPS
  const i = LINES.findIndex((l) => t >= l.start - 0.05 && t < l.end + 0.15)
  if (i < 0) return null
  const l = LINES[i]
  const out = lerp(t, [l.end, l.end + 0.15], [1, 0])
  const [kw, col] = KEY[i] ?? ['', FG]
  const words = l.text.split(' ')
  const kwWords = kw.toLowerCase().split(' ')
  // Words appear in step with the voice (spread over the line by length), each one popping in.
  const total = words.reduce((n, w) => n + w.length + 1, 0)
  let acc = 0
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 70, pointerEvents: 'none' }}>
      <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 48, letterSpacing: '-0.01em', textAlign: 'center', maxWidth: 1600, opacity: out, WebkitTextStroke: '9px rgba(8,9,12,0.92)', paintOrder: 'stroke fill' }}>
        {words.map((w, j) => {
          const at = l.start + (acc / total) * (l.end - l.start) * 0.8
          acc += w.length + 1
          const k = spring({ frame: f - S(at - 0.04), fps: FPS, config: { damping: 15, mass: 0.45, stiffness: 170 } })
          const clean = w.toLowerCase().replace(/[^a-z0-9']/g, '')
          const hot = kw && kwWords.some((x) => x.replace(/[^a-z0-9']/g, '') === clean)
          return (
            <span key={j} style={{ display: 'inline-block', marginRight: '0.26em', color: hot ? col : FG, opacity: Math.min(1, k * 1.4), transform: `translateY(${(1 - k) * 14}px) scale(${0.9 + 0.1 * k})` }}>
              {w}
            </span>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

// ------------------------------------------------------------------------------------------------ 0-7.5 s
/** The Moon turns; the date card; the camera dives to the south pole; Athena lands, tips over, its battery dies. */
function Athena() {
  const f = useCurrentFrame()
  const t = f / FPS
  const dive = lerp(t, [2.1, 3.3], [0, 1])
  const R = 330
  const moonScale = 1 + 9 * dive
  // the pole (bottom of the disc) moves to the ground line as we dive
  const cx = W / 2
  const cy = H / 2 - 20 + (-R * moonScale + R) * 0 - dive * (R * moonScale - 120) + dive * 0
  const groundY = 700
  const descend = lerp(t, [2.7, 3.9], [-520, 0], Easing.bezier(0.2, 0.7, 0.3, 1))
  const landed = t >= 3.9
  const tip = landed ? spring({ frame: f - S(4.25), fps: FPS, config: { damping: 9, mass: 0.9, stiffness: 90 } }) : 0
  const drain = lerp(t, [5.2, 7.0], [1, 0], Easing.linear)
  const hours = 13 * (1 - drain)
  const dead = t >= 7.0
  const night = lerp(t, [6.6, 7.3], [0, 0.45])
  return (
    <AbsoluteFill style={{ background: BG }}>
      <Stars />
      {/* The Moon, real LROC colour wrapped on a turning disc. */}
      <div
        style={{
          position: 'absolute',
          left: cx - R * moonScale,
          top: cy - R * moonScale,
          width: R * 2 * moonScale,
          height: R * 2 * moonScale,
          borderRadius: '50%',
          backgroundImage: `url(${staticFile('moon/color_2k.jpg')})`,
          backgroundSize: '200% 100%',
          backgroundPositionX: `${-t * 22}px`,
          boxShadow: `inset -${60 * moonScale}px -${20 * moonScale}px ${120 * moonScale}px rgba(0,0,0,0.85), 0 0 80px rgba(160,180,255,0.08)`,
          opacity: 1 - lerp(t, [3.0, 3.5], [0, 1]),
        }}
      />
      {/* Ground of the pole after the dive: a soft grey curve, the low Sun on the left. */}
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0, opacity: lerp(t, [2.9, 3.4], [0, 1]) }}>
        <defs>
          <linearGradient id="gnd" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3a3d44" />
            <stop offset="1" stopColor="#111317" />
          </linearGradient>
        </defs>
        <SunDisc x={250} y={groundY - 30} r={20} glow={1 - night} />
        <path d={`M0 ${groundY} Q ${W / 2} ${groundY - 40} ${W} ${groundY} V ${H} H 0 Z`} fill="url(#gnd)" />
        <path d={`M560 ${groundY - 18} q 50 -26 120 -6 q 40 10 70 2`} stroke="#5d6272" strokeWidth={3} fill="none" opacity={0.6} />
        {t > 2.6 && t < 3.95 && <path d={`M ${W / 2} ${groundY - 560} L ${W / 2} ${groundY - 30 + descend}`} stroke={DIM} strokeWidth={2} strokeDasharray="6 10" />}
        {t > 2.6 && (
          <g>
            {!landed && <path d={`M ${W / 2 - 10} ${groundY + descend} l 10 ${26 + 6 * Math.sin(f)} l 10 -${26 + 6 * Math.sin(f)} z`} fill={SUN} opacity={0.8} />}
            <Lander x={W / 2 + 40 * tip} y={groundY - 22 + descend + 18 * tip} scale={1.6} rot={-96 * tip} light={dead ? '#2a2c31' : drain < 0.25 ? FAIL : GOOD} panelLit={tip > 0.5 ? 0 : 1} />
          </g>
        )}
      </svg>
      <AbsoluteFill style={{ background: '#000', opacity: night, pointerEvents: 'none' }} />
      {/* Date card, then the battery and the mission clock. */}
      {t < 2.6 && (
        <Card x={170} y={190} at={S(0.25)} style={{ padding: 0, overflow: 'hidden', width: 220, textAlign: 'center' }}>
          <div style={{ background: SUN, color: '#0e1014', fontWeight: 700, fontSize: 30, padding: '10px 0', letterSpacing: '0.08em' }}>MARCH</div>
          <div style={{ fontWeight: 800, fontSize: 110, lineHeight: 1.05, padding: '6px 0 0' }}>6</div>
          <div style={{ fontFamily: mono, fontSize: 28, padding: '0 0 14px', color: DIM }}>2025</div>
        </Card>
      )}
      {t >= 5.0 && (
        <>
          <Card x={1240} y={190} at={S(5.05)} style={{ width: 300 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <svg width={92} height={46} viewBox="0 0 92 46">
                <rect x={2} y={2} width={80} height={42} rx={8} fill="none" stroke={FG} strokeWidth={4} />
                <rect x={84} y={14} width={6} height={18} rx={2} fill={FG} />
                <rect x={8} y={8} width={70 * drain} height={30} rx={4} fill={drain > 0.3 ? GOOD : FAIL} />
              </svg>
              <b style={{ fontFamily: mono, fontSize: 40 }}>{Math.round(drain * 100)}%</b>
            </div>
          </Card>
          <Card x={1240} y={340} at={S(5.2)} style={{ width: 300 }}>
            <div style={{ fontFamily: mono, fontSize: 56, fontWeight: 700, color: dead ? FAIL : FG }}>+{hours.toFixed(0)} h</div>
          </Card>
        </>
      )}
    </AbsoluteFill>
  )
}

// ------------------------------------------------------------------------------------------------ 7.5-11.64 s
const SKY = X.skyline as number[]
const CIRCLE = X.circle as { az: number; el: number; frac: number }[]
const K_EL = 46 // px per degree of elevation (exaggerated, labelled)

/** Malapert's real skyline unrolled over 360°, the Sun's month-long loop on it; then the strip bends into a ring. */
function Horizon() {
  const f = useCurrentFrame()
  const t = f / FPS // local, 0 = 7.5 s
  const bend = lerp(t, [2.35, 3.25], [0, 1], Easing.inOut(Easing.cubic))
  const base = 620
  const ringR = 300
  const cx = W / 2, cy = 470
  const place = (az: number, el: number) => {
    const sx = (az / 360) * (W - 200) + 100
    const sy = base - el * K_EL
    const a = ((az - 90) * Math.PI) / 180 // N at the top of the ring
    const r = ringR + el * K_EL * 0.9
    const rx = cx + Math.cos(a) * r
    const ry = cy + Math.sin(a) * r
    return [sx + (rx - sx) * bend, sy + (ry - sy) * bend]
  }
  const pts = SKY.map((e, i) => place(i * 0.5, e))
  const ground = bend < 0.5
    ? `M100 ${H} ` + pts.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(' ') + ` L${W - 100} ${H} Z`
    : 'M' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L') + ' Z'
  const flat = Array.from({ length: 73 }, (_, i) => place(i * 5, 0))
  const prog = lerp(t, [0.35, 4.0], [0, CIRCLE.length - 1], Easing.linear)
  const k = Math.floor(prog)
  const fr = prog - k
  const a = CIRCLE[Math.min(k, CIRCLE.length - 1)]
  const b = CIRCLE[Math.min(k + 1, CIRCLE.length - 1)]
  const daz = ((b.az - a.az + 540) % 360) - 180
  const sunAz = (a.az + daz * fr + 360) % 360
  const sunEl = a.el + (b.el - a.el) * fr
  const [sx, sy] = place(sunAz, sunEl)
  const trail = CIRCLE.slice(0, k + 1).map((c) => place(c.az, c.el))
  const appear = lerp(t, [0, 0.4], [0, 1])
  return (
    <AbsoluteFill style={{ background: BG, opacity: appear }}>
      <Stars />
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
        <path d={'M' + flat.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L')} fill="none" stroke={DIM} strokeWidth={2} strokeDasharray="4 10" />
        {trail.length > 1 && <path d={'M' + trail.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L')} fill="none" stroke={SUN} strokeWidth={4} strokeOpacity={0.55} strokeLinecap="round" />}
        <SunDisc x={sx} y={sy} r={20} />
        <path d={ground} fill={bend < 0.5 ? '#26282e' : 'none'} stroke="#c9cbd6" strokeWidth={3} strokeLinejoin="round" />
        {bend > 0.5 && <Lander x={cx} y={cy + 40} scale={1.1 * bend} />}
        {(['N', 'E', 'S', 'W'] as const).map((l, i) => {
          const [x, y] = place(i * 90, -1.6 - 0.8 * bend)
          return (
            <text key={l} x={x} y={y + 10} fill={DIM} fontFamily={mono} fontSize={28} textAnchor="middle">
              {l}
            </text>
          )
        })}
      </svg>
      {bend < 0.3 && (
        <div style={{ position: 'absolute', right: 110, top: base - 5 * K_EL - 18, fontFamily: mono, fontSize: 22, color: DIM, opacity: 1 - bend * 3 }}>
          5° ─
        </div>
      )}
    </AbsoluteFill>
  )
}

// ------------------------------------------------------------------------------------------------ 11.64-14.28 s
const RSKY = X.ridge_skyline as number[]
const RIDGE = X.ridge as { az: number; el: number; frac: number }[]

/** Nobile Rim 2, a real moment of 2027: the Sun, still above the flat horizon, slides behind a ridge. */
function Ridge() {
  const f = useCurrentFrame()
  const t = f / FPS // local, 0 = 11.64 s
  // auto-fit: window centred on the Sun path, same scale in azimuth and elevation (the disc and the ridge are true to size)
  const sAz = RIDGE.map((r) => r.az), sEl = RIDGE.map((r) => r.el)
  const azMid = (Math.min(...sAz) + Math.max(...sAz)) / 2
  const az0 = Math.round(azMid - 21), az1 = az0 + 42
  const win = RSKY.slice(az0 * 2, az1 * 2 + 1)
  const elLo = Math.min(...win, 0) - 0.6, elHi = Math.max(...win, ...sEl) + 0.6
  const kEl = W / (az1 - az0)
  const base = 560 + ((elLo + elHi) / 2) * kEl
  const x = (az: number) => ((az - az0) / (az1 - az0)) * W
  const y = (el: number) => base - el * kEl
  const prog = lerp(t, [0.2, 2.2], [0, RIDGE.length - 1], Easing.inOut(Easing.quad))
  const k = Math.min(RIDGE.length - 2, Math.floor(prog))
  const fr = prog - k
  const az = RIDGE[k].az + (RIDGE[k + 1].az - RIDGE[k].az) * fr
  const el = RIDGE[k].el + (RIDGE[k + 1].el - RIDGE[k].el) * fr
  const lit = RIDGE[k].frac + (RIDGE[k + 1].frac - RIDGE[k].frac) * fr
  const pts: string[] = []
  for (let i = Math.floor(az0 * 2); i <= Math.ceil(az1 * 2); i++) pts.push(`${x(i / 2).toFixed(1)},${y(RSKY[i % 720]).toFixed(1)}`)
  const dark = 1 - lit
  const appear = lerp(t, [0, 0.35], [0, 1])
  return (
    <AbsoluteFill style={{ background: BG, opacity: appear }}>
      <Stars />
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
        <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke={DIM} strokeWidth={2} strokeDasharray="4 10" />
        <text x={30} y={y(0) - 12} fill={DIM} fontFamily={mono} fontSize={22}>
          flat horizon 0°
        </text>
        <path d={`M${RIDGE.map((r) => `${x(r.az).toFixed(1)},${y(r.el).toFixed(1)}`).join(' L')}`} fill="none" stroke={SUN} strokeWidth={2.5} strokeDasharray="3 9" strokeLinecap="round" opacity={0.55 * lerp(t, [0.2, 0.6], [0, 1])} />
        <SunDisc x={x(az)} y={y(el)} r={Math.max(14, 0.267 * kEl)} glow={0.4 + 0.6 * lit} />
        <path d={`M0 ${H} L${pts.join(' L')} L${W} ${H} Z`} fill="#26282e" stroke="#c9cbd6" strokeWidth={3} strokeLinejoin="round" />
        <path d={`M0 ${H - 70} Q${W / 2} ${H - 120} ${W} ${H - 60} L${W} ${H} L0 ${H} Z`} fill="#111317" />
        <Lander x={260} y={H - 84} scale={1.4} panelLit={lit} light={lit > 0.5 ? GOOD : FAIL} />
      </svg>
      <AbsoluteFill style={{ background: '#000', opacity: 0.45 * dark, pointerEvents: 'none' }} />
    </AbsoluteFill>
  )
}

// ------------------------------------------------------------------------------------------------ 14.28-19.62 s
const SLOPE = X.slope as { nx: number; step_m: number; half_m: number; deg: number[] }
const LANDERS = X.landers as [number, number, number | null][]

function SlopeMap({ size }: { size: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current!
    const g = c.getContext('2d')!
    const n = SLOPE.nx
    const img = g.createImageData(n, n)
    for (let iy = 0; iy < n; iy++) {
      for (let ix = 0; ix < n; ix++) {
        const s = Math.min(1, SLOPE.deg[iy * n + ix] / 20)
        const o = ((n - 1 - iy) * n + ix) * 4 // north up
        img.data[o] = 26 + 120 * s
        img.data[o + 1] = 27 + 118 * s
        img.data[o + 2] = 31 + 112 * s
        img.data[o + 3] = 255
      }
    }
    g.putImageData(img, 0, 0)
  }, [])
  return <canvas ref={ref} width={SLOPE.nx} height={SLOPE.nx} style={{ width: size, height: size, imageRendering: 'auto', borderRadius: 24, filter: 'blur(0.5px)' }} />
}

/** 1,000 simulated landings on Malapert's real terrain slope; then 14 days pass and each one lives or dies. */
function Crash() {
  const f = useCurrentFrame()
  const t = f / FPS // local, 0 = 14.28 s
  const size = 760
  const left = W / 2 - size / 2 - 220, top = 150
  const m2px = size / (2 * SLOPE.half_m)
  const hour = lerp(t, [2.3, 4.3], [0, 336], Easing.inOut(Easing.quad))
  const alive = LANDERS.filter((l) => l[2] == null || l[2] > hour).length
  const total = X.n_draws * X.n_days * X.n_sites
  const appear = lerp(t, [0, 0.4], [0, 1])
  return (
    <AbsoluteFill style={{ background: BG, opacity: appear }}>
      <Stars />
      <div style={{ position: 'absolute', left, top, transform: `scale(${lerp(t, [0, 5.3], [0.96, 1.02])})` }}>
        <SlopeMap size={size} />
        <svg width={size} height={size} style={{ position: 'absolute', inset: 0 }}>
          {[100, 250, 400].map((r) => (
            <circle key={r} cx={size / 2} cy={size / 2} r={r * m2px} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={2} strokeDasharray="6 8" />
          ))}
          {LANDERS.map((l, i) => {
            const at = 0.35 + (i / LANDERS.length) * 1.6
            const k = lerp(t, [at, at + 0.25], [0, 1], Easing.out(Easing.back(2)))
            if (k <= 0) return null
            const x = size / 2 + l[0] * m2px
            const y = size / 2 - l[1] * m2px
            if (x < 0 || y < 0 || x > size || y > size) return null
            const dead = l[2] != null && (l[2] as number) <= hour && t > 2.3
            return <circle key={i} cx={x} cy={y} r={5.5 * k} fill={dead ? FAIL : GOOD} stroke="#0e1014" strokeWidth={1.2} opacity={0.95} />
          })}
          <circle cx={size / 2} cy={size / 2} r={9} fill={SUN} stroke="#0e1014" strokeWidth={3} />
        </svg>
      </div>
      <Card x={left + size + 70} y={top + 230} at={S(0.6)} style={{ width: 470 }}>
        <div style={{ fontFamily: mono, fontSize: 84, fontWeight: 700, color: alive / LANDERS.length > 0.5 ? SUN : FAIL, lineHeight: 1 }}>{t < 2.3 ? LANDERS.length : alive}</div>
        <div style={{ fontSize: 26, fontWeight: 600, marginTop: 8 }}>{t < 2.3 ? 'landings' : `alive · day ${Math.min(14, Math.floor(hour / 24))}`}</div>
        <div style={{ height: 10, background: '#2a2c31', borderRadius: 5, marginTop: 16, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(hour / 336) * 100}%`, background: SUN }} />
        </div>
      </Card>
    </AbsoluteFill>
  )
}

// ------------------------------------------------------------------------------------------------ 19.62-23.46 s
const BEST = X.best as { id: string; name: string; p: number; date: string; lat: number; lon: number }[]

/** The answer: the logo, then the best landing day of each region, ranked, bars growing one after the other. */
function Ranking() {
  const f = useCurrentFrame()
  const t = f / FPS // local, 0 = 19.62 s
  const logo = pop(f, S(0.1))
  return (
    <AbsoluteFill style={{ background: BG, opacity: lerp(t, [0, 0.35], [0, 1]) }}>
      <Stars />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 70, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 22, transform: `scale(${0.7 + 0.3 * logo})`, opacity: logo }}>
        <Img src={staticFile('shots/lastlight-mark.svg')} style={{ width: 84 }} />
        <div style={{ fontFamily: mono, fontWeight: 600, fontSize: 64, letterSpacing: '0.02em', color: FG }}>LASTLIGHT</div>
      </div>
      <div style={{ position: 'absolute', left: 300, top: 260, width: 1320 }}>
        {BEST.map((b, i) => {
          const k = lerp(t, [0.5 + i * 0.12, 1.3 + i * 0.12], [0, 1], Easing.out(Easing.cubic))
          const top = i === 0
          const hl = top ? pop(f, S(2.0)) : 0
          return (
            <div key={b.name} style={{ display: 'grid', gridTemplateColumns: '330px 1fr 140px', alignItems: 'center', gap: 22, height: 60, opacity: Math.min(1, k * 2), transform: `translateX(${(1 - k) * -30}px)` }}>
              <span style={{ fontFamily: sans, fontSize: 30, fontWeight: top ? 600 : 400, color: top ? FG : DIM }}>{b.name}</span>
              <span style={{ height: 14, background: 'rgba(236,235,230,0.07)', borderRadius: 7, overflow: 'hidden' }}>
                <i style={{ display: 'block', height: '100%', width: `${b.p * 100 * k}%`, background: top ? SUN : b.p >= 0.8 ? '#a8865a' : '#5a5d64', borderRadius: 7, boxShadow: top ? `0 0 ${18 * hl}px ${SUN}` : 'none' }} />
              </span>
              <span style={{ fontFamily: mono, fontSize: 30, fontWeight: 500, color: top ? SUN : FG, textAlign: 'right' }}>{(b.p * 100 * k).toFixed(1)}%</span>
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

// ------------------------------------------------------------------------------------------------ 23.46-30 s
/** The south pole seen from above (lat rings 84°, 86°, 88°), the nine Artemis III regions lighting up; then the end card. */
function PoleMap() {
  const f = useCurrentFrame()
  const t = f / FPS // local, 0 = 23.46 s
  const cx = W / 2, cy = 480, R = 470 // R px at 83°S
  const place = (lat: number, lon: number) => {
    const r = ((90 + lat) / 7) * R
    const a = (lon * Math.PI) / 180
    return [cx + r * Math.sin(a), cy - r * Math.cos(a)]
  }
  const spin = lerp(t, [0, 3.6], [-8, 0])
  const end = lerp(t, [3.55, 4.2], [0, 1])
  const fadeOut = lerp(t, [6.2, 6.54], [1, 0])
  return (
    <AbsoluteFill style={{ background: BG, opacity: fadeOut * lerp(t, [0, 0.35], [0, 1]) }}>
      <Stars />
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0, opacity: 1 - end * 0.85, transform: `scale(${1 - end * 0.06})`, transformOrigin: `${cx}px ${cy}px` }}>
        <g transform={`rotate(${spin} ${cx} ${cy})`}>
          {[84, 86, 88].map((lat, i) => {
            const r = ((90 - lat) / 7) * R
            const k = lerp(t, [0.05 + i * 0.12, 0.7 + i * 0.12], [0, 1])
            const c = 2 * Math.PI * r
            return <circle key={lat} cx={cx} cy={cy} r={r} fill="none" stroke="rgba(236,235,230,0.18)" strokeWidth={2} strokeDasharray={`${c * k} ${c}`} />
          })}
          {[0, 90, 180, 270].map((lon) => {
            const [x, y] = place(-83.6, lon)
            return <line key={lon} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(236,235,230,0.08)" strokeWidth={1.5} />
          })}
          <circle cx={cx} cy={cy} r={6} fill={FG} />
          {BEST.map((b, i) => {
            const [x, y] = place(b.lat, b.lon)
            const k = pop(f, S(0.6 + i * 0.14))
            const good = b.p >= 0.95
            return (
              <g key={b.id} transform={`translate(${x} ${y}) rotate(${-spin}) scale(${k})`}>
                <circle r={good ? 34 : 22} fill={SUN} opacity={0.14 * b.p} />
                <circle r={good ? 12 : 9} fill={b.p >= 0.8 ? SUN : '#6b6e76'} />
                {good && <text x={-26} y={9} textAnchor="end" fill={FG} fontFamily={sans} fontSize={28} fontWeight={600} opacity={lerp(t, [1.4, 1.8], [0, 1])}>{b.name}</text>}
              </g>
            )
          })}
        </g>
        <text x={cx + 12} y={cy - 12} fill="rgba(236,235,230,0.5)" fontFamily={mono} fontSize={18} opacity={lerp(t, [0.6, 1], [0, 1])}>South Pole</text>
      </svg>
      {end > 0 && (
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: end, transform: `translateY(${(1 - end) * 16}px)` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <Img src={staticFile('shots/lastlight-mark.svg')} style={{ width: 120 }} />
            <div style={{ fontFamily: mono, fontWeight: 600, fontSize: 84, letterSpacing: '0.02em', color: FG }}>LASTLIGHT</div>
          </div>
          <div style={{ fontFamily: sans, fontSize: 36, color: DIM, marginTop: 24 }}>Choose where and when your lander survives the lunar south pole.</div>
          <div style={{ fontFamily: sans, fontSize: 24, color: DIM, marginTop: 40 }}>Casablanca, We Have A Solution · Adam, Ghali, Yassine · NASA Space Apps Challenge 2026</div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  )
}

// ------------------------------------------------------------------------------------------------ film
/** Crossfade between scenes: the outgoing one stays under the incoming fade-in (no hard cuts, no flashes). */
export function Film2D() {
  const { durationInFrames } = useVideoConfig()
  const f = useCurrentFrame()
  const t = f / FPS
  const X0 = 0.35
  return (
    <AbsoluteFill style={{ background: BG, fontVariantNumeric: 'tabular-nums' }}>
      <Audio src={staticFile('film_mix.wav')} />
      <Sequence from={0} durationInFrames={S(7.5 + X0)}>
        <Athena />
      </Sequence>
      <Sequence from={S(7.5)} durationInFrames={S(4.14 + X0)}>
        <Horizon />
      </Sequence>
      <Sequence from={S(11.64)} durationInFrames={S(2.64 + X0)}>
        <Ridge />
      </Sequence>
      <Sequence from={S(14.28)} durationInFrames={S(5.34 + X0)}>
        <Crash />
      </Sequence>
      <Sequence from={S(19.62)} durationInFrames={S(3.84 + X0)}>
        <Ranking />
      </Sequence>
      <Sequence from={S(23.46)} durationInFrames={durationInFrames - S(23.46)}>
        <PoleMap />
      </Sequence>
      <AbsoluteFill style={{ background: 'radial-gradient(120% 95% at 50% 45%, transparent 60%, rgba(0,0,0,0.55) 100%)', pointerEvents: 'none' }} />
      <Subtitle />
      <div style={{ position: 'absolute', top: 34, right: 44, fontFamily: mono, fontSize: 17, color: 'rgba(236,235,230,0.45)' }}>AI-generated voice</div>
      {t > 27.4 && (
        <div style={{ position: 'absolute', bottom: 26, left: 0, right: 0, textAlign: 'center', fontFamily: mono, fontSize: 15, color: 'rgba(236,235,230,0.42)', opacity: lerp(t, [27.4, 28], [0, 1]) }}>
          Music: “Mesmerizing Galaxy” by Kevin MacLeod (incompetech.com), CC BY 4.0 · Data: NASA LOLA, NAIF SPICE, LROC
        </div>
      )}
      <AbsoluteFill style={{ background: '#000', opacity: Math.max(lerp(t, [0, 0.4], [1, 0]), lerp(f, [durationInFrames - 10, durationInFrames - 1], [0, 1])), pointerEvents: 'none' }} />
    </AbsoluteFill>
  )
}
