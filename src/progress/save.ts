// The player's progress in this browser. Versioned: a save from an older version (or a broken one) is read
// carefully or replaced with a fresh start, never crashes the game.
import { freshProgress, type Progress } from './progression'

const KEY = 'goops-progress'
const VERSION = 1

export function loadProgress(storage: Pick<Storage, 'getItem'> | null = safeStorage()): Progress {
  try {
    const raw = storage?.getItem(KEY)
    if (!raw) return freshProgress()
    const data = JSON.parse(raw)
    if (data?.v !== VERSION) return freshProgress() // no older versions exist yet: start fresh
    const totalXp = Number(data.totalXp), scrapsSpent = Number(data.scrapsSpent)
    if (!Number.isFinite(totalXp) || totalXp < 0 || !Number.isFinite(scrapsSpent) || scrapsSpent < 0) return freshProgress()
    return { totalXp, scrapsSpent }
  } catch {
    return freshProgress()
  }
}

export function saveProgress(p: Progress, storage: Pick<Storage, 'setItem'> | null = safeStorage()): void {
  try { storage?.setItem(KEY, JSON.stringify({ v: VERSION, totalXp: p.totalXp, scrapsSpent: p.scrapsSpent })) } catch { /* private mode: play on */ }
}

function safeStorage(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null }
}
