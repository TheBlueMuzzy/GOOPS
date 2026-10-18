// THE REPAIR PANELS on the console (F24): the three panels of Muzzy's console art, drawn as kit ArtLayers inside the
// console's ArtStage. A broken machine's panel comes alive (its lamps say what to do); a working (or locked) one stays
// switched off. The puzzles' rules are in src/game/repairs.ts; when one is solved the console calls onRepair(machine)
// (the App sends act({ type: 'repair' }) to the engine, the machine is fixed, and its panel switches off again).
// Each breakdown starts a new puzzle (the App keys each panel by how many times its machine has broken).
// Sliders and the dial are the kit's SnapControl (drag or tap); the visor's buttons are kit picture Buttons.
import { Fragment, useEffect, useRef, useState } from 'react'
import { ArtLayer, Button, SnapControl, fill } from './kit'
import { controlsTurn, controlsDone, laserSolved, newControls, newLaser, newVisor, visorDone, visorLitButton, visorPress, visorSlide } from '../game/repairs'
import { art } from './art'
import text from '../../content/text/en.json'

const t = text.console
const a = art.console
const r = art.repairs
const offLabel = (name: string) => fill(t.unavailable, { name })

type PanelProps = { live: boolean; onRepair(): void }

// calls onRepair once, the moment the puzzle is solved
function useSolved(solved: boolean, onRepair: () => void) {
  const latest = useRef(onRepair)
  useEffect(() => { latest.current = onRepair })
  useEffect(() => { if (solved) latest.current() }, [solved])
}

// A lamp: its "off" picture, with the "on" picture over it while lit (blinking while it asks for something)
function Lamp({ at, lit, blink, live }: { at: [number, number, number, number]; lit: boolean; blink?: 'fast' | 'slow'; live: boolean }) {
  return (
    <>
      <ArtLayer src={r.lampOff} at={at} off={!live} />
      {live && lit && <ArtLayer src={r.lampOn} at={at} blink={blink} />}
    </>
  )
}

// LASER: 2 of the 4 sliders light up, each wanting left or right (its lamp at that end blinks until the knob is there)
export function LaserPanel({ live, onRepair }: PanelProps) {
  const [want] = useState(() => newLaser(Math.random))
  const [pos, setPos] = useState([1, 1, 1, 1]) // every knob starts in the middle
  useSolved(live && laserSolved(want, pos), onRepair)
  return (
    <>
      <ArtLayer {...a.laser} off={!live} label={live ? undefined : offLabel(t.laser)} />
      <ArtLayer {...a.words.laser} tone="primary" off={!live}>{t.laser}</ArtLayer>
      {r.laser.sliders.map((at, i) => (
        <SliderRow key={i} at={at} lamps={r.laser.lamps[i]} live={live} want={live ? want[i] : null} value={pos[i]}
          label={fill(t.laserSlider, { n: i + 1 })} onChange={(v) => setPos((p) => p.map((old, k) => (k === i ? v : old)))} />
      ))}
    </>
  )
}
function SliderRow({ at, lamps, live, want, value, label, onChange }: {
  at: [number, number, number, number]; lamps: [number, number, number, number][]; live: boolean; want: 0 | 2 | null; value: number
  label: string; onChange(v: number): void
}) {
  return (
    <>
      {lamps.map((lampAt, end) => {
        const stop = end ? 2 : 0
        return <Lamp key={end} at={lampAt} live={live} lit={want === stop} blink={value !== stop ? 'fast' : undefined} />
      })}
      <ArtLayer at={at} off={!live}>
        <SnapControl label={label} stops={3} knob={r.knobShare} value={value} onChange={onChange} disabled={!live}
          valueText={(v) => t.positions[v]}>
          <img src={r.knob} alt="" draggable={false} />
        </SnapControl>
      </ArtLayer>
    </>
  )
}

// VISOR (the RESET LIGHTS panel): top lamp blinks → slide up → the lit button, three times → bottom lamp → slide down.
// The slider only moves when it's asked for (otherwise it springs back); a wrong button shakes the panel, nothing resets.
export function VisorPanel({ live, onRepair }: PanelProps) {
  const [v, setV] = useState(() => newVisor(Math.random))
  const [shake, setShake] = useState(0)
  useSolved(live && visorDone(v), onRepair)
  const lit = live ? visorLitButton(v) : null
  const press = (b: number) => {
    const next = visorPress(v, b)
    if (next.wrong) setShake((n) => n + 1)
    else setV(next.visor)
  }
  return (
    <>
      <ArtLayer {...a.lights} off={!live} shake={shake} label={live ? undefined : offLabel(t.lights)} />
      <ArtLayer {...a.words.lights} tone="primary" off={!live} shake={shake}>{t.lights}</ArtLayer>
      <Lamp at={r.visor.topLamp} live={live} lit={v.step === 0} blink="fast" />
      <Lamp at={r.visor.bottomLamp} live={live} lit={v.step === 4} blink="fast" />
      <ArtLayer at={r.visor.slider} off={!live} shake={shake}>
        <SnapControl label={t.visorSlider} axis="y" stops={2} knob={r.knobShare} value={v.slider} disabled={!live}
          onChange={(to) => { const next = visorSlide(v, to as 0 | 1); if (next) setV(next) }} valueText={(k) => t.upDown[k]}>
          <img src={r.knob} alt="" draggable={false} />
        </SnapControl>
      </ArtLayer>
      {r.visor.buttons.map((b, i) => (
        <Fragment key={i}>
          <Lamp at={b.lamp} live={live} lit={lit === i} blink="slow" />
          <ArtLayer at={b.at} off={!live} shake={shake}>
            <Button art={b.art} disabled={!live} onClick={() => press(i)}>{t.visorButtons[i]}</Button>
          </ArtLayer>
        </Fragment>
      ))}
    </>
  )
}

// CONTROLS: one corner lamp blinks; turn the dial's arrow to it and it locks by itself; then the next; 3 in all
export function ControlsPanel({ live, onRepair }: PanelProps) {
  const [c, setC] = useState(() => newControls(Math.random))
  useSolved(live && controlsDone(c), onRepair)
  const target = live && !controlsDone(c) ? c.targets[c.step] : null
  return (
    <>
      <ArtLayer {...a.controls} off={!live} label={live ? undefined : offLabel(t.controls)} />
      <ArtLayer {...a.words.controls} tone="primary" off={!live}>{t.controls}</ArtLayer>
      {r.controls.lamps.map((at, k) => <Lamp key={k} at={at} live={live} lit={target === k} blink="fast" />)}
      <ArtLayer at={r.controls.dialAt} off={!live}>
        <SnapControl kind="turn" label={t.dial} angles={r.controls.angles} value={c.dial} disabled={!live}
          onChange={(k) => setC((now) => controlsTurn(now, k))} valueText={(k) => t.corners[k]}>
          <img src={r.controls.dial} alt="" draggable={false} />
        </SnapControl>
      </ArtLayer>
    </>
  )
}
