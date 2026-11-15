import React from 'react'
import { AbsoluteFill, Audio, Easing, Img, OffthreadVideo, Sequence, interpolate, random, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import timings from '../public/voice-timings.json'
import X from '../public/explainer.json'

/*
 * LASTLIGHT, 30 s, the cinematic cut. Every image is the real app rendering real data (public/clips2, captured by
 * scripts/capture2.mjs from the production build): the Moon, Athena's site, Malapert's skyline, the Sun going behind
 * Nobile Rim 2's ridge, 1,000 simulated landings, the copilot, the Planner, the nine regions.
 * Finishing, per shot: slow camera push, grade, bloom, anamorphic bars, film grain, vignette, soft light leaks,
 * blur-dissolves (never a hard cut or a flash). Audio is mixed offline (scripts/mix_film.py -> public/film_mix.wav).
 */

const FPS = 30
const W = 1920
const H = 1080
const S = (s: number) => Math.round(s * FPS)
const AMBER = '#ffb547'
const FG = '#ecebe6'
const DIM = 'rgba(236,235,230,0.62)'
const sans = "'IBM Plex Sans', system-ui, sans-serif"
const cond = "'IBM Plex Sans Condensed', 'IBM Plex Sans', sans-serif"
const mono = "'IBM Plex Mono', ui-monospace, monospace"
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
const soft = Easing.bezier(0.33, 0, 0.2, 1)
const lerp = (f: number, a: number[], b: number[], e: (t: number) => number = soft) => interpolate(f, a, b, { ...clamp, easing: e })
const XF = 0.6 // dissolve length, seconds

type Shot = { clip: string; at: number; end: number; from: number; rate: number; push: [number, number]; drift: [number, number]; grade?: string; bars?: boolean }
// at/end: seconds in the film. from: seconds into the clip. rate: playback speed.
const SHOTS: Shot[] = [
  { clip: 'athena', at: 0, end: 7.5, from: 0, rate: 1, push: [1.0, 1.07], drift: [0, -10], bars: true },
  { clip: 'ground', at: 7.5, end: 11.64, from: 0.4, rate: 1, push: [1.04, 1.1], drift: [-14, 0], bars: true },
  { clip: 'ridge', at: 11.64, end: 14.28, from: 4.7, rate: 1, push: [1.05, 1.12], drift: [10, 0], bars: true },
  { clip: 'crash', at: 14.28, end: 19.62, from: 0, rate: 2.7, push: [1.02, 1.09], drift: [0, 8], bars: true },
  { clip: 'command', at: 19.62, end: 22.2, from: 5.7, rate: 2.6, push: [1.0, 1.03], drift: [0, 0], bars: false },
  { clip: 'planner', at: 22.2, end: 23.6, from: 1.8, rate: 1.4, push: [1.0, 1.03], drift: [0, -6], bars: false },
  { clip: 'pole', at: 23.46, end: 27.2, from: 0.8, rate: 1, push: [1.03, 1.1], drift: [0, 6], bars: true },
]

function Grain() {
  const f = useCurrentFrame()
  const seed = Math.floor(f / 2) // grain at 15 fps, like film
  return (
    <svg width={W} height={H} style={{ position: 'absolute', inset: 0, mixBlendMode: 'overlay', opacity: 0.11, pointerEvents: 'none' }}>
      <filter id={`g${seed}`}>
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={seed} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width={W} height={H} filter={`url(#g${seed})`} />
    </svg>
  )
}

/** One shot: the real footage, pushed in slowly, graded, with a bloom pass on its highlights. */
function ShotLayer({ s }: { s: Shot }) {
  const f = useCurrentFrame() // local to the Sequence
  const dur = (s.end - s.at + XF) * FPS
  const k = f / dur
  const scale = s.push[0] + (s.push[1] - s.push[0]) * soft(Math.min(1, k))
  const tx = s.drift[0] * k, ty = s.drift[1] * k
  const inA = lerp(f, [0, XF * FPS], [0, 1])
  const outA = lerp(f, [dur - XF * FPS, dur], [1, 0])
  const blurIn = lerp(f, [0, XF * FPS], [14, 0])
  const blurOut = lerp(f, [dur - XF * FPS, dur], [0, 10])
  const src = staticFile(`clips2/${s.clip}_30.mp4`)
  const common: React.CSSProperties = { position: 'absolute', inset: 0, width: W, height: H, objectFit: 'cover' }
  return (
    <AbsoluteFill style={{ opacity: Math.min(inA, outA), filter: `blur(${(blurIn + blurOut).toFixed(2)}px)` }}>
      <AbsoluteFill style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})`, transformOrigin: '50% 45%' }}>
        <OffthreadVideo src={src} startFrom={S(s.from)} playbackRate={s.rate} muted style={{ ...common, filter: 'contrast(1.1) saturate(0.88) brightness(0.98)' }} />
        {/* bloom: the same frame, blurred and lifted, screened over its own highlights */}
        <OffthreadVideo src={src} startFrom={S(s.from)} playbackRate={s.rate} muted style={{ ...common, filter: 'blur(22px) brightness(1.5) contrast(1.6)', mixBlendMode: 'screen', opacity: 0.26 }} />
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

/** Warm light sweeping across at the big turns of the story: a lens leak, not a flash. */
function Leak({ at, dir = 1 }: { at: number; dir?: number }) {
  const f = useCurrentFrame()
  const t = f / FPS - at
  if (t < -0.8 || t > 1.4) return null
  const k = lerp(t, [-0.8, 1.4], [0, 1], Easing.inOut(Easing.sin))
  const x = dir > 0 ? -30 + 160 * k : 130 - 160 * k
  const a = Math.sin(Math.PI * k) * 0.34
  return (
    <AbsoluteFill style={{ mixBlendMode: 'screen', pointerEvents: 'none', opacity: a, background: `radial-gradient(60% 90% at ${x}% 40%, rgba(255,181,71,0.9) 0%, rgba(255,140,40,0.35) 35%, transparent 70%)` }} />
  )
}

const LINES = timings.segments as { start: number; end: number; text: string }[]
const KEY: Record<number, string> = { 2: 'dead', 3: 'never rises', 5: 'dark', 6: 'crash', 7: "NASA's real terrain", 8: 'survives', 9: 'Open source' }

function Subtitle() {
  const f = useCurrentFrame()
  const t = f / FPS
  const i = LINES.findIndex((l) => t >= l.start - 0.05 && t < l.end + 0.12)
  if (i < 0) return null
  const l = LINES[i]
  const k = lerp(t, [l.start - 0.05, l.start + 0.3], [0, 1], Easing.out(Easing.cubic))
  const o = lerp(t, [l.end - 0.05, l.end + 0.12], [1, 0])
  const kw = KEY[i] ?? ''
  const at = kw ? l.text.toLowerCase().indexOf(kw.toLowerCase()) : -1
  const parts = at >= 0 ? [l.text.slice(0, at), l.text.slice(at, at + kw.length), l.text.slice(at + kw.length)] : [l.text, '', '']
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 92, pointerEvents: 'none' }}>
      <div
        style={{
          fontFamily: sans,
          fontWeight: 600,
          fontSize: 46,
          letterSpacing: '-0.01em',
          color: FG,
          textShadow: '0 2px 18px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.9)',
          opacity: k * o,
          filter: `blur(${(1 - k) * 6}px)`,
          transform: `translateY(${(1 - k) * 10}px)`,
          textAlign: 'center',
          maxWidth: 1500,
        }}
      >
        {parts[0]}
        <span style={{ color: AMBER }}>{parts[1]}</span>
        {parts[2]}
      </div>
    </AbsoluteFill>
  )
}

/** A small instrument caption, top-left: what this real frame is. Enters from blur, never more than one at a time. */
function Tag({ from, to, children }: { from: number; to: number; children: React.ReactNode }) {
  const f = useCurrentFrame()
  const t = f / FPS
  if (t < from - 0.1 || t > to + 0.5) return null
  const k = lerp(t, [from, from + 0.5], [0, 1], Easing.out(Easing.cubic)) * lerp(t, [to, to + 0.4], [1, 0])
  return (
    <div style={{ position: 'absolute', left: 120, top: 128, fontFamily: mono, fontSize: 22, letterSpacing: '0.08em', color: DIM, opacity: k, filter: `blur(${(1 - k) * 5}px)`, textShadow: '0 1px 10px rgba(0,0,0,0.8)' }}>
      {children}
    </div>
  )
}

// The crash footage: the 1,000 landers of Malapert Massif, 8 Oct 2027 (explainer.json, the same draws as the app).
const LANDERS = X.landers as [number, number, number | null][]
function CrashCounter() {
  const f = useCurrentFrame()
  const t = f / FPS
  const s = SHOTS[3]
  if (t < s.at + 0.7 || t > s.end + 0.3) return null
  // The footage is a time-lapse of this same simulation; the count follows the 14 days across the shot.
  const hour = lerp(t, [s.at + 1.2, s.end - 0.5], [0, 336], Easing.inOut(Easing.quad))
  const alive = LANDERS.filter((l) => l[2] == null || (l[2] as number) > hour).length
  const k = lerp(t, [s.at + 0.7, s.at + 1.2], [0, 1]) * lerp(t, [s.end - 0.1, s.end + 0.3], [1, 0])
  return (
    <div style={{ position: 'absolute', right: 120, top: 120, textAlign: 'right', opacity: k, textShadow: '0 2px 16px rgba(0,0,0,0.85)' }}>
      <div style={{ fontFamily: cond, fontWeight: 600, fontSize: 110, color: AMBER, lineHeight: 0.9, letterSpacing: '-0.02em' }}>{alive.toLocaleString('en-US')}</div>
      <div style={{ fontFamily: mono, fontSize: 22, color: DIM, marginTop: 10, letterSpacing: '0.06em' }}>
        OF {LANDERS.length.toLocaleString('en-US')} ALIVE · DAY {Math.min(14, Math.floor(hour / 24))}
      </div>
    </div>
  )
}

function EndCard() {
  const f = useCurrentFrame()
  const t = f / FPS
  const a = lerp(t, [27.0, 27.8], [0, 1])
  if (a <= 0) return null
  const rise = (d: number) => lerp(t, [27.0 + d, 27.9 + d], [0, 1], Easing.out(Easing.cubic))
  const line = (d: number): React.CSSProperties => ({ opacity: rise(d), transform: `translateY(${(1 - rise(d)) * 14}px)`, filter: `blur(${(1 - rise(d)) * 6}px)` })
  return (
    <AbsoluteFill style={{ background: `rgba(5,6,8,${0.94 * a})`, justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 30, ...line(0) }}>
        <Img src={staticFile('shots/lastlight-mark.svg')} style={{ width: 128 }} />
        <div style={{ fontFamily: mono, fontWeight: 500, fontSize: 84, letterSpacing: '0.22em', color: FG }}>LASTLIGHT</div>
      </div>
      <div style={{ fontFamily: cond, fontWeight: 500, fontSize: 40, color: DIM, marginTop: 26, ...line(0.15) }}>Choose where and when your lander survives the lunar south pole.</div>
      <div style={{ fontFamily: mono, fontSize: 32, color: AMBER, marginTop: 46, ...line(0.3) }}>lastlight-17r.pages.dev</div>
      <div style={{ fontFamily: mono, fontSize: 22, color: DIM, marginTop: 12, ...line(0.4) }}>github.com/ghalidev/casablanca-lunar-navigator</div>
      <div style={{ fontFamily: sans, fontSize: 24, color: DIM, marginTop: 44, ...line(0.5) }}>
        Casablanca, We Have A Solution · Adam, Ghali, Yassine · NASA Space Apps Challenge 2026
      </div>
    </AbsoluteFill>
  )
}

export function Film() {
  const { durationInFrames } = useVideoConfig()
  const f = useCurrentFrame()
  const t = f / FPS
  // Anamorphic bars glide in and out with the shots that carry them (never pop).
  let bars = 0
  for (const s of SHOTS) if (s.bars) bars = Math.max(bars, lerp(t, [s.at - 0.3, s.at + 0.4], [0, 1]) * lerp(t, [s.end - 0.2, s.end + 0.4], [1, 0]))
  const barH = 96 * bars
  return (
    <AbsoluteFill style={{ background: '#050608' }}>
      <Audio src={staticFile('film_mix.wav')} />
      {SHOTS.map((s) => (
        <Sequence key={s.clip} from={S(s.at)} durationInFrames={S(s.end - s.at + XF)}>
          <ShotLayer s={s} />
        </Sequence>
      ))}
      {/* "dead": the frame loses its warmth and light as Athena's mission ends */}
      <AbsoluteFill style={{ background: '#000', opacity: lerp(t, [5.0, 6.6], [0, 0.42]) * lerp(t, [7.2, 7.9], [1, 0]), pointerEvents: 'none' }} />
      {/* "goes dark": the ridge takes the light */}
      <AbsoluteFill style={{ background: '#000', opacity: lerp(t, [13.2, 14.2], [0, 0.5]) * lerp(t, [14.3, 14.9], [1, 0]), pointerEvents: 'none' }} />
      <Leak at={7.5} />
      <Leak at={14.28} dir={-1} />
      <Leak at={19.62} />
      <Leak at={23.46} dir={-1} />
      {/* vignette */}
      <AbsoluteFill style={{ background: 'radial-gradient(120% 95% at 50% 50%, transparent 55%, rgba(0,0,0,0.62) 100%)', pointerEvents: 'none' }} />
      <Grain />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: barH, background: '#000' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: barH, background: '#000' }} />

      <Tag from={1.0} to={4.6}>6 MARCH 2025 · IM-2 ATHENA · MONS MOUTON</Tag>
      <Tag from={8.0} to={11.2}>MALAPERT MASSIF · REAL LOLA SKYLINE · 2027</Tag>
      <Tag from={12.0} to={13.9}>NOBILE RIM 2 · 16 OCT 2027 · SUN BEHIND THE RIDGE</Tag>
      <Tag from={15.0} to={19.3}>1,000 SIMULATED LANDINGS · MALAPERT MASSIF · 8 OCT 2027</Tag>
      <CrashCounter />
      <Subtitle />
      <EndCard />
      <div style={{ position: 'absolute', top: barH > 1 ? barH + 18 : 34, right: 44, fontFamily: mono, fontSize: 16, color: 'rgba(236,235,230,0.45)' }}>AI-generated voice</div>
      {t > 27.4 && (
        <div style={{ position: 'absolute', bottom: 28, left: 0, right: 0, textAlign: 'center', fontFamily: mono, fontSize: 15, color: 'rgba(236,235,230,0.42)', opacity: lerp(t, [27.4, 28], [0, 1]) }}>
          Music: “Mesmerizing Galaxy” by Kevin MacLeod (incompetech.com), CC BY 4.0 · Data: NASA LOLA, NAIF SPICE, LROC, SVS CGI Moon Kit
        </div>
      )}
      {/* open from black, close to black */}
      <AbsoluteFill style={{ background: '#000', opacity: Math.max(lerp(t, [0, 0.8], [1, 0]), lerp(f, [durationInFrames - 12, durationInFrames - 1], [0, 1])), pointerEvents: 'none' }} />
    </AbsoluteFill>
  )
}
