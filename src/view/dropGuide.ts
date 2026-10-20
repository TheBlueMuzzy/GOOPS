// The drop guide (F26, Muzzy 2026-10-18): faint downward chevrons in the column under the falling piece, from just
// below it down to its landing shadow — "like an airplane landing strip of lights". A wave of brightness runs DOWN
// them and loops; it runs faster while fast drop is held. The chevrons stay put in the tank (one every spacingCells
// rows, counted up from the landing shadow), so the piece passes them: a passed chevron is gone, and the wave's
// cycle spans only the ones still showing — the beat per chevron stays the same, it never lags over hidden ones.
// Drawn on the tank canvas, under the goo. Every number is in content/tuning/hud.json → chevrons.
import type { ShiftState } from '../engine/types'
import type { GooView } from '../goo/types'
import { screenColumn } from '../goo/types'
import hud from '../../content/tuning/hud.json'

export interface DropGuide {
  // dtSec = real time since the last frame (the wave keeps its pace even when the shift runs slower at the console)
  draw(ctx: CanvasRenderingContext2D, s: ShiftState, view: GooView, dtSec: number, fast: boolean, still: boolean): void
}

// cfg: tests pass their own; the game leaves it out and the guide reads hud.json each frame (live Dev Kit edits)
export function createDropGuide(fixed?: typeof hud.chevrons): DropGuide {
  let phase = 0 // how many chevrons the wave has passed, ever (it loops over however many are showing)

  return {
    draw(ctx, s, view, dtSec, fast, still) {
      const cfg = fixed ?? hud.chevrons
      const p = s.piece
      if (!p || !s.ghost.length || s.status !== 'playing') return
      const cp = view.cellPx
      // the piece's columns on screen (placed by the spin, like the piece and its shadow), and its bottom edge
      const cols = p.cells.map(([x]) => screenColumn(x, s.spin, s.width))
      const x = view.centreX + ((Math.min(...cols) + Math.max(...cols)) / 2) * cp
      const pieceBottom = Math.max(...p.cells.map(([, y]) => y)) + 1 + p.fall // in rows
      const landTop = Math.min(...s.ghost.map(([, y]) => y)) // the landing shadow's top row
      const half = cfg.heightCells / 2
      // the chevrons still showing, top to bottom: centred every spacing rows above the shadow, below the piece
      const rows: number[] = []
      for (let k = 0; ; k++) {
        const row = landTop - (k + 0.5) * cfg.spacingCells
        if (row - half <= pieceBottom) break
        rows.unshift(row)
      }
      const n = rows.length
      if (!n) return
      phase += still ? 0 : dtSec * cfg.wavePerSec * (fast ? cfg.fastMultiplier : 1)
      // the wave's place along the chevrons: it runs off the bottom, then starts again above the top one
      const cycle = n + cfg.waveWidth
      const at = (phase % cycle) - cfg.waveWidth / 2
      const w = (cfg.widthCells * cp) / 2, h = cfg.heightCells * cp
      ctx.save()
      ctx.strokeStyle = cfg.color
      ctx.lineWidth = Math.max(1, cfg.lineWidthCells * cp)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      rows.forEach((row, i) => {
        const lit = still ? 0 : Math.max(0, 1 - Math.abs(i - at) / cfg.waveWidth)
        ctx.globalAlpha = cfg.alpha + (cfg.peakAlpha - cfg.alpha) * lit
        const y = view.topY + (row - s.bufferRows) * cp
        ctx.beginPath()
        ctx.moveTo(x - w, y - h / 2); ctx.lineTo(x, y + h / 2); ctx.lineTo(x + w, y - h / 2)
        ctx.stroke()
      })
      ctx.restore()
    },
  }
}
