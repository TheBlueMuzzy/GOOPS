// F34: the upgrade shop's rules — buy (1 scrap a level by default), take back (free, refunds), equip (active slots).
import { describe, expect, it } from 'vitest'
import tuning from '../content/tuning/progression.json'
import { freshProgress, scrapsAt, xpToNext, type Progress } from '../src/progress/progression'
import { activeSlots, buyLevel, costOf, levelCount, levelOf, levelPercent, ownsAny, respec, setEquipped, showsCount, takeBackLevel, upgradeBook, upgradesForShift, whyNotBuy } from '../src/progress/upgradeShop'
import { playableUpgrades, type UpgradeBook } from '../src/engine/upgrades'
import text from '../content/text/en.json'
import { SAVE_VERSION, loadProgress, saveProgress } from '../src/progress/save'
import goldenV3 from './saves/goops-progress-v3.json'

const book: UpgradeBook = { upgrades: [
  { id: 'cheap', name: 'Cheap', type: 'passive', rank: 2, maxLevel: 2, effects: [] },
  { id: 'pricey', name: 'Pricey', type: 'passive', rank: 2, maxLevel: 4, cost: 3, effects: [] },
  { id: 'late', name: 'Late', type: 'passive', rank: 9, maxLevel: 4, effects: [] },
  { id: 'zap', name: 'Zap', type: 'active', rank: 5, maxLevel: 3, ability: { effect: 'x', chargePerSecond: 0, chargePerSeal: 0, byLevel: [] } },
  { id: 'zap2', name: 'Zap 2', type: 'active', rank: 5, maxLevel: 3, ability: { effect: 'x', chargePerSecond: 0, chargePerSeal: 0, byLevel: [] } },
  { id: 'hidden', name: 'Test', type: 'passive', rank: 0, maxLevel: 1, testOnly: true, effects: [] },
] }
const at = (rank: number): Progress => { let xp = 0; for (let r = 0; r < rank; r++) xp += xpToNext(r); return { ...freshProgress(), totalXp: xp } }
const scraps = (p: Progress, rank: number) => scrapsAt(rank, p)

describe('buying a level', () => {
  it('costs the upgrade’s cost (1 when the data says none) and raises the level', () => {
    expect(costOf(book.upgrades[0])).toBe(1)
    expect(costOf(book.upgrades[1])).toBe(3)
    const p = buyLevel(at(5), 'cheap', 5, book)
    expect(levelOf(p, 'cheap')).toBe(1)
    expect(scraps(p, 5)).toBe(4)
    const q = buyLevel(p, 'pricey', 5, book)
    expect(levelOf(q, 'pricey')).toBe(1)
    expect(scraps(q, 5)).toBe(1)
  })

  it('is refused (progress unchanged) without enough scraps, at max level, above your rank, or for an unknown / test-only upgrade', () => {
    const p = at(5)
    expect(whyNotBuy(p, 'late', 5, book)).toBe('locked')
    expect(buyLevel(p, 'late', 5, book)).toBe(p)
    let maxed = buyLevel(buyLevel(p, 'cheap', 5, book), 'cheap', 5, book)
    expect(levelOf(maxed, 'cheap')).toBe(2)
    expect(whyNotBuy(maxed, 'cheap', 5, book)).toBe('maxed')
    expect(buyLevel(maxed, 'cheap', 5, book)).toBe(maxed)
    maxed = buyLevel(maxed, 'zap', 5, book) // 2 scraps left
    expect(whyNotBuy(maxed, 'pricey', 5, book)).toBe('scraps')
    expect(buyLevel(maxed, 'pricey', 5, book)).toBe(maxed)
    expect(whyNotBuy(p, 'nope', 5, book)).toBe('unknown')
    expect(whyNotBuy(p, 'hidden', 5, book)).toBe('unknown')
    expect(whyNotBuy(p, 'cheap', 5, book)).toBeNull()
  })

  it('can never spend below 0 scraps', () => {
    let p = at(5)
    for (let i = 0; i < 20; i++) for (const id of ['cheap', 'pricey', 'zap', 'zap2']) p = buyLevel(p, id, 5, book)
    expect(scraps(p, 5)).toBeGreaterThanOrEqual(0)
    expect(p.scrapsSpent).toBe(5)
  })
})

