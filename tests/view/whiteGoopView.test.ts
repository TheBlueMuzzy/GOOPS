// F64: the white goop's look shrinks with him in the final shift — it eases to state.vet.size over whiteGoop.json
// shrinkSec (src/view/whiteGoopView.ts), on the goo's clock (no steps = no change).
import { describe, expect, it } from 'vitest'
import { createShift, type WhiteGoopConfig } from '../../src/engine'
import type { FinalShiftConfig } from '../../src/engine/finalShift'
import { createWhiteGoopView } from '../../src/view/whiteGoopView'
import finalJson from '../../content/tuning/finalShift.json'
import whiteGoopJson from '../../content/tuning/whiteGoop.json'
import { realConfig } from '../engine/helpers'

describe('the white goop view', () => {
  it('shrinks to his size over shrinkSec, and only while the goo clock runs', () => {
    const shift = createShift(realConfig(), { seed: 1, rank: 50, finalShift: structuredClone(finalJson) as FinalShiftConfig,
      whiteGoop: structuredClone(whiteGoopJson) as WhiteGoopConfig })
    const s = shift.state
    const view = createWhiteGoopView()
    view.step(s, [], 1 / 60, null)
    expect(view.report().shown).toBeCloseTo(1, 6)
    s.vet!.size = 0.5
    expect(view.report().shown).toBeCloseTo(1, 6) // (nothing until the next step)
    view.step(s, [], 1 / 60, null)
    expect(view.report().shown).toBeLessThan(1)
    expect(view.report().shown).toBeGreaterThan(0.9) // (eases, doesn't jump)
    for (let k = 0; k < Math.ceil(whiteGoopJson.shrinkSec * 60 * 2); k++) view.step(s, [], 1 / 60, null)
    expect(view.report().shown).toBeCloseTo(0.5, 2)
  })
})
