import React from 'react'
import { AbsoluteFill, Audio, Easing, OffthreadVideo, Sequence, interpolate, random, staticFile, useCurrentFrame } from 'remotion'
import timings from '../public/voice-timings.json'
import top10 from '../public/top10.json'
import survival from '../public/malapert-survival.json'
import { MoonCanvas, lookAlongLimb, sunAtLimb, sunOnScreen, type MoonShot } from './MoonScene'

/*
 * LASTLIGHT, 30 s, 1920x1080, 2.39:1 letterbox. Every number on screen is read from the pipeline output
 * (top10.json, malapert-survival.json, copied from web/public/data). Footage: the real LASTLIGHT 3D film
 * (video/scripts/capture.mjs) and the NASA SVS Moon Kit globe rendered here in three.js.
 * Music: Kevin MacLeod, "Interloper" and "Heroic Age" (incompetech.com), CC BY 4.0. Voice: ElevenLabs.
 */

const FPS = 30
const S = (sec: number) => Math.round(sec * FPS)
const W = 1920
const H = 1080
const BAR = 138 // 2.39:1
const FG = '#f2f0ea'
const DIM = 'rgba(242,240,234,0.62)'
const SUN = '#ffb547'
const EARTH = '#4da3ff'
const GOOD = '#5bd69a'
const FAIL = '#ff5a4e'
const sans = "'Geist Variable', system-ui, sans-serif"
const mono = "'Geist Mono Variable', ui-monospace, monospace"
const outExpo = Easing.bezier(0.16, 1, 0.3, 1)
const inOut = Easing.bezier(0.65, 0, 0.35, 1)
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
const lerp = (f: number, a: number[], b: number[], easing: (t: number) => number = (t) => t) => interpolate(f, a, b, { ...clamp, easing })

// ------------------------------------------------------------------------------------------------ data
const best = top10.windows[0]
const bestPct = best.p_survive_14d * 100
const bestDate = new Date(best.landing_utc).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const byDay = new Map((survival.windows as { landing_utc: string; p_survive_14d: number }[]).map((w) => [w.landing_utc.slice(0, 10), w.p_survive_14d]))
const nextDay = new Date(Date.parse(best.landing_utc) + 86_400_000).toISOString().slice(0, 10)
const latePct = (byDay.get(nextDay) ?? NaN) * 100
const nDays = survival.windows.length
const nDraws = (survival.windows[0] as { n_draws?: number }).n_draws ?? 1000
const nSites = 9
const total = nDraws * nDays * nSites
const ghosts = survival.ghost_landers_sample as { died_at_h: number | null }[]
const aliveAt = (h: number) => ghosts.filter((g) => g.died_at_h == null || g.died_at_h > h).length

// ------------------------------------------------------------------------------------------------ voice
const SEG: { start: number; end: number; text: string }[] = timings.segments.map((s: { start: number; end: number; text: string }) => ({
  ...s,
  text: s.text.replace('Last Light', 'LASTLIGHT').replace('South Pole', 'south pole').replace('the sun', 'the Sun'),
}))
const speaking = (t: number) => SEG.some((s) => t >= s.start - 0.08 && t <= s.end + 0.12)
/** 1 while the narrator speaks, eased in and out over ~0.25 s: drives the music ducking. */
function duck(t: number) {
  let v = 0
  for (let k = -4; k <= 4; k++) v += speaking(t + k * 0.06) ? 1 : 0
  return v / 9
}

// ------------------------------------------------------------------------------------------------ helpers
function Clip({ src, from = 0, rate = 1, scale = [1, 1], dur, filter, x = [0, 0], y = [0, 0] }: { src: string; from?: number; rate?: number; scale?: [number, number]; dur: number; filter?: string; x?: [number, number]; y?: [number, number] }) {
  const f = useCurrentFrame()
  const k = lerp(f, [0, dur], [0, 1], inOut)
  const s = scale[0] + (scale[1] - scale[0]) * k
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: '#000' }}>
      <OffthreadVideo
        src={staticFile(`clips/${src}.mp4`)}
        startFrom={Math.round(from * FPS)}
        playbackRate={rate}
        muted
        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `translate(${x[0] + (x[1] - x[0]) * k}px, ${y[0] + (y[1] - y[0]) * k}px) scale(${s})`, filter: filter ?? 'contrast(1.12) saturate(0.85) brightness(0.95)' }}
      />
    </AbsoluteFill>
  )
}

