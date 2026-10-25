// F35: which story moments are due at the console — and every moment's words exist.
import { describe, expect, it } from 'vitest'
import en from '../../content/text/en.json'
import progression from '../../content/tuning/progression.json'
import { dueRanks, monitorDeniesVoices, storyFile, whisperFor, whisperStage } from '../../src/game/lessons/storyMoments'
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
  it('every rank 0–30 has a moment, and every line has words', () => {
    const lines = en.story.lines as Record<string, string>
    for (let r = 0; r <= 30; r++) {
      const m = storyFile.moments[String(r)]
      expect(m?.lines.length, `rank ${r}`).toBeGreaterThan(0)
      for (const l of m.lines) {
        expect(['mon', 'spk']).toContain(l.voice)
        expect(lines[l.words], `rank ${r} ${l.words}`).toBeTruthy()
      }
    }
  })
  it('Management 0–4, the Veteran 5–29 (story.md pacing)', () => {
    for (let r = 0; r <= 29; r++) for (const l of storyFile.moments[String(r)].lines) expect(l.voice).toBe(r < 5 ? 'mon' : 'spk')
  })
  it('30 = his capture: the Veteran is cut off, then Management cuts in with the alarm', () => {
    const lines = storyFile.moments['30'].lines
    expect(lines.map((l) => l.voice)).toEqual(['spk', 'mon'])
    expect(lines[0].cut).toBe(true)
    expect(lines[1].monitor).toBe('alarm')
    expect(storyFile.moments['29'].lines[0].cut).toBe(true) // he cuts out mid-word the rank before
  })
  it('whispers: none before 3, "cold" once at 3–7, a feeling every shift from 8', () => {
    expect(whisperFor(2, false, 0.5)).toBeNull()
    expect(whisperFor(3, false, 0.5)).toBe('cold')
    expect(whisperFor(7, true, 0.5)).toBeNull()
    for (const pick of [0, 0.4, 0.99]) expect(['warm', 'tight', 'nnn']).toContain(whisperFor(8, true, pick))
  })
  it('F40 whisper stages: feelings 8–14, single words 15–23, names from 24 (story.md)', () => {
    const at = (rank: number) => new Set([0, 0.2, 0.4, 0.6, 0.8, 0.99].map((pick) => whisperFor(rank, true, pick)))
    for (const r of [8, 14]) expect([...at(r)].every((k) => ['warm', 'tight', 'nnn'].includes(k!))).toBe(true)
    for (const r of [15, 23]) expect([...at(r)].every((k) => ['dont', 'heavy', 'hold'].includes(k!))).toBe(true)
    for (const r of [24, 30]) expect([...at(r)].every((k) => ['odile', 'bram', 'ines', 'teodor'].includes(k!))).toBe(true)
    expect(whisperStage(14)?.from).toBe(8)
    expect(whisperStage(15)?.from).toBe(15)
    expect(whisperStage(24)?.from).toBe(24)
    expect(whisperStage(7)).toBeNull()
    // the stages' order in the file doesn't matter: the highest one reached wins
    const shuffled = { ...storyFile.whispers, stages: [...storyFile.whispers.stages].reverse() }
    expect(whisperStage(20, shuffled)?.from).toBe(15)
    // every whisper has words
    for (const k of [...storyFile.whispers.stages.flatMap((s) => s.say), 'cold']) expect((en.story.whispers as Record<string, string>)[k], k).toBeTruthy()
  })
  it('F40: Management denies the voices from rank 12, and its line has words', () => {
    expect(monitorDeniesVoices(11)).toBe(false)
    expect(monitorDeniesVoices(12)).toBe(true)
    expect(monitorDeniesVoices(30)).toBe(true)
    expect((en.story.lines as Record<string, string>).noVoices).toMatch(/NO VOICES/)
  })
  it('titles: the bands from story.md, every one with words', () => {
    expect([0, 1, 4, 5, 9, 10, 29, 30, 44, 45, 50].map((r) => titleAt(r))).toEqual(
      ['intern', 'juniorAssociate', 'juniorAssociate', 'associate', 'associate', 'technician', 'leadSpecialist', 'supervisor', 'assistant', 'deputy', 'deputy'])
    for (const id of Object.keys(progression.titles)) expect((en.story.titles as Record<string, string>)[id]).toBeTruthy()
  })
})
