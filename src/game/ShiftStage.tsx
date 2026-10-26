// The playing field: the tank canvas (2D, under), the goo canvas (WebGL, over), the controls, and the frame loop that
// ticks the engine and hands its state + events to both. React only renders this once; per-frame work uses refs.
// It also decides where the tank sits around the HUD (F26, Muzzy's mock-up; F59 his second one): one top row above it,
// the bottom panel under it (or beside it on a phone on its side), and the pressure readout hanging on the pressure line.
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { crackCells, whiteGoopAt, type MachineId, type ShiftEngine, type ShiftEvent, type ShiftStatus, type ShiftPhase, type ShiftState, type TapPoint } from '../engine'
import { createWhiteGoopView } from '../view/whiteGoopView'
import whiteGoopLook from '../../content/tuning/whiteGoop.json'
import talk from '../../content/tuning/talk.json'
import text from '../../content/text/en.json'
import type { GooRenderer, GooView } from '../goo/types'
import { colorOf, makeGoo } from './gooFactory'
import { drawTank } from '../view/tankView'
import { createDropGuide } from '../view/dropGuide'
import { createCrackBubbles, crackIsOpen } from '../view/crackBubbles'
import cracksLook from '../../content/tuning/cracks-look.json'
import { layoutTank, pieceScreenColumn, screenToVisibleCell, stepCamera, tankRect } from '../view/geometry'
import { attachControls } from '../input/controls'
import { gooStyle } from './gooStyle'
import { wallKick } from './wallKick'
import { readoutSetting, type ReadoutSetting } from './readoutSetting'
import { createMessages, type Message, type MessageTuning } from './messages'
import { bentPoint, createVisorFx, curvedY, flatPoint, type VisorFx } from '../view/visorFx'
import { createZapBeam } from '../view/zapBeam'
import { zapLook } from '../goo/shared/zap'
import type { FaceStory } from '../goo/shared/faces'
import { screenColumn } from '../goo/types'
import { PinnedBox, TalkingBubble, reduceMotion } from '../ui/kit'
import tank from '../../content/tuning/tank.json'
import hud from '../../content/tuning/hud.json'
import breakdowns from '../../content/tuning/breakdowns.json'
import messageTuning from '../../content/tuning/messages.json'
import pauseTuning from '../../content/tuning/pause.json'
import { clockPause, looksClock, rulesClock } from '../devkit/gameClock'
import { onTuning } from '../devkit/tuning/liveTuning'
import { session } from './session'
import { lessonPlay, placeLessonMark, runner as lessonRunner } from './lessons/goopsLessons'
import { playGameSound, playShiftSounds } from './sound'
import { SOUNDS } from './shiftSounds'
import type { NextPiece } from './NextWindow'
import './game.css'

const HUD_SIDE_ROOM = 16 // CSS px the HUD may reach past each side of the tank (the kit's screen edge gap)
const HUD_MIN_WIDTH = 360 // the HUD needs a narrow phone's width even when the tank is smaller (a phone on its side)
const PIN_GAP = 8 // CSS px kept between the messages and the HUD's top row

export interface HudSnapshot {
  pressure: number
  score: number
  cracksSealed: number
  cracksNeeded: number
  integrity: number
  phase: ShiftPhase
  holdProgress: number | null
  next: NextPiece | null // F59: the piece after the falling one (the next-piece window shows it)
  // the console's machines (F23/F24): only unlocked ones get a bar; broken ones light their repair panel.
  // breaks = how many times each has broken this shift (a new repair puzzle each time)
  machines: Record<MachineId, { unlocked: boolean; health: number; broken: boolean }>
  breaks: Record<MachineId, number>
  // F34 / F42: the equipped actives, in equip order (none to three): each one's charge 0..1 and whether it's full — the
  // HUD's charge buttons, one each
  abilities: { id: string; charge: number; ready: boolean }[]
}

interface Props {
  engine: ShiftEngine
  speed: number // how fast the shift runs: 1 = playing, 0 = paused, consoleTimeScale while at the console mid-shift
  inputOn: boolean // the tank takes touches and keys (not while the console or a menu is over it)
  // the bottom panel (App draws it, kit Hud dock): 'machines' = machine bars + integrity, 'integrity' = integrity only
  // (shorter). Known when the shift starts, so the panel never changes height mid-shift.
  panel: 'machines' | 'integrity'
  side: boolean // a phone on its side: the panel is a column beside the tank, which keeps the whole height
  nextWindow: boolean // F59: the next-piece window shows in the bottom panel (from its rank) — the panel is at least its height
  // F42: the charge buttons' row in the bottom panel, above the machine bars: its height in px (0 = no row) — the panel
  // grows by it (+ the small gap under it) and the tank gets that much shorter. Known when the shift starts.
  abilityRowPx: number
  // F43 Goop Swap: × how long a hold takes to swap (the shift's swapHoldTimeMult; 1 = no upgrade) — the input layer reads it
  swapHoldMult: number
  readout: ReactNode // the pressure readout's words ("10% PSI"), hung on the pressure line by the frame loop
  onHud(h: HudSnapshot): void
  onEnd(status: ShiftStatus): void
  onMessage(m: Message): void // a short in-shift message to show (src/game/messages.ts decides which)
  onConsole(): void
}