/** Text that slides up out of a mask, one line at a time. */
function MaskIn({ children, at, dur = 14, style }: { children: React.ReactNode; at: number; dur?: number; style?: React.CSSProperties }) {
  const f = useCurrentFrame()
  const k = lerp(f, [at, at + dur], [0, 1], outExpo)
  return (
    <div style={{ overflow: 'hidden', ...style }}>
      <div style={{ transform: `translateY(${(1 - k) * 105}%)`, opacity: k > 0 ? 1 : 0 }}>{children}</div>
    </div>
  )
}

/** Wide-tracked caps that tighten as they appear: the trailer title card. */
function Tracked({ text, at, size, color = FG, weight = 600, from = 0.9, to = 0.22, dur = 40 }: { text: string; at: number; size: number; color?: string; weight?: number; from?: number; to?: number; dur?: number }) {
  const f = useCurrentFrame()
  const k = lerp(f, [at, at + dur], [0, 1], outExpo)
  const blur = (1 - k) * 14
  return (
    <div style={{ fontFamily: sans, fontWeight: weight, fontSize: size, color, letterSpacing: `${from + (to - from) * k}em`, opacity: k, filter: `blur(${blur}px)`, whiteSpace: 'nowrap', textAlign: 'center', marginRight: `-${from + (to - from) * k}em` }}>
      {text}
    </div>
  )
}

function Flash({ at, dur = 8, color = '#fff', peak = 1 }: { at: number; dur?: number; color?: string; peak?: number }) {
  const f = useCurrentFrame()
  const o = interpolate(f, [at - 1, at, at + dur], [0, peak, 0], clamp)
  return o > 0 ? <AbsoluteFill style={{ background: color, opacity: o, mixBlendMode: 'screen' }} /> : null
}

/** Film grain + vignette: one noise texture, offset every frame. */
function Grain() {
  const f = useCurrentFrame()
  const seed = f % 8
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <svg width={W} height={H} style={{ position: 'absolute', opacity: 0.07, mixBlendMode: 'overlay' }}>
        <filter id={`g${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={seed} stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#g${seed})`} />
      </svg>
      <AbsoluteFill style={{ background: 'radial-gradient(130% 100% at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)' }} />
    </AbsoluteFill>
  )
}

