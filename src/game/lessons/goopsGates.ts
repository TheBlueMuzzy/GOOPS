// GOOPS LESSON GATES AND TANK POINTERS (F31) — the numbers a Goops lesson step can wait on and the tank cells a pointer
// can pick, worked out from the shift's state alone (pure, so unit tests can check them; goopsLessons.ts uses them).
//
//   gates    "position" (rows the falling piece's bottom has come into the tank) · "pressure" / "integrity" (percent) ·
//            "sealed" (cracks sealed) · "cracksOutOfView" · "wrongCover" (cracks covered by another colour's goop) ·
//            F31: "plugged" (cracks covered by their own colour) · "openCracks" (cracks not plugged) ·
//            "ready:<colour>" (groups of that colour ready to zap: full and under the line) · "full:<colour>" (groups
//            done filling) · "underLine:<colour>" (groups whose top is at or under the pressure line, full or not)
//   pointers F31: { "crack": "open" | "plugged" | "wrongCover" | "outOfView" | "any" } = the nearest such crack to the
//            middle of the view (an out-of-view one: the cell on the tank's edge where its arrow is) ·
//            { "goop": "<colour>" } = the biggest group of that colour
import type { Crack, ShiftState } from '../../engine'
import { popLine } from '../../engine/cracks'
import { columnOffset, isOnScreen } from '../../engine/tank'
import shiftConfig from '../../../content/tuning/shift.json'

/** A colour by its name in shift.json ("blue") or its number (1 = the first colour). 0 = no such colour. */
export const colourOf = (c: unknown) => (typeof c === 'number' ? c : shiftConfig.colors.indexOf(String(c)) + 1)

const groupsOf = (s: ShiftState, c: number) => [...s.groups.values()].filter((g) => g.color === c)
const coveredBy = (s: ShiftState, c: Crack) => s.grid[c.y * s.width + c.x]

/** A gate's number now (null = not a tank gate, or can't tell right now). */
export function tankGate(s: ShiftState, name: string): number | null {
  switch (name) {
    case 'position': return s.piece ? Math.max(...s.piece.cells.map(([, y]) => y)) - s.bufferRows + 1 : null
    case 'pressure': return Math.round(s.pressure * 100)
    case 'integrity': return Math.round(s.integrity * 100)
    case 'sealed': return s.cracksSealed
    case 'cracksOutOfView': return s.cracks.filter((c) => !isOnScreen(c.x, s.spin, s.width, s.visibleWidth)).length
    case 'wrongCover': return s.cracks.filter((c) => { const g = coveredBy(s, c); return g !== 0 && g !== c.color }).length
    case 'plugged': return s.cracks.filter((c) => c.plugged).length
    case 'openCracks': return s.cracks.filter((c) => !c.plugged).length
  }
  const [kind, name2] = name.split(':')
  const c = name2 === undefined ? 0 : colourOf(name2)
  if (!c) return null
  const line = popLine(s)
  if (kind === 'ready') return groupsOf(s, c).filter((g) => g.ready).length
  if (kind === 'full') return groupsOf(s, c).filter((g) => g.fill >= 1).length
  // (cells are sorted, so a group's first cell is its highest — the same test as the engine's canPop)
  if (kind === 'underLine') return groupsOf(s, c).filter((g) => Math.floor(g.cells[0] / s.width) >= line).length
  return null
}

/** The tank cells [x, y] a { crack } or { goop } pointer picks now — null = it isn't one, [] = nothing to point at. */
export function pointerCells(s: ShiftState, pointer: { crack?: string; goop?: string }): [number, number][] | null {
  if (pointer.crack) {
    const which = pointer.crack
    const wanted = s.cracks.filter((c) => {
      const cover = coveredBy(s, c)
      if (which === 'open') return !c.plugged
      if (which === 'plugged') return c.plugged
      if (which === 'wrongCover') return cover !== 0 && cover !== c.color
      if (which === 'outOfView') return !isOnScreen(c.x, s.spin, s.width, s.visibleWidth)
      return true
    })
    const near = (c: Crack) => Math.abs(columnOffset(c.x, s.spin, s.width))
    const crack = wanted.sort((a, b) => near(a) - near(b))[0]
    if (!crack) return []
    if (isOnScreen(crack.x, s.spin, s.width, s.visibleWidth)) return [[crack.x, crack.y]]
    // out of view: the edge cell its arrow sits in (the tank's edge the short way round, as tankView draws it)
    const left = Math.floor((s.visibleWidth - 1) / 2)
    const edge = columnOffset(crack.x, s.spin, s.width) < 0 ? -left : s.visibleWidth - 1 - left
    return [[(((s.spin + edge) % s.width) + s.width) % s.width, crack.y]]
  }
  if (pointer.goop) {
    const biggest = groupsOf(s, colourOf(pointer.goop)).sort((a, b) => b.cells.length - a.cells.length)[0]
    return biggest ? biggest.cells.map((i) => [i % s.width, Math.floor(i / s.width)]) : []
  }
  return null
}
