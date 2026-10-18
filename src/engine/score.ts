// What a pop is worth (v1 rules): points, and how much pressure it vents.
import type { ShiftConfig } from './config'
import type { ShiftState } from './types'
import { isOnScreen, neighbours } from './tank'

// Points for popping `cells`. `combo` = pops since the last piece landed, counting this one (v1 popStreak + 1).
// Each cell: (base + height bonus + off-screen bonus) × combo multiplier.
// Plus a flat bonus for every side the group touches other goop (not multiplied).
export function popPoints(state: ShiftState, config: ShiftConfig, cells: number[], combo: number): number {
  const s = config.score
  const { width, height } = state
  const inGroup = new Set(cells)
  const multiplier = 1 + combo * s.comboStep

  let touching = 0
  for (const i of cells) {
    for (const n of neighbours(i, width, height)) if (state.grid[n] !== 0 && !inGroup.has(n)) touching++
  }

  let total = touching * s.adjacentPerSide
  for (const i of cells) {
    const x = i % width
    const y = (i - x) / width
    const heightBonus = (height - y) * s.heightPerRow // higher up the tank = more
    const offscreen = isOnScreen(x, state.spin, width, state.visibleWidth) ? 0 : s.offscreenPerCell
    total += (s.perCell + heightBonus + offscreen) * multiplier
  }
  return Math.floor(total)
}

// Pressure a pop vents, in ms of pressure rise (v1 gave this back as shift time): 0.1 s per cell,
// plus 0.25 s per "tier" for big groups (15+, then every 10 more).
export function popRefundMs(config: ShiftConfig, size: number): number {
  const p = config.pop
  let ms = size * p.refundMsPerCell
  if (size >= p.refundTierFromSize) {
    const tier = Math.floor((size - p.refundTierFromSize) / p.refundTierStep) + 1
    ms += tier * p.refundTierMs
  }
  return ms
}
