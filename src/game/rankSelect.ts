// RANK SELECT's rules (F70; the screen: src/ui/RankSelect.tsx) — what picking a rank does to this device's save.
//   0        wipe the save: the progress (and the name you signed, F66), the first day's checkpoint and every lesson / story moment / tip the device
//            has seen — a brand-new device's fresh first day. Settings are kept.
//   any other  the START of that rank (0 XP into it), nothing bought: every scrap back, as Respec gives them — and the
//            lessons, story moments and looks of the ranks before it count as seen, as for a player who lived through them
//            (lessons/livedThrough.ts; Muzzy 2026-10-26: a jump to 50 played the first day's lessons on top of it)
// Then the page reloads without ?rank / ?lesson / ?step (they'd override the save — Muzzy's ?rank links left his save
// at 18), so everything starts from the new save exactly as it would on a real device.
import { tipsMemory } from '../ui/kit'
import { progressAtRank } from '../progress/progression'
import { clearProgress, saveProgress } from '../progress/save'
import { firstDay } from './lessons/firstDay'
import { livedThrough } from './lessons/livedThrough'

/** Is RANK SELECT part of this build? The Dev Kit's own switch (main.tsx): always in dev; in a release build only
 *  while content/devkit.json "inReleaseBuilds" is on (the testers' alpha) — never in a store build. */
export const rankSelectOn: boolean = import.meta.env.DEV || __DEVKIT_IN_RELEASE__

/** The device's save becomes that rank's start (0 = a brand-new device), then the page starts again from it. */
export function pickRank(rank: number) {
  if (rank <= 0) {
    clearProgress()
    firstDay.forget()
    tipsMemory().resetTips() // (the lessons, story moments, whispers and console notes it has seen; the Tips switch stays)
  } else {
    saveProgress(progressAtRank(rank))
    for (const id of livedThrough(rank)) tipsMemory().markSeen(id)
  }
  const url = new URL(location.href)
  for (const param of ['rank', 'lesson', 'step']) url.searchParams.delete(param)
  location.replace(url.href)
}
