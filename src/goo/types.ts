// A goo renderer draws living goo on top of the tank. It READS the engine's state + events and never writes back:
// the grid is the game, the goo is the costume. Switching renderers (or turning goo off) changes no result.
import type { ShiftEvent, ShiftState } from '../engine/types'

export interface GooView {
  cellPx: number // CSS pixels per cell
  centreX: number // CSS px of the view's centre column centre
  topY: number // CSS px of row `bufferRows` (the top of the visible tank)
  camera: number // tank column at the view centre, FRACTIONAL (animates smoothly between state.spin values)
  width: number // canvas CSS size
  height: number
  dpr: number
}

export interface GooRenderer {
  readonly name: 'jelly' | 'particle'
  // Called once per frame, after the engine's tick. `events` = this frame's events (already taken from the engine).
  frame(state: ShiftState, events: ShiftEvent[], view: GooView, dtSec: number): void
  setKnobs(values: Record<string, number>): void
  dispose(): void
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
