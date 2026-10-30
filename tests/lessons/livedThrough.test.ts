// RANK SELECT's "a player who lived through the ranks before" (src/game/lessons/livedThrough.ts): a jump plays only
// what belongs to the picked rank itself (Muzzy 2026-10-26: RANK SELECT → 50 on a fresh device played the first day's
// lessons on top of the final shift).
import { describe, expect, it } from 'vitest'
import { livedThrough, type LivedThroughFiles } from '../../src/game/lessons/livedThrough'

const files: LivedThroughFiles = {
  machineRank: { laser: 4, visor: 2, controls: 6 },
  unlockAt: (u) => ({ nextPiece: 1, swap: 3, upgrades: 5 })[u],
  consoleNoteVisits: 2,
  coldAt: 3,
  chorusRank: 48,
}

describe('livedThrough', () => {
  it('rank 0 is a brand-new device: nothing seen', () => {
    expect(livedThrough(0, files)).toEqual([])
  })

  it('rank 50: every lesson, note, story moment 0–49 and look before it', () => {
    const seen = livedThrough(50, files)
    for (const id of ['lesson:first-day', 'lesson:unlock-window', 'lesson:unlock-swap', 'lesson:unlock-upgrades',
      'lesson:visor', 'lesson:laser', 'lesson:controls', 'consoleNote:1', 'consoleNote:2', 'whisper:cold', 'look:mouths-open']) {
      expect(seen).toContain(id)
    }
    expect(seen).toContain('story:49')
    expect(seen).not.toContain('story:50') // the picked rank's own moment still plays
  })

  it("the picked rank's own unlock, machine and look still play", () => {
    const at4 = livedThrough(4, files)
    expect(at4).toContain('lesson:visor') // breaks from 2
    expect(at4).not.toContain('lesson:laser') // breaks from 4 — its lesson is this rank's
    expect(at4).toContain('lesson:unlock-swap')
    expect(at4).not.toContain('lesson:unlock-upgrades')
    expect(livedThrough(48, files)).not.toContain('look:mouths-open')
  })

  it('reads the real content files (every machine and unlock found)', () => {
    const seen = livedThrough(50)
    for (const id of ['lesson:visor', 'lesson:laser', 'lesson:controls', 'lesson:unlock-upgrades', 'consoleNote:1']) expect(seen).toContain(id)
  })

  it('no console notes before any machine breaks', () => {
    expect(livedThrough(2, files).some((id) => id.startsWith('consoleNote:'))).toBe(false)
  })
})
