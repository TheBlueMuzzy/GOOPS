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
  let speed = 1, input = true
  const seen = new Set<string>()
  const runner = createLessonRunner({
    clock, timing: () => TIMING,
    game: {
      setup: (s) => log.push(JSON.stringify(s)),
      gate: (name) => gates[name] ?? null,
      setSpeed: (s, i) => { speed = s; input = i },
      seen: (id) => seen.has(id), markSeen: (id) => seen.add(id),
      finished: (id) => log.push(`finished ${id}`),
    },
  })
  return { runner, run, log, gates, count, seen, speed: () => speed, input: () => input, lesson: () => lesson }
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
