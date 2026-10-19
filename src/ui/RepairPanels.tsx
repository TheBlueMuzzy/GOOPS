// THE REPAIR PANELS on the console (F24): the three panels of Muzzy's console art, drawn as kit ArtLayers inside the
// console's ArtStage. A broken machine's panel comes alive (its lamps say what to do); a working (or locked) one stays
// switched off. The puzzles' rules are in src/game/repairs.ts; when one is solved the console calls onRepair(machine)
// (the App sends act({ type: 'repair' }) to the engine, the machine is fixed, and its panel switches off again).
// Each breakdown starts a new puzzle (the App keys each panel by how many times its machine has broken).
// Sliders and the dial are the kit's SnapControl (drag or tap); the visor's buttons are kit picture Buttons.
// F32 lessons point at the panels by data-tag (an invisible box filling an ArtLayer): "panel-<machine>" = the panel,
// "repair-<machine>" = the part that wants doing next (the blinking lamp, or the laser's next slider).
import { Fragment, useEffect, useRef, useState } from 'react'
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
// an invisible box over its ArtLayer, for a lesson's pointer (src/game/lessons/goopsLessons.ts lessonTarget).
// placement = which side of it the lesson's message goes first, so the message never covers the parts still to use
// (the kit Callout flips it when there's no room)
type Side = 'top' | 'bottom' | 'left' | 'right'
export const LessonTag = ({ tag, placement }: { tag: string; placement?: Side }) => <span className="lesson-tag" data-tag={tag} data-placement={placement} aria-hidden />
// the laser's top row of sliders (its message goes above them; the bottom row's below)
const laserTopRow = (at: [number, number, number, number]) => {
  const ys = r.laser.sliders.map((s) => s[1])
  return at[1] < (Math.min(...ys) + Math.max(...ys)) / 2
}

type PanelProps = { live: boolean; onRepair(): void; fewerSteps?: number } // fewerSteps: from upgrades (later); 0 today

