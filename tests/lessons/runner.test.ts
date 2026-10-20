// F30: the lesson runner on its own — a fake game and a hand-turned clock (no browser, no Goops).
import { describe, expect, it } from 'vitest'
import { createLessonRunner, type LessonClock } from '../../src/game/lessons/runner'
import { expandStep } from '../../src/game/lessons/patterns'
import type { Lesson, LessonTiming } from '../../src/game/lessons/lessonTypes'

// A clock that only moves when the test says so (like the rules clock under the Dev Kit's pause, until it doesn't).
function handClock() {
  let now = 0
  const timers = new Set<{ at: number; every: number; fn: () => void }>()
  const add = (ms: number, fn: () => void, every: number) => { const t = { at: now + ms, every, fn }; timers.add(t); return () => { timers.delete(t) } }
  const clock: LessonClock = { after: (ms, fn) => add(ms, fn, 0), every: (ms, fn) => add(ms, fn, ms) }
  const run = (ms: number) => {
    const end = now + ms
    for (;;) {
      const due = [...timers].filter((t) => t.at <= end).sort((a, b) => a.at - b.at)[0]
      if (!due) break
      now = due.at
      if (due.every) due.at += due.every
      else timers.delete(due)
      due.fn()
    }
    now = end
  }
  return { clock, run, count: () => timers.size }
}

const TIMING: LessonTiming = { dismissArmSeconds: 0.3, betweenStepsSeconds: 0, slowSpeed: 0.25, gatePollMs: 100 }

function setup(lesson: Lesson) {
  const { clock, run, count } = handClock()
  const log: string[] = []
  const gates: Record<string, number> = {}
  let speed = 1, input = true, only: string[] | undefined
  const seen = new Set<string>()
  const runner = createLessonRunner({
    clock, timing: () => TIMING,
    game: {
      setup: (s) => log.push(JSON.stringify(s)),
      gate: (name) => gates[name] ?? null,
      setSpeed: (s, i, o) => { speed = s; input = i; only = o },
      seen: (id) => seen.has(id), markSeen: (id) => seen.add(id),
      finished: (id) => log.push(`finished ${id}`),
    },
  })
  return { runner, run, log, gates, count, seen, speed: () => speed, input: () => input, only: () => only, lesson: () => lesson }
}

const lesson: Lesson = {
  id: 'test',
  finish: { free: true },
  steps: [
    { id: 'hello', pattern: 'pauseShowDismiss', message: 'hello', setup: { a: 1 } },
    { id: 'drop', message: 'drop', advance: { on: 'event', event: 'lock' }, hint: { after: 5, message: 'dropHint' } },
    { id: 'fall', pattern: 'positionGated', advance: { on: 'gate', gate: 'position', atLeast: 6 }, message: 'falls' },
  ],
}

