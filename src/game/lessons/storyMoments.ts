// F35: STORY MOMENTS — one short moment per rank-up (design/story.md "Story moments, rank by rank"), played at the
// console between shifts, once per device: Management types on the monitor (voice "mon"), the Veteran talks in his
// talking bubble over the same monitor area (voice "spk"; a mon line in the middle of his = Management cutting in —
// Muzzy, 2026-10-24). Not skippable but short: a tap / Enter moves to the next line. Which lines play when:
// content/story/moments.json; words: en.json story.lines. Seen ones are kept in the kit's tips memory as "story:<rank>",
// so Settings → Replay lessons plays them again. App asks atConsole(rank) before the console's lessons (the first day,
// the upgrades unlock), and those wait while a moment plays.
import { tipsMemory } from '../../ui/kit'
import { looksClock } from '../../devkit/gameClock'
import momentsFile from '../../../content/story/moments.json'
import text from '../../../content/text/en.json'
import { operatorName } from '../../progress/save'

// F63: head = the goop in your head (ranks 31–39) — the whisper bubble over the monitor area; him = the Veteran from
// inside the white goop is the one talking (35, 37) · F45: goop = the goop through the speaker (41, 43, 48) — the
// Veteran's bubble place, the goop's look (StoryView.tsx)
export type Voice = 'mon' | 'spk' | 'head' | 'goop'
// F40: monitor = what the monitor does while the line is up · crackle = the bubble squelches more often · cut = the line
// is cut off once typed (the moment moves on by itself) — moments.json _about · F66 sign = the line puts a name box on
// the monitor (PLEASE SIGN HERE, rank 0): Sign or Skip moves on instead of Got it (Console.tsx) · F45: monitor glitch =
// for a beat something that isn't a face (45) · rattle = the hatch under the console rattles (46, 47; Console.tsx)
export type MonitorLook = 'flicker' | 'alarm' | 'glitch'
export type StoryLine = { voice: Voice; words: string; monitor?: MonitorLook; crackle?: boolean; cut?: boolean; sign?: boolean; him?: boolean; rattle?: boolean }
type Moment = { look?: string; lines: StoryLine[] }
// F40: the goop gets better at talking — each stage (from a rank on) has its own words: feelings (8) → single words
// (15) → names (24). From noVoicesFrom, Management answers a whisper (en.json story.lines.noVoices).
type WhisperStage = { from: number; say: string[] }
type Whispers = { coldAt: number; stages: WhisperStage[]; afterSeconds: [number, number]; showSeconds: number; heightInTank: number
  noVoicesFrom: number; noVoicesDelaySeconds: number; noVoicesSeconds: number }
export type StoryLooks = { flickerSeconds: number; alarmSeconds: number; alarmColour: string; alarmWords: string; crackleEvery: number; cutSeconds: number
  goopOutline: 'wave' | 'plain'; glitchAfterSeconds: number; glitchSeconds: number; glitchColour: string; rattleSeconds: number; rattleShake: number; rattleTimes: number }
type MomentsFile = { catchUp: number; moments: Record<string, Moment>; whispers: Whispers; looks: StoryLooks }

export const storyFile = momentsFile as unknown as MomentsFile
const seenId = (rank: number) => `story:${rank}`

/** The ranks whose moments are due at this rank: every unseen one up to it, the newest `catchUp` of them, oldest first. */
export function dueRanks(rank: number, seen: (rank: number) => boolean, file: MomentsFile = storyFile): number[] {
  const due = Object.keys(file.moments).map(Number).filter((r) => r <= rank && !seen(r)).sort((a, b) => a - b)
  return due.slice(Math.max(0, due.length - Math.max(1, file.catchUp)))
}

/** The whisper stage at this rank: the last one whose `from` it has reached (null = none yet). */
export function whisperStage(rank: number, w: Whispers = storyFile.whispers): WhisperStage | null {
  let stage: WhisperStage | null = null
  for (const s of w.stages) if (rank >= s.from && s.say.length && (!stage || s.from >= stage.from)) stage = s
  return stage
}

/** In-shift whispers (Whisper.tsx): which one this shift gets at this rank (null = none) — one of its stage's words
 *  (feelings from 8, single words from 15, names from 24); before the first stage, "cold" once per device from coldAt.
 *  pick = a random 0..1. */
export const COLD_SEEN = 'whisper:cold'
export function whisperFor(rank: number, coldSeen: boolean, pick: number, w: Whispers = storyFile.whispers): string | null {
  const stage = whisperStage(rank, w)
  if (stage) return stage.say[Math.floor(pick * stage.say.length) % stage.say.length]
  if (rank >= w.coldAt && !coldSeen) return 'cold'
  return null
}

/** F40: does Management answer a whisper at this rank? ("THERE ARE NO VOICES IN THE TANK…", story.md, rank 12+) */
export const monitorDeniesVoices = (rank: number, w: Whispers = storyFile.whispers) => rank >= w.noVoicesFrom

/** The words of a line (its key when en.json has none, so a missing line shows up instead of going quiet).
 *  F63: {name} = your name — the one you signed at rank 0, else "Operator #4471" (en.json story.sign.fallback). */
export const storyWords = (key: string) => ((text.story.lines as Record<string, string>)[key] ?? key)
  .replace(/\{name\}/g, () => operatorName() ?? text.story.sign.fallback)

export type StoryView = { rank: number; line: StoryLine; look?: string } | null

// Scripted checks (a dev build in an automated browser) start at the console at every rank: there the moments stay
// quiet unless the page asks for them with ?story (e2e/story.mjs) — never in a player's game.
export const quietForChecks = () => import.meta.env.DEV && typeof navigator !== 'undefined' && navigator.webdriver
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
  /** F40 / F45: a cut line has typed out — the moment moves on by itself after looks.cutSeconds (looks clock: the Dev
   *  Kit's full pause holds it), unless it went on another way first. Returns "cancel". */
  cutAfterTyped(): () => void {
    const at = view
    return looksClock.after(storyFile.looks.cutSeconds * 1000, () => { if (view === at) storyMoments.next() })
  },
  playing: () => !!view,
  view: (): StoryView => view,
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
}
