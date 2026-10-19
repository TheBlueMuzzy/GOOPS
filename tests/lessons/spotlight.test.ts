// F32: the spotlight's dim = the screen minus its holes, as rectangles that never overlap (two overlapping holes must
// stay ONE undimmed area — an even-odd path would dim their overlap again).
import { describe, expect, it } from 'vitest'
import { outsidePath, outsideRects, type Box } from '../../src/game/lessons/spotlightMath'

const area = (bs: Box[]) => bs.reduce((s, b) => s + (b.right - b.left) * (b.bottom - b.top), 0)
const covers = (bs: Box[], x: number, y: number) => bs.some((b) => x > b.left && x < b.right && y > b.top && y < b.bottom)

describe('the spotlight dim', () => {
  it('no holes: the whole screen', () => {
    expect(outsideRects([], 100, 50)).toEqual([{ left: 0, top: 0, right: 100, bottom: 50 }])
  })
  it('one hole: everything but the hole', () => {
    const rs = outsideRects([{ left: 10, top: 10, right: 30, bottom: 20 }], 100, 50)
    expect(area(rs)).toBe(100 * 50 - 20 * 10)
    expect(covers(rs, 20, 15)).toBe(false)
    expect(covers(rs, 5, 5)).toBe(true)
  })
  it('two overlapping holes (a panel and the part inside it): their union stays undimmed, nothing counted twice', () => {
    const panel = { left: 50, top: 10, right: 90, bottom: 40 }, part = { left: 40, top: 20, right: 60, bottom: 30 }
    const rs = outsideRects([panel, part], 100, 50)
    expect(covers(rs, 55, 25)).toBe(false) // the overlap
    expect(covers(rs, 45, 25)).toBe(false) // the part sticking out of the panel
    expect(covers(rs, 70, 35)).toBe(false) // the panel
    expect(area(rs)).toBe(100 * 50 - (40 * 30 + 10 * 10))
    for (const a of rs) for (const b of rs) if (a !== b) expect(a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom).toBe(false)
  })
  it('holes off the screen are clipped; all covered → nothing to draw', () => {
    expect(area(outsideRects([{ left: -10, top: -10, right: 20, bottom: 60 }], 100, 50))).toBe(80 * 50)
    expect(outsidePath([{ left: -1, top: -1, right: 101, bottom: 51 }], 100, 50)).toBe('inset(50%)')
    expect(outsidePath([], 10, 10)).toBe('path("M0 0H10V10H0Z")')
  })
})
