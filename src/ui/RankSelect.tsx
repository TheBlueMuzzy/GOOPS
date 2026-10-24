// RANK SELECT (F70, Muzzy 2026-10-24: v1's rank selector back, at the console's bottom row between the version and
// "MuzzyMade © 2026") — a tester's tool: tap it → SELECT RANK, a list of every rank 0…maxRank (content/tuning/progression.json):
// rank 0 has the red "Wipe save" badge (a brand-new device's first day), your rank the green "You" badge, any other =
// the start of that rank with upgrades refunded. What a pick does: src/game/rankSelect.ts.
// Only where the Dev Kit is on (rankSelectOn); the App hides it mid-shift and while a lesson or a story moment is on.
import { useContext, useId, useLayoutEffect } from 'react'
import { Badge, Button, ListRow, Modal, ScrollArea, Stack, Text, fill, screens } from './kit'
import { topRank } from '../progress/progression'
import { pickRank } from '../game/rankSelect'
import { UpgradeShopContext } from './upgradeShopContext'
import text from '../../content/text/en.json'

const w = text.console.rankSelect

/** The console's bottom-row button (between the version and the credit). */
export function RankSelectButton() {
  return <Button variant="ghost" compact data-tag="rankSelect" onClick={() => screens.push('rankSelect')}>{w.open}</Button>
}

/** SELECT RANK: every rank, 0 → max, the list opened at yours. */
export function RankSelectScreen() {
  const shop = useContext(UpgradeShopContext) // (the rank the console shows: the App's "rank the player plays at")
  const yours = shop?.rank ?? 0
  const id = useId()
  // open at your rank (in the middle of the list, so the ranks around it show too)
  useLayoutEffect(() => {
    document.getElementById(id)?.querySelectorAll('.kit-listrow')[yours]?.scrollIntoView({ block: 'center' })
  }, [id, yours])
  const ranks = Array.from({ length: topRank() + 1 }, (_, n) => n)
  return (
    <Modal title={w.title} onBack={() => screens.pop()} backLabel={w.back}>
      <Text kind="caption">{w.about}</Text>
      <ScrollArea label={w.list}>
        <Stack gap="xs" id={id}>
          {ranks.map((n) => (
            <ListRow key={n} label={fill(w.row, { n })} detail={n === 0 ? w.wipeDetail : undefined} onClick={() => pickRank(n)}>
              {(n === yours || n === 0) && (
                <Stack gap="xs">
                  {n === yours && <Badge variant="success">{w.yours}</Badge>}
                  {n === 0 && <Badge variant="danger">{w.wipe}</Badge>}
                </Stack>
              )}
            </ListRow>
          ))}
        </Stack>
      </ScrollArea>
    </Modal>
  )
}
