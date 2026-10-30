// F64 THE FINAL SHIFT (rank 50, the boss level — design/story.md "The final shift"): the shape of
// content/tuning/finalShift.json and small lookups on it. The rules themselves live in shift.ts (they touch every part
// of a shift); this file keeps the numbers' meaning in one place.
//   - One colour: every piece, junk cell, rain cell and crack is `colour` (galaxy black) — so any goop merges with any
//     and any goop seals any crack.
//   - The onslaught: pieces fall × fallSpeedMult, pressure rises × pressureRiseMult, cracks come × crackRateMult, and
//     loose cells rain in every rain.everySec.
//   - The Veteran (the white goop) drops in first — the shift's clock waits for his intro — and seals the cracks you
//     can't reach (whiteGoop.json with `vet` laid over it). F75: his seals are free — he wears down by the integrity the
//     tank loses (vet.wearPerIntegrity); used up, he says his last line and is gone, and the shift goes on without him.
//   - Seals (his too) count toward valve.stages; a full stage WAITS for the console (seals don't count meanwhile) until
//     the engine's openValveStage() is called. The last stage opened = the win.
//   - Losses end the shift at once (no rupture drain): goop over the top · integrity 0 (F75: only the tank breaking).
//   - F75 Goop Dump rains into the columns with an open crack here (shift.ts dropDumpCell); Slow Cracks slows only the
//     spreading here, not how often cracks come (shift.ts growCracks).
import type { WhiteGoopConfig } from './whiteGoop'

export interface FinalShiftConfig {
  rank: number
  consoleTimeScale: number // read by the game (App) and the bots, not the engine: the shift's speed at the console here
  colour: string // a name from shift.json colors
  fallSpeedMult: number
  pressureRiseMult: number
  crackRateMult: number
  rain: { everySec: number; cells: number }
  valve: { stages: number[] }
  vet: Partial<WhiteGoopConfig>
  intro: { hiSec: number; itsMeSec: number; fallSec: number; helpSec: number; playSec: number; lineSec?: number }
  goneLineSec?: number // F75: how long his used-up line stays in its bubble (looks time; the game reads it)
  bots?: { valveSec: number }
}

// His lines in the intro, in order (words: en.json finalShift.vet.<line>)
export type VetLine = 'hi' | 'itsMe' | 'oof' | 'help'

const num = (v: unknown, fallback: number, min = 0) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, v) : fallback)

/** Is this shift the final shift? (a normal shift at its rank or above; never a lesson's training shift) */
export function finalShiftIn(cfg: FinalShiftConfig | undefined, rank: number, training: boolean): boolean {
  return !!cfg && !training && rank >= num(cfg.rank, Infinity)
}

/** The seals each valve stage needs (broken entries count as 1). */
export function valveStages(cfg: FinalShiftConfig): number[] {
  const stages = Array.isArray(cfg.valve?.stages) ? cfg.valve.stages : []
  return stages.map((n) => Math.max(1, Math.round(num(n, 1))))
}

/** A number from finalShift.json read live, with a fallback when it's missing or broken. */
export const finalNum = num

/** The white goop's tuning in the final shift: whiteGoop.json with finalShift.json's `vet` laid over it. */
export function finalVet(white: WhiteGoopConfig, cfg: FinalShiftConfig): WhiteGoopConfig {
  return { ...white, ...cfg.vet }
}
