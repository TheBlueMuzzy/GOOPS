// The player's progress in this browser. Versioned: an older save is UPGRADED step by step (never wiped), a broken one
// is replaced with a fresh start, and nothing here ever crashes the game.
//   version 1 (alpha): { v: 1, totalXp, scrapsSpent }
//   version 2 (F34):   + owned (upgrade id → level) and equipped (ids of the actives taken into the shift)
// (Hand-made: the framework's saves module — backups, save codes — isn't installed in Goops yet. Its shape is the same:
// one upgrade step per version, so moving onto it later keeps these steps.)
import { freshProgress, type Progress } from './progression'

const KEY = 'goops-progress'
export const SAVE_VERSION = 2

// One step per older version: the save as it was → the next version's shape. A step only ADDS what the new version
// has (empty), so everything the player had stays.
const UPGRADE_STEPS: Record<number, (old: Record<string, unknown>) => Record<string, unknown>> = {
  1: (v1) => ({ ...v1, v: 2, owned: {}, equipped: [] }), // F34: nothing bought yet (alpha had no shop)
}

export function loadProgress(storage: Pick<Storage, 'getItem'> | null = safeStorage()): Progress {
  try {
    const raw = storage?.getItem(KEY)
    if (!raw) return freshProgress()
    let data = JSON.parse(raw)
    if (typeof data !== 'object' || data === null) return freshProgress()
    // older versions step up one at a time; an unknown version (newer than this build, or nonsense) starts fresh —
    // and saveProgress never writes over a newer build's save
    while (typeof data.v === 'number' && data.v < SAVE_VERSION && UPGRADE_STEPS[data.v]) data = UPGRADE_STEPS[data.v](data)
    if (data.v !== SAVE_VERSION) return freshProgress()
    const totalXp = Number(data.totalXp), scrapsSpent = Number(data.scrapsSpent)
    if (!Number.isFinite(totalXp) || totalXp < 0 || !Number.isFinite(scrapsSpent) || scrapsSpent < 0) return freshProgress()
    return { totalXp, scrapsSpent, owned: readOwned(data.owned), equipped: readEquipped(data.equipped) }
  } catch {
    return freshProgress()
  }
}

export function saveProgress(p: Progress, storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeStorage()): void {
  try {
    if (newerSaveThere(storage)) return // a newer build's save: leave it alone (this build can't read all of it)
    storage?.setItem(KEY, JSON.stringify({ v: SAVE_VERSION, totalXp: p.totalXp, scrapsSpent: p.scrapsSpent, owned: p.owned, equipped: p.equipped }))
  } catch { /* private mode: play on */ }
}

// F70 RANK SELECT 0: forget the progress entirely, as on a brand-new device (the next load is a fresh start)
export function clearProgress(storage: Pick<Storage, 'removeItem'> | null = safeStorage()): void {
  try { storage?.removeItem(KEY) } catch { /* private mode: nothing was kept */ }
}

function newerSaveThere(storage: Pick<Storage, 'getItem'> | null): boolean {
  try {
    const v = JSON.parse(storage?.getItem(KEY) ?? 'null')?.v
    return typeof v === 'number' && v > SAVE_VERSION
  } catch { return false }
}

// owned: only whole levels above 0 survive (a broken entry is dropped, not the whole save)
function readOwned(raw: unknown): Record<string, number> {
  const owned: Record<string, number> = {}
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return owned
  for (const [id, value] of Object.entries(raw)) {
    const level = Math.floor(Number(value))
    if (Number.isFinite(level) && level > 0) owned[id] = level
  }
  return owned
}

// equipped: ids (text), each once
function readEquipped(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return [...new Set(raw.filter((id): id is string => typeof id === 'string'))]
}

function safeStorage(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null }
}