// Subtitles: big, white, hard shadow; the key word of each line lights up in its colour. Word timing is spread
// evenly over the Whisper segment, so words pop in roughly as they are spoken.
const ACCENT: Record<string, string> = { dead: FAIL, 'dead.': FAIL, never: SUN, horizon: SUN, 'horizon.': SUN, dark: FAIL, 'dark.': FAIL, crash: FAIL, thousands: GOOD, real: EARTH, LASTLIGHT: SUN, survives: GOOD, 'survives.': GOOD, 'Open': GOOD, Athena: FG }
function Subtitles() {
  const f = useCurrentFrame()
  const t = f / FPS
  const seg = SEG.find((s) => t >= s.start && t < s.end + 0.1)
  if (!seg) return null
  const words = seg.text.split(' ')
  const span = Math.max(0.3, seg.end - seg.start - 0.25)
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: (BAR - 62) / 2 }}>
      <div style={{ display: 'flex', gap: 14, fontFamily: sans, fontWeight: 700, fontSize: 46, letterSpacing: '-0.015em', lineHeight: '62px', height: 62 }}>
        {words.map((w, i) => {
          const at = seg.start + (span * i) / words.length
          const k = interpolate(t, [at, at + 0.12], [0, 1], clamp)
          const c = ACCENT[w] ?? FG
          return (
            <span key={i} style={{ color: c, opacity: 0.25 + 0.75 * k, transform: `translateY(${(1 - k) * 6}px) scale(${0.96 + 0.04 * k})`, display: 'inline-block', textShadow: '0 3px 0 rgba(0,0,0,0.9), 0 0 18px rgba(0,0,0,0.6)' }}>
              {w}
            </span>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

/** HUD reticle that locks onto a point. */
function Reticle({ at, x, y, color = FG, label }: { at: number; x: number; y: number; color?: string; label?: string }) {
  const f = useCurrentFrame()
  const k = lerp(f, [at, at + 16], [0, 1], outExpo)
  const r = 120 - 70 * k
  const blink = f > at + 16 && Math.floor((f - at) / 4) % 2 === 0 ? 0.55 : 1
  if (k <= 0) return null
  return (
    <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
      <g transform={`translate(${x} ${y}) rotate(${(1 - k) * 90})`} stroke={color} strokeWidth={2.5} fill="none" opacity={k * blink}>
        <circle r={r} strokeDasharray="10 8" />
        {[0, 90, 180, 270].map((a) => (
          <line key={a} x1={0} y1={-r - 16} x2={0} y2={-r + 10} transform={`rotate(${a})`} />
        ))}
      </g>
      {label && (
        <text x={x + 70} y={y - 56} fill={color} fontFamily={mono} fontSize={22} letterSpacing={2} opacity={k}>
          {label}
        </text>
      )}
    </svg>
  )
}

// ------------------------------------------------------------------------------------------------ shots
/** 0 - 2.9 s: total black, the Moon emerges, the Sun breaks over its limb, then the dive to the pole. */
function Opening() {
  const f = useCurrentFrame()
  const t = f / FPS
  const dive = lerp(t, [2.15, 2.9], [0, 1], Easing.in(Easing.cubic))
  const drift = lerp(t, [0, 2.2], [0, 1], Easing.out(Easing.quad))
  // Far out, the Moon a dark disc; the Sun breaks over its upper limb (the south pole: rot x = PI puts it on top).
  const cy = 1.0 + 0.25 * drift + 0.2 * dive
  const cz = 3.25 - 0.25 * drift - 2.05 * dive
  const cam: [number, number, number] = [0, cy, cz]
  const roll = -0.38 + 0.08 * drift
  const fwd = lookAlongLimb(cam, -0.13 + 0.09 * dive)
  const shot: MoonShot = {
    cam,
    look: fwd,
    up: [Math.sin(roll), Math.cos(roll), 0],
    fov: 30 + 10 * dive,
    sunDir: sunAtLimb(cam, lerp(t, [0.25, 1.5], [-0.012, 0.01], Easing.inOut(Easing.quad))),
    rot: [Math.PI, 0.4 + t * 0.04, 0],
    exposure: lerp(t, [0, 1.0], [0, 1], Easing.out(Easing.quad)),
  }
  const sun = sunOnScreen(shot, W, H)
  const flare = sun.clear * lerp(t, [0.4, 1.4], [0, 1]) * (1 - dive)
  return (
    <AbsoluteFill>
      <MoonCanvas shot={shot} width={W} height={H} />
      {sun.inFront && flare > 0.01 && (
        <>
          <div style={{ position: 'absolute', left: sun.x - 900, top: sun.y - 3, width: 1800, height: 6, background: 'linear-gradient(90deg, transparent, rgba(160,200,255,0.0) 10%, rgba(190,215,255,0.85) 50%, rgba(160,200,255,0) 90%, transparent)', opacity: flare, filter: 'blur(2px)', mixBlendMode: 'screen' }} />
          <div style={{ position: 'absolute', left: sun.x - 260, top: sun.y - 260, width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,240,210,0.55), rgba(255,180,80,0.12) 35%, transparent 70%)', opacity: flare, mixBlendMode: 'screen' }} />
        </>
      )}
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: 1 - dive * 2 }}>
        <div style={{ marginTop: 300 }}>
          <Tracked text="MARCH 2025" at={S(0.35)} size={44} weight={500} from={1.4} to={0.55} dur={S(1.4)} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

/** 2.9 - 7.5 s: Athena. Push in, reticle, the clock runs, then the screen dies like an old monitor. */
function Athena() {
  const f = useCurrentFrame()
  const t = f / FPS // local
  const dead = lerp(t, [2.1, 4.0], [0, 1])
  const off1 = lerp(t, [4.2, 4.38], [1, 0.004], Easing.in(Easing.quad))
  const off2 = lerp(t, [4.38, 4.5], [1, 0], Easing.in(Easing.quad))
  const hours = Math.min(13, lerp(t, [2.2, 3.9], [0, 13], Easing.out(Easing.cubic)))
  const glitch = t > 3.75 && t < 4.2 ? (random(`g${f}`) - 0.5) * 40 : 0
  return (
    <AbsoluteFill style={{ transform: `scale(${off2 < 1 ? off2 : 1}, ${off1}) translateX(${glitch}px)`, filter: off1 < 1 ? `brightness(${1 + (1 - off1) * 4})` : undefined, background: '#000' }}>
      <Clip src="athena" from={0.2} dur={S(4.6)} scale={[1.42, 1.08]} filter={`contrast(1.15) saturate(${0.9 - 0.9 * dead}) brightness(${1 - 0.45 * dead})`} />
      <AbsoluteFill style={{ background: `linear-gradient(90deg, rgba(0,0,0,0.75), transparent 60%)` }} />
      {t < 2.1 && <Reticle at={S(0.5)} x={W / 2} y={H / 2 + 20} label="IM-2 ATHENA · MONS MOUTON" />}
      {t >= 2.1 && <AbsoluteFill style={{ background: 'linear-gradient(270deg, rgba(0,0,0,0.8), transparent 60%)' }} />}
      <AbsoluteFill style={{ padding: `${BAR + 70}px 130px`, justifyContent: 'flex-start' }}>
        <MaskIn at={S(0.15)}>
          <div style={{ fontFamily: mono, fontSize: 26, letterSpacing: '0.18em', color: DIM }}>6 MARCH 2025 · LUNAR SOUTH POLE</div>
        </MaskIn>
        <MaskIn at={S(0.3)} dur={18}>
          <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 168, letterSpacing: '-0.045em', color: FG, lineHeight: 1 }}>Athena</div>
        </MaskIn>
      </AbsoluteFill>
      {t > 2.15 && (
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'flex-end', paddingRight: 150 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: mono, fontSize: 26, letterSpacing: '0.2em', color: DIM }}>MISSION CLOCK</div>
            <div style={{ fontFamily: mono, fontWeight: 600, fontSize: 210, letterSpacing: '-0.04em', color: hours >= 12.99 ? FAIL : FG, lineHeight: 1, transform: `translateX(${glitch * 0.5}px)` }}>
              T+{String(Math.floor(hours)).padStart(2, '0')}:{String(Math.floor((hours % 1) * 60)).padStart(2, '0')}
            </div>
            {t > 3.75 && <div style={{ fontFamily: mono, fontSize: 40, letterSpacing: '0.3em', color: FAIL, marginTop: 10 }}>SIGNAL LOST</div>}
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  )
}

/** 7.5 - 14.28 s: on the ground. The Sun skims the horizon; then the ridge's shadow eats the frame. */
function Ground() {
  const f = useCurrentFrame()
  const t = f / FPS // local, 0 = 7.5 s
  const shadow = lerp(t, [4.3, 6.2], [0, 1], inOut)
  const turnOn = lerp(t, [0, 0.5], [0, 1], outExpo)
  // The Sun's daily path at the pole: a flat loop hugging the horizon, drawn as a perspective ellipse.
  const cx = W / 2, cy = H / 2 + 120, rx = 760, ry = 70
  const sa = lerp(t, [0.3, 4.2], [-0.4, Math.PI * 1.1])
  const sx = cx + Math.cos(sa + Math.PI) * rx
  const sy = cy - Math.sin(sa + Math.PI) * ry
  const draw = lerp(t, [0.4, 2.4], [0, 1], outExpo)
  return (
    <AbsoluteFill style={{ transform: `scaleY(${turnOn})` }}>
      <Clip src="site" from={0.4} dur={S(6.8)} scale={[1.12, 1.24]} x={[30, -30]} filter={`contrast(1.12) saturate(0.85) brightness(${1 - 0.7 * shadow})`} />
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0, opacity: 1 - shadow }}>
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={SUN} strokeWidth={2.5} strokeDasharray="14 12" pathLength={1000} strokeDashoffset={0} opacity={0.8 * draw} style={{ strokeDasharray: `${1000 * draw} 1000` }} />
        <line x1={0} y1={cy + 4} x2={W} y2={cy + 4} stroke={FG} strokeOpacity={0.35 * draw} strokeWidth={1.5} />
        <text x={130} y={cy - 18} fill={FG} fillOpacity={0.7 * draw} fontFamily={mono} fontSize={22} letterSpacing={3}>
          HORIZON
        </text>
        <circle cx={sx} cy={sy} r={22} fill={SUN} opacity={draw} />
        <circle cx={sx} cy={sy} r={70} fill={SUN} opacity={0.18 * draw} />
      </svg>
      <AbsoluteFill style={{ padding: `${BAR + 70}px 130px`, opacity: 1 - shadow * 0.8 }}>
        <MaskIn at={S(0.5)}>
          <div style={{ fontFamily: mono, fontSize: 26, letterSpacing: '0.18em', color: SUN }}>THE SUN AT THE POLE</div>
        </MaskIn>
        <MaskIn at={S(0.65)} dur={18}>
          <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 120, letterSpacing: '-0.04em', color: FG, lineHeight: 1 }}>never rises.</div>
        </MaskIn>
        <MaskIn at={S(2.4)} dur={18}>
          <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 120, letterSpacing: '-0.04em', color: SUN, lineHeight: 1 }}>It circles.</div>
        </MaskIn>
      </AbsoluteFill>
      {/* The ridge's shadow sweeps in from the right. */}
      <AbsoluteFill style={{ background: `linear-gradient(270deg, rgba(2,3,8,0.97) ${shadow * 100}%, rgba(2,3,8,0) ${shadow * 100 + 22}%)` }} />
      {shadow > 0.35 && (
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ fontFamily: sans, fontWeight: 800, fontSize: 260, letterSpacing: '-0.05em', color: FAIL, opacity: lerp(t, [5.3, 5.6], [0, 1]) * (Math.floor(f / 3) % 7 === 0 ? 0.4 : 1), lineHeight: 1 }}>DARK.</div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  )
}

