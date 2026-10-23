// THE UPGRADES SCREEN (F34) — the console's shop between shifts, built only from kit parts (game-ui rules).
// Scraps at the top; one card per upgrade in rank order (content/tuning/upgrades.json, never the test-only ones):
// its name and what it does (content/text/en.json upgrades.items), level pips (filled = owned, all of them = the max),
// the cost, and − (take a level back: free, the scrap comes back) / + (buy a level). Upgrades above your rank are shown
// locked with the rank they open at (v1: you can see what's coming). Actives get a switch to take them into the shift
// (activeSlots, 1 for now — switching on another when the slot is full swaps them, and a toast says which stayed behind).
// Every change is saved at once (the App's onChange). The rules: src/progress/upgradeShop.ts.
// The App passes its state through UpgradeShopContext, so this screen stays mounted while you buy (the list keeps its
// scroll); each card holds the same parts whatever you buy, so it never changes size (kit Card: fixed size).
import { useContext } from 'react'
import { Button, Card, Modal, Pips, Row, ScrollArea, Stack, Text, Toggle, fill, screens, toast } from './kit'
import { playableUpgrades, type UpgradeDef } from '../engine'
import { scrapsAt } from '../progress/progression'
import { buyLevel, costOf, isActive, levelOf, levelPercent, maxLevelOf, ownsAny, respec, setEquipped, takeBackLevel, upgradeBook, whyNotBuy } from '../progress/upgradeShop'
import { UpgradeShopContext, type UpgradeShop } from './upgradeShopContext'
import text from '../../content/text/en.json'

const w = text.upgrades
const items = w.items as Record<string, { name: string; desc: string }>
const nameOf = (def: UpgradeDef) => items[def.id]?.name ?? def.name
const percent = (n: number) => `${n < 0 ? '−' : '+'}${Math.abs(n)}%`
// the card's numbers (Muzzy, 2026-10-22): what it does now → at the next level, from upgrades.json — "+30% → +45%"
// (beside − / +, so it reads as what a buy does; short, so it never wraps and the card never grows)
function amountLine(def: UpgradeDef, level: number, max: number) {
  const now = percent(levelPercent(def, level))
  return level >= max ? fill(w.amountMax, { now }) : fill(w.amount, { now, next: percent(levelPercent(def, level + 1)) })
}
// the shop's list: rank order (the JSON's order breaks ties)
const SHOP = playableUpgrades(upgradeBook).map((def, i) => ({ def, i })).sort((a, b) => a.def.rank - b.def.rank || a.i - b.i).map(({ def }) => def)

export function UpgradesScreen() {
  const shop = useContext(UpgradeShopContext)
  if (!shop) return null
  const scraps = Math.max(0, scrapsAt(shop.rank, shop.progress))
  // Respec (Muzzy, 2026-10-22): top right, once a level is in anything — every level back at once, all scraps return
  const doRespec = () => {
    const next = respec(shop.progress)
    shop.onChange(next)
    toast(fill(w.respecDone, { n: Math.max(0, scrapsAt(shop.rank, next)).toLocaleString('en') }))
  }
  // (the word, Muzzy 2026-10-22: "Respec, not cycle arrow" — on the title's line; the kit title fits itself beside it)
  const respecButton = ownsAny(shop.progress) && <Button variant="secondary" compact aria-label={w.respecLabel} onClick={doRespec}>{w.respec}</Button>
  return (
    <Modal title={w.title} onBack={() => screens.pop()} backLabel={w.back} headerAction={respecButton || undefined}>
      <Text kind="heading">{fill(w.scraps, { n: scraps.toLocaleString('en') })}</Text>
      <ScrollArea label={w.list}>
        <Stack gap="m">
          {SHOP.map((def) => <UpgradeCard key={def.id} def={def} shop={shop} />)}
        </Stack>
      </ScrollArea>
    </Modal>
  )
}

function UpgradeCard({ def, shop }: { def: UpgradeDef; shop: UpgradeShop }) {
  const { progress, rank, onChange } = shop
  const name = nameOf(def)
  const level = levelOf(progress, def.id), max = maxLevelOf(def), cost = costOf(def)
  const locked = def.rank > rank
  const active = def.type === 'active'
  const equipped = progress.equipped.includes(def.id)
  const equip = (on: boolean) => {
    const { progress: next, swappedOut } = setEquipped(progress, def.id, on)
    onChange(next)
    const other = swappedOut && SHOP.find((d) => d.id === swappedOut)
    if (other) toast(fill(w.swapped, { name: nameOf(other) }))
  }
  // green when it has a level in it (Muzzy, 2026-10-22: "noticeably green"); greyed out while above your rank
  return (
    <Card title={name} tone={isActive(progress, def.id) ? 'success' : undefined} locked={locked} lockedLabel={w.lockedLabel}>
      <Text>{items[def.id]?.desc ?? def.desc ?? ''}</Text>
      {active && !locked && (
        <Row gap="s">
          <Toggle on={equipped} disabled={level === 0} label={fill(w.equipLabel, { name })} onChange={equip} />
          <Text kind="label">{w.equip}</Text>
        </Row>
      )}
      {/* the level (pips) and the price of one more; then − / + at the right (or the rank it opens at) */}
      <Row gap="s" justify="between">
        {/* (the pips' owned / empty differ only by brightness: the level as a plain number beside them too — "2/4") */}
        <Row gap="s">
          <Pips count={max} filled={level} label={fill(w.level, { n: level, max })} />
          <Text kind="label">{fill(w.levelShort, { n: level, max })}</Text>
        </Row>
        <Text kind="caption">{fill(cost === 1 ? w.cost : w.costMany, { n: cost })}</Text>
      </Row>
      {locked
        ? <Row gap="s" justify="end"><Text kind="label">{fill(w.locked, { rank: def.rank })}</Text></Row>
        : (
          <Row gap="s" justify="between">
            <Text kind="label" data-tag="amount">{amountLine(def, level, max)}</Text>
            <Row gap="s">
              <Button variant="danger" icon disabled={level === 0} aria-label={fill(w.takeBackLabel, { name })}
                onClick={() => onChange(takeBackLevel(progress, def.id))}>{w.takeBack}</Button>
              <Button variant="primary" icon disabled={whyNotBuy(progress, def.id, rank) !== null} aria-label={fill(w.buyLabel, { name })}
                onClick={() => onChange(buyLevel(progress, def.id, rank))}>{w.buy}</Button>
            </Row>
          </Row>
        )}
    </Card>
  )
}
