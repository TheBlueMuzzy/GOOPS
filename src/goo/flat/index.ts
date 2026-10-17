// The plainest renderer: rounded blocks, no physics. Used by tests and as proof of the golden rule — the shift plays
// exactly the same with the goo "off". Draws on a 2D canvas.
import type { ShiftEvent, ShiftState } from '../../engine/types'
import type { GooRenderer, GooView } from '../types'
import { screenColumn } from '../types'

export function createFlatRenderer(canvas: HTMLCanvasElement, colorOf: (c: number) => string): GooRenderer {
  const ctx = canvas.getContext('2d')!
  return {
    name: 'jelly',
    frame(s: ShiftState, _events: ShiftEvent[], v: GooView) {
      const w = Math.round(v.width * v.dpr), h = Math.round(v.height * v.dpr)
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h }
      ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0)
      ctx.clearRect(0, 0, v.width, v.height)
      const cell = (x: number, y: number, c: number, alpha: number) => {
        const sx = v.centreX + screenColumn(x, v.camera, s.width) * v.cellPx, sy = v.topY + (y - s.bufferRows + 0.5) * v.cellPx
        if (sx < -v.cellPx || sx > v.width + v.cellPx) return
        const r = v.cellPx * 0.46
        ctx.globalAlpha = alpha
        ctx.fillStyle = colorOf(c)
        ctx.beginPath(); ctx.roundRect(sx - r, sy - r, r * 2, r * 2, v.cellPx * 0.2); ctx.fill()
      }
      for (let i = 0; i < s.grid.length; i++) {
        if (!s.grid[i]) continue
        const g = s.groups.get(s.groupOf[i])
        cell(i % s.width, Math.floor(i / s.width), s.grid[i], g ? (g.ready ? 1 : 0.45 + 0.4 * g.fill) : 1)
      }
      if (s.piece) s.piece.cells.forEach(([x, y], k) => cell(x, y + s.piece!.fall, s.piece!.colors[k], 1))
      ctx.globalAlpha = 1
    },
    setKnobs() {},
    dispose() { ctx.clearRect(0, 0, canvas.width, canvas.height) },
  }
}
