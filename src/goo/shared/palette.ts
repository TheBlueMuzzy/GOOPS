// Goo colours. content/tuning/goo-colors.json maps a colour NAME to a hex colour; the engine's shift.json lists the
// names in order, so Color index c (1-based) = names[c - 1]. The tank view uses these helpers too (cracks, ghost).
import paletteFile from '../../../content/tuning/goo-colors.json' // live: the Dev Kit's edits show at once
import { rgbHex, wildBaseRgb } from './wildLook'

export type Palette = Record<string, string>

export const PALETTE: Palette = paletteFile as Palette

// v1 order (until the renderer is handed shift.json's list)
export const DEFAULT_COLOR_NAMES = ['red', 'blue', 'green', 'yellow', 'purple', 'white', 'black']

const MISSING = '#808080' // unknown colour: plain grey, so a bad name shows up instead of crashing

// F39 wild goop (the engine's WILD colour value, src/engine/types.ts): never a palette colour. The two goo renderers
// give it an 8th channel of its own (slot 8) and shade it with the wild look (src/goo/shared/wildLook.ts,
// content/tuning/twists-look.json); anything that needs ONE colour for it gets the wild body's plain colour.
export const WILD_COLOR = 255 // (= the engine's WILD)
export const WILD_SLOT = 8
/** The renderers' colour slot for an engine colour: wild → slot 8, the rest as they are. */
export const gooSlot = (c: number) => (c === WILD_COLOR ? WILD_SLOT : c)

export function colorHex(names: string[], c: number, palette: Palette = PALETTE): string {
  if (c === WILD_COLOR) return rgbHex(wildBaseRgb())
  const name = names[c - 1]
  return (name !== undefined && palette[name]) || MISSING
}

// The same colour as 0..1 floats [r, g, b]
export function colorRgb(names: string[], c: number, palette: Palette = PALETTE): [number, number, number] {
  return hexToRgb(colorHex(names, c, palette))
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((ch) => ch + ch).join('') : h
  const n = parseInt(full, 16)
  if (Number.isNaN(n) || full.length !== 6) return [0.5, 0.5, 0.5]
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

// Shader colour table: slot 0 = empty, slots 1..MAX_GOO_COLORS = Color index, slot 8 = wild's plain colour.
export const MAX_GOO_COLORS = 7
// out: fill this table instead of making a new one (the renderers refill theirs every frame, so colour edits show live)
export function paletteTable(names: string[], palette: Palette = PALETTE, out: Float32Array = new Float32Array((WILD_SLOT + 1) * 3)): Float32Array {
  for (let c = 1; c <= MAX_GOO_COLORS; c++) out.set(colorRgb(names, c, palette), c * 3)
  out.set(wildBaseRgb(), WILD_SLOT * 3)
  return out
}