export function ShiftStage({ engine, speed, inputOn, panel, side, nextWindow, abilityRowPx, swapHoldMult, readout, onHud, onEnd, onMessage, onConsole }: Props) {
  const style = useSyncExternalStore(gooStyle.subscribe, gooStyle.get)
  const readoutAt = useSyncExternalStore(readoutSetting.subscribe, readoutSetting.get)
  const host = useRef<HTMLDivElement>(null)
  const tankCanvas = useRef<HTMLCanvasElement>(null)
  const gooCanvas = useRef<HTMLCanvasElement>(null)
  const readoutCanvas = useRef<HTMLCanvasElement>(null)
  const zapCanvas = useRef<HTMLCanvasElement>(null) // F67 the zap's beam, above the visor
  const readoutEl = useRef<HTMLDivElement>(null)
  const lessonMark = useRef<HTMLDivElement>(null)
  const swapRing = useRef<SVGSVGElement>(null)
  // F63: the white goop's "ow" when the laser goes through him — the game's whisper bubble (kit TalkingBubble, plain
  // outline), above him; n = which ow (a new one restarts the bubble). Set only on the event, never per frame.
  const [ow, setOw] = useState<{ x: number; y: number; n: number } | null>(null)
  const live = useRef({ inputOn, readoutAt, swapHoldMult, onHud, onEnd, onMessage, onConsole })
  useEffect(() => { live.current = { inputOn, readoutAt, swapHoldMult, onHud, onEnd, onMessage, onConsole } })
  // THE RULES CLOCK (src/devkit/gameClock.ts): how fast the shift runs. The Dev Kit's ⏸ / ◐ pauses stop it on top
  // of this (rulesClock.rate = 0); the frame loop ticks the engine by rate.
  useEffect(() => { rulesClock.scale = speed }, [speed])

  // the Settings "Wall kick" row: applied now and whenever it changes
  useEffect(() => {
    engine.setWallKick(wallKick.get())
    return wallKick.subscribe(() => engine.setWallKick(wallKick.get()))
  }, [engine])
  const viewRef = useRef<GooView | null>(null)
  const layoutRef = useRef({ panel, side, nextWindow, abilityRowPx })
  const relayout = useRef<() => void>(() => {})
  // (a phone turned on its side, or a new shift's panel: the tank re-fits straight away)
  useEffect(() => { layoutRef.current = { panel, side, nextWindow, abilityRowPx }; relayout.current() }, [panel, side, nextWindow, abilityRowPx])

  // the goo renderer: rebuilt when the style changes (a fresh canvas each time — see key below)
  const gooRef = useRef<GooRenderer | null>(null)
  useEffect(() => {
    const g = makeGoo[style](gooCanvas.current!)
    gooRef.current = g
    return () => { g.dispose(); if (gooRef.current === g) gooRef.current = null }
  }, [style])

  // F25: the visor glitch + pixel filter, a canvas over both (src/view/visorFx.ts); the frame loop feeds it
  const visorFx = useRef<VisorFx | null>(null)
  useEffect(() => {
    const fx = createVisorFx(host.current!, tankCanvas.current!, () => gooCanvas.current)
    visorFx.current = fx
    return () => { fx.dispose(); visorFx.current = null }
  }, [])

  // frame loop + controls
  useEffect(() => {
    const el = host.current!, tc = tankCanvas.current!, ctx = tc.getContext('2d')!
    const rc = readoutCanvas.current!, rctx = rc.getContext('2d')!
    const s = engine.state
    const beam = createZapBeam(zapCanvas.current!) // F67: the zap's beam + laser point (src/view/zapBeam.ts)
    let lastTap: { x: number; y: number; at: TapPoint } | null = null // the last zap tap: stage px + the tank point it sent
    // F62 the goop's faces: told the rank, the pressure and what the eyes look at (one object, refilled every frame)
    const story: FaceStory = { rank: 0, pressure: 0, focus: null }
    const pieceAt: TapPoint = { x: 0, y: 0 }
    let laser: { at: TapPoint; t: number } | null = null // the last zap's tap point while its beam is up (goo clock)
    const white = createWhiteGoopView() // F63 the white goop's look (on the tank canvas, behind the goop)
    const vetAt: TapPoint = { x: 0, y: 0 }
    const xray = { cells: [] as number[], pad: 0, alpha: 1 } // view.xray, refilled each frame (no garbage per frame)
    let owT = -1, owN = 0 // F63: seconds the "ow" bubble has been up (goo clock; -1 = none), and which ow it is
    // Two clocks (gameClock.ts): the frame's time comes from the LOOKS clock (stops only on the Dev Kit's full pause,
    // so nothing jumps on resume); the engine moves by that time × rulesClock.rate (0 under any pause or menu).
    let camera = s.spin, last = looksClock.now(), hudAt = 0, raf = 0, ended = false
    let toastsAt = 0, toastsAtPx = '', toastsStart = '', toastsEnd = '' // the messages' point + sides, as last set
    const messages = createMessages(messageTuning as MessageTuning) // (reads the live tuning each time it decides)
    const guide = createDropGuide()
    const bubbles = createCrackBubbles() // F36: open cracks leak air bubbles into the tank
    let still = reduceMotion() // reduce motion: the drop guide's chevrons don't light up in a wave
    const root = document.documentElement
    let holdProgress: number | null = null
    const breaks: Record<MachineId, number> = { laser: 0, visor: 0, controls: 0 }
    let softHeld = false // the engine turns fast-drop off at every lock; a held drag keeps it on for the next piece
    const view: GooView = { cellPx: 0, centreX: 0, topY: 0, camera, width: 0, height: 0, dpr: 1 }
    viewRef.current = view
    const readoutSize = { w: 0, h: 0 } // the readout's words, measured a few times a second
    const topRow: Box[] = [] // the HUD's top row (score · cracks · Console button), measured with it: the readout stays clear
    let readoutDrawn = '' // the leader line as last drawn (only redrawn when it moves)

    const resize = () => {
      const r = el.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      // the bottom panel: a share of the window's height, but tall enough for its rows at the current text size — and
      // (F59, from rank 1) for the next-piece window at its left: its cells + its frame (padding gap-xs + border) + the
      // panel's own padding (gap-s + border; kit tokens on the root). On a phone on its side a column beside the tank
      // instead (content/tuning/hud.json → panel, nextWindow). F42: the charge buttons' own row (+ the gap under it) goes on
      // top of the bars' rows (hud.json abilities; the window beside them is often taller already, so it may not grow)
      const P = hud.panel, { panel, side, nextWindow, abilityRowPx } = layoutRef.current
      const css = getComputedStyle(root), remPx = parseFloat(css.fontSize) || 16
      const token = (name: string) => parseFloat(css.getPropertyValue(`--${name}`)) || 0
      const frame = token('border-width')
      const NW = hud.nextWindow // (its box of cells: rows + the room round them, cellRem each — NextWindow.tsx)
      const windowPx = nextWindow ? (NW.rows + 2 * NW.padCells) * NW.cellRem * remPx + 2 * (token('gap-xs') + frame) + 2 * (token('gap-s') + frame) : 0
      const buttonsPx = abilityRowPx > 0 ? abilityRowPx + token('gap-s') : 0
      const dock = Math.ceil(side ? P.sideRem * remPx
        : Math.max(windowPx, panel === 'machines' ? Math.max(P.share * r.height, P.machinesRem * remPx + buttonsPx) : Math.max(P.integrityShare * r.height, P.integrityRem * remPx + buttonsPx)))
      const L = layoutTank({ screenW: r.width, screenH: r.height, visibleWidth: s.visibleWidth, visibleRows: s.height - s.bufferRows,
        reserveTop: side ? hud.sideTopPx : hud.topRowPx, reserveBottom: side ? 2 * hud.gutterPx : dock + P.gapPx, gutter: hud.gutterPx })
      Object.assign(view, { cellPx: L.cellPx, centreX: L.centreX, topY: L.topY, width: r.width, height: r.height, dpr })
      // the HUD's corners sit over the tank, not at the far window edges (kit --kit-hud-w; menus keep the whole window);
      // beside a tank on a phone on its side it reaches past it far enough for the panel column
      const sideRoom = side ? dock + 2 * HUD_SIDE_ROOM : HUD_SIDE_ROOM
      root.style.setProperty('--kit-hud-w', `${Math.min(r.width, Math.max(HUD_MIN_WIDTH, L.widthPx + 2 * sideRoom))}px`)
      root.style.setProperty('--kit-hud-dock-size', `${dock}px`)
      tc.width = Math.round(r.width * dpr); tc.height = Math.round(r.height * dpr)
      rc.width = tc.width; rc.height = tc.height
      readoutDrawn = ''
    }
    relayout.current = resize
    const stopHudEdits = onTuning('hud', resize) // a Dev Kit edit of hud.json's sizes re-fits the tank at once
    const ro = new ResizeObserver(resize)
    ro.observe(el)
    resize()

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const looksMs = looksClock.now()
      const dt = Math.min((looksMs - last) / 1000, 0.1)
      last = looksMs
      // (× a lesson's speed: 0 while a lesson message pauses the shift, src/game/lessons/goopsLessons.ts)
      const rate = rulesClock.rate * lessonPlay.speed()
      const active = rate > 0 && s.status === 'playing'
      // ◐ the Dev Kit's half pause: the rules stand still, the looks (wave, pulses, glide, goo) keep moving
      const half = clockPause() === 'half' && s.status === 'playing'
      if (active) engine.tick(dt * 1000 * rate)
      const events: ShiftEvent[] = engine.takeEvents()
      if (events.length) { session.emit(events); playShiftSounds(events) } // (sounds: only while the rules clock runs)
      camera = stepCamera(camera, s.spin, s.width, dt, tank.cameraSpeed)
      view.camera = camera
      bubbles.step(s, dt, still) // (looks clock: keeps rising in the half pause, stops in the full pause)
      view.still = still // (reduce motion: the zap has no swell and no spray, F67)
      const gooDt = active ? dt * rate : half && pauseTuning.halfPauseGooMoves ? dt : 0
      // F62 the faces look at the laser's tap while its beam is up, else at the falling piece — and (F63, rank 31: "every
      // eye turns to it") at the white goop while he drops in
      if (laser && (laser.t += gooDt) >= zapLook().beamTime) laser = null
      const focus = laser ? laser.at : pieceFocus(s, camera, pieceAt)
      white.step(s, events, gooDt, focus)
      story.rank = s.rank
      story.pressure = s.pressure
      story.still = still
      story.focus = white.eyesOnHim(s, vetAt) ?? focus
      view.story = story
      drawTank(ctx, s, view, colorOf, looksMs / 1000, () => guide.draw(ctx, s, view, active || half ? dt : 0, softHeld, still),
        { bubbles, still, white: () => white.draw(ctx, s, view, gooStyle.get(), looksMs / 1000, still) })
      // the x-ray (F36): the goo over a covered crack is drawn see-through, round the box the tank view drew — and over
      // the white goop while goop covers him (F63)
      const X = cracksLook.xray
      xray.cells.length = 0
      for (const c of s.cracks) for (const [x, y] of crackCells(c)) if (!crackIsOpen(s, { x, y })) xray.cells.push(y * s.width + x) // (F39: each cell of a grown crack)
      white.xrayCells(s, xray.cells)
      xray.pad = X.pad + X.width
      xray.alpha = X.gooAlpha
      view.xray = xray
      gooRef.current?.frame(s, events, view, gooDt)
      // F67 the zap's beam: from the visible tank's top centre to the tap (the finger: stage px, above the visor), on
      // the goo's clock. A pop that didn't come from a tap here (a lesson, a test) aims at its `at`, un-bent.
      for (const e of events) if (e.type === 'pop' && e.at) {
        const rect = tankRect(view, s.visibleWidth, s.height - s.bufferRows)
        // (the engine re-wraps x, which can move it by a rounding error: near enough is the same tap)
        const tap = lastTap && Math.abs(lastTap.at.x - e.at.x) < 1e-6 && Math.abs(lastTap.at.y - e.at.y) < 1e-6 ? lastTap : null
        const to: [number, number] = tap ? [tap.x, tap.y]
          : [view.centreX + screenColumn(e.at.x - 0.5, view.camera, s.width) * view.cellPx, view.topY + (e.at.y - s.bufferRows) * view.cellPx]
        beam.fire([rect.left + rect.width / 2, rect.top], to, colorOf(e.color))
        laser = { at: e.at, t: 0 }
      }
      // F63 the laser through the white goop: the same beam (in his white) to the tap, and his "ow" bubble above him.
      // (A pop of goop in front of him in the same tap already fired its beam above.)
      for (const e of events) if (e.type === 'vetOw' && s.vet) {
        const rect = tankRect(view, s.visibleWidth, s.height - s.bufferRows)
        const tap = lastTap && Math.abs(lastTap.at.x - e.at.x) < 1e-6 && Math.abs(lastTap.at.y - e.at.y) < 1e-6 ? lastTap : null
        const to: [number, number] = tap ? [tap.x, tap.y]
          : [view.centreX + screenColumn(e.at.x - 0.5, view.camera, s.width) * view.cellPx, view.topY + (e.at.y - s.bufferRows) * view.cellPx]
        if (!events.some((p) => p.type === 'pop')) beam.fire([rect.left + rect.width / 2, rect.top], to, String(whiteGoopLook.color))
        laser = { at: e.at, t: 0 }
        const [x, y] = vetOnScreen(s, view, 0, visorFx.current?.curve() ?? 0) // (his top middle, where he's seen)
        owT = 0
        setOw({ x, y, n: ++owN })
      }
      if (owT >= 0 && (owT += gooDt) >= whiteGoopLook.owTime) { owT = -1; setOw(null) }
      beam.frame(gooDt, view.cellPx, view.width, view.height, view.dpr)
      // the spawn rows above the tank stay hidden (v1): pieces slide in from the tank's top edge, never over the HUD
      const gc = gooCanvas.current, clip = `inset(${view.topY}px 0 0 0)`
      if (gc && gc.style.clipPath !== clip) gc.style.clipPath = clip
      visorFx.current?.frame(s, view, looksMs / 1000)
      placeLessonMark(lessonMark.current, s, view, visorFx.current?.curve() ?? 0) // what a lesson message points at (F30)
      readoutDrawn = placeReadout(readoutEl.current, rctx, s, view, live.current.readoutAt, readoutSize, topRow, visorFx.current?.curve() ?? 0, readoutDrawn)
      // count new breakdowns BEFORE the HUD snapshot: the console keys each repair panel by its break count, so a
      // snapshot saying "broken" with the old count would re-light an already-solved panel (a free repair)
      for (const e of events) if (e.type === 'breakdown') breaks[e.machine]++
      // the console (or a menu) came up while fast drop was held: no key-up will reach the tank, so let go here
      if (softHeld && !live.current.inputOn) { softHeld = false; engine.act({ type: 'softDrop', on: false }) }
      if (now - hudAt > 100) {
        hudAt = now
        live.current.onHud({ pressure: s.pressure, score: s.score, cracksSealed: s.cracksSealed, cracksNeeded: s.cracksNeeded,
          integrity: s.integrity, phase: s.phase, holdProgress, machines: machinesNow(s.machines), breaks: { ...breaks },
          next: s.next && s.nextCells ? { cells: s.nextCells, color: s.next[0], colors: s.next } : null, // (F39: colors = per cell)
          abilities: (s.abilities ?? []).map((a) => ({ id: a.id, charge: a.charge, ready: a.ready })) })
        still = reduceMotion()
        const box = readoutEl.current?.querySelector('.kit-pinned')?.getBoundingClientRect()
        if (box?.width) { readoutSize.w = box.width; readoutSize.h = box.height }
        // (in the stage's own px, like the tank: the page's px minus the stage's corner)
        topRow.length = 0
        const stage = el.getBoundingClientRect()
        for (const e of document.querySelectorAll('.kit-hud-slot > *')) {
          const b = e.getBoundingClientRect()
          if (b.width) topRow.push({ left: b.left - stage.left, right: b.right - stage.left, bottom: b.bottom - stage.top })
        }
      }
      // the messages sit just above the goop (where the eyes are): the kit's toasts' point (--kit-toasts-at), a few
      // times a second (they glide there)
      if (now - toastsAt > messageTuning.stack.updateMs) {
        toastsAt = now
        const g = readoutGeometry(s, view, live.current.readoutAt, readoutSize, topRow, visorFx.current?.curve() ?? 0)
        const clearTop = layoutRef.current.side ? hud.sideTopPx : hud.topRowPx
        const px = `${Math.round(messagesPoint(s, view, clearTop, Math.min(g.text[1] - readoutSize.h / 2, g.end[1])))}px`
        if (px !== toastsAtPx) { toastsAtPx = px; root.style.setProperty('--kit-toasts-at', px) }
        // and only as wide as the tank (+ the HUD's 16 px), so they never reach the panel beside it (kit
        // --kit-toasts-start / -end = room kept clear at the screen's left / right edge)
        const sides = tankSides(s, view)
        const start = `${Math.max(0, Math.round(sides[0] - HUD_SIDE_ROOM))}px`, end = `${Math.max(0, Math.round(view.width - sides[1] - HUD_SIDE_ROOM))}px`
        if (start !== toastsStart) { toastsStart = start; root.style.setProperty('--kit-toasts-start', start) }
        if (end !== toastsEnd) { toastsEnd = end; root.style.setProperty('--kit-toasts-end', end) }
      }
      for (const m of messages.step(s, events, looksMs)) live.current.onMessage(m)
      for (const e of events) {
        if (e.type === 'spawn' && softHeld) engine.act({ type: 'softDrop', on: true })
        if (e.type === 'end' && !ended) { ended = true; live.current.onEnd(e.status) }
      }
    }
    raf = requestAnimationFrame(frame)
    // The tank cell under a click (page px). The curved-TV look moves what you see, so it's the cell the player is
    // pointing at in the BENT picture (Muzzy 2026-10-18: a one-cell goop near a corner was missed → the piece rotated).
    const cellAt = (px: number, py: number) => {
      const r = el.getBoundingClientRect()
      const [fx, fy] = flatPoint(px - r.left, py - r.top, tankRect(view, s.visibleWidth, s.height - s.bufferRows), visorFx.current?.curve() ?? 0)
      return screenToVisibleCell(fx, fy, view, s.width, s.bufferRows, s.visibleWidth, s.height - s.bufferRows)
    }
    // ...and the exact spot inside it, in fractional tank cells (cell x, y covers x … x+1, y … y+1) — the zap's laser
    // point (F67). Same flat (un-bent) point as cellAt, so it lands inside the cell cellAt picked.
    const tapPoint = (px: number, py: number): TapPoint => {
      const r = el.getBoundingClientRect()
      const [fx, fy] = flatPoint(px - r.left, py - r.top, tankRect(view, s.visibleWidth, s.height - s.bufferRows), visorFx.current?.curve() ?? 0)
      const x = view.camera + (fx - view.centreX) / view.cellPx + 0.5
      return { x: ((x % s.width) + s.width) % s.width, y: (fy - view.topY) / view.cellPx + s.bufferRows }
    }
    // fast drop held (on) / let go: the engine has no event for it (it's the player's hold), so its whoosh plays here
    const softDrop = (on: boolean) => {
      if (on && !softHeld) playGameSound(SOUNDS.fastDrop)
      softHeld = on; engine.act({ type: 'softDrop', on })
    }
    // dev + tests only: lets a Playwright check reach the engine (fast-forward a shift, read the grid)
    // (cellAt(px, py): the cell a click there picks; curve(): the visor's curve right now — e2e/controls.mjs;
    // gooMotion(cell): how fast the goo there is moving — e2e/controls.mjs pokes goop that can't pop yet)
    // (say: show an in-shift message now, e.g. say('brokeLaser') — e2e/hud-shots.mjs checks where it sits;
    // readout(): where the pressure readout's line and words are; setReadout({ readoutPosition, readoutDirection }): as if
    // the Settings rows changed; fastDrop(on): as if fast drop were held; clocks(): the rules + looks clocks, ms)
    if (import.meta.env.DEV) (window as unknown as { __goops?: unknown }).__goops = { engine, view, gooStyle, breakMachine: devBreakMachine(engine, breaks),
      say: (key: Message['key'], seconds = 30) => live.current.onMessage({ key, danger: false, seconds }),
      readout: () => readoutGeometry(s, view, live.current.readoutAt, readoutSize, topRow, visorFx.current?.curve() ?? 0),
      setReadout: (values: Record<string, unknown>) => readoutSetting.setFromSettings({ ...readoutSettingValues(readoutSetting.get()), ...values }),
      fastDrop: softDrop,
      bubbles: { count: () => bubbles.count(), from: (crackId: number) => bubbles.from(crackId) }, // F36 e2e/cracks-look.mjs
      zapBeam: () => beam.shots(), // F67 e2e/zap.mjs: the beams on screen (from, to: stage px; t: seconds)
      cellAt, curve: () => visorFx.current?.curve() ?? 0, gooMotion: (cell: number) => gooRef.current?.motion?.(cell) ?? 0,
      faces: () => gooRef.current?.faces?.() ?? [], // F62 e2e/eyes.mjs: the goop's faces (eyes, brows, mouth, gaze, where)
      // F63 e2e/white-goop.mjs: the white goop (the engine's state.vet + how he looks), and his cell's centre on the stage
      white: () => s.vet ? { ...s.vet, look: white.report(), screen: vetOnScreen(s, view, 0.5, visorFx.current?.curve() ?? 0) } : null,
      clocks: () => ({ rules: rulesClock.now(), looks: looksClock.now(), rate: rulesClock.rate, pause: clockPause() }),
      // F30 lessons: lesson('sample', 3) plays a lesson from a step (1 = the first, or a step id); lessonView(): where it is
      lesson: (id: string, step: number | string = 1) => session.startLesson?.(id, step) ?? false,
      lessonView: () => lessonRunner.view() }

    const detach = attachControls(el, {
      spin: (dir) => engine.act({ type: 'spin', dir }),
      rotate: (dir) => engine.act({ type: 'rotate', dir }),
      softDrop,
      hold: () => engine.act({ type: 'hold' }),
      console: () => live.current.onConsole(),
      // F34 / F42: F / Numpad . / 1 fire the first equipped active, 2 / 3 the second / third (refused unless it's full —
      // the engine says no; a slot with nothing in it: nothing happens); none equipped: no keys
      ...(s.abilities?.length ? { ability: (slot: number) => { const a = s.abilities![slot]; if (a) engine.act({ type: 'ability', id: a.id }) } } : {}),
      // F28: a held key's swap timer is the HUD's Swap bar; a finger's (or the mouse's) is the ring beside it
      holdProgress: (p, at) => {
        holdProgress = at ? null : p
        placeSwapRing(swapRing.current, el, p, at, layoutRef.current.side ? hud.sideTopPx : hud.topRowPx)
      },
      canSwap: () => engine.allows('hold'), // F59: off before its rank (and in lessons) — no charging ring then
      swapHoldMult: () => live.current.swapHoldMult, // F43 Goop Swap: a shorter hold (the Swap bar and the ring both follow)
      // broken controls (F23/F24): a held turn repeats slower; single presses and quick swipes stay the same
      spinSlowdown: () => (s.machines?.controls.broken ? breakdowns.controls.heldSpinSlowdown : 1),
      tapCell: (px, py) => {
        const cell = cellAt(px, py)
        if (!cell) return false // beside or above the visible tank: a plain tap (rotate)
        const [x, y] = cell
        const at = tapPoint(px, py), r = el.getBoundingClientRect()
        // (goop to zap — or the white goop, F63: the laser goes through him with an "ow")
        if (y < 0 || y >= s.height || (!s.grid[y * s.width + x] && !whiteGoopAt(s, at))) return false
        lastTap = { x: px - r.left, y: py - r.top, at } // (the beam ends on the finger: F67)
        engine.act({ type: 'pop', x, y, at })
        return true
      },
    }, () => live.current.inputOn && rulesClock.rate > 0 && lessonPlay.inputOn() && s.status === 'playing',
    // (F32: a lesson insisting "go to the console" — the shift paused, only W / ↑ / flick up work)
    () => live.current.inputOn && rulesClock.rate > 0 && lessonPlay.consoleOnly() && s.status === 'playing')

    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); detach(); stopHudEdits(); beam.dispose()
      for (const v of ['--kit-hud-w', '--kit-hud-dock-size', '--kit-toasts-at', '--kit-toasts-start', '--kit-toasts-end']) root.style.removeProperty(v)
    }
  }, [engine])

  return (
    <div className="stage" ref={host} data-testid="stage">
      <canvas className="stage-layer" ref={tankCanvas} />
      <canvas className="stage-layer" ref={gooCanvas} key={style} data-goo={style} />
      {/* the pressure readout, on top of everything in the tank (the goo and the visor glitch): its line on a canvas
          of its own, its words kit text in a kit PinnedBox (never catches taps, so zaps reach the tank under it) */}
      {/* F67 the zap's beam + laser point: above the visor (a laser from the viewer — it lands exactly on the finger) */}
      <canvas className="stage-layer stage-zap" ref={zapCanvas} />
      <canvas className="stage-layer stage-readout" ref={readoutCanvas} />
      {ow && <TalkingBubble key={ow.n} target={{ x: ow.x, y: ow.y }} outline="plain" placement="top" feel={talk} colours={talk.colours}
        text={text.whiteGoop.ow} />}
      <div className="stage-pin" data-tag="readout" ref={readoutEl}>
        <PinnedBox pixelsPerUnit={1} rem={16} anchor={readoutAt.direction === 'lineFirst' ? 'left' : 'right'} name="readout">{readout}</PinnedBox>
      </div>
      {/* F30: an invisible box the frame loop puts over what a lesson message points at (a cell, the falling piece) —
          the kit's Callout points at it and rings it */}
      <div className="stage-pin lesson-mark" ref={lessonMark} aria-hidden />
      {/* F28: the swap timer beside a holding finger (placeSwapRing moves and fills it; hidden otherwise) */}
      <svg className="swap-ring" ref={swapRing} viewBox="0 0 100 100" data-testid="swap-ring" aria-hidden>
        <circle className="swap-ring-track" cx="50" cy="50" r="40" />
        <circle className="swap-ring-fill" cx="50" cy="50" r="40" pathLength={1} strokeDasharray="0 1" />
      </svg>
    </div>
  )
}

