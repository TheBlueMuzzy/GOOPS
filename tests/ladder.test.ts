// F78 — One rank ladder file: the ladder module (src/ladder) and Goops' ladder.json.
import { describe, expect, it } from 'vitest'
import { createLadder, LadderError, type LadderFile } from '../src/ladder'
import ladderJson from '../content/tuning/ladder.json'
import upgradesJson from '../content/tuning/upgrades.json'
import momentsJson from '../content/story/moments.json'
import en from '../content/text/en.json'
import { ladder } from '../src/progress/ladder'

const file = (): LadderFile => ({
  maxRank: 10,
  beats: { start: 0, wild: 4, grow: 4, final: 10 },
  titles: { rookie: 0, pro: 5 },
  story: { a: 0, b: 4, c: 4 },
  grants: { scraps: { wild: 3, final: 2 } },
})

describe('the ladder module', () => {
  it('rankOf: a beat by name, a group name with its group', () => {
    const l = createLadder(file())
    expect(l.rankOf('wild')).toBe(4)
    expect(l.rankOf('titles.pro')).toBe(5)
    expect(l.rankOf('story.c')).toBe(4)
    expect(l.has('wild')).toBe(true)
    expect(l.has('nope')).toBe(false)
  })
  it('an unknown beat throws a plain message naming the file', () => {
    const l = createLadder(file(), 'my-ladder.json')
    expect(() => l.rankOf('wilde')).toThrow(LadderError)
    expect(() => l.rankOf('wilde')).toThrow(/no beat called "wilde" in my-ladder\.json/)
    expect(() => l.rankOf('titles.nope')).toThrow(LadderError)
    expect(() => l.group('nope')).toThrow(LadderError)
  })
  it('beatsAt: every name at a rank, beats first, then groups, in file order', () => {
    expect(createLadder(file()).beatsAt(4)).toEqual(['wild', 'grow', 'story.b', 'story.c'])
    expect(createLadder(file()).beatsAt(3)).toEqual([])
  })
  it('maxRank, group, lastAt (a title per band)', () => {
    const l = createLadder(file())
    expect(l.maxRank()).toBe(10)
    expect(l.group('titles')).toEqual([{ name: 'rookie', rank: 0 }, { name: 'pro', rank: 5 }])
    expect([0, 4, 5, 10].map((r) => l.lastAt('titles', r))).toEqual(['rookie', 'rookie', 'pro', 'pro'])
  })
  it('stepAt: a step table that names beats', () => {
    const l = createLadder(file())
    const steps = [{ beat: 'start', count: 4 }, { beat: 'wild', count: 5 }, { beat: 'final', count: 7 }]
    expect([0, 3, 4, 9, 10].map((r) => l.stepAt(steps, r))).toEqual([4, 4, 5, 5, 7])
  })
  it('a pivot that moves one name past the next: the highest rank reached wins, not the file order', () => {
    // (Claude's F78 review: "associate 5 → 12 with technician at 10" showed technician at 12)
    const moved = { ...file(), titles: { rookie: 0, pro: 8, vet: 6 }, beats: { start: 0, wild: 9, grow: 4, final: 10 } }
    const l = createLadder(moved)
    expect([0, 6, 7, 8, 10].map((r) => l.lastAt('titles', r))).toEqual(['rookie', 'vet', 'vet', 'pro', 'pro'])
    const steps = [{ beat: 'start', count: 4 }, { beat: 'wild', count: 5 }, { beat: 'grow', count: 6 }]
    expect([0, 4, 8, 9].map((r) => l.stepAt(steps, r))).toEqual([4, 6, 6, 5])
  })
  it('grants land on their beat\'s rank; grantsUpTo adds them up', () => {
    const l = createLadder(file())
    expect([0, 4, 10].map((r) => l.grantAt('scraps', r))).toEqual([0, 3, 2])
    expect([3, 4, 9, 10].map((r) => l.grantsUpTo('scraps', r))).toEqual([0, 3, 3, 5])
    expect(l.grantsUpTo('nothing', 10)).toBe(0)
  })
  it('reads live: an edit to the file (the Dev Kit\'s) shows on the next call', () => {
    const f = file(), l = createLadder(f)
    f.beats.wild = 7
    expect(l.rankOf('wild')).toBe(7)
    let current = file()
    const fromFn = createLadder(() => current)
    current = { ...file(), maxRank: 30 }
    expect(fromFn.maxRank()).toBe(30)
  })
  it('problems: ranks off the ladder, grants on unknown beats', () => {
    expect(createLadder(file()).problems()).toEqual([])
    const bad = file()
    bad.beats.wild = 11
    ;(bad.titles as Record<string, number>).pro = -1
    bad.grants = { scraps: { ghost: 1 } }
    const p = createLadder(bad).problems()
    expect(p.some((s) => s.includes('wild is at rank 11'))).toBe(true)
    expect(p.some((s) => s.includes('titles.pro'))).toBe(true)
    expect(p.some((s) => s.includes('ghost'))).toBe(true)
  })
})

describe("Goops' ladder.json", () => {
  it('is whole: every rank on the ladder, every grant on a beat', () => {
    expect(ladder.problems()).toEqual([])
  })
  it('names every playable upgrade (and nothing else in upgrades)', () => {
    const playable = upgradesJson.upgrades.filter((u) => !('testOnly' in u && u.testOnly)).map((u) => u.id)
    expect(Object.keys(ladderJson.upgrades).sort()).toEqual([...playable].sort())
  })
  it('places every story moment, and every placed moment exists', () => {
    expect(Object.keys(ladderJson.story).sort()).toEqual(Object.keys(momentsJson.moments).sort())
  })
  it('every title has words', () => {
    for (const t of ladder.group('titles')) expect((en.story.titles as Record<string, string>)[t.name], t.name).toBeTruthy()
  })
  it('every number has a _help line and a _range for the Dev Kit', () => {
    const help = ladderJson._help as Record<string, string>, ranges = ladderJson._ranges as Record<string, unknown>
    const paths = ['maxRank', ...['beats', 'titles', 'upgrades', 'story'].flatMap((g) => Object.keys((ladderJson as unknown as Record<string, object>)[g]).map((k) => `${g}.${k}`))]
    for (const p of paths) {
      expect(help[p], `_help ${p}`).toBeTruthy()
      expect(ranges[p], `_ranges ${p}`).toBeTruthy()
    }
  })
  it('no content file keeps a rank gate of its own any more (one source)', async () => {
    const { readFileSync } = await import('node:fs')
    const read = (p: string) => readFileSync(p, 'utf8')
    for (const [path, field] of [['content/tuning/progression.json', '"maxRank"'], ['content/tuning/progression.json', '"unlocks"'],
      ['content/tuning/progression.json', '"titles"'], ['content/tuning/shift.json', 'ByRank'], ['content/tuning/breakdowns.json', 'unlockRank'],
      ['content/tuning/twists.json', 'fromRank'], ['content/tuning/whiteGoop.json', 'fromRank'], ['content/tuning/finalShift.json', '"rank"'],
      ['content/tuning/payslip.json', 'caughtRank'], ['content/tuning/payslip.json', 'pendingRetirementRank'], ['content/tuning/payslip.json', 'afterRank'],
      ['content/tuning/eyes.json', 'chorusRank'], ['content/ui/art.json', 'fromRank'], ['content/tuning/upgrades.json', '"rank"'],
      ['content/story/moments.json', 'coldAt'], ['content/story/moments.json', 'noVoicesFrom'], ['content/story/moments.json', '"from"']]) {
      expect(read(path).includes(field), `${path} still has ${field}`).toBe(false)
    }
  })
})
