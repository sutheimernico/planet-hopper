import { describe, expect, it } from 'vitest'
import {
  DEATH_NOISE_GAIN, DOPPLER_C, dopplerRatios, gainToDb, PAD_GAIN, SFX_GAIN, SFX_PEAK,
} from '../src/audio/mix'
import { createSfx, type AudioContextLike } from '../src/audio/sfx'

// Minimal fake of the Web Audio surface sfx.ts uses — records what gets started.
function fakeContext() {
  const started: string[] = []
  const gains: { value: number }[] = []
  const param = () => {
    const p = {
      value: 0,
      setValueAtTime: (v: number) => { p.value = v; return p },
      linearRampToValueAtTime: () => p,
      exponentialRampToValueAtTime: () => p,
    }
    return p
  }
  const node = <T extends object>(extra: T) => ({ connect: (n: unknown) => n, ...extra })
  const ctx = {
    currentTime: 0,
    sampleRate: 8000,
    destination: {},
    createOscillator: () => node({
      type: 'sine', frequency: param(),
      start: () => void started.push('osc'), stop: () => {},
    }),
    createGain: () => {
      const g = node({ gain: param() })
      gains.push(g.gain)
      return g
    },
    createBiquadFilter: () => node({ type: 'lowpass', frequency: param() }),
    createBuffer: (_c: number, len: number) => {
      const data = new Float32Array(len)
      return { getChannelData: () => data }
    },
    createBufferSource: () => node({ buffer: null, start: () => void started.push('noise'), stop: () => {} }),
  }
  return { ctx: ctx as unknown as AudioContextLike, started, master: () => gains[0]! }
}

describe('audio mix constants', () => {
  it('keeps the pad at least 24 dB below the loudest effect', () => {
    expect(gainToDb(PAD_GAIN / SFX_PEAK)).toBeLessThanOrEqual(-24)
  })
  it('are sane linear gains', () => {
    for (const g of [SFX_GAIN, PAD_GAIN, DEATH_NOISE_GAIN]) {
      expect(g).toBeGreaterThan(0)
      expect(g).toBeLessThanOrEqual(1)
    }
  })
})

describe('Doppler flyby ramp', () => {
  it('is neutral at rest', () => {
    expect(dopplerRatios(0)).toEqual({ approach: 1, recede: 1 })
  })
  it('rises on approach and falls on recede, wider with speed', () => {
    const slow = dopplerRatios(20)
    const fast = dopplerRatios(55)
    expect(slow.approach).toBeGreaterThan(1)
    expect(slow.recede).toBeLessThan(1)
    expect(fast.approach).toBeGreaterThan(slow.approach)
    expect(fast.recede).toBeLessThan(slow.recede)
    expect(fast.approach).toBeCloseTo(DOPPLER_C / (DOPPLER_C - 55))
  })
  it('stays finite for absurd speeds (clamped)', () => {
    const r = dopplerRatios(1e6)
    expect(Number.isFinite(r.approach)).toBe(true)
    expect(r.approach).toBeCloseTo(2.5) // 1 / (1 − 0.6)
    expect(dopplerRatios(-5)).toEqual({ approach: 1, recede: 1 })
  })
})

describe('sfx', () => {
  it('creates no AudioContext before the first sound or gesture (autoplay policy)', () => {
    let made = 0
    const f = fakeContext()
    createSfx(false, () => { made++; return f.ctx })
    expect(made).toBe(0)
  })
  it('plays every effect, the layered death and the pad when unmuted', () => {
    const f = fakeContext()
    const sfx = createSfx(false, () => f.ctx)
    sfx.launch(); sfx.capture(); sfx.crystal(); sfx.flyby(40); sfx.death()
    expect(f.started.filter((s) => s === 'noise')).toHaveLength(1)
    const before = f.started.length
    sfx.startPad()
    sfx.startPad() // idempotent
    expect(f.started.length - before).toBe(3) // LFO + two detuned oscillators
    expect(f.master().value).toBe(1)
  })
  it('mute kills everything: no new sounds, and the master (incl. running pad) goes to 0', () => {
    const f = fakeContext()
    const sfx = createSfx(false, () => f.ctx)
    sfx.startPad()
    const started = f.started.length
    sfx.setMuted(true)
    expect(sfx.isMuted()).toBe(true)
    expect(f.master().value).toBe(0)
    sfx.launch(); sfx.capture(); sfx.crystal(); sfx.flyby(40); sfx.death()
    expect(f.started.length).toBe(started)
    sfx.setMuted(false)
    expect(f.master().value).toBe(1)
  })
  it('starting muted: the pad is built silent and becomes audible on unmute', () => {
    const f = fakeContext()
    const sfx = createSfx(true, () => f.ctx)
    sfx.startPad()
    expect(f.master().value).toBe(0)
    sfx.setMuted(false)
    expect(f.master().value).toBe(1)
  })
})
