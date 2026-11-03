// THE LADDER (F78 — One rank ladder file): every rank gate of a game in ONE file, as NAMED beats → rank. Systems ask
// `rankOf('wildGoop')` instead of keeping their own `fromRank`, so moving a beat (or shrinking the whole ladder) is
// one number in one file. Self-contained on purpose (no game imports): it can move into the framework as a module.
//
// The file (a game's content/tuning/ladder.json):
//   maxRank          the top rank (ranks run 0…maxRank)
//   beats            { name: rank } — the game's gates ("wildGoop": 40). A plain name is looked up here.
//   <group>          { name: rank } — more named ranks kept apart (titles, upgrades, story…): "titles.technician"
//   grants           { kind: { name: amount } } — extra rewards landing on a beat's rank ("scraps": { "veteranCaught": 8 })
//   _about / _help / _ranges / any "_" key: notes for people and the Dev Kit, never read here.
//
// LIVE: the ladder keeps the file object it was given and reads it on every call (never a copy), so a Dev Kit edit
// (whose Vite plugin hands the game a live object per content/tuning file) applies while the game runs.

export type LadderNumbers = Record<string, number>
export interface LadderFile {
  maxRank: number
  beats: LadderNumbers
  grants?: Record<string, LadderNumbers>
  [group: string]: unknown
}

/** A step table that names beats: [{ beat: 'firstDay', count: 4 }, { beat: 'fifthColour', count: 5 }] */
export interface BeatStep { beat: string; count: number }

export class LadderError extends Error {}

const isNumbers = (v: unknown): v is LadderNumbers =>
  !!v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every((n) => typeof n === 'number')

export interface Ladder {
  /** The rank a beat sits at. "wildGoop" = a beat; "titles.technician" = a name in a group. Unknown → throws. */
  rankOf(name: string): number
  /** Is there a beat (or group name) called this? */
  has(name: string): boolean
  /** The top rank. */
  maxRank(): number
  /** Every name at this rank, beats first (plain), then each group's ("titles.technician"), in file order. */
  beatsAt(rank: number): string[]
  /** A group's names and ranks, in file order ("titles" → [{ name: 'intern', rank: 0 }, …]). Unknown group → throws. */
  group(group: string): { name: string; rank: number }[]
  /** The last name of a group (file order) whose rank is at or below this one — e.g. the title a rank carries. */
  lastAt(group: string, rank: number): string | undefined
  /** The value of the last step reached at this rank (0 before the first). Steps name beats. */
  stepAt(steps: readonly BeatStep[], rank: number): number
  /** A grant (e.g. "scraps") landing exactly on this rank: the sum of its entries whose beat sits here. */
  grantAt(kind: string, rank: number): number
  /** The same grant summed over every rank from 0 up to this one. */
  grantsUpTo(kind: string, rank: number): number
  /** What's wrong with the file, in plain words (empty = fine): ranks off the ladder, grants on unknown beats… */
  problems(): string[]
}

/** Make a ladder over a file (or a function that returns the latest one). Reads it on every call — live. */
export function createLadder(source: LadderFile | (() => LadderFile), fileName = 'the ladder file'): Ladder {
  const file = () => (typeof source === 'function' ? source() : source)
  const groupOf = (g: string): LadderNumbers => {
    const v = file()[g]
    if (!isNumbers(v) || g.startsWith('_') || g === 'grants') throw new LadderError(`Ladder: ${fileName} has no group called "${g}".`)
    return v
  }
  const find = (name: string): number | undefined => {
    const dot = name.indexOf('.')
    const table = dot < 0 ? file().beats : (file()[name.slice(0, dot)] as LadderNumbers | undefined)
    const key = dot < 0 ? name : name.slice(dot + 1)
    if (!isNumbers(table) || !Object.prototype.hasOwnProperty.call(table, key)) return undefined
    return table[key]
  }
  const groups = () => Object.keys(file()).filter((g) => !g.startsWith('_') && g !== 'beats' && g !== 'grants' && isNumbers(file()[g]))

  const ladder: Ladder = {
    rankOf(name) {
      const r = find(name)
      if (r === undefined) throw new LadderError(`Ladder: no beat called "${name}" in ${fileName} — add it there (beats, or a group like "titles.<name>").`)
      return r
    },
    has: (name) => find(name) !== undefined,
    maxRank: () => file().maxRank,
    beatsAt(rank) {
      const out = Object.entries(file().beats).filter(([, r]) => r === rank).map(([n]) => n)
      for (const g of groups()) for (const [n, r] of Object.entries(groupOf(g))) if (r === rank) out.push(`${g}.${n}`)
      return out
    },
    group: (g) => Object.entries(groupOf(g)).map(([name, rank]) => ({ name, rank })),
    // (the highest rank reached wins, not the file's order — so moving one name past another never needs a re-sort;
    // a tie goes to the one later in the file)
    lastAt(g, rank) {
      let last: string | undefined, best = -Infinity
      for (const [name, r] of Object.entries(groupOf(g))) if (rank >= r && r >= best) { last = name; best = r }
      return last
    },
    stepAt(steps, rank) {
      let value = 0, best = -Infinity
      for (const s of steps) {
        const r = ladder.rankOf(s.beat)
        if (rank >= r && r >= best) { value = s.count; best = r }
      }
      return value
    },
    grantAt(kind, rank) {
      let sum = 0
      for (const [name, amount] of Object.entries(file().grants?.[kind] ?? {})) if (ladder.rankOf(name) === rank) sum += amount
      return sum
    },
    grantsUpTo(kind, rank) {
      let sum = 0
      for (const [name, amount] of Object.entries(file().grants?.[kind] ?? {})) if (ladder.rankOf(name) <= rank) sum += amount
      return sum
    },
    problems() {
      const f = file(), out: string[] = []
      if (!Number.isInteger(f.maxRank) || f.maxRank < 0) out.push(`maxRank should be a whole number 0 or more (it's ${f.maxRank}).`)
      if (!isNumbers(f.beats)) out.push('beats should be { name: rank }.')
      const check = (label: string, table: LadderNumbers) => {
        for (const [n, r] of Object.entries(table)) {
          if (!Number.isInteger(r) || r < 0 || r > f.maxRank) out.push(`${label}${n} is at rank ${r} — off the ladder (0…${f.maxRank}).`)
        }
      }
      if (isNumbers(f.beats)) check('', f.beats)
      for (const g of groups()) check(`${g}.`, groupOf(g))
      for (const [kind, table] of Object.entries(f.grants ?? {})) {
        for (const name of Object.keys(table ?? {})) if (!ladder.has(name)) out.push(`grants.${kind}.${name}: no beat called "${name}".`)
      }
      return out
    },
  }
  return ladder
}