describe('taking a level back', () => {
  it('is free and refunds its cost; at 0 the upgrade is gone from the save', () => {
    const bought = buyLevel(buyLevel(at(5), 'pricey', 5, book), 'cheap', 5, book)
    expect(scraps(bought, 5)).toBe(1)
    const back = takeBackLevel(bought, 'pricey', book)
    expect(scraps(back, 5)).toBe(4)
    expect(back.owned).toEqual({ cheap: 1 })
  })

  it('nothing owned → unchanged', () => {
    const p = at(5)
    expect(takeBackLevel(p, 'cheap', book)).toBe(p)
    expect(takeBackLevel(p, 'nope', book)).toBe(p)
  })

  it('taking an active to level 0 unequips it; a level still left keeps it equipped', () => {
    let p = buyLevel(buyLevel(at(5), 'zap', 5, book), 'zap', 5, book)
    p = setEquipped(p, 'zap', true, book).progress
    expect(p.equipped).toEqual(['zap'])
    p = takeBackLevel(p, 'zap', book)
    expect(p.equipped).toEqual(['zap'])
    p = takeBackLevel(p, 'zap', book)
    expect(p.equipped).toEqual([])
    expect(scraps(p, 5)).toBe(5)
  })
})

describe('equipping actives', () => {
  it('one slot to start (content/tuning/progression.json activeSlots; the Expansion Slots add more — below)', () => {
    expect(tuning.activeSlots).toBe(1)
    expect(activeSlots()).toBe(1)
  })

  it('only an owned active can be equipped', () => {
    const p = buyLevel(at(5), 'cheap', 5, book)
    expect(setEquipped(p, 'zap', true, book).progress).toBe(p) // not owned
    expect(setEquipped(p, 'cheap', true, book).progress).toBe(p) // not an active
  })

  it('equipping into a full slot swaps: the one equipped longest comes off, and is named', () => {
    let p = buyLevel(buyLevel(at(5), 'zap', 5, book), 'zap2', 5, book)
    p = setEquipped(p, 'zap', true, book).progress
    const swap = setEquipped(p, 'zap2', true, book)
    expect(swap.progress.equipped).toEqual(['zap2'])
    expect(swap.swappedOut).toBe('zap')
    // with 2 slots both fit
    const two = setEquipped(p, 'zap2', true, book, { ...tuning, activeSlots: 2 })
    expect(two.progress.equipped).toEqual(['zap', 'zap2'])
    expect(two.swappedOut).toBeNull()
  })

  it('switching off unequips; equipping twice changes nothing', () => {
    let p = setEquipped(buyLevel(at(5), 'zap', 5, book), 'zap', true, book).progress
    expect(setEquipped(p, 'zap', true, book).progress).toBe(p)
    p = setEquipped(p, 'zap', false, book).progress
    expect(p.equipped).toEqual([])
  })
})

describe('respec: every level back at once', () => {
  it('owning nothing → no Respec; after buying, respec gives every scrap back and unequips', () => {
    let p: Progress = { ...freshProgress(), totalXp: 1e9 }
    expect(ownsAny(p)).toBe(false)
    const before = scrapsAt(9, p)
    p = buyLevel(p, 'cheap', 9, book); p = buyLevel(p, 'pricey', 9, book); p = buyLevel(p, 'pricey', 9, book)
    p = buyLevel(p, 'zap', 9, book); p = setEquipped(p, 'zap', true, book).progress
    expect(ownsAny(p)).toBe(true)
    expect(scrapsAt(9, p)).toBe(before - 1 - 3 - 3 - 1)
    const r = respec(p)
    expect(scrapsAt(9, r)).toBe(before)
    expect(r.owned).toEqual({})
    expect(r.equipped).toEqual([])
    expect(ownsAny(r)).toBe(false)
    expect(r.totalXp).toBe(p.totalXp)
  })
})

