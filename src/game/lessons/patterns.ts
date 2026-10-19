// v1's TUTORIAL PATTERNS as named building blocks (.planning/research/v1/Tutorial3.md §6). A step names one
// ("pattern": "pauseShowDismiss") and only writes what's different; the pattern fills in the rest. Game-agnostic.
// Patterns 6–8 aren't step shapes, so they live elsewhere:
//   6 continuous spawn — the game's set-up (Goops: "rules": { "autoSpawn": true })
//   7 retry with accumulating cracks — a step's `retry` (its set-up runs again on each miss; nothing is cleared)
//   8 discovery interrupt — the lesson's `interrupts`
import type { LessonStep } from './lessonTypes'

export const PATTERNS: Record<string, Partial<LessonStep>> = {
  // 1. The game stops, the message shows, the player closes it, the game goes on → next step.
  pauseShowDismiss: { while: 'pause', advance: { on: 'dismiss' } },
  // 2. The game runs, the message says what to do, doing it moves on (the step's own `advance` says what "it" is).
  runActAdvance: { while: 'run' },
  // 3. Like 2, but after a while without doing it, a reminder shows (the step's `hint`; default 6 s).
  waitThenHint: { while: 'run', hint: { after: 6, message: '' } },
  // 4. Moves on when the falling piece gets this far down (the step's advance gives the row).
  positionGated: { while: 'run', advance: { on: 'gate', gate: 'position', atLeast: 6 } },
  // 5. Moves on when the pressure reaches a value (percent).
  pressureGated: { while: 'run', advance: { on: 'gate', gate: 'pressure', atLeast: 50 } },
}

// The step with its pattern filled in: the step's own fields win; a half-written hint / advance is completed by
// the pattern's (e.g. "advance": { "atLeast": 10 } under positionGated keeps its gate).
export function expandStep(step: LessonStep, extra: Record<string, Partial<LessonStep>> = {}): LessonStep {
  const base = step.pattern ? (extra[step.pattern] ?? PATTERNS[step.pattern]) : undefined
  if (!base) return step
  const out: LessonStep = { ...base, ...step }
  if (base.advance && step.advance) out.advance = { ...base.advance, ...step.advance } as LessonStep['advance']
  if (base.hint && step.hint) out.hint = { ...base.hint, ...step.hint }
  if (out.hint && !out.hint.message) delete out.hint // waitThenHint without words: no hint
  return out
}
