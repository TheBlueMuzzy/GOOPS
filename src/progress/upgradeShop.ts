// THE UPGRADE SHOP'S RULES (F34) — pure: a progress in, a new progress out (the caller saves it).
// v1's money (design/upgrades-map.md "F33 decisions" 4): every level costs its upgrade's `cost` scraps (1 unless the data
// says otherwise), taking a level back is free and refunds what it cost, as often as you like — upgrades are a loadout
// you re-shape between shifts. Actives are also EQUIPPED: only equipped ones go into the shift, at most `activeSlots`
// (content/tuning/progression.json) at once.
import upgradesJson from '../../content/tuning/upgrades.json'
import tuning from '../../content/tuning/progression.json'
import { playableUpgrades, resolveUpgrades, type ResolvedUpgrades, type UpgradeBook, type UpgradeDef } from '../engine/upgrades'
import { scrapsAt, type Progress, type ProgressionTuning } from './progression'

export const upgradeBook = upgradesJson as UpgradeBook

// Why a buy was refused (the screen greys the button out; the words are in en.json upgrades.refused)
export type BuyRefusal = 'unknown' | 'locked' | 'maxed' | 'scraps'

/** Scraps one level costs (v1: 1). A missing or broken cost counts as 1. */
export function costOf(def: UpgradeDef): number {
  const cost = Number(def.cost ?? 1)
  return Number.isFinite(cost) && cost >= 0 ? Math.floor(cost) : 1
}

/** The highest level this upgrade can have (a broken maxLevel counts as 1, as resolveUpgrades does). */
export function maxLevelOf(def: UpgradeDef): number {
  return Number.isFinite(def.maxLevel) && def.maxLevel > 0 ? Math.floor(def.maxLevel) : 1
}

/** The level the player owns (0 = not bought). */
export function levelOf(p: Progress, id: string): number {
  const level = Math.floor(Number(p.owned[id] ?? 0))
  return Number.isFinite(level) && level > 0 ? level : 0
}

// The upgrades the shop may sell (never the test-only ones), by id
function findUpgrade(id: string, book: UpgradeBook): UpgradeDef | undefined {
  return playableUpgrades(book).find((u) => u.id === id)
}

/** Can the player buy the next level right now? null = yes, otherwise why not. */
export function whyNotBuy(p: Progress, id: string, rank: number, book: UpgradeBook = upgradeBook, t: ProgressionTuning = tuning): BuyRefusal | null {
  const def = findUpgrade(id, book)
  if (!def) return 'unknown'
  if (def.rank > rank) return 'locked'
  if (levelOf(p, id) >= maxLevelOf(def)) return 'maxed'
  if (scrapsAt(rank, p, t) < costOf(def)) return 'scraps'
  return null
}

/** Buy one level: the level goes up, its cost is spent. Refused → the same progress back, unchanged. */
export function buyLevel(p: Progress, id: string, rank: number, book: UpgradeBook = upgradeBook, t: ProgressionTuning = tuning): Progress {
  if (whyNotBuy(p, id, rank, book, t)) return p
  const def = findUpgrade(id, book)!
  return { ...p, scrapsSpent: p.scrapsSpent + costOf(def), owned: { ...p.owned, [id]: levelOf(p, id) + 1 } }
}

/** Take one level back: free, its cost comes back. At level 0 an active is unequipped. Nothing owned → unchanged. */
export function takeBackLevel(p: Progress, id: string, book: UpgradeBook = upgradeBook): Progress {
  const level = levelOf(p, id)
  const def = findUpgrade(id, book)
  if (!def || level === 0) return p
  const owned = { ...p.owned }
  if (level === 1) delete owned[id]
  else owned[id] = level - 1
  return {
    ...p,
    scrapsSpent: Math.max(0, p.scrapsSpent - costOf(def)),
    owned,
    equipped: level === 1 ? p.equipped.filter((e) => e !== id) : p.equipped,
  }
}

/**
 * Is this upgrade "in use" — its card shows the green border (Muzzy, 2026-10-22: "if there is at least 1 point in
 * something")? An active can only be equipped from level 1, so its switch adds nothing to the rule.
 */
export const isActive = (p: Progress, id: string) => levelOf(p, id) > 0

