import { describe, expect, it } from 'vitest'
import { screenColumn } from '../src/goo/types'

describe('screenColumn', () => {
  it('wraps tank columns around the camera', () => {
    expect(screenColumn(0, 0, 30)).toBe(0)
    expect(screenColumn(29, 0, 30)).toBe(-1)
    expect(screenColumn(15, 0, 30)).toBe(-15)
    expect(screenColumn(1, 29.5, 30)).toBe(1.5)
  })
})
