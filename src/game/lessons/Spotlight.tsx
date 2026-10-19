// THE SPOTLIGHT (F32, Muzzy's first try: "it's not just about layering, it's about showcasing what we want") — a dim
// over everything with CUT-OUTS (holes: the message's target, the console's screen…), ONE pink outline round the whole
// target (several parts joined into one box), and optionally the message bubble, kept inside the game's column.
// Game-agnostic: the game hands it a `layout()` it measures every frame (page px). It looks exactly like the kit's
// Callout — it reuses the kit's callout parts and classes (bubble, pointer, dim, glow ring) — but the kit Callout has
// one hole, one target and the whole window as its room, so this is the game's own piece for now.
// → Framework session: worth lifting into the kit as a Callout upgrade (holes, pass-through areas, a room box, a
//   bubble-less spotlight, an action that's there from the first frame). Noted in SPRINT Notes (F32).
//
//   holes        undimmed, and taps reach what's under them
//   passThrough  dimmed, but taps still reach what's under them (an insisting step: the tank, so the flick up works)
//   everywhere else, while dimmed, taps stop at the dim
//   focus        the outline (null = none) · frame = the room the bubble may use (it never leaves it)
// The bubble has its whole content — words AND its button — from the first frame, so it never changes shape.
import { useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Button, Row, Stack, Text, placeCallout, type CalloutPlacement } from '../../ui/kit'
import { clip, grow, outsidePath, roundHalf as r, type Box } from './spotlightMath'
import './lessons.css'

export type SpotLayout = { focus: Box | null; holes: Box[]; passThrough?: Box[]; frame: Box }

type Props = {
  layout: () => SpotLayout | null // measured every frame; null = nothing to show right now
  dim: boolean
  dimAmount?: number // 0–1
  text?: string // no words = no bubble (the spotlight only)
  action?: string // the button ("Got it"): there from the first frame
  onAction?: () => void
  placement?: CalloutPlacement
}