/** Has the player put a level into anything? (the shop's Respec button shows only then) */
export const ownsAny = (p: Progress) => Object.keys(p.owned).some((id) => levelOf(p, id) > 0)

/**
 * Respec (Muzzy, 2026-10-22): every level taken back at once — the scraps they cost come back (each at its current
 * price, as takeBackLevel does; an id no longer in the book refunds 1 a level) and every active comes off.
 */
export function respec(p: Progress, book: UpgradeBook = upgradeBook): Progress {
  let refund = 0
  for (const id of Object.keys(p.owned)) {
    const def = book.upgrades.find((u) => u.id === id)
    refund += levelOf(p, id) * (def ? costOf(def) : 1)
  }
  return { ...p, scrapsSpent: Math.max(0, p.scrapsSpent - refund), owned: {}, equipped: [] }
}

/** How many actives can go into a shift at once. */
export const activeSlots = (t: ProgressionTuning = tuning) => Math.max(1, Math.floor(t.activeSlots))

export interface EquipResult {
  progress: Progress
  swappedOut: string | null // equipping into full slots: the one taken off to make room (the one equipped longest)
}

/**
 * Equip (on) or unequip (off) an owned active. With every slot full, equipping SWAPS: the one equipped longest comes
 * off (swappedOut names it, so the screen can say so). Not an owned active → unchanged.
 */
export function setEquipped(p: Progress, id: string, on: boolean, book: UpgradeBook = upgradeBook, t: ProgressionTuning = tuning): EquipResult {
  const def = findUpgrade(id, book)
  const has = p.equipped.includes(id)
  if (!on) return { progress: has ? { ...p, equipped: p.equipped.filter((e) => e !== id) } : p, swappedOut: null }
  if (has || !def || def.type !== 'active' || levelOf(p, id) === 0) return { progress: p, swappedOut: null }
  const equipped = [...p.equipped, id]
  const swappedOut = equipped.length > activeSlots(t) ? equipped.shift()! : null
  return { progress: { ...p, equipped }, swappedOut }
}

/**
 * F34 task 5 — what the player's upgrades do to the NEXT shift: their owned levels and equipped actives, worked out by
 * resolveUpgrades → createShift's modifiers + abilities, the console's fewer repair steps, Focus Mode's console speed.
 * Read from the book when the shift starts, so a Dev Kit edit of upgrades.json counts from the next shift.
 * A lesson's training shift (the first day, a replayed lesson) gets none: its steps are set up to play the same for
 * everyone (and at rank 0 nothing is owned anyway). Test-only upgrades never count, even in a hand-edited save.
 */
export function upgradesForShift(p: Progress, training = false, book: UpgradeBook = upgradeBook): ResolvedUpgrades {
  const playable = { upgrades: playableUpgrades(book) }
  // never more actives than slots (a hand-edited save, or fewer slots after equipping): keep the newest, as setEquipped does
  const equipped = p.equipped.slice(-activeSlots())
  return training ? resolveUpgrades(playable, {}) : resolveUpgrades(playable, p.owned, equipped)
}

/**
 * The number a level brings, as a % change from owning none: what the card's number line shows (Circuit Stabilizer
 * level 2 → +30, Capacitor Efficiency level 4 → −25, Cooldown Booster level 3 → +50). Read from the book, so it never
 * goes stale: a passive's first effect (not the max-level fewer repair steps), an active's first number. Level 0 → 0.
 */
export function levelPercent(def: UpgradeDef, level: number): number {
  if (level < 1) return 0
  const effect = def.effects?.find((e) => !e.modifier.endsWith('RepairFewerSteps'))
  const value = effect
    ? effect.byLevel[Math.min(level, effect.byLevel.length) - 1]
    : Object.values(def.ability?.byLevel[Math.min(level, def.ability.byLevel.length) - 1] ?? {}).find((v) => typeof v === 'number')
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  const pct = effect?.op === 'mul' ? (value - 1) * 100 : value * 100 // a multiplier's change, or a fraction added (an active's boost)
  return Math.round(pct) // whole percents: "−6% → −13%" fits beside − / + on a 360 phone ("−6.3% → −12.5%" wrapped, the card grew)
}