describe('the lesson runner', () => {
  it('insist (F32): the SAME message, then — when its gate holds — paused, dimmed, only the named controls; once; doing it moves on', () => {
    const t = setup({ id: 'i', steps: [
      { id: 'go', message: 'go', pointer: { tag: 'bar' }, advance: { on: 'event', event: 'consoleOpened' },
        insist: { when: { on: 'gate', gate: 'insist', atLeast: 1 }, only: ['console'] } },
      { id: 'next', message: 'next' },
    ] })
    t.runner.start(t.lesson)
    const first = t.runner.view().message!
    expect(first.dim).toBe(false)
    expect(first.waitsForDismiss).toBe(false)
    expect(t.speed()).toBe(1) // shown while the game runs
    t.run(1000)
    expect(t.runner.view().message).toBe(first) // not yet
    t.gates.insist = 1
    t.run(100)
    const insisting = t.runner.view().message!
    expect(insisting.text).toBe('go') // one message: the same words
    expect(insisting.insisting).toBe(true)
    expect(insisting.dim).toBe(true)
    expect(insisting.waitsForDismiss).toBe(false) // no Got it: only doing it moves on
    expect(t.speed()).toBe(0)
    expect(t.input()).toBe(false)
    expect(t.only()).toEqual(['console'])
    t.run(1000) // the gate still holds: shown once, not again and again
    expect(t.runner.view().message).toBe(insisting)
    t.runner.event('consoleOpened')
    expect(t.runner.view().stepId).toBe('next')
    expect(t.speed()).toBe(1)
    expect(t.only()).toBeUndefined()
  })

  it('a step with a pointer and no message only points (F32: the spotlight, no words, nothing to close)', () => {
    const t = setup({ id: 'p', steps: [{ id: 'look', pointer: { tag: 'periscope' }, dim: true, advance: { on: 'event', event: 'consoleClosed' } }] })
    t.runner.start(t.lesson)
    const m = t.runner.view().message!
    expect(m.text).toBe('')
    expect(m.pointer).toEqual({ tag: 'periscope' })
    expect(m.dim).toBe(true)
    expect(m.waitsForDismiss).toBe(false)
    t.runner.event('consoleClosed')
    expect(t.runner.view().done).toBe(true)
  })

  it('plays a lesson: pause-show-dismiss, act to advance, a gate, then finish', () => {
    const t = setup(lesson)
    t.runner.start(t.lesson)
    expect(t.runner.view().stepId).toBe('hello')
    expect(t.speed()).toBe(0) // paused while the message shows
    expect(t.input()).toBe(false)
    t.runner.dismiss() // too early: not armed yet
    expect(t.runner.view().stepId).toBe('hello')
    t.run(300)
    expect(t.runner.view().message!.armed).toBe(true)
    t.runner.dismiss()
    expect(t.runner.view().stepId).toBe('drop')
    expect(t.speed()).toBe(1)
    t.runner.event('lock')
    expect(t.runner.view().stepId).toBe('fall')
    t.gates.position = 3
    t.run(500)
    expect(t.runner.view().stepId).toBe('fall')
    t.gates.position = 7
    t.run(100)
    expect(t.runner.view().done).toBe(true)
    expect(t.log).toEqual(['{"a":1}', '{"free":true}', 'finished test'])
    expect(t.count()).toBe(0) // no timer left behind
  })

  it('wait-then-hint: the hint shows after the wait, and never if the player acts first', () => {
    const t = setup(lesson)
    t.runner.start(t.lesson, 1)
    t.run(4900)
    expect(t.runner.view().message!.kind).toBe('step')
    t.run(200)
    expect(t.runner.view().message!.text).toBe('dropHint')

    t.runner.start(t.lesson, 1)
    t.run(2000)
    t.runner.event('lock')
    t.run(10_000)
    expect(t.runner.view().stepId).toBe('fall')
    expect(t.runner.view().message!.text).toBe('falls')
  })

  it('timers stand still while the clock does (the Dev Kit pause)', () => {
    const t = setup(lesson)
    t.runner.start(t.lesson, 1)
    // the hand clock doesn't move: nothing fires however long the test "waits"
    expect(t.runner.view().message!.kind).toBe('step')
    t.run(4999)
    expect(t.runner.view().message!.kind).toBe('step')
  })

  it('event filters: a pop that sealed at least one crack', () => {
    const t = setup({ id: 'f', steps: [{ id: 'seal', advance: { on: 'event', event: 'pop', where: { sealed: 1 } } }] })
    t.runner.start(t.lesson)
    t.runner.event('pop', { sealed: [] })
    expect(t.runner.view().done).toBe(false)
    t.runner.event('pop', { sealed: [4] })
    expect(t.runner.view().done).toBe(true)
  })

  it('retry: its set-up runs again on each miss and counts tries; after max it moves on', () => {
    const t = setup({ id: 'r', steps: [{ id: 'aim', advance: { on: 'event', event: 'pop' },
      retry: { when: { on: 'event', event: 'miss' }, setup: { crack: 1 }, message: 'again', max: 2 } }] })
    t.runner.start(t.lesson)
    t.runner.event('miss')
    expect(t.runner.view().message).toMatchObject({ kind: 'retry', tries: 1 })
    t.run(300); t.runner.dismiss()
    t.runner.event('miss')
    expect(t.log.filter((l) => l === '{"crack":1}')).toHaveLength(2)
    t.run(300); t.runner.dismiss()
    t.runner.event('miss') // the third miss: past max → on
    expect(t.runner.view().done).toBe(true)
  })

  it('an interrupt pauses any step once and the step carries on exactly where it was', () => {
    const t = setup({ id: 'i', interrupts: [{ id: 'away', when: { on: 'event', event: 'offscreen' }, message: 'look', remember: true }],
      steps: [{ id: 'work', message: 'work', advance: { on: 'event', event: 'done' } }] })
    t.runner.start(t.lesson)
    t.runner.event('offscreen')
    expect(t.runner.view().message!.text).toBe('look')
    expect(t.speed()).toBe(0)
    t.run(300); t.runner.dismiss()
    expect(t.runner.view().message!.text).toBe('work') // back to the step's own message
    expect(t.speed()).toBe(1)
    t.runner.event('offscreen') // once only
    expect(t.runner.view().message!.text).toBe('work')
    expect(t.seen.has('interrupt:away')).toBe(true)
  })

  it('skip-ahead: a step whose gate is already true is skipped', () => {
    const t = setup({ id: 's', steps: [{ id: 'one', skipIf: { on: 'gate', gate: 'pressure', atLeast: 50 }, message: 'x' }, { id: 'two', message: 'y' }] })
    t.gates.pressure = 60
    t.runner.start(t.lesson)
    expect(t.runner.view().stepId).toBe('two')
  })

  it('skip-ahead with a list: any gate that holds skips the step (F32)', () => {
    const t = setup({ id: 's', steps: [{ id: 'one', message: 'x',
      skipIf: [{ on: 'gate', gate: 'atConsole', atLeast: 1 }, { on: 'gate', gate: 'broken', atMost: 0 }] }, { id: 'two', message: 'y' }] })
    t.gates.atConsole = 0; t.gates.broken = 1
    t.runner.start(t.lesson)
    expect(t.runner.view().stepId).toBe('one')
    t.gates.broken = 0
    t.runner.start(t.lesson)
    expect(t.runner.view().stepId).toBe('two')
  })

  it('a reaction says something else until its `until`, then the step\'s own message comes back (F32)', () => {
    const t = setup({ id: 'r', steps: [{ id: 'go', message: 'go', advance: { on: 'event', event: 'opened' },
      reactions: [{ when: { on: 'event', event: 'pauseOpened' }, message: 'pauseMenu', until: { on: 'event', event: 'pauseClosed' } }] },
    { id: 'next', message: 'next' }] })
    t.runner.start(t.lesson)
    t.runner.event('pauseOpened')
    expect(t.runner.view().message).toMatchObject({ kind: 'reaction', text: 'pauseMenu', waitsForDismiss: false })
    expect(t.speed()).toBe(1) // (the game's speed stays as it was)
    t.runner.event('pauseClosed')
    expect(t.runner.view().message).toMatchObject({ kind: 'step', text: 'go' })
    t.runner.event('pauseOpened')
    t.runner.event('opened') // the step moves on under a reaction: the reaction ends with it
    expect(t.runner.view()).toMatchObject({ stepId: 'next', message: { text: 'next' } })
    t.runner.event('pauseClosed')
    expect(t.runner.view().message!.text).toBe('next')
  })

  it('a lesson queued behind another plays when the first finishes', () => {
    const t = setup(lesson)
    const second: Lesson = { id: 'second', steps: [{ id: 'only', message: 'hi' }] }
    t.runner.start(() => ({ id: 'first', steps: [{ id: 'a', advance: { on: 'event', event: 'go' } }] }))
    t.runner.queue(() => second)
    t.runner.event('go')
    expect(t.runner.view().lessonId).toBe('second')
  })

  it('once a lesson has finished, a queued one starts at once (F32: nothing is left "running")', () => {
    const t = setup(lesson)
    t.runner.start(() => ({ id: 'first', steps: [{ id: 'a', advance: { on: 'event', event: 'go' } }] }))
    t.runner.event('go')
    expect(t.runner.view()).toMatchObject({ lessonId: null, done: true })
    t.runner.queue(() => ({ id: 'later', steps: [{ id: 'b', message: 'hi' }] }))
    expect(t.runner.view().lessonId).toBe('later')
  })

  it('restart point: the last checkpoint at or before a step', () => {
    const t = setup(lesson)
    const l: Lesson = { id: 'c', steps: [{ id: 'a' }, { id: 'b', checkpoint: true }, { id: 'c' }, { id: 'd' }] }
    expect(t.runner.restartPoint(l, 3)).toBe(1)
    expect(t.runner.restartPoint(l, 0)).toBe(0)
  })

  it('patterns fill in what a step leaves out; the step wins', () => {
    expect(expandStep({ id: 'x', pattern: 'pauseShowDismiss' })).toMatchObject({ while: 'pause', advance: { on: 'dismiss' } })
    expect(expandStep({ id: 'x', pattern: 'positionGated', advance: { atLeast: 10 } as never }).advance).toEqual({ on: 'gate', gate: 'position', atLeast: 10 })
    expect(expandStep({ id: 'x', pattern: 'waitThenHint' }).hint).toBeUndefined()
  })
})

