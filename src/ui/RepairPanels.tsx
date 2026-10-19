// THE REPAIR PANELS on the console (F24): the three panels of Muzzy's console art, drawn as kit ArtLayers inside the
// console's ArtStage. A broken machine's panel comes alive (its lamps say what to do); a working (or locked) one stays
// switched off. The puzzles' rules are in src/game/repairs.ts; when one is solved the console calls onRepair(machine)
// (the App sends act({ type: 'repair' }) to the engine, the machine is fixed, and its panel switches off again).
// Each breakdown starts a new puzzle (the App keys each panel by how many times its machine has broken).
// Sliders and the dial are the kit's SnapControl (drag or tap); the visor's buttons are kit picture Buttons.
// F32 lessons point at the panels by data-tag (an invisible box filling an ArtLayer): "panel-<machine>" = the panel,
// "repair-<machine>" = the part that wants doing next (the blinking lamp, or the laser's next slider).
import { Fragment, useEffect, useRef, useState, type PointerEvent } from 'react'
import { ArtLayer, Button, SnapControl, fill } from './kit'
import { controlsTurn, controlsDone, laserSolved, newControls, newLaser, newVisor, repairSteps, visorDone, visorLitButton, visorPress, visorSlide, visorWantsDown } from '../game/repairs'
import { art } from './art'
import { playUiSound } from '../game/sound'
import { SOUNDS } from '../game/shiftSounds'
import text from '../../content/text/en.json'

const t = text.console
const a = art.console
const r = art.repairs
const offLabel = (name: string) => fill(t.unavailable, { name })
// an invisible box over its ArtLayer, for a lesson's pointer (src/game/lessons/goopsLessons.ts lessonTarget). Every
// element with the tag counts: the lesson's outline goes round all of them (F32: "repair-visor" = the lit lamp AND the
// slider or button it asks for). placement = which side a bubble goes first (only on a phone on its side now: elsewhere
// the console's words are on its monitor). say = the words this part asks for (en.json lessons.<machine>.<say>), so the
// message says what to do with the part that's outlined
type Side = 'top' | 'bottom' | 'left' | 'right'
export const LessonTag = ({ tag, placement, say }: { tag: string; placement?: Side; say?: string }) =>
  <span className="lesson-tag" data-tag={tag} data-placement={placement} data-say={say} aria-hidden />
// the laser's top row of sliders (its message goes above them; the bottom row's below)
const laserTopRow = (at: [number, number, number, number]) => {
  const ys = r.laser.sliders.map((s) => s[1])
  return at[1] < (Math.min(...ys) + Math.max(...ys)) / 2
}

// fewerSteps: from upgrades (later); 0 today. showcase (F32): a lesson is showing this panel off ("Fixed!") — it looks
// switched on (not dimmed) though there's nothing to do on it
type PanelProps = { live: boolean; onRepair(): void; fewerSteps?: number; showcase?: boolean }

// calls onRepair once, the moment the puzzle is solved
function useSolved(solved: boolean, onRepair: () => void) {
  const latest = useRef(onRepair)
  useEffect(() => { latest.current = onRepair })
  useEffect(() => { if (solved) latest.current() }, [solved])
}

// THE SLIDERS ARE A REAL DRAG (F32, Muzzy: "I clicked the top of the drag area, and the draggable teleported to the
// top. it's a drag"). The kit's SnapControl also moves to the stop nearest a TAP; this wraps it and ignores a press
// that didn't move (the kit's own rule for "moved": half a rem). Keys still step it (a deliberate press, and the way
// in without a pointer). Returns the wrapper's handlers, whether the press now is a tap, and the press itself.
const TAP_SLOP_REM = 0.5 // = the kit's SnapControl TAP_SLOP
function useDragOnly(onPress?: () => void) {
  const press = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const slop = () => TAP_SLOP_REM * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16)
  const handlers = {
    onPointerDownCapture: (e: PointerEvent) => {
      if (e.button !== 0) return // (a right-click is no press: it would leave a "tap" behind and shake the panel)
      press.current = { x: e.clientX, y: e.clientY, moved: false }; onPress?.()
    },
    onPointerMoveCapture: (e: PointerEvent) => {
      const p = press.current
      if (p && !p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) >= slop()) p.moved = true
    },
    // (bubbling: after the kit's own pointer-up has called onChange)
    onPointerUp: () => { press.current = null },
    onPointerCancel: () => { press.current = null },
  }
  return { handlers, tapping: () => !!press.current && !press.current.moved, pointer: () => !!press.current }
}

