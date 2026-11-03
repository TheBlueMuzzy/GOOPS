// F79 — No rank numbers in code or tests: the e2e scripts' and bots' way to ask the ladder (content/tuning/ladder.json)
// for a rank, so moving a beat there (or reshaping the whole climb) needs no e2e edit. The same lookup as
// src/ladder/ladder.ts rankOf (a .mjs can't import the .ts): "wildGoop" = a beat, "titles.technician" = a group's name.
//   import { rankOf, maxRank, LADDER } from './ladder-ranks.mjs'
//   page.goto(`…/?rank=${rankOf('wildGoop')}`)
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** content/tuning/ladder.json as it is on disk now. */
export const LADDER = JSON.parse(readFileSync(fileURLToPath(new URL('../content/tuning/ladder.json', import.meta.url)), 'utf8'))

/** The rank a beat sits at ("wildGoop", "titles.technician", "upgrades.goopSwap", "story.31"). Unknown → throws. */
export function rankOf(name) {
  const dot = name.indexOf('.')
  const table = dot < 0 ? LADDER.beats : LADDER[name.slice(0, dot)]
  const key = dot < 0 ? name : name.slice(dot + 1)
  const r = table && Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined
  if (typeof r !== 'number') throw new Error(`ladder-ranks: no beat called "${name}" in content/tuning/ladder.json`)
  return r
}

/** The top rank (the final shift's rank is its own beat, finalShift). */
export const maxRank = () => LADDER.maxRank