// F28: the swap timer for a finger (or mouse) hold — a ring that fills (p 0..1) beside the finger at `at` (page px),
// content/tuning/hud.json → swapRing: offset above-left so the thumb doesn't hide it; near a screen edge (or the HUD's
// top row, clearTop px) it flips to the other side of the finger. p null (or a key hold, no `at`): hidden.
// Moved straight on the element every frame of the charge (no React re-render).
function placeSwapRing(svg: SVGSVGElement | null, stage: HTMLElement, p: number | null, at: { x: number; y: number } | undefined, clearTop: number) {
  if (!svg) return
  if (p === null || !at) { svg.style.display = 'none'; return }
  const R = hud.swapRing, rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  const size = R.sizeRem * rem, half = size / 2, box = stage.getBoundingClientRect()
  const fx = at.x - box.left, fy = at.y - box.top // the finger, in the stage's px
  const minX = half + R.edgePx, maxX = box.width - half - R.edgePx, minY = clearTop + half + R.edgePx, maxY = box.height - half - R.edgePx
  let cx = fx + R.offsetXRem * rem, cy = fy + R.offsetYRem * rem
  if (cx < minX || cx > maxX) cx = fx - R.offsetXRem * rem // off the side: the other side of the finger
  if (cy < minY || cy > maxY) cy = fy - R.offsetYRem * rem // under the top row: below the finger
  cx = Math.min(Math.max(cx, minX), maxX); cy = Math.min(Math.max(cy, minY), maxY)
  // the line's thickness, in the ring's own 0..100 units (the circles have r 40: room for up to 20 units of line)
  const stroke = String(Math.min(20, (R.strokeRem / R.sizeRem) * 100))
  for (const c of svg.querySelectorAll('circle')) c.setAttribute('stroke-width', stroke)
  svg.querySelector('.swap-ring-fill')?.setAttribute('stroke-dasharray', `${p} 1`)
  svg.style.display = 'block'
  svg.style.width = svg.style.height = `${size}px`
  svg.style.transform = `translate(${cx - half}px, ${cy - half}px)`
}