/** 14.28 - 19.62 s: we crash it first. 1,000 landings a day, every day, nine regions. */
function Crash() {
  const f = useCurrentFrame()
  const t = f / FPS // local, 0 = 14.28 s
  const hour = lerp(t, [0.9, 3.0], [0, 336], Easing.inOut(Easing.cubic))
  const a = aliveAt(hour)
  const eq = lerp(t, [3.0, 3.4], [0, 1], outExpo)
  const roll = lerp(t, [3.3, 4.6], [0, 1], Easing.out(Easing.cubic))
  return (
    <AbsoluteFill>
      <Clip src="crash" from={1.0} rate={1.4} dur={S(5.4)} scale={[1.25, 1.05]} filter={`contrast(1.12) saturate(1.05) brightness(${1 - 0.55 * eq})`} />
      <AbsoluteFill style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.7), transparent 45%)' }} />
      <AbsoluteFill style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.72), transparent 55%)', opacity: 1 - eq }} />
      <AbsoluteFill style={{ padding: `${BAR + 60}px 130px`, opacity: 1 - eq }}>
        <MaskIn at={2} dur={12}>
          <div style={{ fontFamily: sans, fontWeight: 800, fontSize: 132, letterSpacing: '-0.045em', color: FG, lineHeight: 1 }}>We crash it</div>
        </MaskIn>
        <MaskIn at={8} dur={12}>
          <div style={{ fontFamily: sans, fontWeight: 800, fontSize: 132, letterSpacing: '-0.045em', color: FAIL, lineHeight: 1 }}>first.</div>
        </MaskIn>
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: 'flex-end', padding: `0 130px ${BAR + 40}px`, opacity: 1 - eq }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 20 }}>
          <div style={{ fontFamily: mono, fontWeight: 600, fontSize: 120, color: GOOD, letterSpacing: '-0.04em', lineHeight: 1 }}>{a}</div>
          <div style={{ fontFamily: sans, fontSize: 32, color: DIM }}>
            of {ghosts.length} landers alive · day {Math.min(14, Math.floor(hour / 24))}
          </div>
        </div>
      </AbsoluteFill>
      {eq > 0 && (
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: eq }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 34, fontFamily: mono, fontWeight: 500, color: FG, transform: `scale(${0.92 + 0.08 * eq})` }}>
            {[
              [nDraws.toLocaleString('en-US'), 'landings / day'],
              ['×'],
              [nDays.toLocaleString('en-US'), 'days'],
              ['×'],
              [String(nSites), 'regions'],
            ].map(([v, l], i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: l ? 92 : 64, color: l ? FG : DIM, lineHeight: 1 }}>{v}</div>
                {l && <div style={{ fontFamily: sans, fontSize: 26, color: DIM, marginTop: 10 }}>{l}</div>}
              </div>
            ))}
          </div>
          <div style={{ fontFamily: mono, fontWeight: 600, fontSize: 150, color: GOOD, letterSpacing: '-0.04em', marginTop: 34, opacity: roll > 0 ? 1 : 0 }}>
            = {Math.round(total * roll).toLocaleString('en-US')}
          </div>
          <div style={{ fontFamily: sans, fontSize: 30, color: DIM, marginTop: 6, opacity: roll }}>simulated landings, on NASA LOLA terrain</div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  )
}

