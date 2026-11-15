// Generated soundscape (Web Audio, no audio files, no licensing issues).
// Warm chord while the lander sees the Sun, a cold low drone when it does not,
// a soft air sweep between chapters. Starts only after the user turns it on.

export class Soundscape {
  private ctx: AudioContext | null = null
  private warm: GainNode | null = null
  private cold: GainNode | null = null
  private master: GainNode | null = null

  get on() {
    return !!this.ctx && this.ctx.state === 'running'
  }

  start() {
    if (this.ctx) {
      this.ctx.resume()
      return
    }
    const ctx = new AudioContext()
    this.ctx = ctx
    const master = ctx.createGain()
    master.gain.value = 0
    master.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 2)
    const comp = ctx.createDynamicsCompressor()
    master.connect(comp).connect(ctx.destination)
    this.master = master

    const pad = (freqs: number[], type: OscillatorType, cutoff: number) => {
      const g = ctx.createGain()
      g.gain.value = 0
      const f = ctx.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.value = cutoff
      f.Q.value = 0.7
      f.connect(g).connect(master)
      freqs.forEach((hz, i) => {
        const o = ctx.createOscillator()
        o.type = type
        o.frequency.value = hz
        o.detune.value = (i - 1) * 6
        const lfo = ctx.createOscillator()
        const lg = ctx.createGain()
        lfo.frequency.value = 0.05 + i * 0.03
        lg.gain.value = 4
        lfo.connect(lg).connect(o.detune)
        const og = ctx.createGain()
        og.gain.value = 0.12
        o.connect(og).connect(f)
        o.start()
        lfo.start()
      })
      return g
    }
    this.warm = pad([110, 164.8, 220, 277.2], 'triangle', 900) // A major-ish, soft
    this.cold = pad([55, 82.4, 61.7], 'sine', 260)
    this.setSun(true)
  }

  stop() {
    this.ctx?.suspend()
  }

  setSun(lit: boolean) {
    if (!this.ctx || !this.warm || !this.cold) return
    const t = this.ctx.currentTime
    this.warm.gain.cancelScheduledValues(t)
    this.cold.gain.cancelScheduledValues(t)
    this.warm.gain.linearRampToValueAtTime(lit ? 0.55 : 0.0, t + 1.6)
    this.cold.gain.linearRampToValueAtTime(lit ? 0.12 : 0.6, t + 1.6)
  }

  whoosh() {
    if (!this.ctx || !this.master) return
    const ctx = this.ctx
    const len = ctx.sampleRate * 1.4
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / len)
    const src = ctx.createBufferSource()
    src.buffer = buf
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.Q.value = 1.2
    f.frequency.setValueAtTime(300, ctx.currentTime)
    f.frequency.exponentialRampToValueAtTime(2400, ctx.currentTime + 1.2)
    const g = ctx.createGain()
    g.gain.value = 0.25
    src.connect(f).connect(g).connect(this.master)
    src.start()
  }

  thud() {
    if (!this.ctx || !this.master) return
    const ctx = this.ctx
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(90, ctx.currentTime)
    o.frequency.exponentialRampToValueAtTime(38, ctx.currentTime + 0.5)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.5, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7)
    o.connect(g).connect(this.master)
    o.start()
    o.stop(ctx.currentTime + 0.8)
  }
}
