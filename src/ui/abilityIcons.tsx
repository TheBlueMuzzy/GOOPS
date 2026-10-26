// F42: each active ability's picture on its HUD charge button (from the button-layout sketch,
// .planning/research/sketches/ability-buttons.html → ACTIVES). Drawn on a 24 × 24 grid in the button's own colour
// (currentColor), so it follows the button: its ink while charging, the bright colour when ready (app.css).
// An id with no picture here (a new active, a test one) gets the lightning bolt.
import type { ReactNode } from 'react'

// a lightning bolt — Cooldown Booster (Muzzy, 2026-10-22)
const bolt = <path d="M13.5 2 4 13.5h6.5L9 22l10-12.5h-6.5L13.5 2z" fill="currentColor" />

const ICONS: Record<string, ReactNode> = {
  cooldownBooster: bolt,
  // three drops of goop — Goop Dump
  goopDump: <path d="M6 2.5c-1.6 2.6-3 4.4-3 6a3 3 0 0 0 6 0c0-1.6-1.4-3.4-3-6zM17.5 1.5c-1.6 2.6-3 4.4-3 6a3 3 0 0 0 6 0c0-1.6-1.4-3.4-3-6zM12 11c-2 3.2-3.7 5.4-3.7 7.4a3.7 3.7 0 0 0 7.4 0c0-2-1.7-4.2-3.7-7.4z" fill="currentColor" />,
  // a paint drop (with a shine cut into it, in the ring's dark middle colour) beside a colour swatch — Goop Colorizer
  goopColorizer: <>
    <path d="M10 2.5C7.4 6.7 5 9.6 5 12.6a5 5 0 0 0 10 0c0-3-2.4-5.9-5-10.1z" fill="currentColor" />
    <rect x="15.5" y="14" width="6" height="6" rx="1.2" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M7.6 12.4a2.6 2.6 0 0 0 2.4 2.7" stroke="var(--surface)" strokeWidth="1.6" fill="none" strokeLinecap="round" />
  </>,
  // a crack, and an arrow down to the floor — Crack Down
  crackDown: <>
    <path d="M9 1.5 6.5 6l3 2.5-3 4 2 2" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
    <path d="M17 3v13m-4.5-4.5L17 16l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
    <path d="M3 21h18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </>,
}

/** The picture for an active ability's charge button (the bolt for one it doesn't know). */
export function AbilityIcon({ id }: { id: string }) {
  return (
    <svg className="hud-ability-icon" viewBox="0 0 24 24" aria-hidden="true" data-picture={id in ICONS ? id : 'cooldownBooster'}>
      {ICONS[id] ?? bolt}
    </svg>
  )
}
