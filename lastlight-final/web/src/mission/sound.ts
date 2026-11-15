// Generated soundtrack (Web Audio, no audio files, no licensing issues). Starts only after the
// user turns it on. Calm and hopeful: slow major-key pads, a soft pentatonic bell arpeggio
// through echo and reverb, and an occasional high shimmer. When the lander is in the dark the
// music softens and drops lower, but never turns harsh.

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12)

// Four chords, 9 s each: D major (add9) -> B minor 7 -> G major 7 -> A sus.
const CHORDS: { pad: number[]; bass: number; bells: number[] }[] = [
  { pad: [62, 66, 69, 76], bass: 38, bells: [74, 76, 78, 81, 83, 86] },
  { pad: [59, 62, 66, 69], bass: 35, bells: [71, 74, 76, 78, 81, 83] },
  { pad: [55, 59, 62, 66], bass: 31, bells: [71, 74, 78, 79, 81, 83] },
  { pad: [57, 62, 64, 69], bass: 33, bells: [69, 74, 76, 81, 83, 86] },
]
const CHORD_S = 9
const STEP_S = 0.6 // bell grid

function impulse(ctx: AudioContext, seconds: number, decay: number) {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
  }
  return buf
}

export class Soundscape {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private padBus: GainNode | null = null
  private padFilter: BiquadFilterNode | null = null
  private bellBus: GainNode | null = null
  private wet: GainNode | null = null
  private timer = 0
  private nextChordAt = 0
  private nextStepAt = 0
  private chord = 0
  private lit = true
  private padVoices: { stop: (t: number) => void }[] = []

  get on() {
    return !!this.ctx && this.ctx.state === 'running'
  }

  start() {
    if (this.ctx) {
      this.ctx.resume()
      this.master?.gain.linearRampToValueAtTime(0.42, this.ctx.currentTime + 1.5)
      return
    }
    const ctx = new AudioContext()
    this.ctx = ctx
    const master = ctx.createGain()
    master.gain.value = 0
    master.gain.linearRampToValueAtTime(0.42, ctx.currentTime + 3)
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -18
    comp.ratio.value = 3
    master.connect(comp).connect(ctx.destination)
    this.master = master

    // Space: a long soft reverb plus a dotted echo, shared by pads and bells.
    const verb = ctx.createConvolver()
    verb.buffer = impulse(ctx, 5.5, 2.6)
    const wet = ctx.createGain()
    wet.gain.value = 0.55
    verb.connect(wet).connect(master)
    this.wet = wet
    const echo = ctx.createDelay(2)
    echo.delayTime.value = STEP_S * 1.5
    const fb = ctx.createGain()
    fb.gain.value = 0.38
    const echoTone = ctx.createBiquadFilter()
    echoTone.type = 'lowpass'
    echoTone.frequency.value = 2600
    echo.connect(echoTone).connect(fb).connect(echo)
    echoTone.connect(verb)
    const echoOut = ctx.createGain()
    echoOut.gain.value = 0.35
    echoTone.connect(echoOut).connect(master)

    const padFilter = ctx.createBiquadFilter()
    padFilter.type = 'lowpass'
    padFilter.frequency.value = 1400
    padFilter.Q.value = 0.5
    const padBus = ctx.createGain()
    padBus.gain.value = 0.32
    padFilter.connect(padBus)
    padBus.connect(master)
    padBus.connect(verb)
    this.padBus = padBus
    this.padFilter = padFilter

    const bellBus = ctx.createGain()
    bellBus.gain.value = 0.22
    bellBus.connect(master)
    bellBus.connect(echo)
    bellBus.connect(verb)
    this.bellBus = bellBus

    this.nextChordAt = ctx.currentTime + 0.1
    this.nextStepAt = ctx.currentTime + 1.5
    // Look-ahead scheduler: plans notes a little in advance so timing stays smooth.
    this.timer = window.setInterval(() => this.schedule(), 120)
    this.setSun(true)
  }

  stop() {
    if (!this.ctx || !this.master) return
    const t = this.ctx.currentTime
    this.master.gain.cancelScheduledValues(t)
    this.master.gain.setValueAtTime(this.master.gain.value, t)
    this.master.gain.linearRampToValueAtTime(0, t + 0.6)
    window.setTimeout(() => this.ctx?.suspend(), 700)
  }

