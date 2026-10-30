// A goo renderer draws living goo on top of the tank. It READS the engine's state + events and never writes back:
// the grid is the game, the goo is the costume. Switching renderers (or turning goo off) changes no result.
import type { ShiftEvent, ShiftState } from '../engine/types'
import type { FaceReport, FaceStory } from './shared/faces'

export interface GooView {
  cellPx: number // CSS pixels per cell
  centreX: number // CSS px of the view's centre column centre
  topY: number // CSS px of row `bufferRows` (the top of the visible tank)
  camera: number // tank column at the view centre, FRACTIONAL (animates smoothly between state.spin values)
  width: number // canvas CSS size
  height: number
  dpr: number
  // F36 the x-ray (a crack under goop stays visible): the goo inside each box — the cell (a grid index) grown by `pad`
  // cells on every side — is drawn see-through, `alpha` as solid as usual. A read-only look the frame loop hands in.
  xray?: { cells: number[]; pad: number; alpha: number }
  // reduce motion (the kit's setting, read by the frame loop): the zap (F67) skips its swell and spray
  still?: boolean
  // F62 the goop's faces (src/goo/shared/faces.ts): the player's rank (0–9 = no faces at all), the pressure (0..1) and
  // what the eyes look at — the falling piece's centre, or the laser's tap point while the beam fires. Unset = rank 0.
  story?: FaceStory
}

export interface GooRenderer {
  readonly name: 'jelly' | 'particle'
  // Called once per frame, after the engine's tick. `events` = this frame's events (already taken from the engine).
  frame(state: ShiftState, events: ShiftEvent[], view: GooView, dtSec: number): void
  setKnobs(values: Record<string, number>): void
  dispose(): void
  // (dev + tests) how fast the goo at a cell is moving right now (cells/s) — feel checks read it (e2e: a poke jiggles)
  motion?(cell: number): number
  // (dev + tests) the goop's faces right now (F62, e2e/eyes.mjs) — empty below rank 10
  faces?(): FaceReport[]
}

// Options for createJellyRenderer / createParticleRenderer (added F15)
export interface GooOptions {
  colorNames?: string[] // shift.json "colors": Color c = colorNames[c - 1]. Defaults to the v1 order.
}

// Where a tank cell sits on screen for a fractional camera: wrap the column offset into [-width/2, width/2).
export function screenColumn(x: number, camera: number, width: number): number {
  let d = x - camera
  d = ((d % width) + width) % width
  if (d >= width / 2) d -= width
  return d
}
