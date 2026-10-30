// THE RELEASE VALVE PANEL (F64 — the final shift, rank 50; Muzzy's mini-game 2026-10-26, built from sketch S11
// valve-wheels.html). When a valve stage's seals are in, the hatch under the console opens and this panel rises over the
// repair panels: two wheels with one needle on a dial between them. Turn the wheels until the needle sits in the green
// and hold it there → the stage opens (onOpen: the App calls engine.openValveStage() and goes back to the tank).
// The puzzle's rules are in src/game/valve.ts, its numbers in content/tuning/valve.json (live).
//   Phone / mouse: drag round a wheel — it clicks from one detent to the next as you turn. Keyboard: A / D turn the left
//   wheel, ← / → the right one (not while typing in a text box).
// Its time is the rules clock's, unslowed: the shift around it runs at consoleTimeScale, the player's hands don't — but a
// pause (the pause menu, the Dev Kit) stops the needle and the hold. Every stage is a new valve (the console keys this
// panel by stage); under scripted checks the valve is seeded by its stage, so e2e knows it (window.__goopsValve, dev).
// Drawn as one SVG in the console's own units (it scales with the console art), in the style's colours.
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { ArtLayer, fill } from './kit'
import { art } from './art'
import { rulesClock } from '../devkit/gameClock'
import { playUiSound } from '../game/sound'
import { SOUNDS } from '../game/shiftSounds'
import { TAU, clickSize, greenWidth, holdDone, holdStep, inGreen, keyTurn, newValve, seededRand, snap, stepNeedle, valveConfig, wheelsTarget, type ValveWheels } from '../game/valve'
import text from '../../content/text/en.json'

const t = text.console.valve
const P = art.console.valve
const [, , W, H] = P.at
// the drawing, in the panel's units (art.json console.valve.at is its box on the console)
const PAD = 24
const METER = { x: W / 2, y: 262, r: 128, width: 22, hold: 146 } // the dial: a half circle of red | green | red
const SPAN = Math.PI * 0.8 // how much of a circle the dial covers, centred on straight up
const WHEEL_R = 80
const TICK = 1.16 // the detent ticks reach this × the wheel's radius
const WHEELS = [{ x: PAD + WHEEL_R * TICK, y: 350 }, { x: W - PAD - WHEEL_R * TICK, y: 350 }]
const STEP = 1 / 120 // the needle's spring, in fixed steps

