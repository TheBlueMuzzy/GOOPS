// Upgrades → what the shift engine and the screens use (F22, TDD "Upgrades & abilities").
// Pure: the definitions come from content/tuning/upgrades.json, the owned levels from the save (later).
// Passive upgrades become MODIFIERS: named numbers the engine reads at the exact spot it uses each tuning value.
// Active upgrades become ABILITY specs (see abilities.ts). Feature upgrades become flags the screens read.
import type { AbilitySpec } from './abilities'

// Every modifier is a multiplier; 1 = no change. Each one names the tuning value it multiplies.
export interface Modifiers {
  integrityDrainMult: number // × integrity.drainPerCrackPerSec — 0.5 = open cracks wear the tank half as fast
  ruptureDrainTimeMult: number // × rupture.drainMs — 1.5 = after a rupture, pressure takes 50% longer to drain
  pressureRiseTimeMult: number // × pressure.riseMsToFull — 1.2 = pressure rises 20% slower
  crackEveryMult: number // × the time between cracks — 1.2 = cracks come 20% less often
  fallSpeedMult: number // × the piece's fall speed — 1.25 = pieces fall 25% faster (fast drop too)
  leftoverPenaltyMult: number // × score.leftoverPerCell — 0.5 = leftover goop costs half
  // Breakdowns (F23, content/tuning/breakdowns.json):
  laserDrainMult: number // × laser.drainPerCell — 0.75 = each zap drains the capacitor 25% less (Capacitor Efficiency)
  visorGraceMult: number // × visor.graceMs — 1.15 = the visor holds 15% longer before fading (Circuit Stabilizer)
  controlsCoolMult: number // × controls.coolPerSec — 1.125 = the controls cool 12.5% faster (Gear Lubrication)
  breakdownCooldownMult: number // × the cooldown after a repair — 1.25 = machines stay safe 25% longer
}

export type ModifierName = keyof Modifiers

export const NEUTRAL_MODIFIERS: Readonly<Modifiers> = Object.freeze({
  integrityDrainMult: 1,
  ruptureDrainTimeMult: 1,
  pressureRiseTimeMult: 1,
  crackEveryMult: 1,
  fallSpeedMult: 1,
  leftoverPenaltyMult: 1,
  laserDrainMult: 1,
  visorGraceMult: 1,
  controlsCoolMult: 1,
  breakdownCooldownMult: 1,
})

// Safety rails, not tuning: whatever the upgrades add up to, each modifier stays in this range.
// Never 0 or below where the engine divides by it (a 0 fall speed or drain time would break the shift).
const LIMITS: Record<ModifierName, [min: number, max: number]> = {
  integrityDrainMult: [0, 10], // 0 = cracks never wear the tank (silly, but harmless)
  ruptureDrainTimeMult: [0.1, 10],
  pressureRiseTimeMult: [0.1, 10],
  crackEveryMult: [0.1, 10],
  fallSpeedMult: [0.1, 10],
  leftoverPenaltyMult: [0, 10],
  laserDrainMult: [0, 10], // 0 = the laser never drains
  visorGraceMult: [0, 10],
  controlsCoolMult: [0, 10],
  breakdownCooldownMult: [0, 10],
}

export function isModifierName(name: string): name is ModifierName {
  return Object.hasOwn(NEUTRAL_MODIFIERS, name)
}

// A full, safe set of modifiers from a partial (or missing) one: unknown names dropped, broken numbers
// (NaN, Infinity, not a number) back to neutral, everything clamped to its safety range.
export function clampModifiers(partial?: Partial<Record<string, unknown>>): Modifiers {
  const out: Modifiers = { ...NEUTRAL_MODIFIERS }
  if (!partial) return out
  for (const name of Object.keys(out) as ModifierName[]) {
    const value = partial[name]
    if (typeof value !== 'number' || !Number.isFinite(value)) continue
    const [min, max] = LIMITS[name]
    out[name] = Math.min(max, Math.max(min, value))
  }
  return out
}

// ---------------------------------------------------------------- upgrades.json

export interface UpgradeEffect {
  modifier: string // a ModifierName
  op: string // 'mul' | 'add'
  byLevel: number[] // the value AT level n is byLevel[n - 1]
}

