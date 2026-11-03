// What a player who reached this rank the normal way has already seen (Muzzy 2026-10-26, after RANK SELECT → 50 on a
// fresh device played the first-day, unlock and breakdown lessons on top of the final shift: "maybe the tutorials …
// only show up at the level they are supposed to show up?"). RANK SELECT marks these as seen (src/game/rankSelect.ts),
// so a jump plays only what belongs to the picked rank itself: its story moment, an unlock or machine that starts there.
// The ids are the kit tips memory's: 'lesson:<id>', 'story:<moment id>', 'consoleNote:<n>', 'whisper:cold', 'look:mouths-open'.
import { unlockRank, UNLOCKS, type Unlock } from '../../progress/progression'
import lessonsFile from '../../../content/tuning/lessons.json'
import { rankOf } from '../../progress/ladder'
import { machineRank } from '../../engine/machines'
import { FIRST_DAY } from './firstDay'
import { momentsByRank, storySeenId } from './storyMoments'

// each unlock's lesson (unlockLessons.ts)
const UNLOCK_LESSON: Record<Unlock, string> = { nextPiece: 'unlock-window', swap: 'unlock-swap', upgrades: 'unlock-upgrades' }
const MACHINES = ['visor', 'laser', 'controls'] as const // (goopsLessons BREAKDOWN_LESSONS — each machine's lesson id is its name)

export type LivedThroughFiles = {
  machineRank: Record<string, number> // the rank each machine starts breaking at (the ladder's laserBreaks…)
  unlockAt: (u: Unlock) => number
  consoleNoteVisits: number
  coldAt: number // the ladder beat whisperCold
  chorusRank: number // the ladder beat eyesChorus
  moments?: { id: string; rank: number }[] // each story moment's rank (left out = the ladder's story group)
}
const liveFiles = (): LivedThroughFiles => ({
  machineRank: Object.fromEntries(MACHINES.map((m) => [m, machineRank(m)])),
  unlockAt: (u) => unlockRank(u),
  consoleNoteVisits: lessonsFile.consoleNoteVisits,
  coldAt: rankOf('whisperCold'),
  chorusRank: rankOf('eyesChorus'),
  moments: momentsByRank(),
})

/** The tips-memory ids a player starting this rank has already seen (nothing at rank 0 — a brand-new device). */
export function livedThrough(rank: number, f: LivedThroughFiles = liveFiles()): string[] {
  if (rank <= 0) return []
  const ids = [`lesson:${FIRST_DAY}`]
  for (const u of UNLOCKS) if (f.unlockAt(u) < rank) ids.push(`lesson:${UNLOCK_LESSON[u]}`)
  for (const m of MACHINES) if (f.machineRank[m] < rank) ids.push(`lesson:${m}`)
  if (MACHINES.some((m) => f.machineRank[m] < rank)) for (let n = 1; n <= f.consoleNoteVisits; n++) ids.push(`consoleNote:${n}`)
  for (const m of f.moments ?? momentsByRank()) if (m.rank < rank) ids.push(storySeenId(m.id))
  if (f.coldAt < rank) ids.push('whisper:cold')
  if (f.chorusRank < rank) ids.push('look:mouths-open')
  return ids
}
