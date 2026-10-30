// F41: the end report's payslip — the Company's show around the XP (design/story.md "Credits, payday and fines").
// Credits ARE the XP: the report shows a made-up gross, fines that bring it down, and a net that always equals the
// XP the shift really earned, so fines never slow anyone down. Each rank-up is a payday: the Company takes exactly
// that rank's payment due (xpToNext), split into the bill's items. Numbers in content/tuning/payslip.json; words in
// content/text/en.json payslip. Nothing here is saved: the passage debt is worked out from the rank (debtAt), like
// rank and scraps are from the XP, so it can never disagree with them.
import tuning from '../../content/tuning/payslip.json'
import { createRng, type Rng } from '../engine/rng'
import type { MachineId } from '../engine/types'
import { xpToNext, type ShiftReward } from './progression'

export type PayslipTuning = typeof tuning

// What really happened in the shift — the fines pick these first (App gathers them)
export interface ShiftFacts {
  ruptured: boolean // the tank broke (integrity or overflow)
  broke: MachineId[] // machines that broke at least once
  openCracks: number // cracks still open at the end
  goopLeft: boolean // goop left in the tank at the end (the leftover penalty)
  refusedZaps: number // zaps on goop that couldn't pop
  consoleSeconds: number // time spent at the console mid-shift
  associationFined?: boolean // F40: this device has had the once-only "Association with a retired employee" fine
}
export const NO_FACTS: ShiftFacts = { ruptured: false, broke: [], openCracks: 0, goopLeft: false, refusedZaps: 0, consoleSeconds: 0 }

/** F40: is the once-only fine for knowing the Veteran due on this shift's report? (at or after caughtRank, not had yet) */
export const associationDue = (facts: ShiftFacts, rank: number, t: PayslipTuning = tuning) => rank >= t.caughtRank && !facts.associationFined

/** F40: do the report's words at this rank use the after-capture wording (en.json payslip.afterCaught)? */
export const afterCaught = (rank: number, t: PayslipTuning = tuning) => rank >= t.caughtRank

/** F63: does the report list you under "Pending retirements" (story.md rank 39: "…your name… is on a list…")? From the
 *  shift that reaches pendingRetirementRank on, every report. */
export const pendingRetirement = (rankAfter: number, t: PayslipTuning = tuning) => rankAfter >= t.pendingRetirementRank

// One line on the payslip: what it's for (a key into en.json payslip) and how many credits
export interface PayLine { key: string; amount: number }

export interface Payday {
  from: number // the rank being paid off
  to: number // the rank it leads to
  due: number // the payment due (= the XP rank `from` needed)
  items: PayLine[] // the bill; adds up to exactly `due`
  debt: number // passage debt after this payday
  interest: number // interest added on this payday
}

export interface Payslip {
  firstDay: boolean // "Day one is on us": no fines
  gross: number
  fines: PayLine[] // add up to gross − net
  net: number // = the XP the shift earned
  paydays: Payday[] // one per rank-up, in order
  credits: number // credits after it all (XP into the new rank)
  due: number // the payment due now (0 at the top rank)
  debt: number // passage debt now
  pendingRetirement: boolean // F63: the report shows "Pending retirements: Operator #4471 — <your name>"
}

// The real fines from what happened in the shift (shuffled among themselves when picked)
function realFines(facts: ShiftFacts, t: PayslipTuning): string[] {
  const keys: string[] = []
  if (facts.ruptured) keys.push('rupture')
  for (const m of facts.broke) keys.push(m) // laser · visor · controls
  if (facts.openCracks > 0) keys.push('openCracks')
  if (facts.goopLeft) keys.push('goopLeft')
  if (facts.consoleSeconds >= t.loiterSeconds) keys.push('loitering')
  if (facts.refusedZaps > 0) keys.push('zapping')
  return keys
}

