// UNLOCK LESSONS (F59) — the Goops rules for WHEN the "you unlocked something" lessons play (the lessons themselves
// are plain data: content/lessons/unlock-*.json; what unlocks at which rank: src/progress/progression.ts):
//   - in the tank: at the START of a real shift (never a lesson's training shift), the earliest unlock this rank has
//     that the device hasn't seen yet — the next-piece window (rank 1), then swap (rank 3). An interrupt: the shift waits
//     under it until Got it. ONE per shift start, never a stack: a player already past both ranks (e.g. ?rank=6 on a
//     fresh device) gets the window's at this shift and swap's at the next (Claude's call, 2026-10-19: one message at a
//     time reads better than two in a row before the first piece has even fallen).
//   - at the console between shifts: upgrading (rank 5) — its line on the monitor, the Upgrades button outlined; done
//     when the player opens Upgrades.
// Once per device each (kit tips memory 'lesson:<id>', marked by the runner when the lesson finishes); Settings →
// Replay lessons clears them with the rest.
import { tipsMemory } from '../../ui/kit'
import { isUnlocked, type Unlock } from '../../progress/progression'
import { lessonNow, lessonPlay, lessonSeen, runner } from './goopsLessons'

// the tank's unlock lessons, in the order their ranks come
const IN_THE_TANK: { id: string; unlock: Unlock }[] = [
  { id: 'unlock-window', unlock: 'nextPiece' },
  { id: 'unlock-swap', unlock: 'swap' },
]
const AT_THE_CONSOLE = { id: 'unlock-upgrades', unlock: 'upgrades' as Unlock }

export const unlockLessons = {
  /** App: a real shift's tank is on screen (it just started) at this rank — the earliest unseen unlock lesson, if any. */
  shiftStarted(rank: number) {
    if (!lessonPlay.realShift() || runner.view().lessonId) return
    const next = IN_THE_TANK.find((l) => isUnlocked(l.unlock, rank) && !lessonSeen(l.id) && lessonNow(l.id))
    if (next) runner.queue(() => lessonNow(next.id)!)
  },
  /** App: the console is on screen between shifts at this rank — upgrading's lesson, if it's unlocked and unseen. */
  atConsole(rank: number) {
    const { id, unlock } = AT_THE_CONSOLE
    if (runner.view().lessonId || !isUnlocked(unlock, rank) || lessonSeen(id) || !lessonNow(id)) return
    lessonPlay.startAtConsole(id)
  },
}

// dev + tests only: mark lessons seen on this device (e2e/start.mjs skips the unlock lessons this way, as a player who
// has had them would)
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __goopsSeen?: (ids: string[]) => void }).__goopsSeen = (ids) => ids.forEach((id) => tipsMemory().markSeen(id))
}