// a step of the repair done right (`done` went up) → its blip (the knob's own click is the kit's ui.tap)
function useStepSound(done: number, live: boolean) {
  const last = useRef(done)
  useEffect(() => {
    if (live && done > last.current) playUiSound(SOUNDS.repairStep)
    last.current = done
  }, [done, live])
}

// A lamp: its "off" picture, with the "on" picture over it while lit (blinking while it asks for something)
// (tag: a lesson points here)
// (live = switched on: lit lamps show; off = drawn switched off)
function Lamp({ at, lit, blink, live, tag, side }: { at: [number, number, number, number]; lit: boolean; blink?: 'fast' | 'slow'; live: boolean
  tag?: string; side?: Side }) {
  return (
    <>
      <ArtLayer src={r.lampOff} at={at} off={!live}>{tag && <LessonTag tag={tag} placement={side} />}</ArtLayer>
      {live && lit && <ArtLayer src={r.lampOn} at={at} blink={blink} />}
    </>
  )
}

// LASER: the sliders light up (all 4: repairSteps('laser')), each wanting left or right (its lamp at that end blinks until the knob is there)
export function LaserPanel({ live, onRepair, fewerSteps, showcase }: PanelProps) {
  const [want] = useState(() => newLaser(Math.random, repairSteps('laser', fewerSteps)))
  const [pos, setPos] = useState([1, 1, 1, 1]) // every knob starts in the middle
  useSolved(live && laserSolved(want, pos), onRepair)
  useStepSound(want.filter((w, i) => w !== null && pos[i] === w).length, live)
  const next = live ? want.findIndex((w, i) => w !== null && pos[i] !== w) : -1 // the first slider still to do
  const on = live || !!showcase
  return (
    <>
      <ArtLayer {...a.laser} off={!on} label={on ? undefined : offLabel(t.laser)}><LessonTag tag="panel-laser" /></ArtLayer>
      <ArtLayer {...a.words.laser} tone="primary" off={!on}>{t.laser}</ArtLayer>
      {r.laser.sliders.map((at, i) => (
        <SliderRow key={i} at={at} lamps={r.laser.lamps[i]} live={live} on={on} want={live ? want[i] : null} value={pos[i]} next={i === next}
          label={fill(t.laserSlider, { n: i + 1 })} onChange={(v) => setPos((p) => p.map((old, k) => (k === i ? v : old)))} />
      ))}
    </>
  )
}
function SliderRow({ at, lamps, live, on, want, value, next, label, onChange }: {
  at: [number, number, number, number]; lamps: [number, number, number, number][]; live: boolean; on: boolean; want: 0 | 2 | null
  value: number; next: boolean; label: string; onChange(v: number): void
}) {
  const drag = useDragOnly()
  const side = laserTopRow(at) ? 'top' : 'bottom'
  return (
    <>
      {lamps.map((lampAt, end) => {
        const stop = end ? 2 : 0
        // (the lamp this slider wants it at is part of the lesson's outline, with the slider)
        return <Lamp key={end} at={lampAt} live={on} lit={want === stop} blink={value !== stop ? 'fast' : undefined}
          tag={next && want === stop ? 'repair-laser' : undefined} side={side} />
      })}
      <ArtLayer at={at} off={!on}>
        {next && <LessonTag tag="repair-laser" placement={side} />}
        <div className="repair-grab" {...drag.handlers}>
          <SnapControl label={label} stops={3} knob={r.knobShare} value={value} onChange={(v) => { if (!drag.tapping()) onChange(v) }}
            disabled={!live} valueText={(v) => t.positions[v]}>
            <img src={r.knob} alt="" draggable={false} />
          </SnapControl>
        </div>
      </ArtLayer>
    </>
  )
}

