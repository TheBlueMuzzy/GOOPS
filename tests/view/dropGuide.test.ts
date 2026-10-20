// The drop guide's chevrons (F26): where they sit, which ones are gone, and how the wave of light runs over them.
import { describe, expect, it } from 'vitest'
import { createDropGuide } from '../../src/view/dropGuide'
import type { ShiftState } from '../../src/engine/types'
import type { GooView } from '../../src/goo/types'

const cfg = { spacingCells: 2, widthCells: 0.7, heightCells: 0.3, lineWidthCells: 0.07, color: '#fff', alpha: 0.1, peakAlpha: 0.5, wavePerSec: 4, fastMultiplier: 3, waveWidth: 1 }
const view: GooView = { cellPx: 10, centreX: 100, topY: 0, camera: 0, width: 300, height: 300, dpr: 1 }

// a canvas stand-in that keeps each chevron's tip (its middle point) and how bright it was drawn
function fakeCtx() {
  const drawn: { y: number; alpha: number }[] = []
  let pts: number[][] = []
  const ctx = {
    globalAlpha: 1, strokeStyle: '', lineWidth: 1, lineCap: '', lineJoin: '',
    save() {}, restore() {}, beginPath() { pts = [] },
    moveTo(x: number, y: number) { pts.push([x, y]) }, lineTo(x: number, y: number) { pts.push([x, y]) },
    stroke() { drawn.push({ y: pts[1][1], alpha: ctx.globalAlpha }) },
  }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, drawn }
}
// a piece whose bottom row is pieceY, falling toward a landing shadow whose top row is 20
const state = (pieceY: number) => ({
  width: 30, height: 24, bufferRows: 0, spin: 0, status: 'playing',
  piece: { cells: [[0, pieceY - 1], [0, pieceY]], colors: [1, 1], rotation: 0, fall: 0 },
  ghost: [[0, 20], [0, 21]],
}) as unknown as ShiftState

describe('drop guide', () => {
  it('chevrons sit every spacing rows up from the landing shadow, only below the piece', () => {
    const { ctx, drawn } = fakeCtx()
    createDropGuide(cfg).draw(ctx, state(5), view, 0, false, true)
    // rows 19, 17, 15, 13, 11, 9, 7 (centres 20 − (k + 0.5) × 2), all below the piece's bottom edge (row 6)
    expect(drawn.map((d) => d.y - 1.5)).toEqual([70, 90, 110, 130, 150, 170, 190])
  })
  it('passed chevrons are gone: the piece lower down leaves fewer', () => {
    const { ctx, drawn } = fakeCtx()
    createDropGuide(cfg).draw(ctx, state(14), view, 0, false, true)
    expect(drawn).toHaveLength(2) // rows 17 and 19
  })
  it('reduce motion: every chevron at the faint level, no wave', () => {
    const { ctx, drawn } = fakeCtx()
    createDropGuide(cfg).draw(ctx, state(5), view, 0.3, false, true)
    expect(new Set(drawn.map((d) => d.alpha))).toEqual(new Set([0.1]))
  })
  it('the wave runs top to bottom over only the chevrons showing, at the same beat; faster on fast drop', () => {
    const brightest = (g: ReturnType<typeof createDropGuide>, pieceY: number, dt: number, fast = false) => {
      const { ctx, drawn } = fakeCtx()
      g.draw(ctx, state(pieceY), view, dt, fast, false)
      return drawn.reduce((best, d, i) => (d.alpha > drawn[best].alpha ? i : best), 0)
    }
    // 4 chevrons a second, cycle = chevrons showing + the wave's width: after 0.125 s (phase 0.5) it's on the top one
    const g = createDropGuide(cfg)
    expect(brightest(g, 5, 0.125)).toBe(0)
    expect(brightest(g, 5, 0.25)).toBe(1) // one chevron further down every 0.25 s
    expect(brightest(g, 5, 0.25, true)).toBe(4) // fast drop: 3 chevrons in the same 0.25 s
    // phase 3.5: 7 chevrons showing → on the 4th; only 2 showing (the piece passed the rest) → the wave has already
    // looped back to the top one (cycle 3), instead of crossing 5 hidden ones first
    expect(brightest(createDropGuide(cfg), 5, 0.875)).toBe(3)
    expect(brightest(createDropGuide(cfg), 14, 0.875)).toBe(0)
  })
})
