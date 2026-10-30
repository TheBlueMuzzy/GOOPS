// F65 THE NEW CAREER (design/story.md "The ending" step 7, TDD D28; Muzzy 2026-10-27: "a look only … same game from rank 0;
// skip the first day's tutorial but keep the rank-0 sign-in"). The end-game screen's button begins it:
//   - the progress starts again: rank 0, no XP, no scraps, nothing bought, no badge (freshProgress) — the settings, the
//     name you signed and the careers done stay (save.ts keeps them); rank 0's title is now Former Employee
//   - you know the job: every lesson and console note stays seen, so the first day is skipped (the device counts as
//     having had it) and so are the unlock and machine lessons — but the story plays again from rank 0: its moments,
//     whispers and looks are forgotten, so rank 0's sign-in asks your name again (the goop learns the new one) and its
//     first line slips: "WELCOME BA— …" (content/story/moments.json newCareer)
//   - the console + periscope are gold-trimmed from then on (content/ui/art.json career; Console.tsx)
import { tipsMemory } from '../ui/kit'
import { freshProgress, topRank, type Progress } from '../progress/progression'
import { saveProgress } from '../progress/save'
import { firstDay } from './lessons/firstDay'
import { livedThrough, type LivedThroughFiles } from './lessons/livedThrough'

/** What a new career keeps seen: every lesson and console note there is (the story's ids are left out: it plays again). */
export function careerKeeps(f?: LivedThroughFiles): string[] {
  return livedThrough(topRank() + 1, f).filter((id) => id.startsWith('lesson:') || id.startsWith('consoleNote:'))
}

type Memory = { resetTips(): void; markSeen(id: string): void }

/** Begin the new career: the fresh progress saved (name + careers kept), the first day's checkpoint forgotten, the
 *  device's memory = the lessons only. Returns the new progress. */
export function beginNewCareer(memory: Memory = tipsMemory()): Progress {
  const progress = freshProgress()
  saveProgress(progress)
  firstDay.forget()
  memory.resetTips()
  for (const id of careerKeeps()) memory.markSeen(id)
  return progress
}
