import { describe, expect, it } from 'vitest'
import { PiecePose } from '../../src/goo/shared/piecePose'

const cells = (x: number, y: number): [number, number][] => [[x, y], [x + 1, y], [x + 2, y], [x + 1, y + 1]]

describe('piece glide (no per-row lurch)', () => {
  it('the drawn piece moves smoothly through row steps', () => {
    const pose = new PiecePose()
    let y = 2
    const piece = { cells: cells(4, y), colors: [1, 1, 1, 1], rotation: 0, fall: 0 }
    pose.spawn(piece, 30, 0, 0)
    let last = pose.viewCentre(0, 30)[1]
    let worst = 0
    for (let f = 1; f <= 200; f++) {
      const fall = (f % 40) / 40
      if (fall === 0) y++ // a row step: the engine moves the piece down and restarts `fall`
      piece.cells = cells(4, y)
      piece.fall = fall
      pose.follow(piece, 30, 0)
      pose.integrate(1 / 60)
      const now = pose.viewCentre(0, 30)[1]
      worst = Math.max(worst, Math.abs(now - last))
      last = now
    }
    expect(worst).toBeLessThan(0.05) // never more than a sliver of a cell per frame
  })

  it('a spin keeps the piece put on screen (it is placed by the spin)', () => {
    const pose = new PiecePose()
    const piece = { cells: cells(29, 2), colors: [1, 1, 1, 1], rotation: 0, fall: 0 }
    pose.spawn(piece, 30, 29, 0)
    const before = pose.viewCentre(29, 30)
    piece.cells = cells(0, 2) // the tank turned +1 under the piece
    pose.follow(piece, 30, 0)
    expect(pose.viewCentre(0, 30)[0]).toBeCloseTo(before[0])
  })

  it('a rotate lags 90° behind, then springs over', () => {
    const pose = new PiecePose()
    const piece = { cells: [[4, 2], [5, 2], [6, 2], [7, 2]] as [number, number][], colors: [1, 1, 1, 1], rotation: 0, fall: 0 }
    pose.spawn(piece, 30, 0, 0)
    piece.cells = [[5, 1], [5, 2], [5, 3], [5, 4]]
    const turn = pose.reshape(piece, 30, 0, 1)
    expect(Math.abs(turn)).toBe(1)
    expect(Math.abs(pose.a)).toBeCloseTo(Math.PI / 2)
    for (let i = 0; i < 240; i++) pose.integrate(1 / 120)
    expect(Math.abs(pose.a)).toBeLessThan(0.05)
  })

  it('spots a hold swap (new colour or a new shape)', () => {
    const pose = new PiecePose()
    const piece = { cells: cells(4, 2), colors: [1, 1, 1, 1], rotation: 0, fall: 0 }
    pose.spawn(piece, 30, 0, 0)
    expect(pose.swapped(piece, 30)).toBe(false)
    expect(pose.swapped({ ...piece, colors: [2, 2, 2, 2] }, 30)).toBe(true)
    expect(pose.swapped({ ...piece, cells: [[4, 2], [5, 2], [4, 3], [5, 3]] }, 30)).toBe(true)
  })
})