describe('the card number line (levelPercent): read from the real upgrades.json', () => {
  const def = (id: string) => upgradeBook.upgrades.find((u) => u.id === id)!
  it('a passive: its first effect as a % change, level 0 = 0, past the max = the max', () => {
    expect([0, 1, 2, 3, 4].map((n) => levelPercent(def('circuitStabilizer'), n))).toEqual([0, 15, 30, 45, 60])
    expect(levelPercent(def('capacitorEfficiency'), 4)).toBe(-25)
    expect(levelPercent(def('gearLubrication'), 1)).toBe(13) // 12.5, in whole percents
    expect(levelPercent(def('capacitorEfficiency'), 1)).toBe(-6)
    expect(levelPercent(def('focusMode'), 4)).toBe(-40)
    expect(levelPercent(def('pressureControl'), 8)).toBe(40)
    expect(levelPercent(def('pressureControl'), 99)).toBe(40)
  })
  it('an active: its first number as a % (Cooldown Booster +25 / 35 / 50)', () => {
    expect([1, 2, 3].map((n) => levelPercent(def('cooldownBooster'), n))).toEqual([25, 35, 50])
  })
  it('every shop upgrade has a number at every level (and its words)', () => {
    const items = text.upgrades.items as Record<string, { desc?: string }>
    for (const u of playableUpgrades(upgradeBook)) {
      expect(items[u.id]?.desc, u.id).toBeTruthy()
      const card = (n: number) => (showsCount(u) ? levelCount(u, n) : levelPercent(u, n))
      for (let n = 1; n <= u.maxLevel; n++) expect(card(n), `${u.id} ${n}`).not.toBe(0)
    }
  })
  it('F42: the count cards show plain numbers — Dump waves 1 / 2 / 3, Colorizer pieces 6 / 7 / 8, Crack Down cracks 3 / 5 / 7, a slot 0 → 1', () => {
    const counts = (id: string) => [0, 1, 2, 3].map((n) => levelCount(def(id), n))
    expect(counts('goopDump')).toEqual([0, 1, 2, 3])
    expect(counts('goopColorizer')).toEqual([0, 6, 7, 8])
    expect(counts('crackDown')).toEqual([0, 3, 5, 7])
    expect([0, 1].map((n) => levelCount(def('activeSlot'), n))).toEqual([0, 1])
    expect(['goopDump', 'goopColorizer', 'crackDown', 'activeSlot', 'activeSlot2'].every((id) => showsCount(def(id)))).toBe(true)
    expect(showsCount(def('cooldownBooster'))).toBe(false) // still "+25%"
  })
})

