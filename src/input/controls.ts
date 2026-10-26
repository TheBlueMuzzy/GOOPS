// v1's controls (hooks/useInputHandlers.ts + Game.tsx on archive/goops-v1), rebuilt as one small controller.
// Touch/mouse: drag sideways = spin the tank (joystick: hold past the dead zone to keep spinning) · drag down = fast drop
// · tap goop = pop it · tap empty space = rotate (left half ↺, right half ↻) · quick swipe up = console/pause
// · hold still 1.5 s = swap with the next piece.
// F28 (Muzzy 2026-10-20, GDD §4 "Touch, finger by finger"): EVERY FINGER IS ITS OWN GESTURE. Each finger on the glass
// is tracked on its own (by pointerId) and does what its own touch says — one finger can spin while another taps,
// holds to swap, flicks up or drags down. Two rules keep two fingers from fighting:
//   · the spin belongs to the FIRST finger that drags sideways, until it lifts — another finger's sideways drag does
//     nothing ("drag hold is already being used"); the fast drop belongs to the first finger that drags down, the same way
//     (and only its lift ends the drop). Spin and fast drop are different gestures: one finger each, both at once.
//   · only ONE hold charges a swap at a time (the first finger to hold still, or a held key — never both).
// F59: swap unlocks by rank — before that (canSwap false) holding does nothing: no charging ring, no swap.
// Keys (GDD §4, one set, same timing as touch): A D / ← → spin · Q / Right Ctrl ↺, E / Numpad 0 ↻
// · S / ↓ (hold) fast drop · hold R / Right Shift 1.5 s = swap · W / ↑ console/pause
// · F / Numpad . = fire the equipped active (F34, Cooldown Booster; refused unless it's charged)
// · 1 / 2 / 3 = fire the 1st / 2nd / 3rd equipped active (F42: up to three equipped; F / Numpad . stay on the 1st).
import tank from '../../content/tuning/tank.json'
import { rulesClock } from '../devkit/gameClock'

// Every timing here (hold-to-swap, spin repeat, a quick swipe's short fast drop) changes the game, so it runs on the
// RULES clock (src/devkit/gameClock.ts): it stands still under the pause menu and the Dev Kit's pauses, and a hold
// that started before a pause doesn't finish the moment it ends.
const clock = () => rulesClock.now()

// F42: the number keys along the top of the keyboard that fire the 1st / 2nd / 3rd equipped active
const ABILITY_KEYS = ['Digit1', 'Digit2', 'Digit3']

