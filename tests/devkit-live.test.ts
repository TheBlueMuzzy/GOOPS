// The Dev Kit's promise: "the purpose of the devkit is to affect things live" (Muzzy, 2026-10-18).
// 1. Every content/tuning import is live (the Dev Kit's Vite plugin hands the game liveFile objects — also here in vitest).
// 2. The live guard: no game code copies a tuning value once, at load, where a slider can't reach it.
import { describe, expect, it } from 'vitest'
import { copiedAtLoad, type SourceFile } from '../src/devkit/tuning/liveGuard'
import { sendTuning } from '../src/devkit/tuning/liveTuning'
import tank from '../content/tuning/tank.json'
import shift from '../content/tuning/shift.json'
import tankText from '../content/tuning/tank.json?raw'

// every source file in src/, as text (Vite finds them; the keys come back as '../src/…')
const sources = import.meta.glob<string>('../src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true })
const srcFiles = (): SourceFile[] => Object.entries(sources).map(([path, text]) => ({ path: path.slice('../'.length), text }))

describe('the Dev Kit reaches the game live', () => {
  it('content/tuning imports are live objects (the Dev Kit Vite plugin)', () => {
    expect(Object.getOwnPropertyDescriptor(tank, 'cameraSpeed')?.get).toBeTypeOf('function')
    const was = tank.cameraSpeed
    ;(globalThis as { window?: unknown }).window = new EventTarget() // sendTuning tells the page
    try {
      sendTuning('tank', { ...tank, cameraSpeed: was + 3 })
      expect(tank.cameraSpeed).toBe(was + 3)
    } finally {
      sendTuning('tank', JSON.parse(tankText))
      delete (globalThis as { window?: unknown }).window
    }
    expect(tank.cameraSpeed).toBe(was)
    expect(shift.fall.msPerRow).toBeGreaterThan(0)
  })
  it('live guard: no tuning value is copied when a file loads (read it where it is used)', () => {
    const files = srcFiles()
    expect(files.length).toBeGreaterThan(30) // (the glob found the game's code)
    expect(copiedAtLoad(files)).toEqual([])
  })
})
