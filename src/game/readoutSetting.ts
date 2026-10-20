// Where the pressure readout sits on the pressure line (F26): the Settings rows "Pressure readout position" (a slider,
// 0–100 % across the tank) and "Pressure readout direction" (Line, then text / Text, then line). Read live: changing a
// row mid-shift moves the readout straight away. ShiftStage places it (src/game/ShiftStage.tsx placeReadout).
import { loadSettings } from '../ui/kit'
import settings from '../../content/ui/settings.json'

export type ReadoutDirection = 'lineFirst' | 'textFirst'
export interface ReadoutSetting { position: number; direction: ReadoutDirection } // position 0..1

const toSetting = (values: Record<string, unknown>): ReadoutSetting => ({
  position: Math.min(1, Math.max(0, Number(values.readoutPosition ?? 65) / 100)),
  direction: values.readoutDirection === 'Text, then line' ? 'textFirst' : 'lineFirst',
})

const listeners = new Set<() => void>()
let current = toSetting(loadSettings(settings))

export const readoutSetting = {
  get: () => current, // the same object until something changes (useSyncExternalStore needs that)
  setFromSettings(values: Record<string, unknown>) {
    const next = toSetting(values)
    if (next.position === current.position && next.direction === current.direction) return
    current = next
    listeners.forEach((l) => l())
  },
  subscribe(l: () => void) {
    listeners.add(l)
    return () => { listeners.delete(l) }
  },
}
