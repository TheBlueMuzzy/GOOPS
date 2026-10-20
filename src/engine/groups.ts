// Goop groups (same colour, touching on 4 sides, wrapping round the tank) and "sticky gravity".
import type { Group, ShiftState } from './types'
import { neighbours } from './tank'

// Bookkeeping that is not part of the public state.
export interface GroupBook {
  fillMs: Map<number, number> // how long each group has been filling
  nextId: number
}

// Rebuild every group from the grid. A group whose cells did not change keeps its id and its fill.
// A group that changed (grew, merged, landed) restarts filling — v1 reset the fill on any change.
// It keeps the id of the biggest old group inside it, so the goo can keep the same blob alive.
// Returns the ids of groups that were made by joining goop that was apart before (for 'merge' events).
export function regroup(state: ShiftState, book: GroupBook): number[] {
  const { grid, width, height } = state
  const oldGroupOf = state.groupOf
  const oldGroups = state.groups
  const groupOf = new Int32Array(grid.length).fill(-1)
  const groups = new Map<number, Group>()
  const fillMs = new Map<number, number>()
  const claimed = new Set<number>()
  const merged: number[] = []
  const seen = new Uint8Array(grid.length)

  for (let start = 0; start < grid.length; start++) {
    if (grid[start] === 0 || seen[start]) continue
    const color = grid[start]
    // Flood fill this colour.
    const cells: number[] = []
    const queue = [start]
    seen[start] = 1
    while (queue.length > 0) {
      const i = queue.pop()!
      cells.push(i)
      for (const n of neighbours(i, width, height)) {
        if (!seen[n] && grid[n] === color) {
          seen[n] = 1
          queue.push(n)
        }
      }
    }
    cells.sort((a, b) => a - b)

    // Where did these cells come from? Old groups, or brand new goop (-1).
    const sources = new Map<number, number>() // old group id → cells of it in here
    let newCells = 0
    for (const i of cells) {
      const old = oldGroupOf[i]
      if (old >= 0 && oldGroups.has(old)) sources.set(old, (sources.get(old) ?? 0) + 1)
      else newCells++
    }

    const onlySource = sources.size === 1 ? [...sources.keys()][0] : -1
    const unchanged = onlySource >= 0 && newCells === 0 && oldGroups.get(onlySource)!.cells.length === cells.length

    // Pick the id: biggest old group not already taken by another new group, else a fresh one.
    const candidates = [...sources.keys()].sort((a, b) => oldGroups.get(b)!.cells.length - oldGroups.get(a)!.cells.length || a - b)
    let id = candidates.find((c) => !claimed.has(c)) ?? -1
    if (id < 0) id = book.nextId++
    claimed.add(id)

    for (const i of cells) groupOf[i] = id
    const ms = unchanged ? (book.fillMs.get(id) ?? 0) : 0
    fillMs.set(id, ms)
    const old = oldGroups.get(id)
    groups.set(id, { id, color, cells, fill: unchanged && old ? old.fill : 0, ready: unchanged && old ? old.ready : false })
    if (sources.size + (newCells > 0 ? 1 : 0) >= 2) merged.push(id)
  }

  state.groupOf = groupOf
  state.groups = groups
  book.fillMs = fillMs
  return merged
}

// Sticky gravity (v1): a group stays up if any of its cells is on the floor or sits directly on a
// DIFFERENT group that stays up. Groups that don't are loose: each loose cell drops straight down its
// column until it lands on goop, the floor, or the falling piece (`blocked`).
// Moves the cells in the grid and returns [from, to] for each cell that moved (empty = nothing fell).
// Moved cells are marked as new goop (groupOf -1) so the next regroup restarts their fill.
export function dropLoose(state: ShiftState, blocked: Set<number>): [number, number][] {
  const { grid, groupOf, groups, width, height } = state
  const supported = new Set<number>()
  const floorRow = (height - 1) * width
  for (const g of groups.values()) if (g.cells.some((i) => i >= floorRow)) supported.add(g.id)

  let changed = true
  while (changed) {
    changed = false
    for (const g of groups.values()) {
      if (supported.has(g.id)) continue
      const restsOnSupport = g.cells.some((i) => {
        const below = i + width
        return below < grid.length && groupOf[below] !== g.id && supported.has(groupOf[below])
      })
      if (restsOnSupport) {
        supported.add(g.id)
        changed = true
      }
    }
  }

  const loose: number[] = []
  for (const g of groups.values()) if (!supported.has(g.id)) loose.push(...g.cells)
  if (loose.length === 0) return []

  // Lift the loose cells out, then drop them back bottom-first so upper cells land on lower ones.
  loose.sort((a, b) => b - a)
  const colors = loose.map((i) => grid[i])
  for (const i of loose) grid[i] = 0
  const moves: [number, number][] = []
  loose.forEach((from, k) => {
    let to = from
    while (to + width < grid.length && grid[to + width] === 0 && !blocked.has(to + width)) to += width
    grid[to] = colors[k]
    if (to !== from) moves.push([from, to])
  })
  if (moves.length === 0) return []

  for (const [from] of moves) groupOf[from] = -1
  for (const [, to] of moves) groupOf[to] = -1
  return moves
}
