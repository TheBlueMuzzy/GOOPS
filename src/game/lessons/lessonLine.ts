// A lesson message's words and target, as the look shows them (F32) — shared by the tank's bubble (LessonView.tsx)
// and the console's monitor screen (useCrtLesson → Console.tsx).
import { useEffect, useState, useSyncExternalStore } from 'react'
import { looksClock } from '../../devkit/gameClock'
import { useShort } from '../../ui/useShort'
import { lessonPlay, lessonSay, lessonTargets, lessonWords, runner } from './goopsLessons'
import type { LessonMessage } from './runner'

/** What the message points at now. In the tank a message without a pointer points where pieces drop in (the tank's
 *  mark box); at the console it points at nothing (the tank is under the console). */
export const targetsOf = (m: LessonMessage, atConsole: boolean) =>
  (m.pointer === undefined ? (atConsole ? null : lessonTargets({})) : lessonTargets(m.pointer))

/** The words a message shows now ('' = none: a step that only points). One text at a time: a part it points at may
 *  ask for its own words (data-say), which replace the step's. */
export function wordsOf(lessonId: string | null, m: LessonMessage, atConsole: boolean) {
  if (!m.text) return ''
  const found = targetsOf(m, atConsole)
  const id = (found && lessonSay(found.els)) ?? m.text
  return lessonWords(lessonId, id, lessonPlay.vars(), lessonPlay.inputKind())
}

/** Re-read a few times a second (looks time: still on a full pause) while a message is up: live numbers
 *  ({pressure}…), which part is lit now, whether the target is on screen. */
export function useLessonTick(on: boolean) {
  const [, setTick] = useState(0)
  useEffect(() => (on ? looksClock.every(250, () => setTick((n) => n + 1)) : undefined), [on])
}

/** F32: the tags the lesson message points at now (the console shows a panel it points at lit, not switched off). */
export function useSpotlitTags(): string[] {
  const view = useSyncExternalStore(runner.subscribe, runner.view)
  const p = view.message?.pointer as { tag?: string; tags?: string[] } | undefined
  return p ? (p.tags ?? (p.tag ? [p.tag] : [])) : []
}

/** F32: the lesson's line for the console's monitor screen — null when the monitor shows its own words (no lesson
 *  message, a step that only points, a reaction, or a phone on its side where the monitor is off screen). */
export function useCrtLesson(): { text: string; gotIt: boolean; onGotIt(): void } | null {
  const view = useSyncExternalStore(runner.subscribe, runner.view)
  const short = useShort()
  const m = view.message
  useLessonTick(!!m)
  if (!m || !m.text || short || m.kind === 'reaction') return null
  return { text: wordsOf(view.lessonId, m, true), gotIt: m.waitsForDismiss, onGotIt: () => runner.dismiss() }
}