// F63: where the white goop is SEEN on the stage (CSS px, bent by the visor's curved-TV look like everything in the
// tank): his middle column, `down` cells below his top edge (0 = his top, 0.5 = his centre)
function vetOnScreen(s: ShiftState, view: GooView, down: number, curve: number): [number, number] {
  const v = s.vet!
  const x = view.centreX + screenColumn(v.px, view.camera, s.width) * view.cellPx
  const y = view.topY + (v.py - s.bufferRows + down) * view.cellPx
  return bentPoint(x, y, tankRect(view, s.visibleWidth, s.height - s.bufferRows), curve)
}

// The visible tank's left and right edges on screen (CSS px)
function tankSides(s: ShiftState, view: GooView): [number, number] {
  const left = view.centreX - (pieceScreenColumn(s.visibleWidth) + 0.5) * view.cellPx
  return [left, left + s.visibleWidth * view.cellPx]
}

// F62: what the goop's eyes look at when no laser is firing — the falling piece's centre (tank cells, like a pop's `at`:
// a cell's centre is x + 0.5, y + 0.5), gliding down with piece.fall. The drawn piece is placed by the spin while the
// goop rides the animated camera, so the point is shifted by (camera − spin): the eyes look where the piece IS on
// screen while the tank slides under it. Written into `out`; null = no piece.
function pieceFocus(s: ShiftState, camera: number, out: TapPoint): TapPoint | null {
  const p = s.piece
  if (!p || !p.cells.length) return null
  const x0 = p.cells[0][0]
  let sx = 0
  let sy = 0
  for (const [x, y] of p.cells) {
    sx += x0 + screenColumn(x - x0, 0, s.width) // (unwrapped round the tank: a piece on the seam stays whole)
    sy += y
  }
  const n = p.cells.length
  const x = sx / n + 0.5 + screenColumn(camera - s.spin, 0, s.width)
  out.x = ((x % s.width) + s.width) % s.width
  out.y = sy / n + 0.5 + p.fall
  return out
}

