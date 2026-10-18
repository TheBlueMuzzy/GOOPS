// What moves when a rotation is blocked: the Settings row "wallKick" (Rotate vat / Shunt piece).
// Muzzy wants both to test (GDD §4). Changing it mid-shift applies to the next blocked rotation.
import { loadSettings } from '../ui/kit'
import settings from '../../content/ui/settings.json'
import type { WallKickMode } from '../engine'

const listeners = new Set<() => void>()
let current: WallKickMode = toMode(loadSettings(settings).wallKick)

function toMode(v: unknown): WallKickMode {
  return v === 'Shunt piece' ? 'shuntPiece' : 'rotateVat'
}

export const wallKick = {
  get: () => current,
  setFromSetting(v: unknown) {
    const next = toMode(v)
    if (next === current) return
    current = next
    listeners.forEach((l) => l())
  },
  subscribe(l: () => void) {
    listeners.add(l)
    return () => { listeners.delete(l) }
  },
}
