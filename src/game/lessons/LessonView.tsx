// THE LESSON LOOK (F30; F32 from Muzzy's first try). The running lesson's message:
//   IN THE TANK — a speech bubble in the kit's Callout look (Spotlight.tsx), inside the game's phone-width column,
//     pointing at a tank cell, the falling piece or a HUD item, with the pink outline round it and, for a step that
//     says so (`dim`), the spotlight's dim round it. Words and "Got it" are there together from the first frame.
//   AT THE CONSOLE (Muzzy, 2026-10-19: "use the CRT panel at the top of the console as our tutorial bubbles… no popups
//     while in the console") — the words go on the monitor's screen (useCrtLesson, drawn by Console.tsx; it slides
//     down like a toaster when it needs more room) and this only draws the spotlight: the dim with cut-outs for the
//     screen and the target, and the outline round the target. A phone on its side has the monitor off screen, so
//     there the bubble comes back (pointing at the pointer's "or").
// One text at a time: a part the message points at may ask for its own words (data-say: the visor's slider "Drag the
// slider toward the light", its lit button "Press the lit button"), which then replace the step's.
// An insisting step (runner `insist`): the same words, now dimmed, with the tank still taking the flick up through
// the dim (passThrough) — the only control that works then.
// overMenu: a menu is open over the game — only a step's reaction shows then ("That's the pause menu…").
import { useEffect, useSyncExternalStore } from 'react'
import type { CalloutPlacement } from '../../ui/kit'
import { useShort } from '../../ui/useShort'
import { boxAround, gameColumn, lessonTankBox, lessonTargets, lessonTuning, runner, type LessonPointer } from './goopsLessons'
import { targetsOf, useLessonTick, wordsOf } from './lessonLine'
import { Spotlight, type SpotLayout } from './Spotlight'
import text from '../../../content/text/en.json'

export function LessonView({ overMenu = false, atConsole = false }: { overMenu?: boolean; atConsole?: boolean }) {
  const view = useSyncExternalStore(runner.subscribe, runner.view)
  const short = useShort()
  const m = view.message
  useLessonTick(!!m)
  const crt = atConsole && !short // the words are on the monitor
  // Enter closes a message that waits for "Got it" (once it works: dismissArmSeconds)
  const canClose = !!m && m.waitsForDismiss && m.armed && !overMenu
  useEffect(() => {
    if (!canClose) return
    const key = (e: KeyboardEvent) => { if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); runner.dismiss() } }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [canClose])
  if (!m || (overMenu && m.kind !== 'reaction')) return null

  const words = crt ? '' : wordsOf(view.lessonId, m, atConsole)
  const found = targetsOf(m, atConsole)
  // which side the bubble goes: the thing pointed at may say (data-placement), else the pointer's own "placement"
  const side = found?.els[0]?.getAttribute('data-placement') ?? (found?.pointer as LessonPointer | undefined)?.placement
  const layout = (): SpotLayout | null => {
    const now = runner.view().message
    if (!now) return null
    const at = targetsOf(now, atConsole)
    const focus = at ? boxAround(at.els) : null
    const holes = focus ? [focus] : []
    // the pointer's "show": more to keep out of the dim (not outlined) — e.g. the whole visor panel round the part to use
    const show = (at?.pointer as LessonPointer | undefined)?.show
    const shown = show ? lessonTargets(show) : null
    if (shown) holes.push(boxAround(shown.els)!)
    // (the monitor — bezel and screen — is the message at the console: never dimmed, and nor is its toaster)
    if (crt) for (const part of document.querySelectorAll('[data-tag="monitor"], [data-tag="crt"]')) holes.push(boxAround([part])!)
    // an insisting go-to-console message: the flick up reaches the tank through the dim — below the HUD's top row (its
    // pause button stays behind the dim)
    let tank = lessonTankBox()
    if (tank) for (const item of document.querySelectorAll('.kit-hud-slot > *')) {
      const b = item.getBoundingClientRect()
      if (b.height && b.bottom < (tank.top + tank.bottom) / 2) tank = { ...tank, top: Math.max(tank.top, b.bottom) }
    }
    const passThrough = now.only?.includes('console') && !atConsole && tank ? [tank] : []
    // RANK SELECT (a Dev Kit tool, F70) works under any lesson: dimmed, but taps reach it
    for (const part of document.querySelectorAll('[data-tag="rankSelect"]')) passThrough.push(boxAround([part])!)
    return { focus, holes, passThrough, frame: gameColumn() }
  }
  return (
    <Spotlight key={`${view.stepId}:${m.kind}`} layout={layout} dim={m.dim} dimAmount={lessonTuning().dimAmount}
      text={words || undefined} placement={(side ?? 'auto') as CalloutPlacement}
      action={m.waitsForDismiss ? text.lessons.gotIt : undefined} onAction={() => runner.dismiss()} />
  )
}