/** 19.62 - 23.46 s: the title. Sunrise over the south pole's horizon; LASTLIGHT is lit by it. */
function Title() {
  const f = useCurrentFrame()
  const t = f / FPS // local, 0 = 19.62 s
  const push = lerp(t, [0, 3.84], [0, 1], Easing.inOut(Easing.quad))
  // Low over the south pole, looking along the horizon; the Sun rises right on it, then the title locks.
  const cam: [number, number, number] = [0, 1.16 - 0.03 * push, 0.62 - 0.06 * push]
  const shot: MoonShot = {
    cam,
    look: lookAlongLimb(cam, 0.115),
    fov: 40,
    sunDir: sunAtLimb(cam, lerp(t, [0.05, 1.3], [-0.02, 0.022], Easing.out(Easing.cubic))),
    rot: [Math.PI, 0.9 + 0.03 * t, 0],
    exposure: lerp(t, [0, 0.35], [0, 1]),
  }
  const sun = sunOnScreen(shot, W, H)
  const flare = sun.clear
  const lock = 0.63 // seconds: the hit
  const k = lerp(t, [lock - 0.05, lock + 0.9], [0, 1], outExpo)
  const sweep = lerp(t, [lock, lock + 1.6], [-40, 140], inOut)
  return (
    <AbsoluteFill>
      <MoonCanvas shot={shot} width={W} height={H} />
      {sun.inFront && flare > 0.01 && (
        <>
          <div style={{ position: 'absolute', left: 0, top: sun.y - 4, width: W, height: 8, background: 'linear-gradient(90deg, transparent, rgba(170,205,255,0.9) 50%, transparent)', opacity: flare, filter: 'blur(2.5px)', mixBlendMode: 'screen' }} />
          <div style={{ position: 'absolute', left: sun.x - 420, top: sun.y - 420, width: 840, height: 840, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,244,220,0.75), rgba(255,182,80,0.18) 30%, transparent 68%)', opacity: flare, mixBlendMode: 'screen' }} />
          {/* God rays */}
          <div style={{ position: 'absolute', left: sun.x - 1100, top: sun.y - 1100, width: 2200, height: 2200, background: `repeating-conic-gradient(from ${t * 8}deg, rgba(255,210,140,0.10) 0deg 2deg, transparent 2deg 9deg)`, maskImage: 'radial-gradient(circle, black 0%, transparent 55%)', WebkitMaskImage: 'radial-gradient(circle, black 0%, transparent 55%)', opacity: flare * 0.9, mixBlendMode: 'screen' }} />
        </>
      )}
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', paddingBottom: 170 }}>
        <div
          style={{
            fontFamily: sans,
            fontWeight: 700,
            fontSize: 230,
            letterSpacing: `${0.6 - 0.48 * k}em`,
            marginRight: `-${0.6 - 0.48 * k}em`,
            lineHeight: 1,
            opacity: k,
            filter: `blur(${(1 - k) * 18}px)`,
            backgroundImage: `linear-gradient(100deg, #e9e4d8 ${sweep - 30}%, #fff8e6 ${sweep - 6}%, ${SUN} ${sweep}%, #fff8e6 ${sweep + 6}%, #e9e4d8 ${sweep + 30}%)`,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            textShadow: '0 0 60px rgba(255,190,100,0.25)',
          }}
        >
          LASTLIGHT
        </div>
        <div style={{ marginTop: 26 }}>
          <Tracked text="WHERE AND WHEN YOUR LANDER SURVIVES" at={S(lock + 0.5)} size={30} weight={500} color={FG} from={0.8} to={0.32} dur={S(1.2)} />
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'center', paddingTop: BAR + 30 }}>
        <Tracked text="NASA SPACE APPS 2026 · LUNAR LANDING SITE NAVIGATOR · CASABLANCA, WE HAVE A SOLUTION" at={S(lock + 1.0)} size={18} weight={500} color={DIM} from={0.6} to={0.28} dur={S(1.2)} />
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

