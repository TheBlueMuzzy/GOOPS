// Which renderer draws each goo style, and the colour of a goop colour index. (Until the Jelly/Particle renderers
// land, both styles use the flat renderer.)
import type { GooRenderer } from '../goo/types'
import { createFlatRenderer } from '../goo/flat'
import type { GooStyle } from './gooStyle'
import shiftConfig from '../../content/tuning/shift.json'

const HEX: Record<string, string> = { red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308', purple: '#a855f7', white: '#e5e7eb', black: '#1f2937' }
export const colorOf = (c: number) => HEX[shiftConfig.colors[c - 1]] ?? '#888888'

export const makeGoo: Record<GooStyle, (canvas: HTMLCanvasElement) => GooRenderer> = {
  jelly: (c) => createFlatRenderer(c, colorOf),
  particle: (c) => createFlatRenderer(c, colorOf),
}
