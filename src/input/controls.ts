// v1's controls (hooks/useInputHandlers.ts + Game.tsx on archive/goops-v1), rebuilt as one small controller.
// Touch/mouse: drag sideways = spin the tank (joystick: hold past the dead zone to keep spinning) · drag down = fast drop
// · tap goop = pop it · tap empty space = rotate (left half ↺, right half ↻) · quick swipe up = console/pause
// · hold still 1.5 s = swap with the held piece.
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
  // F24: how many times slower a HELD spin repeats right now (broken controls: 2; fine: 1). Single presses and quick
  // swipes are never slowed — only the repeats while a key or a sideways drag is held.
  spinSlowdown?(): number
}

const DRAG_LOCK = 10 // px before a touch counts as a drag
const DRAG_DEADZONE = 20 // px sideways before the tank starts spinning
const SWIPE_MS = 300
const SWIPE_PX = 50

export function attachControls(el: HTMLElement, cb: ControlCallbacks, isActive: () => boolean) {
  let ptr: { id: number; x: number; y: number; t: number; locked: 'H' | 'V' | null; consumed: boolean } | null = null
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
    if (ptr || holdKey || !isActive()) return
    el.setPointerCapture(e.pointerId)
    ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, t: clock(), locked: null, consumed: false }
    holdStart = clock()
    holdTimer = requestAnimationFrame(tickHold)
  }
  const move = (e: PointerEvent) => {
    if (!ptr || e.pointerId !== ptr.id) return
    const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y
    if (!ptr.locked && (Math.abs(dx) > DRAG_LOCK || Math.abs(dy) > DRAG_LOCK)) {
      clearHold()
      ptr.locked = Math.abs(dx) > Math.abs(dy) ? 'H' : 'V'
    }
    if (ptr.locked === 'H') {
      const dir = dx < -DRAG_DEADZONE ? 1 : dx > DRAG_DEADZONE ? -1 : 0
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
    if (p.consumed || !isActive()) return
    if (!p.locked) {
      if (dt >= tank.holdDelayMs) return // a hold that didn't finish isn't a tap
      if (cb.tapCell(e.clientX, e.clientY)) return
      const r = el.getBoundingClientRect()
      cb.rotate(e.clientX - r.left < r.width / 2 ? -1 : 1)
    } else if (dt < SWIPE_MS && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > SWIPE_PX) {
      if (dy < 0) cb.console()
      else { cb.softDrop(true); stopShortDrop(); stopShortDrop = rulesClock.after(150, () => cb.softDrop(false)) } // quick swipe down = a short fast-drop
    }
  }
  const cancel = (e: PointerEvent) => { if (ptr && e.pointerId === ptr.id) { ptr = null; clearHold(); cb.softDrop(false); dragDir = 0 } }

  const keyDown = (e: KeyboardEvent) => {
    if (!isActive() || e.repeat || typingIn(e.target)) return // letters typed into a text box are words, not hotkeys
    const k = e.code
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
      if (!holdKey && !ptr) { holdKey = k; holdStart = clock(); holdTimer = requestAnimationFrame(tickHold) }
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
