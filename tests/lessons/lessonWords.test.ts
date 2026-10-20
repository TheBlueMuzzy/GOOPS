// F28 task 7: every lesson line that changes with the input (keys / mouse / phone) has all three wordings, the phone
// one written out (no ⟨slot⟩ placeholder), and the wording picker (lessonWords) hands a phone its own line.
import { describe, expect, it } from 'vitest'
import { lessonWords } from '../../src/game/lessons/goopsLessons'
import text from '../../content/text/en.json'

type Words = string | { keys?: string; mouse?: string; phone?: string }
const book = (text as unknown as { lessons: Record<string, Record<string, Words> | string> }).lessons
const files = import.meta.glob<{ steps: unknown }>('../../content/lessons/*.json', { eager: true, import: 'default' })
const lessons = Object.entries(files).map(([path, lesson]) => ({ id: path.replace(/^.*\/|\.json$/g, ''), lesson }))
const lessonFiles = lessons.map((l) => l.id)

// every message id a lesson file names (steps, hints, reactions)
function messageIds(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) node.forEach((n) => messageIds(n, out))
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k === 'message' && typeof v === 'string') out.push(v)
      else messageIds(v, out)
    }
  }
  return out
}

describe('lesson wordings: keys / mouse / phone', () => {
  it('every input-dependent line in every lesson (and the shared lines) has a real phone wording', () => {
    const missing: string[] = []
    for (const id of [...lessonFiles, 'shared']) {
      const lines = book[id]
      if (!lines || typeof lines === 'string') continue
      for (const [name, words] of Object.entries(lines)) {
        if (typeof words === 'string') continue // the same for every input
        for (const input of ['keys', 'mouse', 'phone'] as const) {
          const w = words[input]
          if (!w || !w.trim() || /⟨|slot/i.test(w)) missing.push(`${id}.${name}.${input}`)
        }
      }
    }
    expect(missing).toEqual([])
  })

  it('every message a lesson file names has words', () => {
    const none: string[] = []
    expect(lessonFiles).toContain('unlock-swap')
    for (const { id, lesson } of lessons) {
      for (const m of messageIds(lesson.steps)) if (lessonWords(id, m, {}, 'phone') === m) none.push(`${id}.${m}`)
    }
    expect(none).toEqual([])
  })

  it('a phone gets the phone line: a breakdown lesson, the swap unlock, the visor\'s lit button', () => {
    expect(lessonWords('laser', 'broke', {}, 'phone')).toContain('two taps')
    expect(lessonWords('laser', 'broke', {}, 'mouse')).toContain('two clicks')
    expect(lessonWords('visor', 'toConsole', {}, 'phone')).toBe('Flick up for the console.') // (a shared line)
    expect(lessonWords('visor', 'toConsole', {}, 'keys')).toContain('W or ↑')
    expect(lessonWords('unlock-swap', 'swap', {}, 'phone')).toContain('finger still')
    expect(lessonWords('unlock-swap', 'swap', {}, 'keys')).toContain('Right Shift')
    expect(lessonWords('visor', 'fixButton', {}, 'phone')).toBe('Tap the lit button.')
    expect(lessonWords('visor', 'fixButton', {}, 'mouse')).toBe('Press the lit button.')
  })
})
