// v1's controls (hooks/useInputHandlers.ts + Game.tsx on archive/goops-v1), rebuilt as one small controller.
// Touch/mouse: drag sideways = spin the tank (joystick: hold past the dead zone to keep spinning) · drag down = fast drop
// · tap goop = pop it · tap empty space = rotate (left half ↺, right half ↻) · quick swipe up = console/pause
// · hold still 1.5 s = swap with the next piece.
// F59: swap unlocks by rank — before that (canSwap false) holding does nothing: no charging ring, no swap.
// Keys (GDD §4, one set, same timing as touch): A D / ← → spin · Q / Right Ctrl ↺, E / Numpad 0 ↻
// · S / ↓ (hold) fast drop · hold R / Right Shift 1.5 s = swap · W / ↑ console/pause.
import tank from '../../content/tuning/tank.json'
import { rulesClock } from '../devkit/gameClock'

// Every timing here (hold-to-swap, spin repeat, a quick swipe's short fast drop) changes the game, so it runs on the
// RULES clock (src/devkit/gameClock.ts): it stands still under the pause menu and the Dev Kit's pauses, and a hold
// that started before a pause doesn't finish the moment it ends.
const clock = () => rulesClock.now()

export interface ControlCallbacks {
  spin(dir: 1 | -1): void
  rotate(dir: 1 | -1): void
  softDrop(on: boolean): void
  tapCell(px: number, py: number): boolean // true if there was goop there (it tried to pop)
  hold(): void
  console(): void
  holdProgress?(p: number | null): void // 0..1 while a hold-to-swap is charging, null when cancelled
  // F59: does swap work right now? (false before its rank, in a lesson shift, or in a lesson step that blocks it) —
  // then a hold never starts charging: no ring, no swap. Left out = always.
  canSwap?(): boolean
  // F24: how many times slower a HELD spin repeats right now (broken controls: 2; fine: 1). Single presses and quick
  // swipes are never slowed — only the repeats while a key or a sideways drag is held.
  spinSlowdown?(): number
}

// F28: the touch distances live in tank.json in rem (dragLockRem, dragDeadZoneRem, flickRem) so they feel the same on
// every phone: 1 rem = the page's root font size (16 px today, so 0.625 rem = the old 10 px). Read at each press, so
// a Dev Kit edit counts from the next touch. (No page in the node tests: 16 px.)
const remPx = (): number => {
  if (typeof document === 'undefined') return 16
  return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
}

