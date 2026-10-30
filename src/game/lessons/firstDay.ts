// "YOUR FIRST DAY" (F31, .planning/research/tutorial.md §3) — the Goops rules for WHEN day one plays (the day itself is
// plain data: content/lessons/first-day.json):
//   - it's due on a fresh save (rank 0) until it's finished once on this device (kit tips memory 'lesson:first-day',
//     marked by the runner when its last step is done) — or after Settings → Replay lessons, at any rank (a replay: no
//     XP top-up, progression.ts rewardFirstDay). Dev: ?rank=N (N ≥ 1) never plays it; ?rank=0 plays it if it's due.
//   - its first step (A1, "pull the periscope") plays on the console; the pull starts the day's training shift at the
//     phase it got to (B1 the first time).
//   - leaving mid-day (End shift, closing the page) remembers the phase reached (the last checkpoint): next time the
//     pull starts there — each phase sets its own tank up.
// Remembered in the browser under "goops-first-day" ({ at: the checkpoint step id, replay: Replay lessons asked for it }).
import { lessonNow, lessonPlay, lessonSeen, runner } from './goopsLessons'

export const FIRST_DAY = 'first-day'
const KEY = 'goops-first-day'
type Saved = { at: string | null; replay: boolean }

function load(): Saved {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    return { at: typeof saved?.at === 'string' ? saved.at : null, replay: saved?.replay === true }
  } catch { return { at: null, replay: false } }
}
function save(saved: Saved) {
  try { localStorage.setItem(KEY, JSON.stringify(saved)) } catch { /* private mode: it just isn't remembered */ }
}

// keep the checkpoint the day has reached (only in the tank: A1 is the console's step — the pull always resumes at the
// phase reached), and forget it once the day is finished
let running = false
runner.subscribe(() => {
  const view = runner.view()
  const lesson = lessonNow(FIRST_DAY)
  if (view.lessonId === FIRST_DAY && lesson && view.stepIndex > 0) {
    running = true
    const at = lesson.steps[runner.restartPoint(lesson, view.stepIndex)]?.id ?? null
    if (at && at !== lesson.steps[0].id && at !== load().at) save({ ...load(), at })
  } else if (running && view.lessonId !== FIRST_DAY) {
    running = false
    if (lessonSeen(FIRST_DAY)) save({ at: null, replay: false }) // (finished: its last step was done)
  }
})

export const firstDay = {
  /** Should the day play? rank = the player's rank; forced = it comes from ?rank= (dev), which never replays it. */
  due(rank: number, forced = false): boolean {
    if (!lessonNow(FIRST_DAY) || lessonSeen(FIRST_DAY)) return false
    return rank === 0 || (!forced && load().replay)
  },
  /** App: the console is on screen between shifts and the day is due — its first step (pull the periscope). */
  atConsole() {
    if (runner.view().lessonId) return
    lessonPlay.startAtConsole(FIRST_DAY)
  },
  /** The step the day's shift starts at: the checkpoint reached last time, else the first step after the console's. */
  startStep(): string {
    const lesson = lessonNow(FIRST_DAY)
    const at = load().at
    return at && lesson?.steps.some((s) => s.id === at) ? at : (lesson?.steps[1]?.id ?? '')
  },
  /** Is the day playing now (on the console or in its shift)? */
  running: () => runner.view().lessonId === FIRST_DAY,
  /** Settings → Replay lessons: the day plays again from the start (at the next console), whatever the rank. */
  replay() { save({ at: null, replay: true }) },
  /** F70 RANK SELECT 0: forget the day's checkpoint and any replay, as on a brand-new device. */
  forget() { try { localStorage.removeItem(KEY) } catch { /* private mode: nothing was kept */ } },
}
