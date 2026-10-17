// Which renderer draws each goo style, and the colour of a goop colour index (tank view: cracks, ghost).
import type { GooRenderer } from '../goo/types'
import { createJellyRenderer } from '../goo/jelly'
import { createParticleRenderer } from '../goo/particle'
import { colorHex } from '../goo/shared/palette'
import type { GooStyle } from './gooStyle'
import shiftConfig from '../../content/tuning/shift.json'

const colorNames = shiftConfig.colors
export const colorOf = (c: number) => colorHex(colorNames, c)

export const makeGoo: Record<GooStyle, (canvas: HTMLCanvasElement) => GooRenderer> = {
  jelly: (c) => createJellyRenderer(c, { colorNames }),
  particle: (c) => createParticleRenderer(c, { colorNames }),
}
