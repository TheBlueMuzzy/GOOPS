// F35: which story moments are due at the console — and every moment's words exist.
import { describe, expect, it } from 'vitest'
import en from '../../content/text/en.json'
import { ladder, rankOf } from '../../src/progress/ladder'
import { dueMoments, monitorDeniesVoices, storyFile, storyWords, whisperFor, whisperStage } from '../../src/game/lessons/storyMoments'
import { maxRank } from '../../src/progress/ladder'
import { titleAt } from '../../src/progress/progression'

const none = () => false
// (F79: ranks asked of the ladder) the story moments at a rank, in the order they play
const idsAt = (rank: number) => ladder.group('story').filter((m) => m.rank === rank).map((m) => m.name)
const storyRank = (id: string) => rankOf(`story.${id}`)
describe('story moments', () => {
  it('a fresh rank-0 device: the rank-0 moment', () => {
    expect(dueMoments(0, none)).toEqual(['0'])
  })
  // (the ranks that carry moments, lowest first)
  const storyRanks = () => [...new Set(ladder.group('story').map((m) => m.rank))].sort((a, b) => a - b)
  it('one rank-up: just that rank', () => {
    const r = storyRank('4')
    expect(dueMoments(r, (id) => storyRank(id) < r)).toEqual(idsAt(r))
  })
  it('F80: a rank-up onto a rank with several moments plays every one of them, in the ladder\'s order', () => {
    const r = storyRanks().find((x) => idsAt(x).length > storyFile.catchUp)!
    expect(r, 'a rank with more moments than catchUp').toBeDefined()
    expect(dueMoments(r, (id) => storyRank(id) < r)).toEqual(idsAt(r))
  })
  it('two rank-ups in one shift: both, oldest first', () => {
    const r = storyRank('4')
    expect(dueMoments(r + 1, (id) => storyRank(id) < r)).toEqual([...idsAt(r), ...idsAt(r + 1)])
  })
  it('a device that skipped many: only the newest catchUp ranks\' moments', () => {
    const r = storyRank('9'), ranks = storyRanks().filter((x) => x <= r).slice(-storyFile.catchUp)
    expect(dueMoments(r, none)).toEqual(ranks.flatMap(idsAt))
  })
  it('F80: the story keeps its order — a later moment never plays at an earlier rank', () => {
    const ids = Object.keys(storyFile.moments).sort((a, b) => Number(a) - Number(b))
    for (let i = 1; i < ids.length; i++) expect(storyRank(ids[i]), `moment ${ids[i]}`).toBeGreaterThanOrEqual(storyRank(ids[i - 1]))
    // and on a shared rank they play in that order too
    for (const r of storyRanks()) expect(idsAt(r)).toEqual([...idsAt(r)].sort((a, b) => Number(a) - Number(b)))
  })
  it('F80: the quiet after the capture — no moment between the Veteran\'s capture and the white goop; every other rank has one', () => {
    const caught = rankOf('veteranCaught'), back = rankOf('whiteGoop')
    expect(back - caught, 'at least one quiet rank').toBeGreaterThan(1)
    for (let r = 0; r <= maxRank(); r++) {
      const quiet = r > caught && r < back
      expect(idsAt(r).length > 0, `rank ${r}${quiet ? ' (quiet)' : ''}`).toBe(!quiet)
    }
    // the capture (moment 30: cut off, then the alarm) plays on the capture rank; the takeover's ranks all carry the story
    expect(idsAt(caught)).toContain('30')
    for (const b of ['takeover1', 'takeover2', 'takeover3', 'takeover4']) expect(idsAt(rankOf(b)).length, b).toBeGreaterThan(0)
    expect(idsAt(rankOf('finalShift'))).toEqual(['50'])
  })
  it('everything seen: nothing', () => {
    expect(dueMoments(maxRank(), () => true)).toEqual([])
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
  it('F63: 31–39 — every rank has a moment in the goop\'s voice (head), 35 and 37 are him, 36 says your name', () => {
    const lines = en.story.lines as Record<string, string>
    for (let r = 31; r <= 39; r++) {
      const m = storyFile.moments[String(r)]
      expect(m?.lines.length, `rank ${r}`).toBeGreaterThan(0)
      for (const l of m.lines) {
        expect(l.voice, `rank ${r}`).toBe('head')
        expect(lines[l.words], `rank ${r} ${l.words}`).toBeTruthy()
        expect(!!l.him, `rank ${r} him`).toBe(r === 35 || r === 37)
      }
    }
    expect(storyFile.moments['36'].lines.some((l) => lines[l.words].includes('{name}'))).toBe(true)
    expect(storyWords('r36c')).toContain(en.story.sign.fallback) // never signed (no save here): Operator #4471
  })
  it('F45: 40–49 — every rank has a moment; the speaker is back: him (spk), the goop (goop at 41, 43, 48), Management slipping (45, 47)', () => {
    const lines = en.story.lines as Record<string, string>
    const voices: Record<number, string> = { 40: 'spk', 41: 'goop', 42: 'spk', 43: 'goop', 44: 'spk', 45: 'mon', 46: 'spk', 47: 'mon', 48: 'goop', 49: 'spk' }
    for (let r = 40; r <= 49; r++) {
      const m = storyFile.moments[String(r)]
      expect(m?.lines.length, `rank ${r}`).toBeGreaterThan(0)
      for (const l of m.lines) {
        expect(l.voice, `rank ${r}`).toBe(voices[r])
        expect(lines[l.words], `rank ${r} ${l.words}`).toBeTruthy()
        if (l.monitor) expect(['flicker', 'alarm', 'glitch']).toContain(l.monitor)
        if (l.voice === 'mon') expect(lines[l.words]).toBe(lines[l.words].toUpperCase()) // Management types in capitals
      }
    }
    expect(storyFile.moments['40'].lines[0].crackle).toBe(true) // the speaker crackles back to life
    expect(storyFile.moments['43'].lines.some((l) => l.monitor === 'flicker')).toBe(true)
    // 45: the slip types, is cut (no Got it) and corrects itself, with the glitch
    const slip = storyFile.moments['45'].lines
    expect(slip[0]).toMatchObject({ voice: 'mon', monitor: 'glitch', cut: true })
    expect(lines[slip[0].words]).toContain('HUMAN RESOURCE.')
    expect(lines[slip[1].words].startsWith('*OPERATOR.')).toBe(true)
    // 46 and 47: the hatch under the console rattles and is outlined
    for (const r of [46, 47]) {
      expect(storyFile.moments[String(r)].look, `rank ${r}`).toBe('hatch')
      expect(storyFile.moments[String(r)].lines.some((l) => l.rattle), `rank ${r}`).toBe(true)
    }
    expect(storyFile.moments['49'].lines[0]).toMatchObject({ monitor: 'flicker', crackle: true })
    // F64 50: Management's final review, with the red alarm (the Veteran's lines are the final shift's drop-in)
    expect(storyFile.moments['50'].lines).toEqual([{ voice: 'mon', words: 'r50', monitor: 'alarm' }])
    expect(lines.r50).toBe('FINAL PERFORMANCE REVIEW IN PROGRESS. PRESSURE INCREASED 400%.')
    // the looks' numbers are there
    const L = storyFile.looks
    expect(['wave', 'plain']).toContain(L.goopOutline)
    for (const n of [L.glitchAfterSeconds, L.glitchSeconds, L.rattleSeconds, L.rattleShake, L.rattleTimes]) expect(n).toBeGreaterThan(0)
  })
  it('every line has a voice and flags the runner knows', () => {
    const known = new Set(['voice', 'words', 'monitor', 'crackle', 'cut', 'sign', 'him', 'rattle'])
    for (const [r, m] of Object.entries(storyFile.moments)) for (const l of m.lines) {
      expect(['mon', 'spk', 'head', 'goop'], `rank ${r}`).toContain(l.voice)
      for (const k of Object.keys(l)) expect(known.has(k), `rank ${r} ${k}`).toBe(true)
    }
  })
  it('F74: the rank lock\'s moment — Management on the monitor (its caps voice), the meter outlined, every line with words', () => {
    const lock = storyFile.events?.rankLock
    expect(lock?.look).toBe('meter')
    expect(lock?.lines.length).toBeGreaterThan(0)
    for (const l of lock!.lines) {
      expect(l.voice).toBe('mon')
      const words = (en.story.lines as Record<string, string>)[l.words]
      expect(words, l.words).toBeTruthy()
      expect(words).toBe(words.toUpperCase())
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
  // the whisper beats (ladder.json): cold once, then feelings, single words, names
  const [COLD, FEEL, WORDS, NAMES] = ['whisperCold', 'whispersFeelings', 'whispersWords', 'whispersNames'].map((b) => rankOf(b))
  it('whispers: none before whisperCold, "cold" once from it, a feeling every shift from whispersFeelings', () => {
    expect(whisperFor(COLD - 1, false, 0.5)).toBeNull()
    expect(whisperFor(COLD, false, 0.5)).toBe('cold')
    expect(whisperFor(FEEL - 1, true, 0.5)).toBeNull()
    for (const pick of [0, 0.4, 0.99]) expect(['warm', 'tight', 'nnn']).toContain(whisperFor(FEEL, true, pick))
  })
  it('F40 whisper stages: feelings, then single words, then names (story.md), each from its beat', () => {
    const at = (rank: number) => new Set([0, 0.2, 0.4, 0.6, 0.8, 0.99].map((pick) => whisperFor(rank, true, pick)))
    for (const r of [FEEL, WORDS - 1]) expect([...at(r)].every((k) => ['warm', 'tight', 'nnn'].includes(k!))).toBe(true)
    for (const r of [WORDS, NAMES - 1]) expect([...at(r)].every((k) => ['dont', 'heavy', 'hold'].includes(k!))).toBe(true)
    for (const r of [NAMES, maxRank()]) expect([...at(r)].every((k) => ['odile', 'bram', 'ines', 'teodor'].includes(k!))).toBe(true)
    expect(whisperStage(WORDS - 1)?.from).toBe(FEEL)
    expect(whisperStage(WORDS)?.from).toBe(WORDS)
    expect(whisperStage(NAMES)?.from).toBe(NAMES)
    expect(whisperStage(FEEL - 1)).toBeNull()
    // the stages' order in the file doesn't matter: the highest one reached wins
    const shuffled = { ...storyFile.whispers, stages: [...storyFile.whispers.stages].reverse() }
    expect(whisperStage(NAMES - 1, shuffled)?.from).toBe(WORDS)
    // every whisper has words
    for (const k of [...storyFile.whispers.stages.flatMap((s) => s.say), 'cold']) expect((en.story.whispers as Record<string, string>)[k], k).toBeTruthy()
  })
  it('F40: Management denies the voices from the noVoices beat, and its line has words', () => {
    const from = rankOf('noVoices')
    expect(monitorDeniesVoices(from - 1)).toBe(false)
    expect(monitorDeniesVoices(from)).toBe(true)
    expect(monitorDeniesVoices(maxRank())).toBe(true)
    expect((en.story.lines as Record<string, string>).noVoices).toMatch(/NO VOICES/)
  })
  it('titles: the bands from story.md, every one with words', () => {
    // (story.md's order; each from its rank in ladder.json titles, the one before until then)
    const order = ['intern', 'juniorAssociate', 'associate', 'technician', 'seniorTechnician', 'specialist', 'leadSpecialist', 'supervisor', 'seniorSupervisor', 'assistant', 'deputy']
    expect(ladder.group('titles').map((t) => t.name)).toEqual(order)
    order.forEach((id, i) => {
      const from = rankOf(`titles.${id}`)
      expect(titleAt(from), id).toBe(id)
      if (i > 0) expect(titleAt(from - 1), `before ${id}`).toBe(order[i - 1])
    })
    expect(titleAt(maxRank())).toBe('deputy')
    for (const id of ladder.group('titles').map((t) => t.name)) expect((en.story.titles as Record<string, string>)[id]).toBeTruthy()
  })
})