/** 23.46 - 30 s: the answer, rolled up from zero; the cost of one day late; the end card. */
function Verdict() {
  const f = useCurrentFrame()
  const t = f / FPS // local, 0 = 23.46 s
  const roll = lerp(t, [0.25, 1.45], [0, 1], Easing.out(Easing.cubic))
  const lateIn = lerp(t, [2.5, 2.9], [0, 1], outExpo)
  const endIn = lerp(t, [4.35, 4.85], [0, 1], outExpo)
  const fadeOut = lerp(t, [6.0, 6.54], [1, 0])
  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      <Clip src="verdict" from={0} rate={0.8} dur={S(6.54)} scale={[1.08, 1.18]} filter={`blur(${6 + 10 * endIn}px) brightness(${0.45 - 0.25 * endIn}) saturate(0.7)`} />
      <AbsoluteFill style={{ justifyContent: 'center', padding: '0 150px', opacity: 1 - endIn }}>
        <div style={{ fontFamily: mono, fontSize: 28, letterSpacing: '0.2em', color: DIM }}>BEST LANDING WINDOW · 2027–2030</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 40, marginTop: 8 }}>
          <div style={{ fontFamily: mono, fontWeight: 600, fontSize: 250, color: GOOD, letterSpacing: '-0.05em', lineHeight: 1, transform: `scale(${1 + 0.04 * lerp(t, [1.45, 1.6, 1.9], [0, 1, 0])})`, transformOrigin: 'left center' }}>
            {(bestPct * roll).toFixed(1)}%
          </div>
          <div style={{ opacity: lateIn }}>
            <div style={{ fontFamily: mono, fontWeight: 600, fontSize: 96, color: SUN, letterSpacing: '-0.04em', lineHeight: 1 }}>{latePct.toFixed(1)}%</div>
            <div style={{ fontFamily: sans, fontSize: 30, color: SUN, marginTop: 6 }}>if you land one day late</div>
          </div>
        </div>
        <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 46, color: FG, marginTop: 14, opacity: lerp(t, [1.4, 1.8], [0, 1]) }}>
          of landers survive 14 days · Malapert Massif · {bestDate}
        </div>
      </AbsoluteFill>
      {endIn > 0 && (
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: endIn }}>
          <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 120, letterSpacing: '0.1em', marginRight: '-0.1em', color: FG }}>LASTLIGHT</div>
          <div style={{ fontFamily: sans, fontSize: 40, color: FG, marginTop: 18 }}>Open source, for every mission heading to the pole.</div>
          <div style={{ fontFamily: mono, fontSize: 34, color: SUN, marginTop: 30, letterSpacing: '0.04em' }}>lastlight-17r.pages.dev</div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  )
}

