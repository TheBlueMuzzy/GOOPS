// In-shift messages (F26): watches the engine's events and state each frame and decides which short message to show.
// It only DECIDES (which words, danger or not, for how long); App shows them as kit toasts, where the Settings row
// "Messages (test)" says (screen centre, or just above the goop). Numbers come from content/tuning/messages.json.
//   refused zap      → "Above the pressure line" / "Still filling"  (at most once per refusedCooldownSeconds)
//   machine broke    → "Laser broken — W or ↑ to fix" / "…flick up…" / "…swipe up…" by input (one per machine, each break)
//   integrity low    → "Tank weak…" once when it falls below integrityLowAt, again only after it climbs back above
//   pressure near max→ once when it reaches pressureHighAt, again only after it drops below pressureHighResetAt
//   quota met, rupture + why (too many open cracks / overflow)
//   wrong colour     → "Wrong colour on a crack…" the first time goop of another colour covers each open crack (F68),
//                      at most once per wrongCoverCooldownSeconds
import type { MachineId, ShiftEvent, ShiftState } from '../engine'
import en from '../../content/text/en.json'

export type MessageKey = keyof typeof en.messages
export interface Message { key: MessageKey; danger: boolean; seconds: number }

export interface MessageTuning {
  seconds: { refused: number; broke: number; integrityLow: number; pressureHigh: number; quotaMet: number; rupture: number; wrongCover: number }
  refusedCooldownSeconds: number
  wrongCoverCooldownSeconds: number
  integrityLowAt: number
  pressureHighAt: number
  pressureHighResetAt: number
}

const BROKE: Record<MachineId, MessageKey> = { laser: 'brokeLaser', visor: 'brokeVisor', controls: 'brokeControls' }

/** A message's words. Some change with the input used last, like the lessons' lines (F38: "W or ↑ to fix" on a
 *  keyboard, "flick up" with a mouse, "swipe up" on a phone): en.json gives those a { keys, mouse, phone } entry. */
export type Input = 'keys' | 'mouse' | 'phone'
export function messageWords(key: MessageKey, input: Input): string {
  const words: string | Record<Input, string> = en.messages[key]
  return typeof words === 'string' ? words : words[input]
}

export function createMessages(tuning: MessageTuning) {
  let lastRefusedAt = -Infinity // ms of the last "refused" message
  let integrityWarned = false
  let pressureWarned = false
  let lastWrongCoverAt = -Infinity // ms of the last "wrong colour on a crack" message
  const wrongCovered = new Set<number>() // the cracks wrong-colour goop has covered already (each one says it once)

  // Call once per frame with the frame's events. nowMs = the page clock (performance.now()), so the cooldown is
  // real time: spam-tapping is a real-time thing, even when the shift runs slower at the console.
  function step(s: ShiftState, events: ShiftEvent[], nowMs: number): Message[] {
    const out: Message[] = []
    const say = (key: MessageKey, seconds: number, danger = false) => out.push({ key, danger, seconds })
    for (const e of events) {
      if (e.type === 'reject' && e.action === 'pop' && (e.reason === 'aboveLine' || e.reason === 'filling')) { // ('lessonColour': the lesson's line says it)
        if (nowMs - lastRefusedAt < tuning.refusedCooldownSeconds * 1000) continue
        lastRefusedAt = nowMs
        say(e.reason === 'aboveLine' ? 'refusedAboveLine' : 'refusedFilling', tuning.seconds.refused)
      }
      if (e.type === 'breakdown') say(BROKE[e.machine], tuning.seconds.broke, true)
      if (e.type === 'quotaMet') say('quotaMet', tuning.seconds.quotaMet)
      if (e.type === 'rupture') say(e.reason === 'overflow' ? 'ruptureOverflow' : 'ruptureCracks', tuning.seconds.rupture, true)
    }
    // the two warnings only matter while the tank still holds (during a rupture it's already lost)
    if (s.phase === 'playing') {
      if (!integrityWarned && s.integrity < tuning.integrityLowAt) { integrityWarned = true; say('integrityLow', tuning.seconds.integrityLow, true) }
      if (!pressureWarned && s.pressure >= tuning.pressureHighAt) { pressureWarned = true; say('pressureHigh', tuning.seconds.pressureHigh, true) }
      // goop of another colour sits on an open crack: it can't plug it (only its own colour does) — the most
      // confusing moment for a new player (Muzzy 2026-10-24), so say it the first time each crack gets covered
      for (const c of s.cracks) {
        const on = s.grid[c.y * s.width + c.x]
        if (on === 0 || on === c.color || wrongCovered.has(c.id)) continue
        wrongCovered.add(c.id)
        if (nowMs - lastWrongCoverAt < tuning.wrongCoverCooldownSeconds * 1000) continue
        lastWrongCoverAt = nowMs
        say('wrongCover', tuning.seconds.wrongCover)
      }
    }
    if (s.integrity > tuning.integrityLowAt) integrityWarned = false
    if (s.pressure < tuning.pressureHighResetAt) pressureWarned = false
    return out
  }
  return { step }
}