// Where the pressure readout goes (CSS px): its line's foot on the pressure line, the line's other end, and the point
// its words hang on (their left-middle, or right-middle when the text comes first). content/tuning/hud.json → readout.
//   Line, then text: the line rises up-right from the pressure line, the words at its top end.
//   Text, then line: the words, then the line runs down-right to the pressure line (the mirror image; the words
//   themselves are never mirrored).
// The whole readout stays inside the tank: the position slider (0..1) slides it across the room the tank has for it,
// so 0 = against the left wall and 1 = against the right one. With no room above the line (pressure near the top),
// the line goes down instead.
// curve = the visor's curved-TV strength right now (visorFx.curve()): the pressure line bends with it, so the dot goes
// where the bent line really is at its column, and the line + words move with it (Muzzy 2026-10-18).
// topRow = the HUD's top-row items: on a wide screen the big CRACKS count hangs over the tank's top, so the words never
// go above the bottom of any item over them — near the top they take the line down instead (Muzzy 2026-10-18: 95%
// slid under "CRACKS 0 / 6").
function readoutGeometry(s: ShiftState, view: GooView, at: ReadoutSetting, text: { w: number; h: number }, topRow: Box[], curve: number) {
  const R = hud.readout, cp = view.cellPx
  const [left, right] = tankSides(s, view)
  const top = view.topY, bottom = top + (s.height - s.bufferRows) * cp
  const edge = R.edgePx, gap = R.gapPx, rise = R.rise * cp
  const run = Math.max(0, Math.min(R.run * cp, right - left - 2 * edge - gap - text.w)) // shorter in a very narrow tank
  const room = Math.max(0, right - left - 2 * edge - (run + gap + text.w))
  const start = left + edge + at.position * room // the readout's left edge
  const textRight = start + text.w
  const footX = at.direction === 'lineFirst' ? start : textRight + gap + run
  const flatY = top + (s.pressureRow - s.bufferRows) * cp
  const bentY = curvedY(footX, flatY, tankRect(view, s.visibleWidth, s.height - s.bufferRows), curve)
  const footY = Math.min(bottom, Math.max(top, bentY))
  const textBox: [number, number] = at.direction === 'lineFirst' ? [start + run + gap, start + run + gap + text.w] : [start, textRight]
  let ceiling = top // the highest the words may reach: the tank's top, or below a top-row item over them
  for (const b of topRow) if (b.right > textBox[0] && b.left < textBox[1]) ceiling = Math.max(ceiling, b.bottom)
  const up = footY - rise - text.h / 2 >= ceiling + edge
  const textY = Math.min(bottom - edge - text.h / 2, Math.max(ceiling + edge + text.h / 2, up ? footY - rise : footY + rise))
  if (at.direction === 'lineFirst') return { foot: [footX, footY], end: [start + run, textY], text: [textBox[0], textY], textBox }
  return { foot: [footX, footY], end: [textRight + gap, textY], text: [textRight, textY], textBox }
}

