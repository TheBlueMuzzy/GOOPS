// What a player who reached this rank the normal way has already seen (Muzzy 2026-10-26, after RANK SELECT → 50 on a
// fresh device played the first-day, unlock and breakdown lessons on top of the final shift: "maybe the tutorials …
// only show up at the level they are supposed to show up?"). RANK SELECT marks these as seen (src/game/rankSelect.ts),
// so a jump plays only what belongs to the picked rank itself: its story moment, an unlock or machine that starts there.
// The ids are the kit tips memory's: 'lesson:<id>', 'story:<rank>', 'consoleNote:<n>', 'whisper:cold', 'look:mouths-open'.
import { unlockRank, UNLOCKS, type Unlock } from '../../progress/progression'
import breakdownsFile from '../../../content/tuning/breakdowns.json'
import lessonsFile from '../../../content/tuning/lessons.json'
import momentsFile from '../../../content/story/moments.json'
import eyesFile from '../../../content/tuning/eyes.json'
import { FIRST_DAY } from './firstDay'

// each unlock's lesson (unlockLessons.ts)
const UNLOCK_LESSON: Record<Unlock, string> = { nextPiece: 'unlock-window', swap: 'unlock-swap', upgrades: 'unlock-upgrades' }
const MACHINES = ['visor', 'laser', 'controls'] as const // (goopsLessons BREAKDOWN_LESSONS — each machine's lesson id is its name)

export type LivedThroughFiles = {
  machineRank: Record<string, number> // the rank each machine starts breaking at (breakdowns.json unlockRank)
  unlockAt: (u: Unlock) => number
  consoleNoteVisits: number
  coldAt: number
  chorusRank: number
}
const liveFiles = (): LivedThroughFiles => ({
  machineRank: Object.fromEntries(MACHINES.map((m) => [m, (breakdownsFile as unknown as Record<string, { unlockRank: number }>)[m].unlockRank])),
  unlockAt: (u) => unlockRank(u),
  consoleNoteVisits: lessonsFile.consoleNoteVisits,
  coldAt: momentsFile.whispers.coldAt,
  chorusRank: eyesFile.chorusRank,
})

/** The tips-memory ids a player starting this rank has already seen (nothing at rank 0 — a brand-new device). */
export function livedThrough(rank: number, f: LivedThroughFiles = liveFiles()): string[] {
  if (rank <= 0) return []
  const ids = [`lesson:${FIRST_DAY}`]
  for (const u of UNLOCKS) if (f.unlockAt(u) < rank) ids.push(`lesson:${UNLOCK_LESSON[u]}`)
  for (const m of MACHINES) if (f.machineRank[m] < rank) ids.push(`lesson:${m}`)
  if (MACHINES.some((m) => f.machineRank[m] < rank)) for (let n = 1; n <= f.consoleNoteVisits; n++) ids.push(`consoleNote:${n}`)
  for (let r = 0; r < rank; r++) ids.push(`story:${r}`)
  if (f.coldAt < rank) ids.push('whisper:cold')
  if (f.chorusRank < rank) ids.push('look:mouths-open')
  return ids
}
