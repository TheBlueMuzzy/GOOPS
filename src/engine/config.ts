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
  pressure: { riseMsToFull: number } // pressure goes 0 → 1 in this long (if nothing vents it)
  integrity: {
    drainPerCrackPerSec: number // tank integrity lost per open crack per second (1 = full tank)
    sealRefund: number // integrity given back per crack sealed (0.03 = 3%), capped at full; none during a rupture
  }
  rupture: { drainMs: number } // after a rupture, pressure falls by 1 (100%) in this long
  fall: { msPerRow: number; softDropFactor: number }
  lock: { delayMs: number; softDropDelayMs: number; maxResets: number }
  fill: { msPerCell: number }
  pop: { refundMsPerCell: number; refundTierFromSize: number; refundTierStep: number; refundTierMs: number }
  cracks: {
    everyMsAtEmpty: number // time between cracks at 0% pressure…
    everyMsAtFull: number // …and at 100%
    curve?: number // the crack rate follows pressure^curve between them (3 = hockey stick); unset = v1's straight line
    sealRefundMs: number // pressure vented per seal, in "ms of rise"
    onePerColour: boolean // v1: at most one open crack per colour
    // How high cracks may form (F27, cracks.ts crackBandTop): 'none' = anywhere up to the pop line;
    // 'halfway' = up to halfway between the top of the goop (whole tank) and the pop line;
    // 'halfwayPerColumn' = the same, worked out for each column from that column's own goop; 'hill' = no ceiling but the
    // pop line, most cracks around halfway (see below). Anything else = 'none'.
    band: string
    // Where in that band (cracks.ts pickHighSpot): 0 = any empty spot equally; higher = more often high above the goop
    // in its column (bias 2: a spot 4 rows up is 16× as likely as one right on the goop). Unset = 0.
    topBias?: number
    // band 'hill' (cracks.ts pickHillSpot): no ceiling but the pop line; the most likely row is `reach` of the way
    // from the column's goop to the line, thinning out by `spread`; `neighbourCols` lets a column borrow height
    // from stacks that close; cracks above `highFrom` of the way drain × `highDrainMult`.
    reach?: number
    spread?: number
    neighbourCols?: number
    highFrom?: number
    highDrainMult?: number
  }
  score: {
    perCell: number
    heightPerRow: number
    offscreenPerCell: number
    comboStep: number
    adjacentPerSide: number
    leftoverPerCell: number
  }
  pieces: {
    corruptChance: number
    mirrorChance: number
    zones: string[] // piece sizes as the shift goes on, e.g. tetra → penta → hexa
    zoneEveryMs: number // play time spent in each zone before the next (the last zone stays)
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
