// What the Upgrades screen (UpgradesScreen.tsx) needs from the App: the progress, the rank the player plays at, and
// where a change goes (the App saves it at once). A context, so the screen stays mounted while you buy.
import { createContext } from 'react'
import type { Progress } from '../progress/progression'

export type UpgradeShop = { progress: Progress; rank: number; onChange(p: Progress): void }
export const UpgradeShopContext = createContext<UpgradeShop | null>(null)
