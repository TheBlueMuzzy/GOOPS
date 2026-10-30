// F65 THE NEW CAREER (TDD D28; Muzzy 2026-10-27: a look only, same game from rank 0, skip the first day but keep the
// rank-0 sign-in): its start state.
import { describe, expect, it } from 'vitest'
import { beginNewCareer, careerKeeps } from '../../src/game/newCareer'
import { momentFor } from '../../src/game/lessons/storyMoments'
import { badgeTitle, freshProgress, rankInfo } from '../../src/progress/progression'
import { FIRST_DAY } from '../../src/game/lessons/firstDay'
import moments from '../../content/story/moments.json'
import art from '../../content/ui/art.json'

describe('the new career', () => {
  it('starts at rank 0 with nothing: no XP, no scraps spent, nothing bought, no badge — and its title is Former Employee', () => {
    const seen: string[] = []
    const p = beginNewCareer({ resetTips: () => { seen.length = 0 }, markSeen: (id) => { seen.push(id) } })
    expect(p).toEqual(freshProgress())
    expect(rankInfo(p)).toMatchObject({ rank: 0, xpIntoRank: 0, scraps: 0 })
    expect(p.badge).toBeUndefined()
    expect(badgeTitle(0, p.badge, 1)).toBe('formerEmployee')
  })

  it('keeps every lesson seen (the first day is skipped — the device has had it) but forgets the story, so it plays again', () => {
    const seen: string[] = ['story:12', 'whisper:cold', 'look:mouths-open', 'lesson:laser']
    beginNewCareer({ resetTips: () => { seen.length = 0 }, markSeen: (id) => { seen.push(id) } })
    expect(seen).toContain(`lesson:${FIRST_DAY}`)
    for (const id of ['lesson:unlock-window', 'lesson:unlock-swap', 'lesson:unlock-upgrades', 'lesson:visor', 'lesson:laser', 'lesson:controls', 'consoleNote:1'])
      expect(seen, id).toContain(id)
    expect(seen.some((id) => id.startsWith('story:') || id.startsWith('whisper:') || id.startsWith('look:'))).toBe(false)
    expect(careerKeeps().every((id) => id.startsWith('lesson:') || id.startsWith('consoleNote:'))).toBe(true)
  })

  it('rank 0 asks your name again (the sign-in), after the monitor slips: "WELCOME BA—" — only in a new career', () => {
    const career = momentFor(0, 1)
    expect(career.lines[0]).toMatchObject({ voice: 'mon', words: 'r0back', cut: true })
    expect(career.lines.some((l) => l.sign)).toBe(true)
    expect(career.lines.map((l) => l.words)).toContain('r0former')
    expect(momentFor(0, 0)).toEqual(moments.moments['0'])
    expect(momentFor(5, 1)).toEqual(moments.moments['5']) // (other ranks: the usual moments)
  })

  it('the gold trim (a look only) starts with the first career done, on the console and the periscope', () => {
    expect(art.console.career.fromCareers).toBe(1)
    expect(art.console.career.layers).toEqual(expect.arrayContaining(['body', 'periscope']))
  })
})
