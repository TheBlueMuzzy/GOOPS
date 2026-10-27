// F65 THE ENDING (design/story.md "The ending — save the goop", TDD D28) — what plays after the final shift's third
// valve stage opens, one step at a time. Not skippable, but each line moves on with a tap (like the story moments):
//   in the tank   pour   the view shakes, the goop pours out and fills the periscope view (moves on by itself)
//                 goop   the goop speaks out loud through its mouths — thank you, and its names (one step a line)
//   at the console  vet  the speaker's last clear line, in the Veteran's voice
//                 quiet  then the speaker is quiet for good (moves on by itself)
//                 payday the last payday: "Remaining passage debt: 0 cr — paid by: 1,312 former employees"
//                 badge  the monitor glitches; the goop crosses out your title and writes The Savior of Goopkind, with the
//                        real acronym under it
//                 leave  the goop carries you out (moves on by itself)
//                 empty  the empty console (moves on by itself, or a tap)
//                 endScreen  the end-game screen; its button begins the new career (src/game/newCareer.ts)
// The App moves the console over the tank when the first console step comes. Numbers: content/tuning/ending.json (read
// when a step starts, so Dev Kit edits reach the next one); words: en.json ending. Timed steps run on the LOOKS clock:
// the Dev Kit's full pause holds them.
import { looksClock } from '../devkit/gameClock'
import { operatorName } from '../progress/save'
import endingFile from '../../content/tuning/ending.json'
import text from '../../content/text/en.json'

export type EndingTuning = typeof endingFile
type ConsoleStep = 'vet' | 'quiet' | 'payday' | 'badge' | 'leave' | 'empty' | 'endScreen'
export type EndingStep =
  | { id: 'pour'; at: 'tank' }
  | { id: 'goop'; at: 'tank'; words: string; face: number } // face = which of mouths.spots says it
  | { id: ConsoleStep; at: 'console' }
export type EndingStepId = EndingStep['id']

const CONSOLE: ConsoleStep[] = ['vet', 'quiet', 'payday', 'badge', 'leave', 'empty', 'endScreen']

/** The ending's steps in order (story.md steps 1–7). */
export function endingSteps(t: EndingTuning = endingFile): EndingStep[] {
  const faces = Math.max(1, t.mouths.spots.length)
  return [
    { id: 'pour', at: 'tank' },
    ...t.goopLines.map((words, i): EndingStep => ({ id: 'goop', at: 'tank', words, face: i % faces })),
    ...CONSOLE.map((id): EndingStep => ({ id, at: 'console' })),
  ]
}

/** How long a step stays before it moves on by itself (seconds), or null: it waits for the player. */
export function stepSeconds(step: EndingStep, t: EndingTuning = endingFile): number | null {
  const P = t.pour, C = t.console
  if (step.id === 'pour') return P.shakeSeconds + P.seconds + P.holdSeconds
  if (step.id === 'quiet') return C.quietSeconds
  if (step.id === 'leave') return C.leaveSeconds
  if (step.id === 'empty') return C.emptySeconds
  return null
}

/** A goop line's words: {name} = your name (else Operator #4471), {more} = how many more it doesn't name. */
export function goopWords(key: string, name: string | null, t: EndingTuning = endingFile): string {
  const words = (text.ending.goop as Record<string, string>)[key] ?? key
  const more = Math.max(0, t.paidBy - t.named).toLocaleString('en')
  return words.replace(/\{name\}/g, () => name ?? text.story.sign.fallback).replace(/\{more\}/g, more)
}
export const goopLine = (key: string) => goopWords(key, operatorName())

export type EndingView = { step: EndingStep; index: number } | null

let steps: EndingStep[] = []
let at = -1
let view: EndingView = null
let cancel = () => {}
const listeners = new Set<() => void>()
const show = () => {
  view = at >= 0 && steps[at] ? { step: steps[at], index: at } : null
  listeners.forEach((l) => l())
}
// a timed step moves on by itself (unless something moved it on first)
function enter() {
  cancel()
  const step = steps[at], seconds = step ? stepSeconds(step) : null
  cancel = seconds === null ? () => {} : looksClock.after(seconds * 1000, () => { if (view?.step === step) ending.next() })
  show()
}

export const ending = {
  /** The third valve stage opened: the ending plays from its first step (or from `from`: a page opened after the win
   *  goes straight to the end-game screen). */
  start(from?: EndingStepId) {
    steps = endingSteps()
    at = from ? Math.max(0, steps.findIndex((s) => s.id === from)) : 0
    enter()
  },
  /** The next step (a tap, Got it, Done; or a timed step's time). The end-game screen is the last: its button leaves. */
  next() {
    if (at < 0 || at >= steps.length - 1) return
    at++
    enter()
  },
  /** The ending is over (the new career began) or went away. */
  stop() { cancel(); cancel = () => {}; steps = []; at = -1; show() },
  playing: () => at >= 0,
  view: (): EndingView => view,
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
}
