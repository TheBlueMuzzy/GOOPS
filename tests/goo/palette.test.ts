import { describe, expect, it } from 'vitest'
import { DEFAULT_COLOR_NAMES, PALETTE, colorHex, colorRgb, hexToRgb, paletteTable } from '../../src/goo/shared/palette'
import { parseKnobs, mergeKnobs } from '../../src/goo/shared/knobs'
import { JELLY_DEFAULTS } from '../../src/goo/jelly'
import { PARTICLE_DEFAULTS } from '../../src/goo/particle'
import { quarterTurn, pieceShape } from '../../src/goo/shared/piecePose'

describe('palette', () => {
  it('has all seven v1 colours by name', () => {
    for (const n of ['red', 'blue', 'green', 'yellow', 'purple', 'white', 'black']) expect(PALETTE[n]).toMatch(/^#[0-9a-f]{6}$/i)
  })
  it('looks up Color c (1-based) through the names list', () => {
    expect(colorHex(DEFAULT_COLOR_NAMES, 1)).toBe(PALETTE.red)
    expect(colorHex(['green', 'red'], 2)).toBe(PALETTE.red)
    expect(colorRgb(['blue'], 1)).toEqual(hexToRgb(PALETTE.blue))
  })
  it('shows grey for an unknown colour instead of crashing', () => {
    expect(colorHex(DEFAULT_COLOR_NAMES, 0)).toBe('#808080')
    expect(colorHex(['nope'], 1)).toBe('#808080')
  })
  it('converts hex to 0..1 floats', () => {
    expect(hexToRgb('#ff0000')).toEqual([1, 0, 0])
    expect(hexToRgb('#fff')).toEqual([1, 1, 1])
  })
  it('builds the shader table with slot c = Color c', () => {
    const t = paletteTable(DEFAULT_COLOR_NAMES)
    expect(Array.from(t.slice(3, 6))).toEqual(hexToRgb(PALETTE.red).map((v) => Math.fround(v)))
  })
})

describe('goo knobs', () => {
  it('keeps numbers and drops notes', () => {
    expect(parseKnobs('{"_about":"x","a":1,"b":"no"}')).toEqual({ a: 1 })
  })
  it('setKnobs ignores unknown names', () => {
    const k = { a: 1 }
    mergeKnobs(k, { a: 2, zzz: 3 })
    expect(k).toEqual({ a: 2 })
  })
  it("Jelly defaults are Muzzy's pick (Preset 2)", () => {
    expect(JELLY_DEFAULTS).toMatchObject({ stiffness: 700, viscosity: 6.5, wobble: 0.25, tension: 0.15, gravity: 3.9, translucency: 0.5, wetness: 0.9, magnetism: 1.4 })
  })
  it("Particle defaults are Muzzy's Preset 1 (new names)", () => {
    expect(PARTICLE_DEFAULTS).toMatchObject({ gravity: 4.1, viscosity: 0.21, stiffness: 189, magnetism: 1.4, tension: 0.15, wobble: 0.15, threshold: 0.25, wetness: 1 })
  })
})

describe('piece turn detection', () => {
  const piece = (cells: [number, number][]) => ({ cells, colors: cells.map(() => 1), rotation: 0, fall: 0 })
  it('finds the quarter turn between two shapes, also across the seam', () => {
    const T = pieceShape(piece([[29, 1], [0, 1], [1, 1], [0, 2]]), 30) // T pointing down, over the seam
    const Tcw = pieceShape(piece([[0, 0], [0, 1], [0, 2], [29, 1]]), 30) // turned +90° (y down): points left
    expect(quarterTurn(T, Tcw)).toBe(1)
    expect(quarterTurn(Tcw, T)).toBe(-1)
  })
  it('a plain move is not a turn', () => {
    const a = pieceShape(piece([[3, 1], [4, 1], [5, 1], [4, 2]]), 30)
    const b = pieceShape(piece([[4, 1], [5, 1], [6, 1], [5, 2]]), 30)
    expect(quarterTurn(a, b)).toBe(0)
  })
})
