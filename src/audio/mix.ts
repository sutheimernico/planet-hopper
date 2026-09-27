// src/audio/mix.ts
// Mix constants + pure sound math. The final mix is Nico's ear on real speakers — tweak
// the three *_GAIN constants below (linear gain; −6 dB ≈ ×0.5), nothing else needs to change.

// Loudest one-shot peak used in sfx.ts (capture/death blips) — the reference for the pad.
export const SFX_PEAK = 0.2

// 1) Master level of all one-shot effects (launch, capture, crystal, flyby, death).
export const SFX_GAIN = 1
// 2) Ambient pad peak: 0.012 ≈ −24.4 dB below SFX_PEAK (plan: pad ≤ −24 dB rel. to effects).
export const PAD_GAIN = 0.012
// 3) Noise layer of the death sound (broadband noise reads louder than a sine at equal gain).
export const DEATH_NOISE_GAIN = 0.12

export const gainToDb = (gain: number): number => 20 * Math.log10(gain)

// Artistic "speed of sound" in world units/s: ship speeds (18–55+ wu/s) then give an
// audible but not cartoonish pitch swing.
export const DOPPLER_C = 120
const MAX_V = 0.6 * DOPPLER_C // clamp: keeps the ratios finite and musical

// Classic moving-source Doppler: pitch while approaching (c / (c − v)) and receding
// (c / (c + v)). The flyby sweep runs approach → recede, so faster passes swing wider.
export function dopplerRatios(speed: number): { approach: number; recede: number } {
  const v = Math.min(MAX_V, Math.max(0, speed))
  return { approach: DOPPLER_C / (DOPPLER_C - v), recede: DOPPLER_C / (DOPPLER_C + v) }
}
