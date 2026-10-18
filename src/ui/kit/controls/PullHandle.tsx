// PULL HANDLE (0.12.0) — a lever, periscope or cord the player drags to make something happen (Goops: pull the
// periscope down to start a shift). It's a real button: a TAP (or Enter / Space) pulls it all the way by itself, so
// nobody has to drag. Dragging moves it along `direction` up to `travel` (a share of its own length, e.g. 0.5 = half
// its height); let go past `threshold` (share of the travel) and it finishes the pull, short of it and it springs back.
// children = what it looks like (usually the game's picture). label = its name, read out and found by tests.
// pulled: keep it at the end (e.g. while the screen changes); it springs back when this goes false again.
// The drag share is on the element as --kit-pull (0 → 1), so a game's art can follow it.
import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { controlSound } from './controlSound'
import { motionTime } from '../blocks/motion'

type PullHandleProps = {
  label: string
  onPull: () => void
  direction?: 'down' | 'up' | 'left' | 'right'
  travel?: number
  threshold?: number
  pulled?: boolean
  disabled?: boolean
  className?: string
  children?: ReactNode
}

const TAP_SLOP = 0.5 // rem a press may wander and still count as a tap

export function PullHandle({ label, onPull, direction = 'down', travel = 0.5, threshold = 0.6, pulled = false, disabled, className = '', children }: PullHandleProps) {
  const [drag, setDrag] = useState<number | null>(null) // 0 → 1 while a finger holds it
  const [finishing, setFinishing] = useState(false) // let go past the threshold / tapped: gliding to the end
  const start = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null)
  const dragged = useRef(false) // the press was a drag, so the click that follows it isn't a tap
  const vertical = direction === 'down' || direction === 'up'
  const sign = direction === 'down' || direction === 'right' ? 1 : -1

  const finish = () => {
    if (disabled) return
    setFinishing(true)
    controlSound('tap')
    // glide to the end first (the style's normal time), then act — no glide with reduce motion
    window.setTimeout(() => { setFinishing(false); onPull() }, motionTime('motion-normal'))
  }
  const remPx = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16

  function onPointerDown(e: PointerEvent<HTMLButtonElement>) {
    if (disabled || pulled || finishing || (e.pointerType === 'mouse' && e.button !== 0)) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    start.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false }
    dragged.current = false
  }
  function onPointerMove(e: PointerEvent<HTMLButtonElement>) {
    const s = start.current
    if (!s || s.id !== e.pointerId) return
    const along = (vertical ? e.clientY - s.y : e.clientX - s.x) * sign
    const across = vertical ? e.clientX - s.x : e.clientY - s.y
    if (!s.moved && Math.hypot(along, across) < TAP_SLOP * remPx()) return
    s.moved = true
    const box = e.currentTarget.getBoundingClientRect()
    const length = (vertical ? box.height : box.width) * travel
    setDrag(Math.max(0, Math.min(1, along / Math.max(1, length))))
  }
  function onPointerUp(e: PointerEvent<HTMLButtonElement>) {
    const s = start.current
    if (!s || s.id !== e.pointerId) return
    start.current = null
    if (!s.moved) { setDrag(null); return } // a tap: the click that follows does the pull
    dragged.current = true
    const share = drag ?? 0
    setDrag(null)
    if (share >= threshold) finish()
  }
  function onPointerCancel() { start.current = null; setDrag(null) }
  function onClick() {
    if (dragged.current) { dragged.current = false; return }
    if (!pulled && !finishing) finish()
  }
  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    // the arrow it's pulled with pulls it too (Enter / Space already click)
    const keys = { down: 'ArrowDown', up: 'ArrowUp', left: 'ArrowLeft', right: 'ArrowRight' }
    if (e.key === keys[direction] && !pulled && !finishing) { e.preventDefault(); finish() }
  }

  const share = pulled || finishing ? 1 : drag ?? 0
  return (
    <button type="button" className={`kit-pull ${className}`} aria-label={label} disabled={disabled}
      data-direction={direction} data-dragging={drag !== null || undefined} data-pulled={pulled || finishing || undefined}
      style={{ '--kit-pull': share, '--kit-pull-travel': travel } as CSSProperties}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}
      onClick={onClick} onKeyDown={onKeyDown}>
      {children}
    </button>
  )
}
