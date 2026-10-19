// WHICH SOUND FOR WHICH MOMENT (F29) — pure: no audio here, so it's tested in node (tests/sound.test.ts).
// Every sound id the game plays is in SOUNDS below, and each one is in content/audio.json (a test checks both ways).
// shiftSounds() turns one frame's engine events into the sounds to play: one of each per frame (a lock that merges three
// groups is one squelch, not three), a pop sized by how many cells burst (content/tuning/sound.json).
import type { ShiftEvent } from '../engine'
import type { MachineId } from '../engine'
import soundTuning from '../../content/tuning/sound.json'

export const SOUNDS = {
  land: 'goop.land',
  merge: 'goop.merge',
  ready: 'goop.ready',
  pop: 'goop.pop',
  poke: 'goop.poke',
  seal: 'crack.seal',
  crack: 'crack.form',
  rotate: 'piece.rotate',
  spin: 'tank.spin',
  swap: 'piece.swap',
  fastDrop: 'piece.fastDrop',
  laserBreak: 'machine.laser.break',
  visorBreak: 'machine.visor.break',
  controlsBreak: 'machine.controls.break',
  fixed: 'machine.fixed',
  rupture: 'tank.rupture',
  quota: 'shift.quota',
  won: 'shift.won',
  lost: 'shift.lost',
  periscope: 'ui.periscope',
  repairStep: 'ui.repair',
  wrong: 'ui.wrong',
  // the UI kit's control sounds (setControlSound → `ui.${kind}`)
  tap: 'ui.tap',
  back: 'ui.back',
  toggleOn: 'ui.toggle.on',
  toggleOff: 'ui.toggle.off',
} as const
export type SoundId = (typeof SOUNDS)[keyof typeof SOUNDS]

const BREAKS: Record<MachineId, SoundId> = { laser: SOUNDS.laserBreak, visor: SOUNDS.visorBreak, controls: SOUNDS.controlsBreak }

export interface SoundCue {
  id: SoundId
  pitch?: number // semitones added to the sound's own
  volumeDb?: number // dB added to the sound's own
}

export type PopTuning = Pick<typeof soundTuning, 'popSmallCells' | 'popBigCells' | 'popBigPitch' | 'popBigVolumeDb'>

/** A popped group of `cells`: 0 = small (as recorded) … 1 = big (lowest, loudest) */
export function popSize(cells: number, t: PopTuning = soundTuning): number {
  const span = t.popBigCells - t.popSmallCells
  if (span <= 0) return cells >= t.popBigCells ? 1 : 0
  return Math.min(1, Math.max(0, (cells - t.popSmallCells) / span))
}

/** One frame's engine events → the sounds to play, in order, each id at most once (the biggest pop wins). */
export function shiftSounds(events: readonly ShiftEvent[], t: PopTuning = soundTuning): SoundCue[] {
  const cues = new Map<SoundId, SoundCue>()
  const add = (cue: SoundCue) => { if (!cues.has(cue.id)) cues.set(cue.id, cue) }
  let biggestPop = -1
  for (const e of events) {
    switch (e.type) {
      case 'lock': add({ id: SOUNDS.land }); break
      case 'merge': add({ id: SOUNDS.merge }); break
      case 'ready': add({ id: SOUNDS.ready }); break
      case 'pop':
        biggestPop = Math.max(biggestPop, e.cells.length)
        add({ id: SOUNDS.pop })
        if (e.sealed.length) add({ id: SOUNDS.seal })
        break
      case 'reject': if (e.action === 'pop' && e.cell !== undefined) add({ id: SOUNDS.poke }); break // a zap on goop that can't pop: it jiggles
      case 'crack': add({ id: SOUNDS.crack }); break
      case 'rotate': add({ id: SOUNDS.rotate }); break
      case 'spin': case 'move': add({ id: SOUNDS.spin }); break
      case 'hold': add({ id: SOUNDS.swap }); break
      case 'breakdown': add({ id: BREAKS[e.machine] }); break
      case 'repaired': add({ id: SOUNDS.fixed }); break
      case 'rupture': add({ id: SOUNDS.rupture }); break
      case 'quotaMet': add({ id: SOUNDS.quota }); break
      case 'end': add({ id: e.status === 'won' ? SOUNDS.won : SOUNDS.lost }); break
    }
  }
  const pop = cues.get(SOUNDS.pop)
  if (pop) {
    const size = popSize(biggestPop, t)
    if (size > 0) Object.assign(pop, { pitch: size * t.popBigPitch, volumeDb: size * t.popBigVolumeDb })
  }
  return [...cues.values()]
}
