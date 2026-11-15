import { AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing } from 'remotion'
import timings from '../public/voice-timings.json'
import top10 from '../public/top10.json'
import survival from '../public/malapert-survival.json'

/*
 * 30 s, 1920x1080. Every shot is the real LASTLIGHT 3D film, recorded on the GPU (video/scripts/capture.mjs).
 * Every number on screen comes from web/public/data (top10.json, malapert-survival.json), copied here.
 * Cuts follow the recorded voice (assets/audio/voice.mp3, Whisper timings). The score is synthesized
 * (video/scripts/make_score.py). No stock footage, no logos.
 */

const S = (sec: number) => Math.round(sec * 30)
const FG = '#ecebe6'
const FG2 = '#a3a3a0'
const FAIL = '#ff5a4e'
const GOOD = '#5bd69a'
const AMBER = '#ffb547'
const sans = "'Geist Variable', system-ui, sans-serif"
const mono = "'Geist Mono Variable', ui-monospace, monospace"
const ease = Easing.bezier(0.32, 0.72, 0, 1)

/** A recorded shot, with a slow push and a fade in and out. `from` is where in the recording it starts (s). */
function Shot({ clip, from = 0, dur, rate = 1, push = 0.05, fadeIn = 10, fadeOut = 10 }: { clip: string; from?: number; dur: number; rate?: number; push?: number; fadeIn?: number; fadeOut?: number }) {
  const f = useCurrentFrame()
  const p = interpolate(f, [0, dur], [0, 1], { extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) })
  const op = Math.min(interpolate(f, [0, fadeIn], [0, 1], { extrapolateRight: 'clamp' }), interpolate(f, [dur - fadeOut, dur], [1, 0], { extrapolateLeft: 'clamp' }))
  return (
    <AbsoluteFill style={{ opacity: op, overflow: 'hidden', background: '#000' }}>
      <OffthreadVideo src={staticFile(`clips/${clip}.mp4`)} startFrom={Math.round(from * 30)} playbackRate={rate} muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${1 + push * p})` }} />
    </AbsoluteFill>
  )
}

function Reveal({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: React.CSSProperties }) {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({ frame: f - delay, fps, config: { damping: 200, mass: 0.7 } })
  return <div style={{ opacity: s, transform: `translateY(${(1 - s) * 22}px)`, ...style }}>{children}</div>
}

const Kicker = ({ children, color = FG2 }: { children: React.ReactNode; color?: string }) => (
  <div style={{ fontFamily: mono, fontSize: 26, color, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{children}</div>
)

/** Black veil that grows between two local frames (the light dying). */
function Dim({ from, to, amount }: { from: number; to: number; amount: number }) {
  const f = useCurrentFrame()
  return <AbsoluteFill style={{ background: '#000', opacity: interpolate(f, [from, to], [0, amount], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }} />
}

/** Soft dark gradient where text sits, so it reads on bright terrain. */
const Scrim = ({ side = 'left', strength = 0.7 }: { side?: 'left' | 'bottom'; strength?: number }) => (
  <AbsoluteFill style={{ background: side === 'left' ? `linear-gradient(90deg, rgba(5,6,10,${strength}) 0%, rgba(5,6,10,${strength * 0.45}) 45%, transparent 75%)` : `linear-gradient(0deg, rgba(5,6,10,${strength}) 0%, transparent 55%)` }} />
)

/** Burned-in subtitles from the Whisper segments. */
const LINES: { start: number; end: number; text: string }[] = timings.segments.map((s: { start: number; end: number; text: string }) => ({
  start: s.start,
  end: s.end,
  text: s.text.replace('Last Light', 'LASTLIGHT').replace('South Pole', 'south pole').replace('the sun', 'the Sun'),
}))

function Subtitles() {
  const f = useCurrentFrame()
  const t = f / 30
  const line = LINES.find((l) => t >= l.start && t < l.end + 0.05)
  if (!line) return null
  const op = interpolate((t - line.start) * 30, [0, 5], [0, 1], { extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 64 }}>
      <div style={{ opacity: op, fontFamily: sans, fontWeight: 500, fontSize: 40, color: FG, background: 'rgba(7,8,11,0.6)', padding: '10px 24px', borderRadius: 10, letterSpacing: '-0.01em', maxWidth: 1500, textAlign: 'center' }}>{line.text}</div>
    </AbsoluteFill>
  )
}

/** Alive share of the 1,000 simulated landings of the best 2027 window at Malapert Massif, from the real draws. */
const ghosts = survival.ghost_landers_sample as { died_at_h: number | null }[]
const alive = (h: number) => ghosts.filter((g) => g.died_at_h == null || g.died_at_h > h).length
const HOURS = 14 * 24

function SurvivalOverlay({ dur }: { dur: number }) {
  const f = useCurrentFrame()
  const k = interpolate(f, [S(0.4), dur - S(0.3)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease })
  const hour = k * HOURS
  const W = 640, H = 170
  const pts: string[] = []
  for (let h = 0; h <= hour; h += 6) pts.push(`${(h / HOURS) * W},${H - (alive(h) / ghosts.length) * (H - 16) - 8}`)
  const a = alive(hour)
  const op = interpolate(f, [0, 10], [0, 1], { extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ padding: '0 140px 150px', justifyContent: 'flex-end', opacity: op }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 18 }}>
        <div style={{ fontFamily: mono, fontSize: 110, fontWeight: 500, color: GOOD, letterSpacing: '-0.04em', lineHeight: 1 }}>{a}</div>
        <div style={{ fontSize: 30, color: FG2 }}>of {ghosts.length} landers still alive · day {Math.floor(hour / 24)}</div>
      </div>
      <svg width={W} height={H} style={{ marginTop: 14 }}>
        <rect width={W} height={H} fill="rgba(255,255,255,0.05)" />
        <polyline points={pts.join(' ')} fill="none" stroke={GOOD} strokeWidth={3.5} strokeLinejoin="round" />
      </svg>
    </AbsoluteFill>
  )
}

const best = top10.windows[0]
const bestDate = new Date(best.landing_utc).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const nAbove = top10.windows.filter((w) => w.p_survive_14d >= top10.criteria.p_threshold).length

export function LastLight() {
  return (
    <AbsoluteFill style={{ background: '#05060a', fontFamily: sans }}>
      <Audio src={staticFile('voice.mp3')} />
      <Audio src={staticFile('score.wav')} volume={0.6} />

      {/* 0 - 2.2 s: the Moon. */}
      <Sequence from={0} durationInFrames={S(2.5)}>
        <Shot clip="moon" from={0.8} dur={S(2.5)} push={0.06} fadeIn={20} fadeOut={8} />
        <AbsoluteFill style={{ padding: '0 140px', justifyContent: 'center' }}>
          <Reveal delay={14}>
            <Kicker>March 2025</Kicker>
          </Reveal>
        </AbsoluteFill>
      </Sequence>

      {/* 2.2 - 7.5 s: flight to Athena's landing site, then the silence. */}
      <Sequence from={S(2.2)} durationInFrames={S(5.4)}>
        <Shot clip="athena" from={0} dur={S(5.4)} push={0.04} fadeIn={10} fadeOut={10} />
        <Dim from={S(2.8)} to={S(5.2)} amount={0.5} />
        <AbsoluteFill style={{ padding: '120px 140px' }}>
          <Reveal delay={S(0.4)}>
            <Kicker>6 March 2025 · Intuitive Machines IM-2</Kicker>
          </Reveal>
          <Reveal delay={S(0.8)}>
            <div style={{ fontSize: 96, fontWeight: 600, color: FG, letterSpacing: '-0.04em', marginTop: 16, lineHeight: 1 }}>Athena lands at the pole.</div>
          </Reveal>
          <Reveal delay={S(2.8)}>
            <div style={{ fontFamily: mono, fontSize: 72, color: FAIL, marginTop: 28 }}>+13 h. Silent.</div>
          </Reveal>
        </AbsoluteFill>
      </Sequence>

      {/* 7.5 - 14.28 s: on the ground, the title, the Sun at the horizon. */}
      <Sequence from={S(7.5)} durationInFrames={S(6.78)}>
        <Shot clip="site" from={0} dur={S(6.78)} push={0.05} fadeIn={14} fadeOut={8} />
        <Scrim side="left" strength={0.8} />
        <AbsoluteFill style={{ padding: '0 140px', justifyContent: 'center' }}>
          <Reveal delay={8}>
            <div style={{ fontSize: 150, fontWeight: 600, color: FG, letterSpacing: '-0.05em', lineHeight: 0.95 }}>LASTLIGHT</div>
          </Reveal>
          <Reveal delay={20}>
            <div style={{ width: 120, height: 3, background: FG, opacity: 0.8, margin: '30px 0' }} />
          </Reveal>
          <Reveal delay={26}>
            <div style={{ fontSize: 34, color: FG2, lineHeight: 1.4 }}>
              Lunar Landing Site Navigator
              <br />
              Casablanca, We Have A Solution
            </div>
          </Reveal>
        </AbsoluteFill>
      </Sequence>

      {/* 14.28 - 19.62 s: we crash it first. Thousands of times. */}
      <Sequence from={S(14.28)} durationInFrames={S(5.34)}>
        <Shot clip="crash" from={0.6} rate={1.5} dur={S(5.34)} push={0.04} fadeIn={8} fadeOut={8} />
        <Scrim side="bottom" strength={0.85} />
        <AbsoluteFill style={{ padding: '110px 140px' }}>
          <Reveal delay={6}>
            <Kicker>1,000 simulated landings per day · NASA LOLA terrain</Kicker>
          </Reveal>
        </AbsoluteFill>
        <Sequence from={S(1.6)}>
          <SurvivalOverlay dur={S(3.6)} />
        </Sequence>
      </Sequence>

      {/* 19.62 - 23.46 s: where, when, will it survive. The pole, the date sliding. */}
      <Sequence from={S(19.62)} durationInFrames={S(3.84)}>
        <Shot clip="pole" from={4.9} dur={S(3.84)} push={0.03} fadeIn={8} fadeOut={8} />
        <Scrim side="left" strength={0.75} />
        <AbsoluteFill style={{ padding: '0 140px', justifyContent: 'center' }}>
          {['Where.', 'When.', 'Will it survive?'].map((w, i) => (
            <Reveal key={w} delay={6 + i * 16}>
              <div style={{ fontSize: 120, fontWeight: 600, color: i === 2 ? GOOD : FG, letterSpacing: '-0.045em', lineHeight: 1.04 }}>{w}</div>
            </Reveal>
          ))}
        </AbsoluteFill>
      </Sequence>

      {/* 23.46 - 30 s: the result, from the real ranking. */}
      <Sequence from={S(23.46)} durationInFrames={S(6.54)}>
        <Shot clip="verdict" from={0} rate={0.92} dur={S(6.54)} push={0.03} fadeIn={10} fadeOut={S(1.2)} />
        <Scrim side="left" strength={0.85} />
        <AbsoluteFill style={{ padding: '0 140px', justifyContent: 'center' }}>
          <Reveal delay={S(2.9)}>
            <Kicker color={FG2}>Best window · {bestDate}</Kicker>
          </Reveal>
          <Reveal delay={S(3.1)}>
            <div style={{ fontFamily: mono, fontSize: 190, fontWeight: 500, color: GOOD, letterSpacing: '-0.05em', lineHeight: 1, marginTop: 10 }}>{(best.p_survive_14d * 100).toFixed(1)}%</div>
          </Reveal>
          <Reveal delay={S(3.4)}>
            <div style={{ fontSize: 40, color: FG, marginTop: 10 }}>survive 14 days at Malapert Massif</div>
          </Reveal>
          <Reveal delay={S(4.0)}>
            <div style={{ fontSize: 28, color: FG2, marginTop: 22, maxWidth: 900, lineHeight: 1.4 }}>
              {nAbove} windows reach {(top10.criteria.p_threshold * 100).toFixed(0)}% between {top10.criteria.year_start} and {top10.criteria.year_end}, all at Malapert Massif. Open source.
            </div>
          </Reveal>
          <Reveal delay={S(4.6)}>
            <div style={{ fontFamily: mono, fontSize: 26, color: AMBER, marginTop: 26 }}>lastlight-17r.pages.dev</div>
          </Reveal>
        </AbsoluteFill>
      </Sequence>

      <AbsoluteFill style={{ background: 'radial-gradient(120% 90% at 50% 45%, transparent 58%, rgba(0,0,0,0.5) 100%)', pointerEvents: 'none' }} />
      <Subtitles />

      {/* Disclosures: visible the whole time, small. */}
      <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'flex-end', padding: '36px 44px', pointerEvents: 'none' }}>
        <div style={{ fontFamily: mono, fontSize: 18, color: 'rgba(236,235,230,0.6)' }}>AI-generated voice</div>
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'flex-end', padding: '30px 44px', pointerEvents: 'none' }}>
        <div style={{ fontFamily: mono, fontSize: 15, color: 'rgba(236,235,230,0.45)' }}>NASA LOLA terrain · NASA SPICE orbits · NASA SVS Moon Kit imagery</div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