// consoleOnly (F32): while isActive() is false, the console control (W / ↑ / a quick flick up) may still work — a
// lesson insisting "go to the console" pauses everything else
export function attachControls(el: HTMLElement, cb: ControlCallbacks, isActive: () => boolean, consoleOnly: () => boolean = () => false) {
  // rem = px per rem at the press · lowest = the furthest DOWN the finger has been (screen y grows downward)
  let ptr: { id: number; x: number; y: number; t: number; locked: 'H' | 'V' | null; consumed: boolean; rem: number; lowest: number } | null = null
  let dragDir: -1 | 0 | 1 = 0
  const keys = new Set<string>()
  let nextSpinAt = -Infinity
  let holdTimer = 0
  let holdStart = 0
  let holdKey: string | null = null // the swap key being held, if any
  let raf = 0
  let stopShortDrop = () => {} // a quick swipe down's fast drop, ending on the rules clock

  // spinning repeats while a key or the drag is held
  const spinDir = (): -1 | 0 | 1 => {
    if (dragDir) return dragDir
    // keys move the VIEW: Left looks further left round the tank, so the goop slides right on screen (Muzzy 2026-10-18:
    // v1's way — Left slid the goop left — "feels reversed"). A drag still pulls the goop along with the finger.
    if (keys.has('ArrowLeft') || keys.has('KeyA')) return -1
    if (keys.has('ArrowRight') || keys.has('KeyD')) return 1
    return 0
  }
  const loop = () => {
    raf = 0
    const dir = spinDir()
    if (!dir) return
    const now = clock()
    if (now >= nextSpinAt && isActive()) { cb.spin(dir); nextSpinAt = now + tank.spinRepeatMs * (cb.spinSlowdown?.() ?? 1) }
    raf = requestAnimationFrame(loop)
  }
  const startLoop = () => { if (!raf) raf = requestAnimationFrame(loop) }

  const swapOn = () => cb.canSwap?.() ?? true
  const clearHold = () => {
    if (holdTimer) { cancelAnimationFrame(holdTimer); holdTimer = 0; cb.holdProgress?.(null) }
  }
  const tickHold = () => {
    if (!ptr && !holdKey) return
    const held = clock() - holdStart
    if (held >= tank.holdDelayMs) cb.holdProgress?.(Math.min(1, (held - tank.holdDelayMs) / (tank.holdToSwapMs - tank.holdDelayMs)))
    if (held >= tank.holdToSwapMs) {
      holdTimer = 0; cb.holdProgress?.(null)
      if (ptr) ptr.consumed = true
      holdKey = null
      if (isActive()) cb.hold()
      return
    }
    holdTimer = requestAnimationFrame(tickHold)
  }

  const down = (e: PointerEvent) => {
    const full = isActive()
    if (ptr || holdKey || !(full || consoleOnly())) return
    el.setPointerCapture(e.pointerId)
    ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, t: clock(), locked: null, consumed: false, rem: remPx(), lowest: e.clientY }
    holdStart = clock()
    if (full && swapOn()) holdTimer = requestAnimationFrame(tickHold) // (console only, or swap still locked: no hold-to-swap)
  }
  const move = (e: PointerEvent) => {
    if (!ptr || e.pointerId !== ptr.id) return
    const dragLock = tank.dragLockRem * ptr.rem, deadZone = tank.dragDeadZoneRem * ptr.rem // (px)
    ptr.lowest = Math.max(ptr.lowest, e.clientY)
    if (!isActive() && consoleOnly()) { // console only: just watch for the flick (no spin, no fast drop)
      if (!ptr.locked && Math.hypot(e.clientX - ptr.x, e.clientY - ptr.y) > dragLock) ptr.locked = 'V'
      return
    }
    const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y
    if (!ptr.locked && (Math.abs(dx) > dragLock || Math.abs(dy) > dragLock)) {
      clearHold()
      ptr.locked = Math.abs(dx) > Math.abs(dy) ? 'H' : 'V'
    }
    if (ptr.locked === 'H') {
      const dir = dx < -deadZone ? 1 : dx > deadZone ? -1 : 0
      if (dir !== dragDir) { dragDir = dir; if (dir) { nextSpinAt = -Infinity; startLoop() } }
    } else if (ptr.locked === 'V') cb.softDrop(dy > 0)
  }
  const up = (e: PointerEvent) => {
    if (!ptr || e.pointerId !== ptr.id) return
    const p = ptr
    ptr = null
    clearHold()
    cb.softDrop(false)
    dragDir = 0
    const dt = clock() - p.t, dx = e.clientX - p.x, dy = e.clientY - p.y
    if (p.consumed) return
    // A quick flick counts only when the drag was locked up/down (C-6: a fast sideways drag whose thumb rises as it
    // lifts isn't a flick). A flick UP opens the console only if the finger never went down first (C-8: a fast drop
    // reversed isn't a flick up) — a dip smaller than the drag lock is just a wobbly thumb, not a drop.
    const flick = p.locked === 'V' && dt < tank.flickMs && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > tank.flickRem * p.rem
    const flickUp = flick && dy < 0 && p.lowest - p.y <= tank.dragLockRem * p.rem
    if (!isActive()) { // console only: a quick flick up is the one thing that works
      if (consoleOnly() && flickUp) cb.console()
      return
    }
    if (!p.locked) {
      if (dt >= tank.holdDelayMs) return // a hold that didn't finish isn't a tap
      if (cb.tapCell(e.clientX, e.clientY)) return
      const r = el.getBoundingClientRect()
      cb.rotate(e.clientX - r.left < r.width / 2 ? -1 : 1)
    } else if (flick) {
      if (flickUp) cb.console()
      else if (dy > 0) { cb.softDrop(true); stopShortDrop(); stopShortDrop = rulesClock.after(tank.flickDropMs, () => cb.softDrop(false)) } // quick swipe down = a short fast-drop
    }
  }
  const cancel = (e: PointerEvent) => { if (ptr && e.pointerId === ptr.id) { ptr = null; clearHold(); cb.softDrop(false); dragDir = 0 } }

  const keyDown = (e: KeyboardEvent) => {
    if (e.repeat || typingIn(e.target)) return // letters typed into a text box are words, not hotkeys
    const k = e.code
    if (!isActive()) { // console only: W / ↑
      if (consoleOnly() && (k === 'KeyW' || k === 'ArrowUp')) { e.preventDefault(); cb.console() }
      return
    }
    if (k === 'ArrowLeft' || k === 'KeyA' || k === 'ArrowRight' || k === 'KeyD') {
      keys.add(k)
      cb.spin(k === 'ArrowLeft' || k === 'KeyA' ? -1 : 1) // (the view moves left: see spinDir)
      nextSpinAt = clock() + tank.spinFirstDelayMs
      startLoop()
    } else if (k === 'KeyQ' || k === 'ControlRight') cb.rotate(-1)
    else if (k === 'KeyE' || k === 'Numpad0') cb.rotate(1)
    else if (k === 'KeyS' || k === 'ArrowDown') { keys.add(k); cb.softDrop(true) }
    else if (k === 'KeyR' || k === 'ShiftRight') {
      // same 1.5 s hold as touch, with the same charging ring
      // (swap still locked: the key does nothing)
      if (!holdKey && !ptr && swapOn()) { holdKey = k; holdStart = clock(); holdTimer = requestAnimationFrame(tickHold) }
    } else if (k === 'KeyW' || k === 'ArrowUp') cb.console()
    else return
    e.preventDefault()
  }
  const keyUp = (e: KeyboardEvent) => {
    keys.delete(e.code)
    if (e.code === 'KeyS' || e.code === 'ArrowDown') cb.softDrop(false)
    if (e.code === holdKey) { holdKey = null; clearHold() }
  }

  // the window lost focus (alt-tab): no keyup will come, so let go of every held key
  const blur = () => {
    if (holdKey) { holdKey = null; clearHold() }
    if (keys.has('KeyS') || keys.has('ArrowDown')) cb.softDrop(false)
    keys.clear()
  }

  el.addEventListener('pointerdown', down)
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerup', up)
  el.addEventListener('pointercancel', cancel)
  window.addEventListener('keydown', keyDown)
  window.addEventListener('keyup', keyUp)
  window.addEventListener('blur', blur)
  return () => {
    el.removeEventListener('pointerdown', down)
    el.removeEventListener('pointermove', move)
    el.removeEventListener('pointerup', up)
    el.removeEventListener('pointercancel', cancel)
    window.removeEventListener('keydown', keyDown)
    window.removeEventListener('keyup', keyUp)
    window.removeEventListener('blur', blur)
    if (raf) cancelAnimationFrame(raf)
    stopShortDrop()
    clearHold()
  }
}

// A text box, a dropdown or an editable area has the keys (e.g. the Dev Kit's search): the game leaves them alone.
function typingIn(target: EventTarget | null): boolean {
  const el = target as { tagName?: string; isContentEditable?: boolean } | null // (no HTMLElement in the node tests)
  return !!el && (!!el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')
}
