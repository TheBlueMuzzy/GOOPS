// A phone on its side: the kit's "short window" (30rem tall or less — the same line its CSS uses), for the few places
// where the game shows something different there (the console mid-shift, the machines' meters).
import { useSyncExternalStore } from 'react'

const SHORT = '(max-height: 30rem)'
const subscribe = (on: () => void) => { const q = matchMedia(SHORT); q.addEventListener('change', on); return () => q.removeEventListener('change', on) }
export const useShort = () => useSyncExternalStore(subscribe, () => matchMedia(SHORT).matches)
