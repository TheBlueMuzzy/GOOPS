// FIRST-BREAKDOWN LESSONS (F32, .planning/research/tutorial.md §5) — the Goops rules for WHEN they play:
//   - the FIRST time a machine breaks in a real shift (never a lesson's training shift), its lesson
//     (content/lessons/<machine>.json) plays on rails: what broke → go to the console → fix it → how to prevent it →
//     back to the tank. Once per device per machine (kit tips memory 'lesson:<machine>'; Settings → Replay lessons
//     clears it). A second machine breaking during a lesson waits its turn (the runner's queue).
//   - it counts as seen once the repair is done; leaving the shift before that → it plays again at the next break.
//   - the console-visit note: the first few times (content/tuning/lessons.json consoleNoteVisits) the player goes to
//     the console mid-shift OUTSIDE a lesson, one line says the tank keeps running slowly there
//     (content/lessons/console-note.json). The count is remembered on the device too ('consoleNote:<n>').
// The lessons themselves are plain data; this file only decides when they start.
import { tipsMemory } from '../../ui/kit'
import { session } from '../session'
import { BREAKDOWN_LESSONS, lessonNow, lessonPlay, lessonSeen, runner } from './goopsLessons'
import lessonTiming from '../../../content/tuning/lessons.json'

const CONSOLE_NOTE = 'console-note'
const asked = new Set<string>() // lessons running or waiting their turn (a machine breaking twice meanwhile: one lesson)
let running: string | null = null
runner.subscribe(() => { // a lesson over → it can be asked for again (if it wasn't seen: e.g. after Replay lessons)
  const now = runner.view().lessonId
  if (running && running !== now) asked.delete(running)
  running = now
})

const isBreakdownLesson = (id: string): id is (typeof BREAKDOWN_LESSONS)[number] => (BREAKDOWN_LESSONS as readonly string[]).includes(id)

session.listen((events) => {
  if (!lessonPlay.realShift()) return
  for (const e of events) {
    if (e.type === 'breakdown' && isBreakdownLesson(e.machine) && !lessonSeen(e.machine) && !asked.has(e.machine) && lessonNow(e.machine)) {
      asked.add(e.machine)
      const id = e.machine
      runner.queue(() => lessonNow(id)!) // (now, or after the lesson that's running)
    }
    // the repair is the part that counts: done → seen, even if the shift ends before the lesson's last words
    if (e.type === 'repaired' && runner.view().lessonId === e.machine) tipsMemory().markSeen(`lesson:${e.machine}`)
  }
})

export const firstBreakdowns = {
  /** App: a new real shift — nothing asked yet. */
  newShift() { asked.clear() },
  /** App: the player went to the console mid-shift (W / ↑ / flick up). Outside a lesson, the first few visits on this
   *  device get the one-line note. */
  consoleVisited() {
    if (!lessonPlay.realShift() || runner.view().lessonId || !lessonNow(CONSOLE_NOTE)) return
    const memory = tipsMemory()
    const shown = memory.seenIds.filter((id) => id.startsWith('consoleNote:')).length
    if (shown >= lessonTiming.consoleNoteVisits) return
    memory.markSeen(`consoleNote:${shown + 1}`)
    runner.queue(() => lessonNow(CONSOLE_NOTE)!)
  },
}