// ------------------------------------------------------------------------------------------------ sound
function Sfx({ src, at, vol = 1, from = 0 }: { src: string; at: number; vol?: number; from?: number }) {
  return (
    <Sequence from={S(at)} layout="none">
      <Audio src={staticFile(`sfx/${src}.wav`)} volume={vol} startFrom={S(from)} />
    </Sequence>
  )
}

function Mix() {
  return (
    <>
      <Audio src={staticFile('voice.mp3')} volume={1} />
      {/* Tension bed: Interloper, cut dead when Athena's screen dies, back under the ground shot. */}
      <Sequence from={0} durationInFrames={S(7.18)} layout="none">
        <Audio src={staticFile('music/interloper.wav')} volume={(fr) => { const t = fr / FPS; return lerp(t, [0, 1.2], [0, 1]) * (0.62 - 0.4 * duck(t)) * lerp(t, [7.05, 7.18], [1, 0]) }} />
      </Sequence>
      <Sequence from={S(7.75)} durationInFrames={S(12.6)} layout="none">
        <Audio src={staticFile('music/interloper.wav')} startFrom={S(7.75)} volume={(fr) => { const t = 7.75 + fr / FPS; return lerp(t, [7.75, 8.6], [0, 1]) * (0.55 - 0.36 * duck(t)) * lerp(t, [19.2, 20.25], [1, 0]) }} />
      </Sequence>
      {/* The anthem: Heroic Age, its first big hit placed on the title. */}
      <Sequence from={S(20.25)} layout="none">
        <Audio src={staticFile('music/heroic_age.wav')} startFrom={S(2.7)} volume={(fr) => { const t = 20.25 + fr / FPS; return (0.78 - 0.42 * duck(t)) * lerp(t, [28.6, 30], [1, 0]) }} />
      </Sequence>
      <Sfx src="whoosh_long" at={2.25} vol={0.9} />
      <Sfx src="cine_hit" at={2.88} vol={0.75} />
      <Sfx src="glitch" at={6.62} vol={0.45} />
      <Sfx src="sub_hit" at={7.12} vol={1} />
      <Sfx src="whoosh_short" at={7.48} vol={0.5} />
      <Sfx src="bass_hit" at={12.85} vol={0.8} />
      <Sfx src="whoosh_impact" at={14.12} vol={0.85} />
      <Sfx src="whoosh_short" at={17.25} vol={0.45} />
      <Sfx src="riser_long" at={20.25 - 2.6} vol={0.75} />
      <Sfx src="cine_hit" at={20.2} vol={1} />
      <Sfx src="bass_hit" at={20.22} vol={0.8} />
      <Sfx src="hit_reverb" at={24.9} vol={0.7} />
      <Sfx src="whoosh_long2" at={27.7} vol={0.5} />
    </>
  )
}

