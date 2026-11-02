// F56: the periscope's two glass shapes in content/ui/art.json are copies of the ones in the periscope picture —
// if Muzzy redraws the goggles (art-prep), this says the copies are out of date instead of the hole missing the glass.
// And PeriscopeZoom moves a path by changing only its first M: so after it, every command must be relative.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import art from '../content/ui/art.json'
import periscope from '../content/tuning/periscope.json'

const svg = readFileSync('public/art/ConsolePeriscope.svg', 'utf8')
const glass = art.console.periscopeGlass

describe('F56 periscope glass', () => {
  it.each([['ring', 'cls-61'], ['inner', 'cls-70']] as const)('the %s glass is the picture\'s %s shape, in its colour', (part, cls) => {
    expect(svg).toContain(`<path class="${cls}" d="${glass[part].d}"/>`)
    expect(svg).toMatch(new RegExp(`\\.${cls}\\s*\\{\\s*fill:\\s*${glass[part].colour}`))
  })
  it.each(['ring', 'inner'] as const)('the %s path is one absolute M, then relative commands only', (part) => {
    const d = glass[part].d
    expect(d).toMatch(/^M[-\d.]+,[-\d.]+[a-z]/)
    expect(d.slice(1).replace(/Z$/, '')).not.toMatch(/[A-Y]/)
  })
  it('the inner glass sits inside the ring', () => {
    const [rx, ry, rw, rh] = glass.ring.box, [ix, iy, iw, ih] = glass.inner.box
    expect(ix).toBeGreaterThan(rx); expect(iy).toBeGreaterThan(ry)
    expect(ix + iw).toBeLessThan(rx + rw); expect(iy + ih).toBeLessThan(ry + rh)
  })
  it('the tuning file has every knob the zoom reads, as numbers', () => {
    for (const k of ['zoomMs', 'backMs', 'ease', 'frameFade', 'tint', 'ringBlur', 'ringDark', 'floorLift'] as const) expect(typeof periscope[k]).toBe('number')
  })
})
