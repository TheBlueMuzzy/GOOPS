// F55 CREDITS (Settings → About → Credits; Muzzy 2026-11-02: from Settings only, not after the ending) — the UI kit's
// Credits screen: the people lines first (content/text/en.json credits.people), then every entry in
// content/credits.json. ‹ goes back to Settings (the kit's own screens.pop()).
// An entry with an empty credit line (the CC0 sounds, Muzzy's own art) would show as a blank line in the kit, so it gets
// en.json's credits.asset line instead: its source up to the first bracket, its author and licence.
import { Credits, fill } from './kit'
import credits from '../../content/credits.json'
import text from '../../content/text/en.json'

const w = text.credits
type Entry = { source?: string; author?: string; licence?: string; credit?: string }

/** The line the Credits screen shows for one content/credits.json entry. */
function creditLine(entry: Entry): string {
  if (entry.credit?.trim()) return entry.credit
  const source = (entry.source ?? '').split(' (')[0].trim()
  return fill(w.asset, { source, author: entry.author ?? '', licence: entry.licence ?? '' })
}

const assets = (credits as Entry[]).map((entry) => ({ credit: creditLine(entry) }))

export function CreditsScreen() {
  return <Credits people={w.people} assets={assets} words={w.words} />
}
