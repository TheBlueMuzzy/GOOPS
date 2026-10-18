// Which renderer draws each goo style, and the colour of a goop colour index (tank view: cracks, ghost).
import type { GooRenderer } from '../goo/types'
import { createJellyRenderer } from '../goo/jelly'
import { createParticleRenderer } from '../goo/particle'
import { colorHex } from '../goo/shared/palette'
import type { GooStyle } from './gooStyle'
import shiftConfig from '../../content/tuning/shift.json'

// (shift.json is read where it's used, so the Dev Kit's edits reach it — colours in goo-colors.json show at once)
export const colorOf = (c: number) => colorHex(shiftConfig.colors, c)

export const makeGoo: Record<GooStyle, (canvas: HTMLCanvasElement) => GooRenderer> = {
  jelly: (c) => createJellyRenderer(c, { colorNames: shiftConfig.colors }),
  particle: (c) => createParticleRenderer(c, { colorNames: shiftConfig.colors }),
}
