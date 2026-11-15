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
const BG = '#0b1020'
const FG = '#f2f0ea'
const DIM = 'rgba(242,240,234,0.6)'
const SUN = '#ffb547'
const EARTH = '#4da3ff'
const GOOD = '#5bd69a'
const FAIL = '#ff5a4e'
const sans = "'Geist Variable', system-ui, sans-serif"
const mono = "'Geist Mono Variable', ui-monospace, monospace"
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
      <rect x={30} y={-74} width={40} height={50} rx={4} fill={panelLit > 0.5 ? '#2b4e9e' : '#1a2238'} stroke="#8fa3d6" strokeWidth={2} />
      <path d="M43 -74 V-24 M56 -74 V-24 M30 -57 H70 M30 -41 H70" stroke="#8fa3d6" strokeWidth={1.2} opacity={0.8} />
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
    <div style={{ position: 'absolute', left: x, top: y, transform: `scale(${k})`, transformOrigin: 'center', opacity: Math.min(1, k * 1.5), background: '#f6f3ea', color: '#141a2e', borderRadius: 22, padding: '18px 26px', boxShadow: '0 18px 50px rgba(0,0,0,0.35)', fontFamily: sans, ...style }}>
      {children}
    </div>
  )
}

// ------------------------------------------------------------------------------------------------ subtitles
const KEY: Record<number, [string, string]> = {
  0: ['2025', SUN],
  1: ['south pole', FG],
  2: ['dead', FAIL],
  3: ['never rises', SUN],
  4: ['circles', SUN],
  5: ['dark', FAIL],
  6: ['crash', FAIL],
  7: ['real terrain', EARTH],
  8: ['survives', GOOD],
  9: ['Open source', GOOD],
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
  const k = spring({ frame: f - S(l.start - 0.05), fps: FPS, config: { damping: 16, mass: 0.5 } })
  const [kw, col] = KEY[i] ?? ['', FG]
  const at = kw ? l.text.toLowerCase().indexOf(kw.toLowerCase()) : -1
  const parts = at >= 0 ? [l.text.slice(0, at), l.text.slice(at, at + kw.length), l.text.slice(at + kw.length)] : [l.text, '', '']
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 66, pointerEvents: 'none' }}>
      <div
        style={{
          fontFamily: sans,
          fontWeight: 800,
          fontSize: 54,
          letterSpacing: '-0.01em',
          color: FG,
          WebkitTextStroke: '10px rgba(5,7,14,0.92)',
          paintOrder: 'stroke fill',
          transform: `translateY(${(1 - k) * 18}px) scale(${0.94 + 0.06 * k})`,
          opacity: k,
          textAlign: 'center',
          maxWidth: 1600,
        }}
      >
        {parts[0]}
        <span style={{ color: col }}>{parts[1]}</span>
        {parts[2]}
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
            <stop offset="0" stopColor="#8b8f9c" />
            <stop offset="1" stopColor="#2a2f40" />
          </linearGradient>
        </defs>
        <SunDisc x={250} y={groundY - 30} r={20} glow={1 - night} />
        <path d={`M0 ${groundY} Q ${W / 2} ${groundY - 40} ${W} ${groundY} V ${H} H 0 Z`} fill="url(#gnd)" />
        <path d={`M560 ${groundY - 18} q 50 -26 120 -6 q 40 10 70 2`} stroke="#5d6272" strokeWidth={3} fill="none" opacity={0.6} />
        {t > 2.6 && t < 3.95 && <path d={`M ${W / 2} ${groundY - 560} L ${W / 2} ${groundY - 30 + descend}`} stroke={DIM} strokeWidth={2} strokeDasharray="6 10" />}
        {t > 2.6 && (
          <g>
            {!landed && <path d={`M ${W / 2 - 10} ${groundY + descend} l 10 ${26 + 6 * Math.sin(f)} l 10 -${26 + 6 * Math.sin(f)} z`} fill={SUN} opacity={0.8} />}
            <Lander x={W / 2 + 40 * tip} y={groundY - 22 + descend + 18 * tip} scale={1.6} rot={-96 * tip} light={dead ? '#30364a' : drain < 0.25 ? FAIL : GOOD} panelLit={tip > 0.5 ? 0 : 1} />
          </g>
        )}
      </svg>
      <AbsoluteFill style={{ background: '#000', opacity: night, pointerEvents: 'none' }} />
      {/* Date card, then the battery and the mission clock. */}
      {t < 2.6 && (
        <Card x={170} y={190} at={S(0.25)} style={{ padding: 0, overflow: 'hidden', width: 220, textAlign: 'center' }}>
          <div style={{ background: FAIL, color: '#fff', fontWeight: 700, fontSize: 30, padding: '10px 0', letterSpacing: '0.08em' }}>MARCH</div>
          <div style={{ fontWeight: 800, fontSize: 110, lineHeight: 1.05, padding: '6px 0 0' }}>6</div>
          <div style={{ fontFamily: mono, fontSize: 28, padding: '0 0 14px', color: '#555b70' }}>2025</div>
        </Card>
      )}
      {t > 3.0 && t < 5.2 && (
        <Card x={W / 2 + 140} y={300} at={S(3.95)} style={{ fontSize: 30, fontWeight: 700 }}>
          Athena · Mons Mouton
        </Card>
      )}
      {t >= 5.0 && (
        <>
          <Card x={1240} y={190} at={S(5.05)} style={{ width: 300 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <svg width={92} height={46} viewBox="0 0 92 46">
                <rect x={2} y={2} width={80} height={42} rx={8} fill="none" stroke="#141a2e" strokeWidth={4} />
                <rect x={84} y={14} width={6} height={18} rx={2} fill="#141a2e" />
                <rect x={8} y={8} width={70 * drain} height={30} rx={4} fill={drain > 0.3 ? GOOD : FAIL} />
              </svg>
              <b style={{ fontFamily: mono, fontSize: 40 }}>{Math.round(drain * 100)}%</b>
            </div>
          </Card>
          <Card x={1240} y={340} at={S(5.2)} style={{ width: 300 }}>
            <div style={{ fontFamily: mono, fontSize: 56, fontWeight: 700, color: dead ? FAIL : '#141a2e' }}>+{hours.toFixed(0)} h</div>
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
        <path d={ground} fill={bend < 0.5 ? '#2a3047' : 'none'} stroke="#c9cbd6" strokeWidth={3} strokeLinejoin="round" />
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
      <Card x={110} y={140} at={S(0.4)} style={{ fontSize: 26, fontWeight: 600, padding: '12px 20px' }}>
        Malapert Massif · real skyline · one lunar day
      </Card>
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
        <path d={`M0 ${H} L${pts.join(' L')} L${W} ${H} Z`} fill="#2a3047" stroke="#c9cbd6" strokeWidth={3} strokeLinejoin="round" />
        <path d={`M0 ${H - 70} Q${W / 2} ${H - 120} ${W} ${H - 60} L${W} ${H} L0 ${H} Z`} fill="#1d2236" />
        <Lander x={260} y={H - 84} scale={1.4} panelLit={lit} light={lit > 0.5 ? GOOD : FAIL} />
      </svg>
      <AbsoluteFill style={{ background: '#000', opacity: 0.45 * dark, pointerEvents: 'none' }} />
      <Card x={110} y={140} at={S(0.3)} style={{ fontSize: 26, fontWeight: 600, padding: '12px 20px' }}>
        Nobile Rim 2 · 2027 · Sun {el.toFixed(1)}° above the flat horizon
      </Card>
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
        img.data[o] = 40 + 150 * s
        img.data[o + 1] = 52 + 80 * s
        img.data[o + 2] = 80 + 40 * s
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
            return <circle key={i} cx={x} cy={y} r={5.5 * k} fill={dead ? FAIL : GOOD} stroke="#0b1020" strokeWidth={1.2} opacity={0.95} />
          })}
          <circle cx={size / 2} cy={size / 2} r={9} fill={SUN} stroke="#0b1020" strokeWidth={3} />
        </svg>
      </div>
      <Card x={left + size + 70} y={top + 10} at={S(0.3)} style={{ width: 470 }}>
        <div style={{ fontSize: 24, fontWeight: 600, color: '#555b70' }}>Malapert Massif · landing {X.landers_day}</div>
        <div style={{ fontSize: 22, color: '#555b70', marginTop: 6 }}>terrain slope from LOLA: dark flat, light steep</div>
      </Card>
      <Card x={left + size + 70} y={top + 190} at={S(0.6)} style={{ width: 470 }}>
        <div style={{ fontFamily: mono, fontSize: 84, fontWeight: 700, color: alive / LANDERS.length > 0.5 ? '#1f8a5a' : FAIL, lineHeight: 1 }}>{t < 2.3 ? LANDERS.length : alive}</div>
        <div style={{ fontSize: 26, fontWeight: 600, marginTop: 8 }}>{t < 2.3 ? 'landings, each one off target' : `alive · day ${Math.min(14, Math.floor(hour / 24))} of 14`}</div>
        <div style={{ height: 10, background: '#e1ddd0', borderRadius: 5, marginTop: 16, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(hour / 336) * 100}%`, background: SUN }} />
        </div>
      </Card>
      <Card x={left + size + 70} y={top + 470} at={S(4.4)} style={{ width: 470 }}>
        <div style={{ fontFamily: mono, fontSize: 30, fontWeight: 700 }}>
          {X.n_draws.toLocaleString('en-US')} × {X.n_days.toLocaleString('en-US')} days × {X.n_sites}
        </div>
        <div style={{ fontFamily: mono, fontSize: 46, fontWeight: 800, color: '#1f8a5a', marginTop: 4 }}>{total.toLocaleString('en-US')}</div>
        <div style={{ fontSize: 24, color: '#555b70' }}>simulated landings, 2027–2030</div>
      </Card>
    </AbsoluteFill>
  )
}

// ------------------------------------------------------------------------------------------------ 19.62-23.46 s
/** The tool itself: logo, then the Explorer slides up and a window gets picked. */
function Tool() {
  const f = useCurrentFrame()
  const t = f / FPS // local, 0 = 19.62 s
  const logo = pop(f, S(0.15))
  const up = spring({ frame: f - S(0.7), fps: FPS, config: { damping: 18, mass: 0.9, stiffness: 90 } })
  const cur = lerp(t, [1.6, 2.2], [0, 1], Easing.inOut(Easing.cubic))
  const click = t > 2.25 ? pop(f, S(2.25)) : 0
  const fw = 1200, fh = fw * (860 / 1440)
  const fx = W / 2 - fw / 2, fy = 180 + (1 - up) * 700
  // the first ranking row in the screenshot (measured on the 1440x860 capture)
  const rowX = fx + (190 / 1440) * fw, rowY = fy + 34 + (300 / 860) * fh
  const cx = rowX + 260 * (1 - cur), cy = rowY + 220 * (1 - cur)
  return (
    <AbsoluteFill style={{ background: BG, opacity: lerp(t, [0, 0.35], [0, 1]) }}>
      <Stars />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 42, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 22, transform: `scale(${0.6 + 0.4 * logo})`, opacity: logo }}>
        <Img src={staticFile('shots/lastlight-mark.svg')} style={{ width: 96 }} />
        <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 84, letterSpacing: '0.12em', color: FG }}>LASTLIGHT</div>
      </div>
      <div style={{ position: 'absolute', left: fx, top: fy, width: fw, borderRadius: 18, overflow: 'hidden', boxShadow: '0 40px 120px rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.12)', background: '#0e1428' }}>
        <div style={{ height: 34, background: '#1a2036', display: 'flex', alignItems: 'center', gap: 9, padding: '0 16px' }}>
          {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
            <i key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c, display: 'block' }} />
          ))}
          <span style={{ marginLeft: 16, fontFamily: mono, fontSize: 16, color: DIM }}>lastlight-17r.pages.dev/explore</span>
        </div>
        <Img src={staticFile('shots/explorer.png')} style={{ width: fw, display: 'block' }} />
      </div>
      {t > 1.5 && (
        <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
          {click > 0 && <circle cx={rowX} cy={rowY} r={20 + 40 * click} fill="none" stroke={SUN} strokeWidth={4} opacity={1 - click * 0.7} />}
          <path d={`M${cx} ${cy} l0 38 l10 -10 l8 18 l7 -3 l-8 -18 l14 0 z`} fill="#fff" stroke="#0b1020" strokeWidth={2} />
        </svg>
      )}
    </AbsoluteFill>
  )
}

// ------------------------------------------------------------------------------------------------ 23.46-30 s
const BEST = X.best as { name: string; p: number; date: string }[]

/** The answer for all nine regions, then the end card. */
function Verdict() {
  const f = useCurrentFrame()
  const t = f / FPS // local, 0 = 23.46 s
  const barsOut = lerp(t, [2.7, 3.2], [0, 1])
  const end = lerp(t, [3.3, 3.9], [0, 1])
  const fadeOut = lerp(t, [6.0, 6.54], [1, 0])
  return (
    <AbsoluteFill style={{ background: BG, opacity: fadeOut * lerp(t, [0, 0.35], [0, 1]) }}>
      <Stars />
      <div style={{ position: 'absolute', left: 260, top: 120, width: 1400, opacity: 1 - barsOut, transform: `translateY(${-barsOut * 40}px)` }}>
        <div style={{ fontFamily: sans, fontSize: 30, color: DIM, marginBottom: 22 }}>Best landing day of each region · 14-day survival · 2027–2030</div>
        {BEST.map((b, i) => {
          const k = lerp(t, [0.15 + i * 0.07, 0.75 + i * 0.07], [0, 1], Easing.out(Easing.cubic))
          const top = i === 0
          return (
            <div key={b.name} style={{ display: 'grid', gridTemplateColumns: '360px 1fr 150px', alignItems: 'center', gap: 24, height: 62, opacity: Math.min(1, k * 2) }}>
              <span style={{ fontFamily: sans, fontSize: 30, fontWeight: top ? 700 : 500, color: top ? FG : DIM }}>{b.name}</span>
              <span style={{ height: 22, background: 'rgba(255,255,255,0.06)', borderRadius: 11, overflow: 'hidden' }}>
                <i style={{ display: 'block', height: '100%', width: `${b.p * 100 * k}%`, background: top ? GOOD : b.p > 0.8 ? '#5aa98a' : '#7d8296', borderRadius: 11 }} />
              </span>
              <span style={{ fontFamily: mono, fontSize: 32, fontWeight: 700, color: top ? GOOD : FG, textAlign: 'right' }}>{(b.p * 100 * k).toFixed(1)}%</span>
            </div>
          )
        })}
      </div>
      {end > 0 && (
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: end, transform: `scale(${0.96 + 0.04 * end})` }}>
          <Img src={staticFile('shots/lastlight-mark.svg')} style={{ width: 150 }} />
          <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 92, letterSpacing: '0.12em', color: FG, marginTop: 20 }}>LASTLIGHT</div>
          <div style={{ fontFamily: mono, fontSize: 34, color: SUN, marginTop: 30 }}>lastlight-17r.pages.dev</div>
          <div style={{ fontFamily: mono, fontSize: 26, color: DIM, marginTop: 12 }}>github.com/ghalidev/casablanca-lunar-navigator</div>
          <div style={{ fontFamily: sans, fontSize: 24, color: DIM, marginTop: 34 }}>NASA Space Apps 2026 · Casablanca, We Have A Solution</div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  )
}

// ------------------------------------------------------------------------------------------------ film
/** Crossfade between scenes: the outgoing one stays under the incoming fade-in (no hard cuts, no flashes). */
export function Explainer() {
  const { durationInFrames } = useVideoConfig()
  const f = useCurrentFrame()
  const t = f / FPS
  const X0 = 0.35
  return (
    <AbsoluteFill style={{ background: BG }}>
      <Audio src={staticFile('mix.wav')} />
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
        <Tool />
      </Sequence>
      <Sequence from={S(23.46)} durationInFrames={durationInFrames - S(23.46)}>
        <Verdict />
      </Sequence>
      <Subtitle />
      <div style={{ position: 'absolute', top: 34, right: 44, fontFamily: mono, fontSize: 17, color: 'rgba(242,240,234,0.5)' }}>AI-generated voice</div>
      {t > 26.6 && (
        <div style={{ position: 'absolute', bottom: 26, left: 0, right: 0, textAlign: 'center', fontFamily: mono, fontSize: 16, color: 'rgba(242,240,234,0.45)' }}>
          Music: “Mesmerizing Galaxy” by Kevin MacLeod (incompetech.com), CC BY 4.0 · Data: NASA LOLA, NAIF SPICE, LROC
        </div>
      )}
      <AbsoluteFill style={{ background: '#000', opacity: lerp(t, [0, 0.4], [1, 0]), pointerEvents: 'none' }} />
    </AbsoluteFill>
  )
}
