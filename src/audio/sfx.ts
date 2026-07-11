// src/audio/sfx.ts
export interface Sfx {
  launch(): void
  capture(): void
  crystal(): void
  flyby(): void
  death(): void
  setMuted(muted: boolean): void
  isMuted(): boolean
}

// All sounds are synthesized — zero asset files, zero licensing.
// The AudioContext is created lazily on first call (browser autoplay policy).
export function createSfx(initialMuted: boolean): Sfx {
  let ctx: AudioContext | null = null
  let muted = initialMuted

  const play = (
    type: OscillatorType, from: number, to: number, duration: number, gainPeak: number,
  ): void => {
    if (muted) return
    ctx ??= new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const t = ctx.currentTime
    osc.type = type
    osc.frequency.setValueAtTime(from, t)
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + duration)
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(gainPeak, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + duration + 0.05)
  }

  return {
    launch: () => play('sawtooth', 180, 40, 0.5, 0.18),
    capture: () => { play('sine', 520, 780, 0.18, 0.2); play('sine', 660, 990, 0.3, 0.12) },
    crystal: () => play('triangle', 880, 1320, 0.15, 0.16),
    flyby: () => play('sawtooth', 300, 900, 0.35, 0.1),
    death: () => play('square', 220, 30, 0.7, 0.2),
    setMuted: (m) => { muted = m },
    isMuted: () => muted,
  }
}