type Box = { left: number; right: number; bottom: number }

// (dev + tests) the readout setting back as Settings values, so a test can change one row and keep the other
const readoutSettingValues = (r: ReadoutSetting) => ({ readoutPosition: r.position * 100, readoutDirection: r.direction === 'textFirst' ? 'Text, then line' : 'Line, then text' })

// Hang the readout's words on their point (CSS translate) and draw its line — only when something moved.
function placeReadout(el: HTMLDivElement | null, ctx: CanvasRenderingContext2D, s: ShiftState, view: GooView, at: ReadoutSetting,
  text: { w: number; h: number }, topRow: Box[], curve: number, drawn: string) {
  const g = readoutGeometry(s, view, at, text, topRow, curve)
  const t = `${Math.round(g.text[0])}px ${Math.round(g.text[1])}px`
  if (el && el.style.translate !== t) el.style.translate = t
  const R = hud.readout
  const key = `${g.foot.map(Math.round)} ${g.end.map(Math.round)} ${R.color} ${R.lineWidthPx} ${R.footPx}` // (+ its look: Dev Kit edits redraw it)
  if (key === drawn) return drawn
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0)
  ctx.clearRect(0, 0, view.width, view.height)
  ctx.strokeStyle = R.color
  ctx.fillStyle = R.color
  ctx.lineWidth = R.lineWidthPx
  ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(g.foot[0], g.foot[1]); ctx.lineTo(g.end[0], g.end[1]); ctx.stroke()
  if (R.footPx > 0) { ctx.beginPath(); ctx.arc(g.foot[0], g.foot[1], R.footPx, 0, Math.PI * 2); ctx.fill() }
  return key
}

