// Goops' ladder (F78 — One rank ladder file): content/tuning/ladder.json through the ladder module (src/ladder). Every
// rank gate in the game is asked here by name — rankOf('wildGoop') — never a rank number in code. Live: the Dev Kit's
// Vite plugin hands the import over as a live object and the ladder reads it on every call.
import ladderJson from '../../content/tuning/ladder.json'
import { createLadder, type BeatStep, type LadderFile } from '../ladder'

export const ladderFile = ladderJson as unknown as LadderFile
export const ladder = createLadder(ladderFile, 'content/tuning/ladder.json')
export type { BeatStep }

/** The rank a beat sits at ("wildGoop", "titles.technician", "upgrades.goopSwap", "story.31"). Unknown → throws. */
export const rankOf = (name: string) => ladder.rankOf(name)
/** The top rank (the final shift's rank is its own beat, finalShift). */
export const maxRank = () => ladder.maxRank()
/** The first rank where all three machines can break — whichever of their beats comes last (never assume which). */
export const allMachinesRank = () => Math.max(rankOf('visorBreaks'), rankOf('laserBreaks'), rankOf('controlsBreak'))
/** Is this rank at or past the beat? */
export const reached = (rank: number, beat: string) => rank >= ladder.rankOf(beat)

export type TitleId = keyof typeof ladderJson.titles