// calls onRepair once, the moment the puzzle is solved
function useSolved(solved: boolean, onRepair: () => void) {
  const latest = useRef(onRepair)
  useEffect(() => { latest.current = onRepair })
  useEffect(() => { if (solved) latest.current() }, [solved])
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
export function LaserPanel({ live, onRepair, fewerSteps }: PanelProps) {
  const [want] = useState(() => newLaser(Math.random, repairSteps('laser', fewerSteps)))
  const [pos, setPos] = useState([1, 1, 1, 1]) // every knob starts in the middle
  useSolved(live && laserSolved(want, pos), onRepair)
  useStepSound(want.filter((w, i) => w !== null && pos[i] === w).length, live)
  const next = live ? want.findIndex((w, i) => w !== null && pos[i] !== w) : -1 // the first slider still to do
  return (
    <>
      <ArtLayer {...a.laser} off={!live} label={live ? undefined : offLabel(t.laser)}><LessonTag tag="panel-laser" /></ArtLayer>
      <ArtLayer {...a.words.laser} tone="primary" off={!live}>{t.laser}</ArtLayer>
      {r.laser.sliders.map((at, i) => (
        <SliderRow key={i} at={at} lamps={r.laser.lamps[i]} live={live} want={live ? want[i] : null} value={pos[i]} next={i === next}
          label={fill(t.laserSlider, { n: i + 1 })} onChange={(v) => setPos((p) => p.map((old, k) => (k === i ? v : old)))} />
      ))}
    </>
  )
}
function SliderRow({ at, lamps, live, want, value, next, label, onChange }: {
  at: [number, number, number, number]; lamps: [number, number, number, number][]; live: boolean; want: 0 | 2 | null; value: number
  next: boolean; label: string; onChange(v: number): void
}) {
  return (
    <>
      {lamps.map((lampAt, end) => {
        const stop = end ? 2 : 0
        return <Lamp key={end} at={lampAt} live={live} lit={want === stop} blink={value !== stop ? 'fast' : undefined} />
      })}
      <ArtLayer at={at} off={!live}>
        {next && <LessonTag tag="repair-laser" placement={laserTopRow(at) ? 'top' : 'bottom'} />}
        <SnapControl label={label} stops={3} knob={r.knobShare} value={value} onChange={onChange} disabled={!live}
          valueText={(v) => t.positions[v]}>
          <img src={r.knob} alt="" draggable={false} />
        </SnapControl>
      </ArtLayer>
    </>
  )
}

// VISOR (the RESET VISOR panel): top lamp blinks → slide up → the lit button, three times (repairSteps('visor')) → bottom lamp → slide down.
// The slider only moves when it's asked for (otherwise it springs back); a wrong button shakes the panel, nothing resets.
export function VisorPanel({ live, onRepair, fewerSteps }: PanelProps) {
  const [v, setV] = useState(() => newVisor(Math.random, repairSteps('visor', fewerSteps)))
  const [shake, setShake] = useState(0)
  useSolved(live && visorDone(v), onRepair)
  useStepSound(v.step, live)
  const lit = live ? visorLitButton(v) : null
  const press = (b: number) => {
    const next = visorPress(v, b)
    if (next.wrong) { setShake((n) => n + 1); playUiSound(SOUNDS.wrong) }
    else setV(next.visor)
  }
  return (
    <>
      <ArtLayer {...a.lights} off={!live} shake={shake} label={live ? undefined : offLabel(t.lights)}><LessonTag tag="panel-visor" /></ArtLayer>
      <ArtLayer {...a.words.lights} tone="primary" off={!live} shake={shake}>{t.lights}</ArtLayer>
      {/* (a lesson's message: left of the top lamp, under the bottom one, right of the buttons' lamps — never over the
          slider or buttons still to use) */}
      <Lamp at={r.visor.topLamp} live={live} lit={v.step === 0} blink="fast" tag={live && v.step === 0 ? 'repair-visor' : undefined} side="left" />
      <Lamp at={r.visor.bottomLamp} live={live} lit={visorWantsDown(v)} blink="fast" tag={live && visorWantsDown(v) ? 'repair-visor' : undefined} side="bottom" />
      <ArtLayer at={r.visor.slider} off={!live} shake={shake}>
        <SnapControl label={t.visorSlider} axis="y" stops={2} knob={r.knobShare} value={v.slider} disabled={!live}
          onChange={(to) => { const next = visorSlide(v, to as 0 | 1); if (next) setV(next) }} valueText={(k) => t.upDown[k]}>
          <img src={r.knob} alt="" draggable={false} />
        </SnapControl>
      </ArtLayer>
      {r.visor.buttons.map((b, i) => (
        <Fragment key={i}>
          <Lamp at={b.lamp} live={live} lit={lit === i} blink="slow" tag={lit === i ? 'repair-visor' : undefined} side="right" />
          <ArtLayer at={b.at} off={!live} shake={shake}>
            <Button art={b.art} disabled={!live} onClick={() => press(i)}>{t.visorButtons[i]}</Button>
          </ArtLayer>
        </Fragment>
      ))}
    </>
  )
}

// CONTROLS: one corner lamp blinks; turn the dial's arrow to it and it locks by itself; then the next; 4 in all (repairSteps('controls'))
export function ControlsPanel({ live, onRepair, fewerSteps }: PanelProps) {
  const [c, setC] = useState(() => newControls(Math.random, repairSteps('controls', fewerSteps)))
  useSolved(live && controlsDone(c), onRepair)
  useStepSound(c.step, live)
  const target = live && !controlsDone(c) ? c.targets[c.step] : null
  return (
    <>
      <ArtLayer {...a.controls} off={!live} label={live ? undefined : offLabel(t.controls)}><LessonTag tag="panel-controls" /></ArtLayer>
      <ArtLayer {...a.words.controls} tone="primary" off={!live}>{t.controls}</ArtLayer>
      {/* (a lesson's message: above the top corners, below the bottom ones — never over the dial) */}
      {r.controls.lamps.map((at, k) => <Lamp key={k} at={at} live={live} lit={target === k} blink="fast"
        tag={target === k ? 'repair-controls' : undefined} side={k < 2 ? 'top' : 'bottom'} />)}
      <ArtLayer at={r.controls.dialAt} off={!live}>
        <SnapControl kind="turn" label={t.dial} angles={r.controls.angles} value={c.dial} disabled={!live}
          onChange={(k) => setC((now) => controlsTurn(now, k))} valueText={(k) => t.corners[k]}>
          <img src={r.controls.dial} alt="" draggable={false} />
        </SnapControl>
      </ArtLayer>
    </>
  )
}