// The messages: the screen y (CSS px) where their bottom edge sits — just above the highest goop in the visible
// columns and above the pressure readout (readoutTop: messages are as wide as the tank, so they'd cover it), kept in
// the tank's lower part, above its floor, and with the messages' own height below the HUD's top row.
function messagesPoint(s: ShiftState, view: GooView, clearTop: number, readoutTop: number) {
  const st = messageTuning.stack
  const cp = view.cellPx, visRows = s.height - s.bufferRows
  const top = view.topY, bottom = top + visRows * cp
  let highest = s.height // the floor when the visible part is empty
  for (let y = s.bufferRows; y < s.height && highest === s.height; y++) {
    for (let k = 0; k < s.visibleWidth; k++) {
      const x = (((s.spin - pieceScreenColumn(s.visibleWidth) + k) % s.width) + s.width) % s.width
      if (s.grid[y * s.width + x]) { highest = y; break }
    }
  }
  const want = Math.min(top + (highest - s.bufferRows - st.gapRows) * cp, readoutTop - PIN_GAP)
  const stackH = document.querySelector('.kit-toasts')?.getBoundingClientRect().height ?? 0
  const lo = Math.max(top + st.topShare * visRows * cp, clearTop + stackH + PIN_GAP)
  const hi = bottom - st.floorGapRows * cp
  return Math.max(lo, Math.min(hi, want)) // staying clear of the HUD wins on a tiny screen
}

const MACHINES: MachineId[] = ['laser', 'visor', 'controls']
const machinesNow = (m: ShiftEngine['state']['machines']) => Object.fromEntries(MACHINES.map((id) => [id,
  { unlocked: !!m?.[id].unlocked, health: m?.[id].health ?? 1, broken: !!m?.[id].broken }])) as HudSnapshot['machines']

// DEV + tests only (e2e/repairs.mjs): break a machine NOW, as the engine does when its meter runs out — without
// playing until it happens. Same state change and event the engine makes (src/engine/machines.ts), so the console reacts
// exactly as in play; the repair itself goes through the real engine (act({ type: 'repair' })).
// announce = also tell the event's listeners (as the engine's own break would: F32's first-breakdown lessons start)
function devBreakMachine(engine: ShiftEngine, breaks: Record<MachineId, number>) {
  return (id: MachineId, announce = false) => {
    const m = engine.state.machines?.[id]
    if (!m || m.broken) return false
    Object.assign(m, { unlocked: true, broken: true, health: 0, cooldownMs: 0 })
    breaks[id]++
    if (announce) session.emit([{ type: 'breakdown', machine: id }])
    return true
  }
}
