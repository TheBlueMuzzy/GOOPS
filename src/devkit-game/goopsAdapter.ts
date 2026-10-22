// Goops plugged into the Dev Kit (src/devkit/devkitGame.ts): Snapshots, Bug capture and the Pause buttons.
// Loaded only with the Dev Kit (from tabs.ts), so none of this ships once the Dev Kit is off.
//   getState / setState — the running shift as plain JSON (src/engine/snapshot.ts); restoring makes a new engine
//     through App (session.restore), on the tank straight away. No shift yet → { shift: null } (restoring it = the console).
//   Pause — Goops runs on the shared clocks (src/devkit/gameClock.ts): the frame loop ticks the engine by
//     rulesClock.rate and takes its time from looksClock, so the Dev Kit's ⏸ / ◐ need nothing more from the game.
//     ◐ Half: the engine stands still; crack pulses, the ready glow, lamps, the drop guide's wave, the readout and the
//     goo's jiggle keep going (content/tuning/pause.json halfPauseGooMoves turns the goo off too).
import type { DevKitGame } from '../devkit/devkitGame'
import type { ShiftEvent, ShiftState } from '../engine'
import { readSnapshot, type ShiftSnapshot } from '../engine/snapshot'
import { session } from '../game/session'
import { versionLabel } from '../version'
import en from '../../content/text/en.json'

type GoopsMoment = { shift: ShiftSnapshot | null }

const pct = (n: number) => `${Math.round(n * 100)}%`

/** One short line per engine event worth reading in a bug capture (the frame-by-frame ones are left out). */
export function eventLine(e: ShiftEvent): string | null {
  switch (e.type) {
    case 'lock': return `piece landed (${e.cells.length} cells, colour ${e.color})`
    case 'pop': return `zapped ${e.cells.length} cells of colour ${e.color}${e.sealed.length ? ` — sealed ${e.sealed.length} crack${e.sealed.length > 1 ? 's' : ''}` : ''}`
    case 'crack': return `new crack at ${e.crack.x},${e.crack.y} (colour ${e.crack.color})`
    case 'plug': return e.plugged ? `crack ${e.crackId} plugged` : null
    case 'quotaMet': return 'crack quota met'
    case 'rupture': return `RUPTURE (${e.reason === 'overflow' ? 'no room for the next piece' : 'too many open cracks'})`
    case 'end': return `shift over: ${e.status}`
    case 'hold': return 'swapped with the next piece'
    case 'breakdown': return `${e.machine} BROKE`
    case 'repaired': return `${e.machine} repaired`
    case 'prime': return `broken laser: group ${e.groupId} primed (zap again)`
    case 'ability': return `ability fired: ${e.id}`
    case 'abilityReady': return `ability ready: ${e.id}`
    case 'reject': return e.action === 'pop' && e.reason ? `zap refused (${e.reason === 'aboveLine' ? 'above the pressure line' : 'still filling'})` : null
    default: return null // spawn, step, spin, rotate, fall, merge, ready… (many a second)
  }
}

/** "rank 6 · score 1240 · cracks 3/10 · pressure 54% · integrity 80%" */
export function describeShift(s: Pick<ShiftState, 'rank' | 'score' | 'cracksSealed' | 'cracksNeeded' | 'pressure' | 'integrity' | 'phase' | 'status'>): string {
  const parts = [`rank ${s.rank}`, `score ${s.score}`, `cracks ${s.cracksSealed}/${s.cracksNeeded}`, `pressure ${pct(s.pressure)}`, `integrity ${pct(s.integrity)}`]
  if (s.status !== 'playing') parts.push(s.status === 'won' ? 'WON' : 'LOST')
  else if (s.phase === 'rupture') parts.push('RUPTURE')
  return parts.join(' · ')
}

export const goopsAdapter: DevKitGame = {
  name: 'Goops',
  version: versionLabel, // "vX.Y.Z.B" — the same words as the console footer (src/version.ts)
  getState: (): GoopsMoment => ({ shift: session.inShift && session.engine ? session.engine.snapshot() : null }),
  setState(state) {
    const moment = state as Partial<GoopsMoment> | null
    if (!moment || typeof moment !== 'object' || !('shift' in moment)) throw new Error('That isn\'t a Goops moment (no "shift" in it).')
    const shift = moment.shift === null ? null : readSnapshot(moment.shift) // junk → a plain reason
    if (!session.restore) throw new Error('The game isn\'t ready to restore yet — try again in a second.')
    session.restore(shift)
  },
  canRestore: () => true, // offline game
  onEvent: (send) => session.listen((events) => {
    for (const e of events) {
      const line = eventLine(e)
      if (line) send(line)
    }
  }),
  describe(state) {
    const shift = (state as GoopsMoment | null)?.shift
    if (!shift) return 'on the console (no shift running)'
    const st = shift.state
    return describeShift({ ...st, rank: shift.options.rank })
  },
  pauseModes: ['full', 'half'], // (the clocks do the work — see the top)
  // check:framework's play checks (Dev Kit 0.19+): from the console to a running shift, as e2e/start.mjs does it —
  // rank 6 (all three machines), lessons already seen on this device, tap the periscope, wait for the console to slide away
  conformance: {
    query: '?rank=6&seed=7',
    async startPlay() {
      const w = window as unknown as { __goopsSeen?: (ids: string[]) => void }
      const until = async (ok: () => boolean, what: string, ms = 25000) => {
        const end = Date.now() + ms
        while (!ok()) {
          if (Date.now() > end) throw new Error(`Goops startPlay: ${what} didn't happen in ${ms / 1000} s`)
          await new Promise((r) => requestAnimationFrame(r))
        }
      }
      await until(() => !!startButton(), 'the console with its Start shift button')
      w.__goopsSeen?.( // (dev builds only — the checks run on the dev server)
['lesson:unlock-window', 'lesson:unlock-swap', 'lesson:first-day'])
      startButton()?.click()
      await until(() => session.inShift && session.engine?.state.status === 'playing' && !document.querySelector('.kit-art-stage'), 'a running shift')
    },
  },
}

/** The console's periscope ("Start shift") — the same button a player taps. */
function startButton(): HTMLButtonElement | null {
  return [...document.querySelectorAll('button')].find((b) => !b.disabled && b.getAttribute('aria-label') === en.console.periscope) ?? null
}
