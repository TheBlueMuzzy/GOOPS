// F35: which story moments are due at the console — and every moment's words exist.
import { describe, expect, it } from 'vitest'
import en from '../../content/text/en.json'
import progression from '../../content/tuning/progression.json'
import { dueRanks, storyFile, whisperFor } from '../../src/game/lessons/storyMoments'
import { titleAt } from '../../src/progress/progression'

const none = () => false
describe('story moments', () => {
  it('a fresh rank-0 device: the rank-0 moment', () => {
    expect(dueRanks(0, none)).toEqual([0])
  })
  it('one rank-up: just that rank', () => {
    expect(dueRanks(4, (r) => r < 4)).toEqual([4])
  })
  it('two rank-ups in one shift: both, oldest first', () => {
    expect(dueRanks(5, (r) => r < 4)).toEqual([4, 5])
  })
  it('a device that skipped many: only the newest catchUp of them', () => {
    expect(dueRanks(9, none)).toEqual([8, 9].slice(-storyFile.catchUp))
  })
  it('everything seen: nothing', () => {
    expect(dueRanks(9, () => true)).toEqual([])
  })
  it('every rank 0–9 has a moment, and every line has words', () => {
    const lines = en.story.lines as Record<string, string>
    for (let r = 0; r <= 9; r++) {
      const m = storyFile.moments[String(r)]
      expect(m?.lines.length, `rank ${r}`).toBeGreaterThan(0)
      for (const l of m.lines) {
        expect(['mon', 'spk']).toContain(l.voice)
        expect(lines[l.words], `rank ${r} ${l.words}`).toBeTruthy()
      }
    }
  })
  it('Management 0–4, the Veteran 5–9 (story.md pacing)', () => {
    for (let r = 0; r <= 9; r++) for (const l of storyFile.moments[String(r)].lines) expect(l.voice).toBe(r < 5 ? 'mon' : 'spk')
  })
  it('whispers: none before 3, "cold" once at 3–7, a feeling every shift from 8', () => {
    expect(whisperFor(2, false, 0.5)).toBeNull()
    expect(whisperFor(3, false, 0.5)).toBe('cold')
    expect(whisperFor(7, true, 0.5)).toBeNull()
    for (const pick of [0, 0.4, 0.99]) expect(storyFile.whispers.feelings).toContain(whisperFor(8, true, pick))
    for (const k of [...storyFile.whispers.feelings, 'cold']) expect((en.story.whispers as Record<string, string>)[k]).toBeTruthy()
  })
  it('titles: the bands from story.md, every one with words', () => {
    expect([0, 1, 4, 5, 9, 10, 29, 30, 44, 45, 50].map((r) => titleAt(r))).toEqual(
      ['intern', 'juniorAssociate', 'juniorAssociate', 'associate', 'associate', 'technician', 'leadSpecialist', 'supervisor', 'assistant', 'deputy', 'deputy'])
    for (const id of Object.keys(progression.titles)) expect((en.story.titles as Record<string, string>)[id]).toBeTruthy()
  })
})
