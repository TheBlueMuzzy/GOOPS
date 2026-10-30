// F75: the Veteran's used-up line in the final shift stays up long enough to type out AND be read — worked out from the
// talking bubble's own typing (kit stepTalk with the game's talk.json feel), not guessed.
import { expect, it } from 'vitest'
import { TALK_GROW_MS, startTalk, stepTalk, talkFeel } from '../src/ui/kit/blocks/talkingBubble'
import talk from '../content/tuning/talk.json'
import finalShift from '../content/tuning/finalShift.json'
import en from '../content/text/en.json'

// seconds from the bubble opening until its whole line shows (grow + the pause before typing + the letters + rests)
function secondsToType(text: string): number {
  const s = startTalk(), feel = talkFeel(talk), dt = 1 / 120
  let t = 0
  while (s.phase !== 'wait' && t < 30) { stepTalk(s, dt, text, feel, () => 0.5); t += dt }
  return t
}

it('his used-up line types out and stays up a second more to read (finalShift.json goneLineSec)', () => {
  const typing = secondsToType(en.finalShift.vet.gone)
  expect(typing).toBeGreaterThan(TALK_GROW_MS / 1000)
  expect(finalShift.goneLineSec).toBeGreaterThanOrEqual(typing + 1)
})
