import { describe, expect, it } from 'vitest'
import { add, cross, dist, len, norm, scale, sub, vec } from '../src/core/vec'

describe('vec', () => {
  it('adds, subtracts, scales', () => {
    expect(add(vec(1, 2), vec(3, -1))).toEqual({ x: 4, y: 1 })
    expect(sub(vec(1, 2), vec(3, -1))).toEqual({ x: -2, y: 3 })
    expect(scale(vec(2, -3), 2)).toEqual({ x: 4, y: -6 })
  })
  it('length and distance', () => {
    expect(len(vec(3, 4))).toBe(5)
    expect(dist(vec(1, 1), vec(4, 5))).toBe(5)
  })
  it('normalizes, zero-safe', () => {
    expect(norm(vec(10, 0))).toEqual({ x: 1, y: 0 })
    expect(norm(vec(0, 0))).toEqual({ x: 0, y: 0 })
  })
  it('cross product sign gives orientation', () => {
    expect(cross(vec(1, 0), vec(0, 1))).toBe(1)
    expect(cross(vec(0, 1), vec(1, 0))).toBe(-1)
  })
})
