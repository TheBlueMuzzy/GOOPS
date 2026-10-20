// The running shift, for tools that look in from outside the screens (the Dev Kit's Snapshots + Bug capture adapter,
// src/devkit-game/goopsAdapter.ts). Tiny and safe in every build: App says which engine is running and how to put a
// saved moment back; ShiftStage passes on each frame's engine events. Nothing here changes the game by itself.
import type { ShiftEngine, ShiftEvent } from '../engine'
import type { ShiftSnapshot } from '../engine/snapshot'

type Listener = (events: ShiftEvent[]) => void
const listeners = new Set<Listener>()

export const session = {
  /** The shift being played (or the last one, finished), null before the first. App keeps it current. */
  engine: null as ShiftEngine | null,
  /** Is the tank on screen with a shift running (not on the console between shifts)? App keeps it current. */
  inShift: false,
  /** Put a saved moment back: App makes a new engine from it and shows the tank. null = back to the console. */
  restore: null as ((snapshot: ShiftSnapshot | null) => void) | null,
  /** F30: play a lesson from a step (1 = the first, or a step id) in a new training shift, straight away. App sets it.
   *  false = no such lesson. (The Dev Kit's Lessons tab and window.__goops.lesson use it.) */
  startLesson: null as ((id: string, step?: number | string) => boolean) | null,
  /** ShiftStage: this frame's events, after the engine gave them. */
  emit(events: ShiftEvent[]) {
    for (const l of listeners) l(events)
  },
  /** Hear every engine event. Returns "stop". */
  listen(listener: Listener): () => void {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  },
}
