// THE NEXT-PIECE WINDOW (F59, from rank 1): at the left of the HUD's bottom panel, as tall as the panel's contents
// (Muzzy's mock-up, 2026-10-19 — first it sat over the tank and was far too small) — the piece that comes after the
// falling one, big, in its goop colour (content/tuning/goo-colors.json) and the way up it will come in. Swapping (from
// rank 3) trades the falling piece with this one.
// The window is always the same size (room for the tallest, widest piece: content/tuning/hud.json → nextWindow), so
// nothing moves when a bigger piece comes up. Inside the frame it wears the reusable CRT look (F60: scan lines over the piece; content/tuning/crt.json
// use.nextWindow, a Dev Kit dropdown — the second place to wear it, and it took one wrapper + one line of data).
import type { CSSProperties } from 'react'
import { Panel } from '../ui/kit'
import { colorOf } from './gooFactory'
import { CrtLook } from './CrtLook'
import hud from '../../content/tuning/hud.json'

export type NextPiece = { cells: [number, number][]; color: number; colors?: number[] } // colors: one per cell (F39 two-colour pieces)

export function NextWindow({ piece, label }: { piece: NextPiece | null; label: string }) {
  const W = hud.nextWindow
  // the piece centred in the window's cells (its cells are offsets round its own origin, some negative)
  const xs = piece ? piece.cells.map(([x]) => x) : [0], ys = piece ? piece.cells.map(([, y]) => y) : [0]
  const left = (W.cols - (Math.max(...xs) - Math.min(...xs) + 1)) / 2 - Math.min(...xs)
  const top = (W.rows - (Math.max(...ys) - Math.min(...ys) + 1)) / 2 - Math.min(...ys)
  const gap = W.cellGap // a thin dark line between cells, so the shape reads as blocks
  const pad = W.padCells // room round the cells inside the frame (nothing touches its edge)
  return (
    <Panel gap="xs" className="next-window" data-tag="next-window" data-knobs="next-window" data-placement="top"
      style={{ '--next-cols': W.cols + 2 * pad, '--next-rows': W.rows + 2 * pad, '--next-cell': `${W.cellRem}rem` } as CSSProperties}>
      <CrtLook place="nextWindow">
      <svg className="next-window-cells" viewBox={`${-pad} ${-pad} ${W.cols + 2 * pad} ${W.rows + 2 * pad}`} role="img" aria-label={label}>
        {piece?.cells.map(([x, y], i) => (
          <rect key={i} x={left + x + gap / 2} y={top + y + gap / 2} width={1 - gap} height={1 - gap} rx={W.cornerCells}
            fill={colorOf(piece.colors?.[i] ?? piece.color)} />
        ))}
      </svg>
      </CrtLook>
    </Panel>
  )
}
