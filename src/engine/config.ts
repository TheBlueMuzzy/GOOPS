// The shape of content/tuning/shift.json, plus small lookups on it.
// Types are loose on purpose (string, number[][]) so the parsed JSON file can be passed in directly.

export interface ShapeDef {
  name: string
  cells: number[][] // [x, y] offsets; y grows downward
  noRotate?: boolean // squares: rotating would only shift them, so v1 skips it
}

export interface ShapeSet {
  normal: ShapeDef[]
  corrupted: ShapeDef[] // cells only touch at corners; parts fall apart when they land
}

export interface RankStep {
  rank: number
  count: number
}

export interface ShiftConfig {
  tank: { width: number; height: number; bufferRows: number; visibleWidth: number }
  colors: string[] // colour names; Color 1 = colors[0]
  colorsByRank: RankStep[] // how many colours are in play from each rank
  junkByRank: RankStep[] // single goop cells on the floor at shift start
  shiftMs: number
  fall: { msPerRow: number; softDropFactor: number }
  lock: { delayMs: number; softDropDelayMs: number; maxResets: number }
  fill: { msPerCell: number }
  pop: { refundMsPerCell: number; refundTierFromSize: number; refundTierStep: number; refundTierMs: number }
  cracks: { spawnEveryMs: number; spawnTries: number; sealRefundMs: number; burstBelowPressure: number }
  score: {
    perCell: number
    heightPerRow: number
    offscreenPerCell: number
    comboStep: number
    adjacentPerSide: number
    hardDropPerRow: number
    leftoverPerCell: number
  }
  pieces: {
    corruptChance: number
    mirrorChance: number
    zones: string[] // piece sizes by equal slices of the shift, e.g. tetra → penta → hexa
    kicks: number[][] // [dx, dy] tried in order when a rotation is blocked
    [zone: string]: unknown // tetra / penta / hexa: ShapeSet
  }
}

// The value of the last step whose rank is at or below `rank`.
function stepFor(steps: RankStep[], rank: number): number {
  let count = 0
  for (const step of steps) if (rank >= step.rank) count = step.count
  return count
}

// Colours in play at this rank: 1..n
export function paletteSize(config: ShiftConfig, rank: number): number {
  return Math.min(stepFor(config.colorsByRank, rank), config.colors.length)
}

export function junkCount(config: ShiftConfig, rank: number): number {
  return stepFor(config.junkByRank, rank)
}

// v1: cracks to seal = colours in play + rank
export function cracksNeededFor(config: ShiftConfig, rank: number): number {
  return paletteSize(config, rank) + rank
}

export function shapeSet(config: ShiftConfig, zone: string): ShapeSet {
  return config.pieces[zone] as ShapeSet
}
