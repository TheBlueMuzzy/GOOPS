// PORTRAIT ONLY (F32, Muzzy 2026-10-19: "a phone held sideways should never affect the orientation of the game. the
// game is a portrait only game"). A web page can't stop a phone from turning, so:
//   1. where the browser allows it (Android, fullscreen or installed) the screen is locked upright — tried at start-up
//      and on the first touch; anywhere else the browser says no and nothing happens;
//   2. a touch phone held sideways (a finger for a pointer + a landscape screen) gets a full-screen "Turn your phone
//      upright" card over everything (Upright.tsx); App pauses the shift under it (its own pause: the rules clock
//      stops) and it carries on exactly where it was when the phone is upright again.
// A short desktop WINDOW (a mouse for a pointer) is not a phone on its side: it keeps its own layout.
import { useEffect, useSyncExternalStore } from 'react'

const SIDEWAYS = '(pointer: coarse) and (orientation: landscape)'
const subscribe = (on: () => void) => { const q = matchMedia(SIDEWAYS); q.addEventListener('change', on); return () => q.removeEventListener('change', on) }
/** A touch phone (or tablet) held sideways. */
export const useSideways = () => useSyncExternalStore(subscribe, () => matchMedia(SIDEWAYS).matches)

type Lockable = ScreenOrientation & { lock?: (o: 'portrait') => Promise<void> }
/** Ask the browser to keep the screen upright; it only agrees in fullscreen or an installed app (else it says no). */
export function lockPortrait() {
  try {
    const o = (typeof screen !== 'undefined' ? screen.orientation : undefined) as Lockable | undefined
    o?.lock?.('portrait')?.catch(() => {})
  } catch { /* (not allowed here) */ }
}

/** Tries the lock at start-up and on the first touch (some browsers only allow it after one). */
export function usePortraitLock() {
  useEffect(() => {
    lockPortrait()
    const once = () => lockPortrait()
    window.addEventListener('pointerdown', once, { once: true, capture: true })
    return () => window.removeEventListener('pointerdown', once, { capture: true })
  }, [])
}