// Split a total into whole parts by weights: each at least 1 (when the total allows), the last takes the rounding
export function split(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0)
  let left = total
  return weights.map((w, i) => {
    if (i === weights.length - 1) return left
    const v = Math.min(left - (weights.length - 1 - i), Math.max(1, Math.round((total * w) / sum)))
    left -= v
    return v
  })
}

function shuffled<T>(items: T[], rng: Rng): T[] {
  const a = items.slice()
  for (let i = a.length - 1; i > 0; i--) { const j = rng.int(i + 1); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

/** The fines for a shift: the once-only association fine first (F40, when due), then the real ones (shuffled among
 *  themselves), topped up with silly ones open at this rank (sillyFines: some only from a rank on). */
export function pickFines(net: number, facts: ShiftFacts, rank: number, rng: Rng, t: PayslipTuning = tuning): PayLine[] {
  const total = Math.round(net * t.fineShare)
  const lines = Math.min(t.fineLines, total)
  if (lines <= 0) return []
  const silly = Object.entries(t.sillyFines).filter(([, from]) => rank >= from).map(([key]) => `silly.${key}`)
  const first = associationDue(facts, rank, t) ? ['fines.association'] : []
  const keys = [...first, ...shuffled(realFines(facts, t), rng).map((k) => `fines.${k}`), ...shuffled(silly, rng)].slice(0, lines)
  const amounts = split(total, keys.map(() => 0.5 + rng.next()))
  return keys.map((key, i) => ({ key, amount: amounts[i] }))
}

/** The bill for one payday: the payment due split by the payday shares; the extra item rotates with the rank. */
export function paydayItems(due: number, from: number, extras: number, t: PayslipTuning = tuning): PayLine[] {
  const names = Object.keys(t.payday) as (keyof PayslipTuning['payday'])[]
  const amounts = split(due, names.map((n) => t.payday[n]))
  return names.map((n, i) => ({ key: n === 'extra' ? `extras.${from % Math.max(1, extras)}` : `payday.${n}`, amount: amounts[i] }))
}

// The interest on the payday from rank `from` — the same every time for that rank (a seeded roll), so debtAt needs no save
function interestAt(from: number, t: PayslipTuning): number {
  const d = t.debt
  const base = d.interestMin + createRng(9001 + from).int(d.interestMax - d.interestMin + 1)
  return from + 1 >= d.afterRank ? base * d.afterMult : base
}
// What the payday from rank `from` pays off the debt (nothing from afterRank on: it only grows then)
function paidOffAt(from: number, t: PayslipTuning): number {
  return from + 1 >= t.debt.afterRank ? 0 : Math.round(xpToNext(from) * t.debt.paidShare)
}

/** Passage debt at a rank: the start, plus every payday's interest, minus what each paid off. */
export function debtAt(rank: number, t: PayslipTuning = tuning): number {
  let debt = t.debt.start
  for (let from = 0; from < rank; from++) debt += interestAt(from, t) - paidOffAt(from, t)
  return debt
}

/** The whole payslip for a finished shift. extras = how many rotating extra items en.json has. */
export function makePayslip(reward: ShiftReward, facts: ShiftFacts, opts: { firstDay: boolean; seed: number; extras: number },
  t: PayslipTuning = tuning): Payslip {
  const rng = createRng(opts.seed)
  const net = reward.xp
  const fines = opts.firstDay ? [] : pickFines(net, facts, reward.before.rank, rng, t)
  const gross = net + fines.reduce((a, f) => a + f.amount, 0)
  const paydays: Payday[] = []
  for (let from = reward.before.rank; from < reward.after.rank; from++) {
    const due = xpToNext(from)
    paydays.push({ from, to: from + 1, due, items: paydayItems(due, from, opts.extras, t), debt: debtAt(from + 1, t), interest: interestAt(from, t) })
  }
  return { firstDay: opts.firstDay, gross, fines, net, paydays, credits: reward.after.xpIntoRank, due: reward.after.xpToNext, debt: debtAt(reward.after.rank, t),
    pendingRetirement: pendingRetirement(reward.after.rank, t) }
}
