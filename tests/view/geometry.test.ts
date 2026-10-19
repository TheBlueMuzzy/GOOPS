// F58 (2026-10-19): a click just beside the tank used to wrap round to a column on the tank's hidden back and zap goop
// the player can't see. Only the 12 visible columns (and the visible rows) take clicks.
import { describe, expect, it } from 'vitest'
import { screenToVisibleCell, tankRect } from '../../src/view/geometry'
import type { GooView } from '../../src/goo/types'

// 30 columns around, 12 seen, 21 visible rows under 3 buffer rows; 40 px cells; the camera on column 0.
const view: GooView = { cellPx: 40, centreX: 250, topY: 100, camera: 0, width: 600, height: 1000, dpr: 1 }
const W = 30, BUFFER = 3, VIS_W = 12, VIS_ROWS = 21
const rect = tankRect(view, VIS_W, VIS_ROWS)
const at = (px: number, py: number) => screenToVisibleCell(px, py, view, W, BUFFER, VIS_W, VIS_ROWS)

describe('only the visible tank takes clicks', () => {
  it('inside the tank: the cell under the click', () => {
    expect(at(view.centreX, rect.top + 5)).toEqual([0, BUFFER]) // the centre column, top visible row
  })

  it('just outside the left or right side: nothing (it used to wrap to the hidden back)', () => {
    expect(at(rect.left - 2, rect.top + 100)).toBeNull()
    expect(at(rect.left + rect.width + 2, rect.top + 100)).toBeNull()
    expect(at(rect.left - 400, rect.top + 100)).toBeNull()
  })

  it('above the visible top (the spawn rows) or below the floor: nothing', () => {
    expect(at(view.centreX, rect.top - 2)).toBeNull()
    expect(at(view.centreX, rect.top + rect.height + 2)).toBeNull()
  })

  it('the edge columns still work', () => {
    const left = at(rect.left + 1, rect.top + 100)
    const right = at(rect.left + rect.width - 1, rect.top + 100)
    expect(left).not.toBeNull()
    expect(right).not.toBeNull()
    // 12 columns apart minus one: the leftmost and rightmost visible columns
    expect(((right![0] - left![0]) % W + W) % W).toBe(VIS_W - 1)
  })
})