  private schedule() {
    const ctx = this.ctx
    if (!ctx || ctx.state !== 'running') return
    const horizon = ctx.currentTime + 0.4
    while (this.nextChordAt < horizon) {
      this.playChord(this.nextChordAt, CHORDS[this.chord])
      this.chord = (this.chord + 1) % CHORDS.length
      this.nextChordAt += CHORD_S
    }
    while (this.nextStepAt < horizon) {
      const c = CHORDS[(this.chord + CHORDS.length - 1) % CHORDS.length]
      // Sparse and gentle: about half the steps play, fewer in the dark.
      if (Math.random() < (this.lit ? 0.55 : 0.3)) {
        const n = c.bells[Math.floor(Math.random() * c.bells.length)] - (this.lit ? 0 : 12)
        this.bell(this.nextStepAt, midi(n), this.lit ? 0.9 : 0.6)
      }
      if (Math.random() < 0.06) this.bell(this.nextStepAt + STEP_S / 2, midi(c.bells[c.bells.length - 1] + 12), 0.35) // shimmer
      this.nextStepAt += STEP_S
    }
  }

  private playChord(t: number, c: (typeof CHORDS)[number]) {
    const ctx = this.ctx!
    // Release the previous chord slowly so chords melt into each other.
    this.padVoices.forEach((v) => v.stop(t + 3))
    this.padVoices = []
    const voice = (hz: number, type: OscillatorType, level: number, detune: number) => {
      const o = ctx.createOscillator()
      o.type = type
      o.frequency.value = hz
      o.detune.value = detune
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(level, t + 3.2)
      o.connect(g).connect(this.padFilter!)
      o.start(t)
      return {
        stop: (at: number) => {
          g.gain.cancelScheduledValues(at - 3)
          g.gain.setTargetAtTime(0, at - 3, 1.1)
          o.stop(at + 4)
        },
      }
    }
    for (const n of c.pad) {
      this.padVoices.push(voice(midi(n), 'sawtooth', 0.05, -7), voice(midi(n), 'sawtooth', 0.05, 7))
    }
    this.padVoices.push(voice(midi(c.bass), 'sine', 0.22, 0))
  }

  private bell(t: number, hz: number, level: number) {
    const ctx = this.ctx!
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.16 * level, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0008, t + 2.6)
    g.connect(this.bellBus!)
    const a = ctx.createOscillator()
    a.type = 'sine'
    a.frequency.value = hz
    const b = ctx.createOscillator() // soft inharmonic partial for a glassy tone
    b.type = 'sine'
    b.frequency.value = hz * 2.76
    const bg = ctx.createGain()
    bg.gain.value = 0.18
    a.connect(g)
    b.connect(bg).connect(g)
    a.start(t)
    b.start(t)
    a.stop(t + 2.8)
    b.stop(t + 2.8)
  }

  setSun(lit: boolean) {
    this.lit = lit
    if (!this.ctx || !this.padFilter || !this.padBus) return
    const t = this.ctx.currentTime
    this.padFilter.frequency.cancelScheduledValues(t)
    this.padFilter.frequency.setTargetAtTime(lit ? 1400 : 650, t, 1.2)
    this.padBus.gain.setTargetAtTime(lit ? 0.32 : 0.24, t, 1.2)
    this.wet?.gain.setTargetAtTime(lit ? 0.55 : 0.7, t, 1.5)
  }

  /** Soft airy rise between chapters. */
  whoosh() {
    if (!this.ctx || !this.master) return
    const ctx = this.ctx
    const len = ctx.sampleRate * 1.6
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(Math.sin((Math.PI * i) / len), 2)
    const src = ctx.createBufferSource()
    src.buffer = buf
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.Q.value = 0.9
    f.frequency.setValueAtTime(400, ctx.currentTime)
    f.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 1.4)
    const g = ctx.createGain()
    g.gain.value = 0.12
    src.connect(f).connect(g).connect(this.master)
    if (this.wet) g.connect(this.wet)
    src.start()
  }

  /** A low, round bell for arrivals and launches (no harsh impact). */
  thud() {
    if (!this.ctx || !this.bellBus) return
    this.bell(this.ctx.currentTime + 0.02, midi(50), 1.4)
    this.bell(this.ctx.currentTime + 0.02, midi(57), 0.8)
  }

  dispose() {
    window.clearInterval(this.timer)
    this.ctx?.close()
  }
}