// F31 (the Sprint 10 spike): what day one's 15 steps need from the runner (.planning/research/tutorial.md §9).
describe('the lesson runner, day one additions', () => {
  it('event `if`: a landing only counts as a miss while the crack is still unplugged (D2 retry)', () => {
    const t = setup({ id: 'd2', steps: [{ id: 'spin', message: 'spin', advance: { on: 'event', event: 'plug' },
      retry: { when: { on: 'event', event: 'lock', if: { on: 'gate', gate: 'plugged', atMost: 0 } }, setup: { cracks: [['inView', 0, 'green']] }, message: 'again' } },
    { id: 'seal', message: 'seal' }] })
    t.gates.plugged = 0
    t.runner.start(t.lesson)
    t.runner.event('lock') // a miss: the crack is still open
    expect(t.runner.view().message!.kind).toBe('retry')
    expect(t.log.filter((l) => l.includes('inView'))).toHaveLength(1)
    t.run(300); t.runner.dismiss()
    t.gates.plugged = 1 // this landing covered it: not a miss (the plug event moves on)
    t.runner.event('lock')
    expect(t.log.filter((l) => l.includes('inView'))).toHaveLength(1)
    t.runner.event('plug')
    t.run(1)
    expect(t.runner.view().stepId).toBe('seal')
  })

  it('hint `unless`: doing the thing first means no hint, all step long (B2: 3 s without fast-dropping)', () => {
    const t = setup({ id: 'b2', steps: [{ id: 'drop', message: 'drop', advance: { on: 'event', event: 'lock' },
      hint: { after: 3, message: 'dropHint', unless: { on: 'action', action: 'softDrop' } } }] })
    t.runner.start(t.lesson)
    t.run(1000)
    t.runner.action('softDrop')
    t.run(10_000)
    expect(t.runner.view().message!.text).toBe('drop')
  })

  it('hint `unless` after the hint is up: it goes and the step message comes back', () => {
    const t = setup({ id: 'd2', steps: [{ id: 'spin', message: 'spin', advance: { on: 'event', event: 'plug' },
      hint: { after: 3, message: 'spinHint', unless: { on: 'action', action: 'spin' } } }] })
    t.runner.start(t.lesson)
    t.run(3000)
    expect(t.runner.view().message!.text).toBe('spinHint')
    t.runner.action('spin')
    expect(t.runner.view().message!.text).toBe('spin')
  })

  it('hint `from`: the wait starts when the goop is ready, not at the step start (C3: 3 s after it is full)', () => {
    const t = setup({ id: 'c3', steps: [{ id: 'zap', message: 'zap', advance: { on: 'event', event: 'pop' },
      hint: { after: 3, message: 'zapHint', from: { on: 'gate', gate: 'ready:blue', atLeast: 1 } } }] })
    t.gates['ready:blue'] = 0
    t.runner.start(t.lesson)
    t.run(10_000)
    expect(t.runner.view().message!.text).toBe('zap') // never ready yet: no hint
    t.gates['ready:blue'] = 1
    t.run(2900)
    expect(t.runner.view().message!.text).toBe('zap') // (the gate is seen at the next poll, then 3 s)
    t.run(300)
    expect(t.runner.view().message!.text).toBe('zapHint')
  })

  it('hint `again`: each seal starts the wait over (F1: 20 s without a seal)', () => {
    const t = setup({ id: 'f1', steps: [{ id: 'quota', message: 'quota', advance: { on: 'event', event: 'quotaMet' },
      hint: { after: 20, message: 'sealHint', again: { on: 'event', event: 'pop', where: { sealed: 1 } } } }] })
    t.runner.start(t.lesson)
    t.run(15_000)
    t.runner.event('pop', { sealed: [7] })
    t.run(15_000)
    expect(t.runner.view().message!.text).toBe('quota') // 15 s since the seal
    t.run(5000)
    expect(t.runner.view().message!.text).toBe('sealHint')
    t.runner.event('pop', { sealed: [8] }) // a seal takes it down and starts the wait again
    expect(t.runner.view().message!.text).toBe('quota')
    t.run(20_000)
    expect(t.runner.view().message!.text).toBe('sealHint')
  })

  it('interrupt from / to: armed only during those steps (D4 from D2 on; the red X only in E1)', () => {
    const t = setup({ id: 'day', interrupts: [
      { id: 'd4', from: 'd2', when: { on: 'event', event: 'away' }, message: 'arrows' },
      { id: 'redX', from: 'e1', to: 'e1', when: { on: 'event', event: 'wrong' }, message: 'redX' }],
    steps: [{ id: 'd1', message: 'd1' }, { id: 'd2', message: 'd2' }, { id: 'e1', message: 'e1' }, { id: 'f1', message: 'f1' }] })
    t.runner.start(t.lesson)
    t.runner.event('away') // in d1: not armed yet
    t.runner.event('wrong')
    expect(t.runner.view().message!.text).toBe('d1')
    t.run(300); t.runner.dismiss(); t.run(1)
    expect(t.runner.view().stepId).toBe('d2')
    t.runner.event('wrong') // not E1 yet
    expect(t.runner.view().message!.text).toBe('d2')
    t.runner.event('away')
    expect(t.runner.view().message!.text).toBe('arrows')
    t.run(300); t.runner.dismiss()
    t.run(300); t.runner.dismiss(); t.run(1) // d2 → e1
    t.run(300); t.runner.dismiss(); t.run(1) // e1 → f1
    t.runner.event('wrong') // past E1: no red X
    expect(t.runner.view().message!.text).toBe('f1')
  })

  it('ensure: a step makes its interrupt happen only if it has not fired yet (F1: the first crack out of view)', () => {
    const lesson: Lesson = { id: 'day', interrupts: [{ id: 'd4', when: { on: 'event', event: 'away' }, message: 'arrows', remember: true }],
      steps: [{ id: 'e1', message: 'e1' }, { id: 'f1', message: 'f1', ensure: { interrupt: 'd4', setup: { cracks: [['outOfView', 0, 'green']] } } }] }
    const fresh = setup(lesson)
    fresh.runner.start(fresh.lesson)
    fresh.run(300); fresh.runner.dismiss(); fresh.run(1)
    expect(fresh.log.some((l) => l.includes('outOfView'))).toBe(true) // never fired: F1 puts a crack out of view
    const fired = setup(lesson)
    fired.runner.start(fired.lesson)
    fired.runner.event('away') // it fired in E1
    fired.run(300); fired.runner.dismiss()
    fired.run(300); fired.runner.dismiss(); fired.run(1)
    expect(fired.runner.view().stepId).toBe('f1')
    expect(fired.log.some((l) => l.includes('outOfView'))).toBe(false)
    const seenBefore = setup(lesson)
    seenBefore.seen.add('interrupt:d4') // seen on this device on an earlier day (a replay)
    seenBefore.runner.start(seenBefore.lesson, 1)
    expect(seenBefore.log.some((l) => l.includes('outOfView'))).toBe(false)
  })
})