// the dial angle (radians, 0 = right, clockwise — SVG's y points down) for a needle value −1..1
const dialAngle = (v: number) => -Math.PI / 2 - SPAN / 2 + ((v + 1) / 2) * SPAN
const onDial = (v: number, r: number) => [METER.x + Math.cos(dialAngle(v)) * r, METER.y + Math.sin(dialAngle(v)) * r]
function arc(from: number, to: number, r: number) {
  const [x1, y1] = onDial(from, r), [x2, y2] = onDial(to, r)
  return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`
}
const deg = (a: number) => (a * 180) / Math.PI
const typingIn = (e: KeyboardEvent) => !!(e.target as HTMLElement | null)?.closest?.('input, select, textarea, [contenteditable="true"]')

type Props = {
  stage: number // the stage this panel opens (0 = the first)
  stages: number // how many the valve has
  live: boolean // it answers (not while the console slides away)
  onOpen(): void // the needle was held in the green: open this stage
}

export function ValvePanel({ stage, stages, live, onOpen }: Props) {
  // a new valve for this stage (fixed under scripted checks — the same every run)
  const [start] = useState<ValveWheels>(() =>
    newValve(import.meta.env.DEV && navigator.webdriver ? seededRand(1000 + stage) : Math.random, valveConfig(), stage))
  const right = start.right
  // where the wheels are: state (it changes a click at a time), and a ref the frame loop and the handlers read
  const [angle, setAngle] = useState<[number, number]>(start.angle)
  const angles = useRef<[number, number]>(start.angle)
  const [opened, setOpened] = useState(false)
  const [dragging, setDragging] = useState<number | null>(null)
  const needle = useRef({ pos: wheelsTarget(valveConfig(), start), vel: 0 })
  const held = useRef(0)
  const drag = useRef<{ wheel: number; last: number; raw: number } | null>(null)
  const latest = useRef({ onOpen, live })
  useEffect(() => { latest.current = { onOpen, live } })
  const needleEl = useRef<SVGLineElement>(null)
  const holdEl = useRef<SVGPathElement>(null)
  const greenEl = useRef<SVGPathElement>(null)
  const wheelEls = [useRef<SVGGElement>(null), useRef<SVGGElement>(null)]

  // turn a wheel to an angle (on a click unless `free`); a new click = its click sound
  const setWheel = (i: number, to: number) => {
    const cfg = valveConfig()
    const was = snap(angles.current[i], cfg), now = snap(to, cfg)
    if (Math.abs(now - was) < 1e-9) return
    const next: [number, number] = i ? [angles.current[0], now] : [now, angles.current[1]]
    angles.current = next
    setAngle(next)
    playUiSound(SOUNDS.tap)
  }

  // the needle, the hold and the drawing, every frame (refs — no React state per frame)
  useEffect(() => {
    let frame = 0, last = rulesClock.now(), openFor = -1
    const tick = () => {
      frame = requestAnimationFrame(tick)
      const cfg = valveConfig()
      const now = rulesClock.now(), rate = rulesClock.rate
      // (the rules clock runs slowed at the console: its time ÷ its rate = real time, and nothing while it's stopped)
      let dt = rate > 0 ? Math.min(0.1, (now - last) / 1000 / rate) : 0
      last = now
      if (openFor >= 0) { // opened: STAGE n OPEN for openSec, then back to the tank
        openFor += dt
        if (openFor >= cfg.openSec) { openFor = -2; latest.current.onOpen() }
      } else if (openFor === -1) {
        while (dt > 0) {
          const d = Math.min(STEP, dt)
          dt -= d
          needle.current = stepNeedle(needle.current, wheelsTarget(cfg, { right, angle: angles.current }), cfg.sway, d)
          held.current = holdStep(held.current, latest.current.live && !drag.current && inGreen(needle.current.pos, cfg, stage), d)
        }
        if (holdDone(held.current, cfg) && latest.current.live && !drag.current) {
          openFor = 0
          setOpened(true)
          playUiSound(SOUNDS.fixed)
        }
      }
      // draw
      const green = greenWidth(cfg, stage)
      greenEl.current?.setAttribute('d', arc(-green / 2, green / 2, METER.r))
      const share = cfg.hold > 0 ? Math.min(1, held.current / cfg.hold) : 0
      holdEl.current?.setAttribute('d', share > 0 && openFor === -1 ? arc(-green / 2, -green / 2 + green * share, METER.hold) : '')
      const [nx, ny] = onDial(Math.max(-1.05, Math.min(1.05, needle.current.pos)), METER.r * 1.05)
      needleEl.current?.setAttribute('x2', String(nx))
      needleEl.current?.setAttribute('y2', String(ny))
      if (import.meta.env.DEV) (window as unknown as { __goopsValve?: unknown }).__goopsValve = {
        stage, right: [...right], angle: [...angles.current], click: clickSize(cfg), keyTurn: keyTurn(cfg),
        needle: needle.current.pos, green, held: held.current, opened: openFor !== -1,
        wheelAt: (i: number) => wheelEls[i].current?.getBoundingClientRect().toJSON(),
      }
    }
    frame = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(frame); if (import.meta.env.DEV) delete (window as unknown as { __goopsValve?: unknown }).__goopsValve }
    // (the valve and its elements are this panel's for life — keyed by stage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage])

  // keys: A / D the left wheel, ← / → the right
  useEffect(() => {
    if (!live || opened) return
    const key = (e: KeyboardEvent) => {
      if (typingIn(e)) return
      const turn = keyTurn(valveConfig())
      const move = ({ KeyA: [0, -1], KeyD: [0, 1], ArrowLeft: [1, -1], ArrowRight: [1, 1] } as Record<string, [number, number]>)[e.code]
      if (!move) return
      e.preventDefault()
      setWheel(move[0], angles.current[move[0]] + move[1] * turn)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [live, opened])

  // drag round a wheel: the hand's own turn adds up unsnapped (a slow drag still gets there), the wheel clicks along
  const angleAt = (i: number, e: PointerEvent) => {
    const r = wheelEls[i].current!.ownerSVGElement!.getBoundingClientRect(), u = r.width / W
    return Math.atan2(e.clientY - (r.top + WHEELS[i].y * u), e.clientX - (r.left + WHEELS[i].x * u))
  }
  const down = (i: number) => (e: PointerEvent<SVGCircleElement>) => {
    if (!live || opened || (e.pointerType === 'mouse' && e.button !== 0)) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    drag.current = { wheel: i, last: angleAt(i, e), raw: angles.current[i] }
    setDragging(i)
  }
  const move = (e: PointerEvent<SVGCircleElement>) => {
    const d = drag.current
    if (!d) return
    const now = angleAt(d.wheel, e)
    d.raw += Math.atan2(Math.sin(now - d.last), Math.cos(now - d.last)) // (the short way round since last time)
    d.last = now
    setWheel(d.wheel, d.raw)
  }
  const up = () => { drag.current = null; setDragging(null) }

  const cfg = valveConfig()
  const clicks = cfg.detents
  const radio = cfg.rule === 2
  const names = radio ? [t.coarse, t.fine] : [t.left, t.right]
  const title = opened ? fill(t.opened, { n: stage + 1 }) : fill(t.title, { n: stage + 1, total: stages })
  return (
    <ArtLayer at={P.at} className="valve-layer">
      <svg className="valve" viewBox={`0 0 ${W} ${H}`} role="group" aria-label={t.label} data-tag="valve" data-stage={stage + 1}
        data-opened={opened || undefined}>
        <rect className="valve-bg" x={1.5} y={1.5} width={W - 3} height={H - 3} rx={24} />
        <text className="valve-title" x={W / 2} y={PAD + 30} fontSize={26} textAnchor="middle" aria-live="polite">{title}</text>
        {/* the dial: red all along, green in the middle, the hold filling round the green, the needle */}
        <path className="valve-red" d={arc(-1, 1, METER.r)} strokeWidth={METER.width} />
        <path ref={greenEl} className="valve-green" d={arc(-greenWidth(cfg, stage) / 2, greenWidth(cfg, stage) / 2, METER.r)} strokeWidth={METER.width} />
        <path ref={holdEl} className="valve-hold" strokeWidth={6} />
        <line ref={needleEl} className="valve-needle" x1={METER.x} y1={METER.y} x2={METER.x} y2={METER.y - METER.r} strokeWidth={5} />
        <circle className="valve-hub" cx={METER.x} cy={METER.y} r={10} />
        {/* the stages: opened · this one · still to come */}
        {Array.from({ length: stages }, (_, s) => (
          <circle key={s} className="valve-stage" data-state={s < stage || (s === stage && opened) ? 'open' : s === stage ? 'now' : undefined}
            cx={METER.x + (s - (stages - 1) / 2) * 32} cy={METER.y + 44} r={9} />
        ))}
        {WHEELS.map((c, i) => (
          <g key={i}>
            {/* the detent ticks round it (they don't turn) */}
            {Array.from({ length: clicks }, (_, k) => {
              const a = (k * TAU) / clicks - Math.PI / 2
              return <line key={k} className="valve-tick" x1={c.x + Math.cos(a) * WHEEL_R * 1.06} y1={c.y + Math.sin(a) * WHEEL_R * 1.06}
                x2={c.x + Math.cos(a) * WHEEL_R * TICK} y2={c.y + Math.sin(a) * WHEEL_R * TICK} strokeWidth={3} />
            })}
            <g ref={wheelEls[i]} className="valve-wheel" data-dragging={dragging === i || undefined}
              transform={`translate(${c.x} ${c.y}) rotate(${deg(angle[i])})`}>
              <circle r={WHEEL_R * 0.86} className="valve-rim" strokeWidth={WHEEL_R * 0.16} />
              {[0, 1, 2, 3].map((k) => <line key={k} className="valve-spoke" x1={0} y1={0} x2={Math.cos((k * Math.PI) / 2) * WHEEL_R * 0.8}
                y2={Math.sin((k * Math.PI) / 2) * WHEEL_R * 0.8} strokeWidth={WHEEL_R * 0.1} />)}
              <circle r={WHEEL_R * 0.18} className="valve-boss" />
              <circle cy={-WHEEL_R * 0.86} r={WHEEL_R * 0.12} className="valve-handle" />
            </g>
            <text className="valve-name" x={c.x} y={H - PAD - 2} fontSize={18} textAnchor="middle">{names[i]}</text>
            {/* the wheel's grab area (a bit bigger than the wheel) */}
            <circle className="valve-grab" cx={c.x} cy={c.y} r={WHEEL_R * 1.25} tabIndex={-1} role="slider" aria-label={i ? t.rightWheel : t.leftWheel}
              aria-valuemin={0} aria-valuemax={Math.max(0, clicks - 1)} data-wheel={i}
              aria-valuenow={clicks ? ((Math.round(angle[i] / clickSize(cfg)) % clicks) + clicks) % clicks : 0}
              onPointerDown={down(i)} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
          </g>
        ))}
      </svg>
    </ArtLayer>
  )
}