// VISOR (the RESET VISOR panel): top lamp blinks → slide up → the lit button, three times (repairSteps('visor')) → bottom lamp → slide down.
// The slider only moves when it's asked for (otherwise it springs back); a wrong button shakes the panel, nothing resets.
export function VisorPanel({ live, onRepair, fewerSteps, showcase }: PanelProps) {
  const [v, setV] = useState(() => newVisor(Math.random, repairSteps('visor', fewerSteps)))
  const [shake, setShake] = useState(0)
  useSolved(live && visorDone(v), onRepair)
  useStepSound(v.step, live)
  const lit = live ? visorLitButton(v) : null
  const wrong = () => { setShake((n) => n + 1); playUiSound(SOUNDS.wrong) }
  const press = (b: number) => {
    const next = visorPress(v, b)
    if (next.wrong) wrong()
    else setV(next.visor)
  }
  // the slider is a real drag (no tap), and touching it while it isn't asked for (the buttons' turn) shakes the panel,
  // like a wrong button (F32, Muzzy)
  const sliderWanted = v.step === 0 || visorWantsDown(v)
  const drag = useDragOnly(() => { if (live && !sliderWanted) wrong() })
  const slide = (to: number) => {
    if (drag.tapping()) return
    const next = visorSlide(v, to as 0 | 1)
    if (next) setV(next)
    else if (!drag.pointer()) wrong() // (keys: the press itself didn't shake it)
  }
  const on = live || !!showcase
  const sliderTag = live && sliderWanted // (the lesson's outline: the lit lamp and the slider, together)
  return (
    <>
      <ArtLayer {...a.lights} off={!on} shake={shake} label={on ? undefined : offLabel(t.lights)}><LessonTag tag="panel-visor" /></ArtLayer>
      <ArtLayer {...a.words.lights} tone="primary" off={!on} shake={shake}>{t.lights}</ArtLayer>
      {/* (a bubble, on a phone on its side: left of the top lamp, under the bottom one, right of the buttons' lamps —
          never over the slider or buttons still to use) */}
      <Lamp at={r.visor.topLamp} live={on} lit={live && v.step === 0} blink="fast" tag={live && v.step === 0 ? 'repair-visor' : undefined} side="left" />
      <Lamp at={r.visor.bottomLamp} live={on} lit={live && visorWantsDown(v)} blink="fast" tag={live && visorWantsDown(v) ? 'repair-visor' : undefined} side="bottom" />
      {/* (the track: cut out of the panel art so it can sit between its two lamps — art.json repairs.visor.track) */}
      <ArtLayer src={r.visor.track} at={r.visor.slider} off={!on} shake={shake} />
      <ArtLayer at={r.visor.slider} off={!on} shake={shake}>
        {sliderTag && <LessonTag tag="repair-visor" placement={v.step === 0 ? 'left' : 'bottom'} say="fixSlide" />}
        <div className="repair-grab" {...drag.handlers}>
          <SnapControl label={t.visorSlider} axis="y" stops={2} knob={r.knobShare} value={v.slider} disabled={!live}
            onChange={slide} valueText={(k) => t.upDown[k]}>
            <img src={r.knob} alt="" draggable={false} />
          </SnapControl>
        </div>
      </ArtLayer>
      {r.visor.buttons.map((b, i) => (
        <Fragment key={i}>
          <Lamp at={b.lamp} live={on} lit={lit === i} blink="slow" tag={lit === i ? 'repair-visor' : undefined} side="right" />
          <ArtLayer at={b.at} off={!on} shake={shake}>
            {lit === i && <LessonTag tag="repair-visor" placement="right" say="fixButton" />}
            <Button art={b.art} disabled={!on} onClick={() => { if (live) press(i) }}>{t.visorButtons[i]}</Button>
          </ArtLayer>
        </Fragment>
      ))}
    </>
  )
}

// CONTROLS: one corner lamp blinks; turn the dial's arrow to it and it locks by itself; then the next; 4 in all (repairSteps('controls'))
export function ControlsPanel({ live, onRepair, fewerSteps, showcase }: PanelProps) {
  const [c, setC] = useState(() => newControls(Math.random, repairSteps('controls', fewerSteps)))
  useSolved(live && controlsDone(c), onRepair)
  useStepSound(c.step, live)
  const target = live && !controlsDone(c) ? c.targets[c.step] : null
  const on = live || !!showcase
  return (
    <>
      <ArtLayer {...a.controls} off={!on} label={on ? undefined : offLabel(t.controls)}><LessonTag tag="panel-controls" /></ArtLayer>
      <ArtLayer {...a.words.controls} tone="primary" off={!on}>{t.controls}</ArtLayer>
      {/* (a bubble, on a phone on its side: above the top corners, below the bottom ones — never over the dial) */}
      {r.controls.lamps.map((at, k) => <Lamp key={k} at={at} live={on} lit={target === k} blink="fast"
        tag={target === k ? 'repair-controls' : undefined} side={k < 2 ? 'top' : 'bottom'} />)}
      <ArtLayer at={r.controls.dialAt} off={!on}>
        {/* (the lesson's outline: the blinking corner and the dial, together) */}
        {target !== null && <LessonTag tag="repair-controls" placement={target < 2 ? 'top' : 'bottom'} />}
        <SnapControl kind="turn" label={t.dial} angles={r.controls.angles} value={c.dial} disabled={!live}
          onChange={(k) => setC((now) => controlsTurn(now, k))} valueText={(k) => t.corners[k]}>
          <img src={r.controls.dial} alt="" draggable={false} />
        </SnapControl>
      </ArtLayer>
    </>
  )
}
