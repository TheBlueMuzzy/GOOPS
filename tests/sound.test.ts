// F29 sound basics: the game's moments → sound ids (src/game/shiftSounds.ts), and content/audio.json is whole —
// every id the game plays is in it, every sound in it is played by something, every file it names is on disk,
// and the audio module reads it without a single warning.
import { describe, expect, it } from 'vitest'
import audioJson from '../content/audio.json'
import soundTuning from '../content/tuning/sound.json'
import { readAudioConfig } from '../src/audio'
import { popSize, shiftSounds, SOUNDS } from '../src/game/shiftSounds'
import type { ShiftEvent } from '../src/engine'

// every sound file on disk (Vite finds them; only the names are used), as 'sfx/sfx_goop_pop_01.mp3'
const onDisk = Object.keys(import.meta.glob('../public/audio/**/*.mp3')).map((p) => p.slice('../public/audio/'.length))
const ids = Object.values(SOUNDS) as string[]
const configured = Object.keys(audioJson.sounds)
const kitControlKinds = ['tap', 'back', 'toggle.on', 'toggle.off'] // the UI kit's ControlSoundKind → `ui.${kind}`
const tuning = { popSmallCells: 4, popBigCells: 16, popBigPitch: -6, popBigVolumeDb: 3 }
const cues = (events: ShiftEvent[]) => shiftSounds(events, tuning).map((c) => c.id)

describe('content/audio.json', () => {
  it('reads without warnings', () => {
    const warnings: string[] = []
    readAudioConfig(audioJson, (w) => warnings.push(w))
    expect(warnings).toEqual([])
  })
  it('has every sound the game plays', () => {
    expect(ids.filter((id) => !configured.includes(id))).toEqual([])
    expect(kitControlKinds.map((k) => `ui.${k}`).filter((id) => !configured.includes(id))).toEqual([])
  })
  it('has no sound nothing plays', () => {
    expect(configured.filter((id) => !ids.includes(id))).toEqual([])
  })
  it('names only files that exist, and every sound has at least one', () => {
    const sounds = audioJson.sounds as Record<string, { files: string[] }>
    for (const [id, s] of Object.entries(sounds)) expect(s.files.length, id).toBeGreaterThan(0)
    const named = Object.values(sounds).flatMap((s) => s.files)
    expect(named.filter((f) => !onDisk.includes(f))).toEqual([])
    expect(onDisk.filter((f) => !named.includes(f)), 'files nothing uses').toEqual([])
  })
  it('the feel tiers point at real sounds', () => {
    for (const id of Object.values(audioJson.tiers)) expect(configured).toContain(id)
  })
  it('menu sounds never vary (Muzzy, 2026-10-10)', () => {
    const sounds = audioJson.sounds as Record<string, { bus: string; randomPitch?: number; randomVolumeDb?: number }>
    for (const [id, s] of Object.entries(sounds)) if (s.bus === 'ui') expect([s.randomPitch ?? 0, s.randomVolumeDb ?? 0], id).toEqual([0, 0])
  })
})

describe('content/tuning/sound.json', () => {
  it('explains every knob', () => {
    const keys = Object.keys(soundTuning).filter((k) => !k.startsWith('_'))
    for (const k of keys) expect(soundTuning._help, k).toHaveProperty(k)
  })
})

describe('shiftSounds: engine events → sounds', () => {
  it('a piece landing and merging: one land, one merge (however many groups joined)', () => {
    expect(cues([{ type: 'lock', cells: [1, 2], color: 1 }, { type: 'merge', groupId: 1 }, { type: 'merge', groupId: 2 }, { type: 'merge', groupId: 3 }]))
      .toEqual([SOUNDS.land, SOUNDS.merge])
  })
  it('a group finishing filling', () => {
    expect(cues([{ type: 'ready', groupId: 4 }])).toEqual([SOUNDS.ready])
  })
  it('a pop, and a pop that seals a crack', () => {
    expect(cues([{ type: 'pop', cells: [1, 2, 3], color: 1, sealed: [] }])).toEqual([SOUNDS.pop])
    expect(cues([{ type: 'pop', cells: [1, 2, 3], color: 1, sealed: [7] }])).toEqual([SOUNDS.pop, SOUNDS.seal])
  })
  it('bigger pops play lower and louder; small ones as recorded', () => {
    const pop = (n: number) => shiftSounds([{ type: 'pop', cells: Array.from({ length: n }, (_, i) => i), color: 1, sealed: [] }], tuning)[0]
    expect(pop(3)).toEqual({ id: SOUNDS.pop })
    expect(pop(10)).toEqual({ id: SOUNDS.pop, pitch: -3, volumeDb: 1.5 })
    expect(pop(40)).toEqual({ id: SOUNDS.pop, pitch: -6, volumeDb: 3 })
    expect([popSize(4, tuning), popSize(16, tuning), popSize(99, tuning)]).toEqual([0, 1, 1])
  })
  it('a refused zap on goop jiggles (poke); other refusals are silent', () => {
    expect(cues([{ type: 'reject', action: 'pop', reason: 'aboveLine', cell: 12 }])).toEqual([SOUNDS.poke])
    expect(cues([{ type: 'reject', action: 'pop' }])).toEqual([])
    expect(cues([{ type: 'reject', action: 'rotate' }])).toEqual([])
  })
  it('cracks, turns, spins and the swap', () => {
    expect(cues([{ type: 'crack', crack: { id: 1, x: 0, y: 5, color: 1, plugged: false } }])).toEqual([SOUNDS.crack])
    expect(cues([{ type: 'rotate', dir: 1 }])).toEqual([SOUNDS.rotate])
    expect(cues([{ type: 'spin', dx: 1 }, { type: 'move', dx: 1 }])).toEqual([SOUNDS.spin]) // (a kick: one tick)
    expect(cues([{ type: 'hold' }])).toEqual([SOUNDS.swap])
  })
  it('each machine breaks with its own sound; a repair has one', () => {
    expect(cues([{ type: 'breakdown', machine: 'laser' }, { type: 'breakdown', machine: 'visor' }, { type: 'breakdown', machine: 'controls' }]))
      .toEqual([SOUNDS.laserBreak, SOUNDS.visorBreak, SOUNDS.controlsBreak])
    expect(cues([{ type: 'repaired', machine: 'visor' }])).toEqual([SOUNDS.fixed])
  })
  it('the big moments: rupture, quota met, the shift ending won / lost', () => {
    expect(cues([{ type: 'rupture', reason: 'integrity' }])).toEqual([SOUNDS.rupture])
    expect(cues([{ type: 'quotaMet' }])).toEqual([SOUNDS.quota])
    expect(cues([{ type: 'end', status: 'won' }])).toEqual([SOUNDS.won])
    expect(cues([{ type: 'end', status: 'lost' }])).toEqual([SOUNDS.lost])
  })
  it('quiet events stay quiet (a step down, a spawn, goop falling, a plug)', () => {
    expect(cues([{ type: 'step' }, { type: 'spawn' }, { type: 'fall', moves: [[1, 31]] }, { type: 'plug', crackId: 1, plugged: true }])).toEqual([])
  })
})
