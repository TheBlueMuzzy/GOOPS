// F65 THE ENDING (design/story.md "The ending — save the goop" steps 1–7, TDD D28): its step order, which steps wait
// for the player, and its words.
import { describe, expect, it } from 'vitest'
import { ending, endingSteps, goopWords, stepSeconds, vetSavedLine } from '../../src/game/ending'
import endingFile from '../../content/tuning/ending.json'
import en from '../../content/text/en.json'

describe('the ending', () => {
  it('plays story.md steps 1–7 in order: the tank (pour, the goop speaks) → the console (his last line, quiet, payday, badge, leave, empty) → the end-game screen', () => {
    const steps = endingSteps()
    expect(steps.map((s) => s.id)).toEqual(['pour', ...endingFile.goopLines.map(() => 'goop'), 'vet', 'quiet', 'payday', 'badge', 'leave', 'empty', 'endScreen'])
    // the tank first, then the console — never back
    const at = steps.map((s) => s.at)
    expect(at.lastIndexOf('tank')).toBeLessThan(at.indexOf('console'))
    // the goop's lines in the file's order, each from a face in turn
    expect(steps.filter((s) => s.id === 'goop').map((s) => s.id === 'goop' && [s.words, s.face]))
      .toEqual(endingFile.goopLines.map((w, i) => [w, i % endingFile.mouths.spots.length]))
  })

  it('F75 the happy ending (he made it): after the goop his lines out loud in the tank, then the console WITHOUT the speaker line + quiet', () => {
    const steps = endingSteps(endingFile, true)
    expect(steps.map((s) => s.id)).toEqual(['pour', ...endingFile.goopLines.map(() => 'goop'), ...endingFile.vetLines.map(() => 'vetSays'),
      'payday', 'badge', 'leave', 'empty', 'endScreen'])
    expect(steps.filter((s) => s.id === 'vetSays').map((s) => s.id === 'vetSays' && s.at === 'tank' && s.words)).toEqual(endingFile.vetLines)
    for (const key of endingFile.vetLines) expect(vetSavedLine(key), key).not.toBe(key) // (every line has its words)
    expect(vetSavedLine('didIt')).toBe('you did it, kid.')
    expect(vetSavedLine('earth')).toMatch(/Earth.*family/)
    expect(stepSeconds(steps.find((s) => s.id === 'vetSays')!)).toBeNull() // (waits for a tap)
    // which one plays: start(…, saved) — the view says so (the tank draws his clump)
    ending.start(undefined, true)
    expect(ending.view()).toMatchObject({ saved: true, step: { id: 'pour' } })
    expect(endingSteps(endingFile, false).some((s) => s.id === 'vetSays')).toBe(false)
    ending.stop()
    ending.start()
    expect(ending.view()?.saved).toBe(false)
    for (let i = 0; i < 1 + endingFile.goopLines.length; i++) ending.next()
    expect(ending.view()?.step.id).toBe('vet') // (he's gone: today's ending, the speaker's line)
    ending.stop()
  })

  it('the looks move on by themselves (pour, quiet, leave, empty); every line waits for a tap', () => {
    const P = endingFile.pour, C = endingFile.console
    const timed = Object.fromEntries(endingSteps().map((s) => [s.id, stepSeconds(s)]))
    expect(timed.pour).toBeCloseTo(P.shakeSeconds + P.seconds + P.holdSeconds)
    expect(timed.quiet).toBe(C.quietSeconds)
    expect(timed.leave).toBe(C.leaveSeconds)
    expect(timed.empty).toBe(C.emptySeconds)
    for (const id of ['goop', 'vet', 'payday', 'badge', 'endScreen']) expect(timed[id], id).toBeNull()
  })

  it('the goop thanks you and names itself; {more} = the former employees it doesn\'t name; {name} = yours (or Operator #4471)', () => {
    for (const key of endingFile.goopLines) expect((en.ending.goop as Record<string, string>)[key], key).toBeTruthy()
    expect(goopWords('thanks', null)).toMatch(/thank you/i)
    expect(goopWords('more', null)).toContain((endingFile.paidBy - endingFile.named).toLocaleString('en'))
    expect(goopWords('yours', 'Muzzy')).toContain('Muzzy')
    expect(goopWords('yours', null)).toContain(en.story.sign.fallback)
  })

  it('runs one step at a time to the end-game screen, which only its button leaves; a page opened after the win starts there', () => {
    ending.start()
    expect(ending.view()?.step.id).toBe('pour')
    const steps = endingSteps()
    for (let i = 1; i < steps.length; i++) { ending.next(); expect(ending.view()?.step.id).toBe(steps[i].id) }
    ending.next() // (the end-game screen stays)
    expect(ending.view()?.step.id).toBe('endScreen')
    ending.stop()
    expect(ending.playing()).toBe(false)
    ending.start('endScreen')
    expect(ending.view()?.step.id).toBe('endScreen')
    ending.stop()
  })

  it('the last payday says the debt paid off by the former employees (payslip debt style)', () => {
    expect(en.ending.payday.debtValue.replace('{n}', endingFile.paidBy.toLocaleString('en'))).toBe('0 cr — paid by: 1,312 former employees')
    expect(en.ending.badge.acronym).toBe('GRADUAL ONBOARDING OF PERMANENT STAFF')
    expect(en.ending.vet).toBe("told you you'd make a good veteran, kid.")
  })
})
