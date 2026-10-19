// THE LESSON LOOK (F30): the running lesson's message as the UI kit's Callout — a speech bubble pointing at a tank cell,
// the falling piece, a HUD item or a console part (goopsLessons.ts lessonTarget / placeLessonMark), with the kit's
// pulse ring round it. A message that waits to be closed gets a "Got it" button (Enter works too) once it's armed.
// Words come from content/text/en.json → lessons.<lesson id>, picked by the input used last, with {placeholders} from
// the live shift.
// overMenu (F32): a menu is open over the game — only a step's reaction shows then ("That's the pause menu…").
// If what it points at isn't on screen, it points at the pointer's "or" (F32), else at the screen's middle, so a message
// is never up but unseen.
import { useEffect, useState, useSyncExternalStore } from 'react'
import { Callout, type CalloutPlacement } from '../../ui/kit'
import { looksClock } from '../../devkit/gameClock'
import { lessonPlay, lessonTarget, lessonWords, runner } from './goopsLessons'
import text from '../../../content/text/en.json'

type Pointer = { placement?: string; or?: Pointer }
const shown = (selector: string) => {
  const r = document.querySelector(selector)?.getBoundingClientRect()
  // (there, and at least partly inside the window)
  return !!r && (r.width > 0 || r.height > 0) && r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth
}

export function LessonView({ overMenu = false }: { overMenu?: boolean }) {
  const view = useSyncExternalStore(runner.subscribe, runner.view)
  const m = view.message
  // re-read a few times a second (looks time: still on a full pause): words with live numbers ({pressure}…), and
  // whether the thing it points at is on screen
  const [, setTick] = useState(0)
  useEffect(() => (m ? looksClock.every(250, () => setTick((n) => n + 1)) : undefined), [m])
  // Enter closes a message that waits for "Got it"
  const canClose = !!m && m.waitsForDismiss && m.armed && !overMenu
  useEffect(() => {
    if (!canClose) return
    const key = (e: KeyboardEvent) => { if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); runner.dismiss() } }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [canClose])
  if (!m || (overMenu && m.kind !== 'reaction')) return null
  const words = lessonWords(view.lessonId, m.text, lessonPlay.vars(), lessonPlay.inputKind())
  // the pointer, or its "or" when that isn't on screen (e.g. the monitor, off screen on a phone on its side), and so on
  // (the tank's mark box is placed by the frame loop, a frame after the message: always there)
  let pointer = m.pointer as Pointer | undefined
  let target: string | { x: number; y: number } = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  for (let p = pointer; p; p = p.or) {
    const wanted = lessonTarget(p)
    if (wanted === '.lesson-mark' || shown(wanted)) { target = wanted; pointer = p; break }
  }
  // which side the message goes: the thing pointed at may say (data-placement — the console's repair parts), else the
  // pointer's own "placement", else wherever it fits
  const side = (typeof target === 'string' ? document.querySelector(target)?.getAttribute('data-placement') : null) ?? pointer?.placement
  return (
    <Callout key={`${view.stepId}:${m.kind}`} target={target} text={words} dim={m.dim} pulse
      placement={(side ?? 'auto') as CalloutPlacement}
      action={canClose ? text.lessons.gotIt : undefined} onDismiss={canClose ? () => runner.dismiss() : undefined} />
  )
}
