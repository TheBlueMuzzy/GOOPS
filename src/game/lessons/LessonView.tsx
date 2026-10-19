// THE LESSON LOOK (F30): the running lesson's message as the UI kit's Callout — a speech bubble pointing at a tank cell,
// the falling piece or a HUD item (goopsLessons.ts lessonTarget / placeLessonMark), with the kit's pulse ring round it.
// A message that waits to be closed gets a "Got it" button (Enter works too) once it's armed. Words come from
// content/text/en.json → lessons.<lesson id>, picked by the input used last, with {placeholders} from the live shift.
import { useEffect, useState, useSyncExternalStore } from 'react'
import { Callout } from '../../ui/kit'
import { looksClock } from '../../devkit/gameClock'
import { lessonPlay, lessonTarget, lessonWords, runner } from './goopsLessons'
import text from '../../../content/text/en.json'

export function LessonView() {
  const view = useSyncExternalStore(runner.subscribe, runner.view)
  const m = view.message
  // words with live numbers ({pressure}…) are re-read a few times a second (looks time: still on a full pause)
  const [, setTick] = useState(0)
  const live = !!m && /\{\w+\}/.test(lessonWords(view.lessonId, m.text, {}, 'keys'))
  useEffect(() => (live ? looksClock.every(250, () => setTick((n) => n + 1)) : undefined), [live])
  // Enter closes a message that waits for "Got it"
  const canClose = !!m && m.waitsForDismiss && m.armed
  useEffect(() => {
    if (!canClose) return
    const key = (e: KeyboardEvent) => { if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); runner.dismiss() } }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [canClose])
  if (!m) return null
  const words = lessonWords(view.lessonId, m.text, lessonPlay.vars(), lessonPlay.inputKind())
  return (
    <Callout key={`${view.stepId}:${m.kind}`} target={lessonTarget(m.pointer)} text={words} dim={m.dim} pulse
      action={canClose ? text.lessons.gotIt : undefined} onDismiss={canClose ? () => runner.dismiss() : undefined} />
  )
}
