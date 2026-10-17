// Which goo renderer draws the tank: the Settings row "gooStyle" (Jelly / Particle). Changing it mid-shift swaps the
// renderer on the next frame; the game itself doesn't notice (the goo is only the costume).
import { loadSettings } from '../ui/kit'
import settings from '../../content/ui/settings.json'

export type GooStyle = 'jelly' | 'particle'

const listeners = new Set<() => void>()
let current: GooStyle = toStyle(loadSettings(settings).gooStyle)

function toStyle(v: unknown): GooStyle {
  return v === 'Particle' ? 'particle' : 'jelly'
}

export const gooStyle = {
  get: () => current,
  setFromSetting(v: unknown) {
    const next = toStyle(v)
    if (next === current) return
    current = next
    listeners.forEach((l) => l())
  },
  subscribe(l: () => void) {
    listeners.add(l)
    return () => { listeners.delete(l) }
  },
}
