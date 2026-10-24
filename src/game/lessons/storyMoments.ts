// F35: STORY MOMENTS — one short moment per rank-up (design/story.md "Story moments, rank by rank"), played at the
// console between shifts, once per device: Management types on the monitor (voice "mon"), the Veteran talks in his
// talking bubble over the same monitor area (voice "spk"; a mon line in the middle of his = Management cutting in —
// Muzzy, 2026-10-24). Not skippable but short: a tap / Enter moves to the next line. Which lines play when:
// content/story/moments.json; words: en.json story.lines. Seen ones are kept in the kit's tips memory as "story:<rank>",
// so Settings → Replay lessons plays them again. App asks atConsole(rank) before the console's lessons (the first day,
// the upgrades unlock), and those wait while a moment plays.
import { tipsMemory } from '../../ui/kit'
import momentsFile from '../../../content/story/moments.json'
import text from '../../../content/text/en.json'

export type Voice = 'mon' | 'spk'
export type StoryLine = { voice: Voice; words: string }
type Moment = { look?: string; lines: StoryLine[] }
type MomentsFile = { catchUp: number; moments: Record<string, Moment> }

export const storyFile = momentsFile as unknown as MomentsFile
const seenId = (rank: number) => `story:${rank}`

/** The ranks whose moments are due at this rank: every unseen one up to it, the newest `catchUp` of them, oldest first. */
export function dueRanks(rank: number, seen: (rank: number) => boolean, file: MomentsFile = storyFile): number[] {
  const due = Object.keys(file.moments).map(Number).filter((r) => r <= rank && !seen(r)).sort((a, b) => a - b)
  return due.slice(Math.max(0, due.length - Math.max(1, file.catchUp)))
}

/** The words of a line (its key when en.json has none, so a missing line shows up instead of going quiet). */
export const storyWords = (key: string) => (text.story.lines as Record<string, string>)[key] ?? key

export type StoryView = { rank: number; line: StoryLine; look?: string } | null

// Scripted checks (a dev build in an automated browser) start at the console at every rank: there the moments stay
// quiet unless the page asks for them with ?story (e2e/story.mjs) — never in a player's game.
const quietForChecks = () => import.meta.env.DEV && typeof navigator !== 'undefined' && navigator.webdriver
  && !new URLSearchParams(location.search).has('story')

let queue: { rank: number; moment: Moment }[] = []
let at = 0 // the line on screen in queue[0]
let view: StoryView = null
const listeners = new Set<() => void>()
const show = () => {
  const now = queue[0]
  view = now ? { rank: now.rank, line: now.moment.lines[at], look: now.moment.look } : null
  listeners.forEach((l) => l())
}

export const storyMoments = {
  /** App: the console is on screen between shifts at this rank. Starts the due moments; true = one is playing. */
  atConsole(rank: number): boolean {
    if (view) return true
    if (quietForChecks()) return false
    const memory = tipsMemory()
    queue = dueRanks(rank, (r) => memory.seen(seenId(r)))
      .map((r) => ({ rank: r, moment: storyFile.moments[String(r)] }))
      .filter((m) => m.moment?.lines.length)
    at = 0
    show()
    return !!view
  },
  /** The next line (a tap / Enter / Got it). The last line of a moment marks it seen; the last moment ends it. */
  next() {
    const now = queue[0]
    if (!now) return
    if (at < now.moment.lines.length - 1) { at++; show(); return }
    tipsMemory().markSeen(seenId(now.rank))
    queue = queue.slice(1)
    at = 0
    show()
  },
  /** Stop without marking anything seen (the console went away). */
  stop() { queue = []; at = 0; show() },
  playing: () => !!view,
  view: (): StoryView => view,
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
}