// ------------------------------------------------------------------------------------------------ film
export function Cinematic() {
  const f = useCurrentFrame()
  const t = f / FPS
  return (
    <AbsoluteFill style={{ background: '#000', fontFamily: sans }}>
      <Mix />
      <Sequence from={0} durationInFrames={S(2.95)}>
        <Opening />
      </Sequence>
      <Sequence from={S(2.9)} durationInFrames={S(4.6)}>
        <Athena />
      </Sequence>
      <Sequence from={S(7.5)} durationInFrames={S(6.82)}>
        <Ground />
      </Sequence>
      <Sequence from={S(14.28)} durationInFrames={S(5.36)}>
        <Crash />
      </Sequence>
      <Sequence from={S(19.62)} durationInFrames={S(3.86)}>
        <Title />
      </Sequence>
      <Sequence from={S(23.46)} durationInFrames={S(6.54)}>
        <Verdict />
      </Sequence>
      <Flash at={S(2.9)} dur={6} peak={0.9} />
      <Flash at={S(14.28)} dur={7} peak={0.8} />
      <Flash at={S(20.25)} dur={10} color="#ffd9a0" peak={0.7} />
      <Grain />
      {/* Letterbox, with the credits and disclosures living in the bars. */}
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: BAR, background: '#000' }} />
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: BAR, background: '#000' }} />
        <div style={{ position: 'absolute', top: 52, right: 60, fontFamily: mono, fontSize: 17, color: 'rgba(242,240,234,0.5)', letterSpacing: '0.1em' }}>AI-GENERATED VOICE</div>
        <div style={{ position: 'absolute', top: 52, left: 60, fontFamily: mono, fontSize: 17, color: 'rgba(242,240,234,0.5)', letterSpacing: '0.1em' }}>NASA LOLA · NAIF SPICE · NASA SVS MOON KIT</div>
        {t > 27.7 && (
          <div style={{ position: 'absolute', bottom: 20, left: 0, right: 0, textAlign: 'center', fontFamily: mono, fontSize: 15, color: 'rgba(242,240,234,0.45)', opacity: lerp(t, [27.7, 28.1], [0, 1]) }}>
            Music: “Interloper”, “Heroic Age” by Kevin MacLeod (incompetech.com), CC BY 4.0
          </div>
        )}
      </AbsoluteFill>
      <Subtitles />
      {/* Fade in from black at the very start. */}
      <AbsoluteFill style={{ background: '#000', opacity: lerp(t, [0, 0.3], [1, 0]), pointerEvents: 'none' }} />
    </AbsoluteFill>
  )
}