export function Spotlight({ layout, dim, dimAmount, text, action, onAction, placement = 'auto' }: Props) {
  const layer = useRef<HTMLDivElement>(null)
  const bubble = useRef<HTMLDivElement>(null)
  const now = useRef({ layout, placement })
  useLayoutEffect(() => { now.current = { layout, placement } })

  useEffect(() => { // above the game and any open screen (the top layer), like the kit's Callout
    const el = layer.current
    if (el?.showPopover && !el.matches(':popover-open')) el.showPopover()
    return () => { if (el?.hidePopover && el.matches(':popover-open')) el.hidePopover() }
  }, [])

  // a dimmed message with a button takes the focus (keys and screen readers land on it); without one, a focus ring
  // left on something under the dim (e.g. the HUD's pause button after its menu closed) is let go, so the only pink
  // ring on screen is the spotlight's own
  useEffect(() => {
    if (dim && !action && document.activeElement instanceof HTMLElement && !layer.current?.contains(document.activeElement)) document.activeElement.blur()
    if (!dim || !action) return
    const frame = requestAnimationFrame(() => bubble.current?.querySelector('button')?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(frame)
  }, [dim, action])

  // place it all every frame (targets move, slide, appear late); write only what changed
  useLayoutEffect(() => {
    let frame = 0
    const last: Record<string, string> = {}
    const write = (el: HTMLElement | null, key: string, value: string, apply: (el: HTMLElement, v: string) => void) => {
      if (!el || last[key] === value) return
      last[key] = value
      apply(el, value)
    }
    const place = () => {
      const el = layer.current
      if (!el) return
      const spot = now.current.layout()
      if (!spot) { write(el, 'ready', '', (e) => e.removeAttribute('data-ready')); return }
      const w = window.innerWidth, h = window.innerHeight
      const space = parseFloat(getComputedStyle(el.querySelector('.kit-callout-frame')!).columnGap) || 0 // (the kit's gap-s)
      const holes = spot.holes.map((b) => grow(b, space))
      // (the outline stays on screen: a target running off the window's edge is outlined to that edge)
      const edge = 2
      const focus = spot.focus && clip(grow(spot.focus, space), { left: edge, top: edge, right: w - edge, bottom: h - edge })
      write(el.querySelector('.kit-callout-dim'), 'dim', outsidePath(holes, w, h), (e, v) => { e.style.clipPath = v })
      write(el.querySelector('.lesson-spot-block'), 'block', outsidePath([...holes, ...(spot.passThrough ?? [])], w, h), (e, v) => { e.style.clipPath = v })
      const ring = el.querySelector<HTMLElement>('.kit-callout-ring')
      write(ring, 'ring', focus ? [focus.left, focus.top, focus.right, focus.bottom].map(r).join() : 'none', (e, v) => {
        e.style.display = v === 'none' ? 'none' : ''
        if (!focus) return
        el.style.setProperty('--kit-hole-l', `${r(focus.left)}px`); el.style.setProperty('--kit-hole-t', `${r(focus.top)}px`)
        el.style.setProperty('--kit-hole-r', `${r(focus.right)}px`); el.style.setProperty('--kit-hole-b', `${r(focus.bottom)}px`)
      })
      const box = bubble.current
      if (box) {
        const tip = box.querySelector<HTMLElement>('.kit-callout-tip')!
        const frameBox = spot.frame
        write(box, 'maxw', `${Math.max(0, Math.floor(frameBox.right - frameBox.left))}px`, (e, v) => { e.style.maxInlineSize = v })
        // keep clear of everything shown (the target and the other holes), point at the target (else the holes)
        const avoid = [...holes, ...(focus ? [focus] : [])]
        const around: Box = avoid.length
          ? avoid.reduce((a, b) => ({ left: Math.min(a.left, b.left), top: Math.min(a.top, b.top), right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom) }))
          : { left: (frameBox.left + frameBox.right) / 2, top: (frameBox.top + frameBox.bottom) / 2, right: (frameBox.left + frameBox.right) / 2, bottom: (frameBox.top + frameBox.bottom) / 2 }
        const tipSize = tip.offsetWidth, reach = tipSize * Math.SQRT1_2
        const size = { width: box.offsetWidth, height: box.offsetHeight }
        const radius = parseFloat(getComputedStyle(box).borderTopLeftRadius) || 0
        const tipInset = Math.min(Math.min(size.width, size.height) / 2, radius + reach)
        const at = placeCallout(around, size, frameBox, reach + tipSize * 0.25, now.current.placement, tipInset)
        const border = (box.offsetWidth - box.clientWidth) / 2
        const tipX = at.tipX - border + (at.side === 'left' ? -border / 2 : at.side === 'right' ? border / 2 : 0)
        const tipY = at.tipY - border + (at.side === 'top' ? -border / 2 : at.side === 'bottom' ? border / 2 : 0)
        write(el, 'bubble', [at.x, at.y, tipX, tipY].map(r).join() + at.side, (e) => {
          e.style.setProperty('--kit-callout-x', `${r(at.x)}px`); e.style.setProperty('--kit-callout-y', `${r(at.y)}px`)
          e.style.setProperty('--kit-callout-tip-x', `${r(tipX)}px`); e.style.setProperty('--kit-callout-tip-y', `${r(tipY)}px`)
          e.setAttribute('data-side', at.side)
        })
      }
      write(el, 'ready', 'yes', (e) => e.setAttribute('data-ready', ''))
    }
    const loop = () => { place(); frame = requestAnimationFrame(loop) }
    place()
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [])

  const dimShare = dimAmount === undefined ? undefined : `${Math.round(Math.max(0, Math.min(1, dimAmount)) * 100)}%`
  const content = (
    <div ref={layer} {...{ popover: 'manual' }} className="kit-scope kit-callout-layer lesson-spot" data-dim={dim || undefined}
      style={{ '--kit-callout-dim': dimShare } as CSSProperties}>
      <div className="kit-callout-frame" aria-hidden />
      {/* the dim you see (taps go through it here: the block below decides where they stop) */}
      {dim && <div className="kit-callout-dim" aria-hidden style={{ pointerEvents: 'none' }} />}
      {dim && <div className="lesson-spot-block" aria-hidden />}
      <div className="kit-callout-ring" aria-hidden />
      {text && (
        <div ref={bubble} className="kit-callout" role={dim && action ? 'dialog' : 'status'} aria-live={dim && action ? undefined : 'polite'} aria-label="Tip">
          <Stack gap="s" className="kit-callout-body">
            <Text><span className="lesson-words">{text}</span></Text>
            {action && <Row justify="end"><Button onClick={onAction}>{action}</Button></Row>}
          </Stack>
          <span className="kit-callout-tip" aria-hidden />
        </div>
      )}
    </div>
  )
  return typeof document === 'undefined' ? null : createPortal(content, document.body)
}
