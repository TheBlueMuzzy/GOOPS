// F64: a black crack's stars sit on its inner points (src/view/tankView.ts crackStarPoint). A grown crack's cells have
// negative keys — that once picked a point before the first and threw on every frame, freezing the final shift's
// picture (Muzzy 2026-10-26).
import { describe, expect, it } from 'vitest'
import { crackStarPoint } from '../../src/view/tankView'

describe('crackStarPoint', () => {
  it('is always an inner point (1..n-2), for root keys and grown cells\' negative keys', () => {
    for (const key of [1, 7, 7001, -(3 * 1024 + 1), -(7001 * 1024 + 5), -1]) {
      for (let k = 0; k < 8; k++) {
        const i = crackStarPoint(6, k, key)
        expect(Number.isInteger(i)).toBe(true)
        expect(i).toBeGreaterThanOrEqual(1)
        expect(i).toBeLessThanOrEqual(4)
      }
    }
  })

  it('a crack that never grew keeps the points it had', () => {
    expect([0, 1, 2].map((k) => crackStarPoint(6, k, 5))).toEqual([2, 4, 2])
  })
})