export interface ControlCallbacks {
  spin(dir: 1 | -1): void
  rotate(dir: 1 | -1): void
  softDrop(on: boolean): void
  tapCell(px: number, py: number): boolean // true if there was goop there (it tried to pop)
  hold(): void
  console(): void
  // F34: fire an equipped active ability — slot 0 = the first equipped (F / Numpad . / 1), 1 = the second (2), 2 = the
  // third (3) (F42); the HUD's charge buttons do the same. Left out = the keys are left alone.
  ability?(slot: number): void
  // 0..1 while a hold-to-swap is charging, null when it ends. at = where the holding finger (or mouse) is, in page px —
  // the swap timer is drawn beside it (F28); no `at` = a held key (the HUD's Swap bar shows it).
  holdProgress?(p: number | null, at?: { x: number; y: number }): void
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

// One finger (or the mouse) on the tank, from press to lift.
// x, y = where it pressed · nowX, nowY = where it is now · t = when it pressed · locked = the drag's axis once it moves
// past the drag lock (H sideways, V up/down) · consumed = its hold already swapped (the lift does nothing more)
// · rem = px per rem at the press · lowest = the furthest DOWN it has been (screen y grows downward)
interface Finger { id: number; x: number; y: number; nowX: number; nowY: number; t: number; locked: 'H' | 'V' | null; consumed: boolean; rem: number; lowest: number }

// consoleOnly (F32): while isActive() is false, the console control (W / ↑ / a quick flick up) may still work — a
// lesson insisting "go to the console" pauses everything else
export function attachControls(el: HTMLElement, cb: ControlCallbacks, isActive: () => boolean, consoleOnly: () => boolean = () => false) {
  const fingers = new Map<number, Finger>() // every finger down right now, by pointerId (a finger that pressed while the tank was off isn't here)
  let spinFinger: number | null = null // the finger that owns the sideways drag (the first to lock sideways)
  let dropFinger: number | null = null // the finger that owns the fast drop (the first to lock up/down)
  let dragDir: -1 | 0 | 1 = 0 // the spin finger's direction right now (0 = inside the dead zone, or no spin finger)
  const keys = new Set<string>()
  let nextSpinAt = -Infinity
  let holdTimer = 0
  let holdStart = 0
  let holdKey: string | null = null // the swap key being held, if any
  let holdFinger: number | null = null // the finger charging a swap, if any (only one hold charges at a time)
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

  // ── hold to swap: one charge at a time, a finger's or a key's ──
  const swapOn = () => cb.canSwap?.() ?? true
  const startHold = (by: { finger: number } | { key: string }) => {
    if ('finger' in by) holdFinger = by.finger
    else holdKey = by.key
    holdStart = clock()
    holdTimer = requestAnimationFrame(tickHold)
  }
  const keyDrop = () => keys.has('KeyS') || keys.has('ArrowDown') // S / ↓ held: a finger letting go mustn't end that drop
  const stopHold = () => {
    holdFinger = null; holdKey = null
    if (holdTimer) { cancelAnimationFrame(holdTimer); holdTimer = 0; cb.holdProgress?.(null) }
  }
  const tickHold = () => {
    const f = holdFinger !== null ? fingers.get(holdFinger) : undefined
    if (!f && !holdKey) { holdTimer = 0; return }
    if (!isActive()) { stopHold(); return } // paused (a lesson, the Dev Kit, a menu): the charge is dropped, no frozen ring
    const at = f ? { x: f.nowX, y: f.nowY } : undefined
    const held = clock() - holdStart
    if (held >= tank.holdDelayMs) cb.holdProgress?.(Math.min(1, (held - tank.holdDelayMs) / (tank.holdToSwapMs - tank.holdDelayMs)), at)
    if (held >= tank.holdToSwapMs) {
      if (f) f.consumed = true
      holdTimer = 0; stopHold(); cb.holdProgress?.(null)
      if (isActive()) cb.hold()
      return
    }
    holdTimer = requestAnimationFrame(tickHold)
  }

  // A finger's gesture ends (lifted or cancelled): let go of whatever it owned. Only its own things — another finger's
  // spin, fast drop or charge carries on.
  const letGo = (f: Finger) => {
    fingers.delete(f.id)
    if (holdFinger === f.id) stopHold()
    if (spinFinger === f.id) { spinFinger = null; dragDir = 0 }
    if (dropFinger === f.id) { dropFinger = null; if (!keyDrop()) cb.softDrop(false) }
  }

  const down = (e: PointerEvent) => {
    const full = isActive()
    if (!(full || consoleOnly())) return // the tank is off: this finger is ignored until it lifts
    el.setPointerCapture(e.pointerId)
    const f: Finger = { id: e.pointerId, x: e.clientX, y: e.clientY, nowX: e.clientX, nowY: e.clientY, t: clock(), locked: null, consumed: false, rem: remPx(), lowest: e.clientY }
    fingers.set(f.id, f)
    // it starts charging a swap unless another finger or a key already is (console only, or swap still locked: no hold)
    if (full && swapOn() && holdFinger === null && !holdKey) startHold({ finger: f.id })
  }
  const move = (e: PointerEvent) => {
    const f = fingers.get(e.pointerId)
    if (!f) return
    const dragLock = tank.dragLockRem * f.rem, deadZone = tank.dragDeadZoneRem * f.rem // (px)
    f.nowX = e.clientX; f.nowY = e.clientY
    f.lowest = Math.max(f.lowest, e.clientY)
    if (!isActive() && consoleOnly()) { // console only: just watch for the flick (no spin, no fast drop)
      if (!f.locked && Math.hypot(e.clientX - f.x, e.clientY - f.y) > dragLock) f.locked = 'V'
      return
    }
    const dx = e.clientX - f.x, dy = e.clientY - f.y
    if (!f.locked && (Math.abs(dx) > dragLock || Math.abs(dy) > dragLock)) {
      if (holdFinger === f.id) stopHold() // moving cancels only this finger's own charge
      f.locked = Math.abs(dx) > Math.abs(dy) ? 'H' : 'V'
      // the first finger to drag this way owns it until it lifts (a second one dragging the same way does nothing)
      if (f.locked === 'H' && spinFinger === null) spinFinger = f.id
      if (f.locked === 'V' && dropFinger === null) { dropFinger = f.id; stopShortDrop() }
    }
    if (spinFinger === f.id) {
      const dir = dx < -deadZone ? 1 : dx > deadZone ? -1 : 0
      if (dir !== dragDir) { dragDir = dir; if (dir) { nextSpinAt = -Infinity; startLoop() } }
    } else if (dropFinger === f.id) cb.softDrop(dy > 0)
  }
  const up = (e: PointerEvent) => {
    const f = fingers.get(e.pointerId)
    if (!f) return
    const ownedDrop = dropFinger === f.id
    letGo(f)
    const dt = clock() - f.t, dx = e.clientX - f.x, dy = e.clientY - f.y
    if (f.consumed) return
    // A quick flick counts only when the drag was locked up/down (C-6: a fast sideways drag whose thumb rises as it
    // lifts isn't a flick). A flick UP opens the console only if the finger never went down first (C-8: a fast drop
    // reversed isn't a flick up) — a dip smaller than the drag lock is just a wobbly thumb, not a drop.
    const flick = f.locked === 'V' && dt < tank.flickMs && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > tank.flickRem * f.rem
    const flickUp = flick && dy < 0 && f.lowest - f.y <= tank.dragLockRem * f.rem
    if (!isActive()) { // console only: a quick flick up is the one thing that works
      if (consoleOnly() && flickUp) cb.console()
      return
    }
    if (!f.locked) {
      if (dt >= tank.holdDelayMs) return // a hold that didn't finish isn't a tap
      if (cb.tapCell(e.clientX, e.clientY)) return
      const r = el.getBoundingClientRect()
      cb.rotate(e.clientX - r.left < r.width / 2 ? -1 : 1)
    } else if (flick) {
      if (flickUp) cb.console() // (any finger's flick up — the console isn't owned)
      else if (dy > 0 && ownedDrop) { // quick swipe down = a short fast-drop (not from a finger that never owned the drop)
        cb.softDrop(true); stopShortDrop()
        stopShortDrop = rulesClock.after(tank.flickDropMs, () => { if (dropFinger === null && !keyDrop()) cb.softDrop(false) }) // (a new drag-down or a held S / ↓ keeps its drop)
      }
    }
  }
  const cancel = (e: PointerEvent) => { const f = fingers.get(e.pointerId); if (f) letGo(f) } // (the system took the finger: no gesture)

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
      // same 1.5 s hold as touch; its timer is the HUD's Swap bar (a finger's is drawn beside the finger)
      // (swap still locked, or a finger already charging: the key does nothing)
      if (!holdKey && holdFinger === null && swapOn()) startHold({ key: k })
    } else if (k === 'KeyW' || k === 'ArrowUp') cb.console()
    else if ((k === 'KeyF' || k === 'NumpadDecimal') && cb.ability) cb.ability(0) // F34: fire the first equipped active
    else if (ABILITY_KEYS.includes(k) && cb.ability) cb.ability(ABILITY_KEYS.indexOf(k)) // F42: 1 / 2 / 3 = slot 1 / 2 / 3
    else return
    e.preventDefault()
  }
  const keyUp = (e: KeyboardEvent) => {
    keys.delete(e.code)
    if (e.code === 'KeyS' || e.code === 'ArrowDown') cb.softDrop(false)
    if (e.code === holdKey) stopHold()
  }

  // the window lost focus (alt-tab): no keyup will come, so let go of every held key
  const blur = () => {
    if (holdKey) stopHold()
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
    for (const f of [...fingers.values()]) letGo(f) // (every finger: no stuck spin, fast drop or charge)
    if (raf) cancelAnimationFrame(raf)
    stopShortDrop()
    stopHold()
  }
}

// A text box, a dropdown or an editable area has the keys (e.g. the Dev Kit's search): the game leaves them alone.
function typingIn(target: EventTarget | null): boolean {
  const el = target as { tagName?: string; isContentEditable?: boolean } | null // (no HTMLElement in the node tests)
  return !!el && (!!el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')
}