export interface AbilityDef {
  effect: string // which effect it fires (abilities.ts ABILITY_EFFECTS)
  chargePerSecond: number // charge gained per second of play (1 = full)
  chargePerSeal: number // charge gained per crack sealed
  byLevel: Record<string, number>[] // the effect's numbers at level n
}

export interface UpgradeDef {
  id: string
  name: string
  desc?: string
  type: string // 'passive' | 'active' | 'feature'
  rank: number // unlocks at this rank
  maxLevel: number
  testOnly?: boolean // for tests only: the game never lists or grants it
  effects?: UpgradeEffect[] // passive
  ability?: AbilityDef // active
  feature?: string // feature: the flag name the screens read (defaults to the id)
}

export interface UpgradeBook {
  upgrades: UpgradeDef[]
}

// Upgrades the game may show and sell (never the test-only ones).
export function playableUpgrades(book: UpgradeBook): UpgradeDef[] {
  return book.upgrades.filter((u) => !u.testOnly)
}

export interface ResolvedUpgrades {
  modifiers: Modifiers // → createShift({ modifiers })
  abilities: AbilitySpec[] // → createShift({ abilities }); only owned AND equipped actives, in equipped order
  features: Record<string, number> // flag → level, for the screens (e.g. a next-piece window)
}

// What a player's upgrades add up to. `owned` = level per upgrade id (missing or 0 = not owned);
// `equipped` = ids of the actives they took into the shift.
export function resolveUpgrades(book: UpgradeBook, owned: Record<string, number>, equipped: string[] = []): ResolvedUpgrades {
  // 'add' effects are summed and 'mul' effects multiplied, then combined as (1 + sum) × product,
  // so the result never depends on the order of upgrades in the JSON.
  const adds: Record<string, number> = {}
  const muls: Record<string, number> = {}
  const features: Record<string, number> = {}
  const byId = new Map(book.upgrades.map((u) => [u.id, u]))

  for (const def of book.upgrades) {
    const level = levelOf(def, owned)
    if (level === 0) continue
    if (def.type === 'passive') {
      for (const effect of def.effects ?? []) {
        if (!isModifierName(effect.modifier)) continue // a typo in the JSON: ignored (a test checks the file)
        const value = atLevel(effect.byLevel, level)
        if (value === undefined) continue
        if (effect.op === 'add') adds[effect.modifier] = (adds[effect.modifier] ?? 0) + value
        else muls[effect.modifier] = (muls[effect.modifier] ?? 1) * value
      }
    } else if (def.type === 'feature') {
      features[def.feature ?? def.id] = level
    }
  }

  const abilities: AbilitySpec[] = []
  for (const id of equipped) {
    const def = byId.get(id)
    const level = def ? levelOf(def, owned) : 0
    if (!def || level === 0 || def.type !== 'active' || !def.ability) continue
    if (abilities.some((a) => a.id === id)) continue // equipped twice: once is enough
    const a = def.ability
    abilities.push({ id, effect: a.effect, chargePerSecond: a.chargePerSecond, chargePerSeal: a.chargePerSeal, params: { ...(atLevel(a.byLevel, level) ?? {}) } })
  }

  const mods: Record<ModifierName, number> = { ...NEUTRAL_MODIFIERS }
  for (const name of Object.keys(mods) as ModifierName[]) mods[name] = (1 + (adds[name] ?? 0)) * (muls[name] ?? 1)
  return { modifiers: clampModifiers(mods), abilities, features }
}

// A typo in the JSON (no maxLevel, a non-number) counts as max level 1 rather than poisoning the result.
function levelOf(def: UpgradeDef, owned: Record<string, number>): number {
  const level = Math.floor(Number(owned[def.id] ?? 0))
  const max = Number.isFinite(def.maxLevel) && def.maxLevel > 0 ? def.maxLevel : 1
  return Number.isFinite(level) ? Math.max(0, Math.min(max, level)) : 0
}

// The value at `level`; a short list keeps its last value for higher levels. A missing list = no value.
function atLevel<T>(byLevel: T[] | undefined, level: number): T | undefined {
  if (!byLevel?.length) return undefined
  return byLevel[Math.min(level, byLevel.length) - 1]
}
