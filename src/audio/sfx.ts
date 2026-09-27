// src/audio/sfx.ts
import { DEATH_NOISE_GAIN, dopplerRatios, PAD_GAIN, SFX_GAIN } from './mix'

export interface Sfx {
  launch(): void
  capture(): void
  crystal(): void
  flyby(speed: number): void // ship speed at the pass → Doppler swing
  death(): void
  startPad(): void // call from a user gesture (Start button) — autoplay policy
  setMuted(muted: boolean): void
  isMuted(): boolean
}

// The subset of AudioContext this module uses — lets tests inject a fake context.
export type AudioContextLike = Pick<
  AudioContext,
  'currentTime' | 'destination' | 'sampleRate' | 'createOscillator' | 'createGain' |
  'createBiquadFilter' | 'createBuffer' | 'createBufferSource'
>

const PAD_FREQ = 110 // A2 — low enough to sit under the effects, audible on laptop speakers
const PAD_DETUNE_HZ = 0.7 // slow beating between the two oscillators
const PAD_LFO_HZ = 0.07 // one gentle swell every ~14 s

// All sounds are synthesized — zero asset files, zero licensing. Everything routes through
// one master gain, so mute silences one-shots AND the running pad in a single place.
// The AudioContext is created lazily on the first sound (browser autoplay policy).
export function createSfx(
  initialMuted: boolean,
  makeContext: () => AudioContextLike = () => new AudioContext(),
): Sfx {
  let ctx: AudioContextLike | null = null
  let master: GainNode | null = null
  let padStarted = false
  let noise: AudioBuffer | null = null
  let muted = initialMuted

  const audio = (): { ctx: AudioContextLike; master: GainNode } => {
    if (!ctx || !master) {
      ctx = makeContext()
      master = ctx.createGain()
      master.gain.value = muted ? 0 : 1
      master.connect(ctx.destination)
    }
    return { ctx, master }
  }

  const play = (
    type: OscillatorType, from: number, to: number, duration: number, gainPeak: number,
  ): void => {
    if (muted) return
    const { ctx: c, master: out } = audio()
    const osc = c.createOscillator()
    const gain = c.createGain()
    const t = c.currentTime
    osc.type = type
    osc.frequency.setValueAtTime(from, t)
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + duration)
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(gainPeak * SFX_GAIN, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    osc.connect(gain).connect(out)
    osc.start(t)
    osc.stop(t + duration + 0.05)
  }

  // Noise burst through a closing low-pass — the "crunch" layer under the death drop.
  const noiseBurst = (duration: number): void => {
    if (muted) return
    const { ctx: c, master: out } = audio()
    if (!noise) {
      noise = c.createBuffer(1, Math.ceil(c.sampleRate * duration), c.sampleRate)
      const data = noise.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    }
    const src = c.createBufferSource()
    const filter = c.createBiquadFilter()
    const gain = c.createGain()
    const t = c.currentTime
    src.buffer = noise
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(2400, t)
    filter.frequency.exponentialRampToValueAtTime(160, t + duration)
    gain.gain.setValueAtTime(DEATH_NOISE_GAIN * SFX_GAIN, t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    src.connect(filter).connect(gain).connect(out)
    src.start(t)
    src.stop(t + duration)
  }

  return {
    launch: () => play('sawtooth', 180, 40, 0.5, 0.18),
    capture: () => { play('sine', 520, 780, 0.18, 0.2); play('sine', 660, 990, 0.3, 0.12) },
    crystal: () => play('triangle', 880, 1320, 0.15, 0.16),
    flyby: (speed) => {
      const { approach, recede } = dopplerRatios(speed)
      play('sawtooth', 450 * approach, 450 * recede, 0.4, 0.1)
    },
    death: () => {
      noiseBurst(0.6)
      play('sine', 110, 30, 0.9, 0.2) // low drop under the noise
      play('square', 220, 30, 0.7, 0.08)
    },
    startPad() {
      if (padStarted) return
      padStarted = true
      const { ctx: c, master: out } = audio()
      const t = c.currentTime
      const pad = c.createGain()
      // two summed oscillators peak at 2× — halve so the pad's peak is exactly PAD_GAIN
      pad.gain.setValueAtTime(0, t)
      pad.gain.linearRampToValueAtTime(PAD_GAIN / 2 * 0.8, t + 4) // slow fade-in
      pad.connect(out)
      // LFO swells the pad gain between 0.6× and 1.0× of its peak
      const lfo = c.createOscillator()
      const lfoDepth = c.createGain()
      lfo.frequency.value = PAD_LFO_HZ
      lfoDepth.gain.value = PAD_GAIN / 2 * 0.2
      lfo.connect(lfoDepth).connect(pad.gain)
      lfo.start(t)
      for (const f of [PAD_FREQ, PAD_FREQ + PAD_DETUNE_HZ]) {
        const osc = c.createOscillator()
        osc.type = 'triangle'
        osc.frequency.value = f
        osc.connect(pad)
        osc.start(t)
      }
    },
    setMuted: (m) => {
      muted = m
      if (master && ctx) master.gain.setValueAtTime(m ? 0 : 1, ctx.currentTime)
    },
    isMuted: () => muted,
  }
}