// F42 task 4: Active Expansion Slot (rank 20) and Slot 2 (rank 38), bought with scraps like any upgrade
describe('active slots: 1 → 2 → 3 with the Active Expansion Slots', () => {
  const rich = (): Progress => ({ ...freshProgress(), totalXp: 1e9 }) // scraps for everything
  const owning = (owned: Record<string, number>, equipped: string[] = []): Progress => ({ ...rich(), owned, equipped })
  const ACTIVES = ['cooldownBooster', 'goopDump', 'goopColorizer', 'crackDown']
  const def = (id: string) => upgradeBook.upgrades.find((u) => u.id === id)!

  it('the slots are upgrades.json feature upgrades at v1’s ranks and price (1 scrap, one level)', () => {
    const slot = def('activeSlot'), slot2 = def('activeSlot2')
    expect([slot.type, slot.rank, slot.maxLevel, costOf(slot), slot.feature]).toEqual(['feature', 20, 1, 1, 'abilitySlots'])
    expect([slot2.type, slot2.rank, slot2.maxLevel, costOf(slot2), slot2.feature]).toEqual(['feature', 38, 1, 1, 'abilitySlots'])
  })

  it('bought with scraps from their rank (not before), each adds a slot', () => {
    expect(whyNotBuy(rich(), 'activeSlot', 19)).toBe('locked')
    let p = buyLevel(rich(), 'activeSlot', 20)
    expect(levelOf(p, 'activeSlot')).toBe(1)
    expect(p.scrapsSpent).toBe(1)
    expect(activeSlots(p)).toBe(2)
    expect(whyNotBuy(p, 'activeSlot2', 37)).toBe('locked')
    p = buyLevel(p, 'activeSlot2', 38)
    expect(activeSlots(p)).toBe(3)
    expect(whyNotBuy(p, 'activeSlot', 38)).toBe('maxed')
    expect(whyNotBuy({ ...at(20), scrapsSpent: 20 }, 'activeSlot', 20)).toBe('scraps')
  })

  it('no slot upgrade = 1 slot; a slot owned but the base raised in progression.json adds on top', () => {
    expect(activeSlots(freshProgress())).toBe(1)
    expect(activeSlots(owning({ activeSlot: 1 }), upgradeBook, { ...tuning, activeSlots: 2 })).toBe(3)
  })

  it('with 3 slots three actives are equipped at once; a 4th swaps out the one equipped longest', () => {
    let p = owning({ activeSlot: 1, activeSlot2: 1, cooldownBooster: 1, goopDump: 1, goopColorizer: 1, crackDown: 1 })
    for (const id of ACTIVES.slice(0, 3)) p = setEquipped(p, id, true).progress
    expect(p.equipped).toEqual(['cooldownBooster', 'goopDump', 'goopColorizer'])
    const fourth = setEquipped(p, 'crackDown', true)
    expect(fourth.progress.equipped).toEqual(['goopDump', 'goopColorizer', 'crackDown'])
    expect(fourth.swappedOut).toBe('cooldownBooster')
  })

  it('taking a slot back unequips the actives that no longer fit, the one equipped longest first', () => {
    const p = owning({ activeSlot: 1, activeSlot2: 1, cooldownBooster: 1, goopDump: 1, goopColorizer: 1 }, ['cooldownBooster', 'goopDump', 'goopColorizer'])
    const two = takeBackLevel(p, 'activeSlot2')
    expect(two.equipped).toEqual(['goopDump', 'goopColorizer'])
    expect(levelOf(two, 'activeSlot2')).toBe(0)
    const one = takeBackLevel(two, 'activeSlot')
    expect(one.equipped).toEqual(['goopColorizer'])
    // taking back something else keeps every equipped active that still fits
    expect(takeBackLevel(p, 'goopDump').equipped).toEqual(['cooldownBooster', 'goopColorizer'])
  })

  it('slots are owned levels like any upgrade (no save change of their own; F65 made it version 4) — old saves load with 1 slot, new ones keep 3 equipped', () => {
    const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } }
    expect(SAVE_VERSION).toBe(4)
    const old = memory()
    old.setItem('goops-progress', JSON.stringify(goldenV3))
    expect(activeSlots(loadProgress(old))).toBe(1)
    const s = memory()
    const p = owning({ activeSlot: 1, activeSlot2: 1, goopDump: 1, goopColorizer: 1, crackDown: 1 }, ['goopDump', 'goopColorizer', 'crackDown'])
    saveProgress(p, s)
    const back = loadProgress(s)
    expect(back.equipped).toEqual(['goopDump', 'goopColorizer', 'crackDown'])
    expect(activeSlots(back)).toBe(3)
    expect(upgradesForShift(back).abilities).toHaveLength(3)
  })

  it('respec takes the slots back too: nothing owned, nothing equipped, every scrap back', () => {
    const p = owning({ activeSlot: 1, activeSlot2: 1, goopDump: 2 }, ['goopDump'])
    const r = respec({ ...p, scrapsSpent: 4 })
    expect([r.owned, r.equipped, r.scrapsSpent]).toEqual([{}, [], 0])
    expect(activeSlots(r)).toBe(1)
  })

  it('the shift gets as many actives as there are slots (the newest kept), at their owned levels', () => {
    const all = ['cooldownBooster', 'goopDump', 'goopColorizer', 'crackDown']
    const owned = { cooldownBooster: 1, goopDump: 2, goopColorizer: 1, crackDown: 3 }
    expect(upgradesForShift(owning(owned, all)).abilities.map((a) => a.id)).toEqual(['crackDown'])
    expect(upgradesForShift(owning({ ...owned, activeSlot: 1 }, all)).abilities.map((a) => a.id)).toEqual(['goopColorizer', 'crackDown'])
    const three = upgradesForShift(owning({ ...owned, activeSlot: 1, activeSlot2: 1 }, all)).abilities
    expect(three.map((a) => a.id)).toEqual(['goopDump', 'goopColorizer', 'crackDown'])
    expect(three.map((a) => a.params)).toEqual([
      { waves: 2, cellsPerWave: 18, cellMs: 80, waveMs: 600 }, { pieces: 6 }, { cracks: 7, rows: 4 },
    ])
    expect(upgradesForShift(owning({ ...owned, activeSlot: 1, activeSlot2: 1 }, all)).features).toEqual({ abilitySlots: 2 })
  })
})
