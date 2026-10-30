// F65 THE ENDING's looks (the steps: src/game/ending.ts; numbers content/tuning/ending.json; words en.json ending).
//   EndingTank (in the tank, after the third valve stage): the view shakes, then the goop pours out — it rises from the
//     bottom and fills the whole periscope view, galaxy black like the final shift's goop (galaxy-look.json colours,
//     twinkling stars). Then faces in it (the goop faces' eyes + mouths, eyes.json colours) and it speaks out loud: every
//     mouth opens at once on each line — the rank-48 chorus (eyes.json chorusTime / chorusOpen) — and the line's bubble
//     points at the face that says it: the goop's own bubble (the in-your-head one, plain outline — story.md: "the same
//     one for telepathy and, at the end, for its real mouths"), now from the goop itself. A tap moves on.
//     F75 the happy ending (the Veteran made it): his white clump rides up in the goop (whiteGoop.json colour, his eyes),
//     and after the goop's lines he speaks out loud from it — the same bubble he used in the final shift (plain outline,
//     his colours), a tap moving on.
//   EndingConsole (on the console): the Veteran's last line in his bubble — clear for the first time: no static squelch
//     while it waits — then nothing (the speaker is quiet for good); the last payday (the payday card, its debt row);
//     you leave: the same goop rises over the console and carries you up and out; the empty console (a tap moves on).
//     The badge on the monitor is the Console's (Console.tsx EndingBadge); the end-game screen is src/ui/EndGameScreen.tsx.
// Animations are CSS on the looks clock's terms: the Dev Kit's full pause holds them (data-paused), like the hatch.
import { useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { Button, Modal, ScrollArea, StatList, Text, TalkingBubble } from '../ui/kit'
import { clockPause, looksClock, onClockPause } from '../devkit/gameClock'
import { ending, goopLine, vetSavedLine } from './ending'
import { hash01 } from '../goo/shared/faces'
import endingTuning from '../../content/tuning/ending.json'
import galaxy from '../../content/tuning/galaxy-look.json'
import eyes from '../../content/tuning/eyes.json'
import whiteGoop from '../../content/tuning/whiteGoop.json'
import talk from '../../content/tuning/talk.json'
import payslipTuning from '../../content/tuning/payslip.json'
import text from '../../content/text/en.json'
import './ending.css'

const E = text.ending

function useFullPause() {
  const [paused, setPaused] = useState(() => clockPause() === 'full')
  useEffect(() => onClockPause((mode) => setPaused(mode === 'full')), [])
  return paused
}

// THE GOOP pouring out: kind 'pour' = shakes, rises and stays (the tank) · 'carry' = rises over the console, holds, and
// sweeps up and away with you (leave) — the same goop, the same motion
// (F75 withVet: the happy ending — his white clump in it, rising with it to ending.json vet.spot)
function GoopFlood({ kind, withVet = false }: { kind: 'pour' | 'carry'; withVet?: boolean }) {
  const paused = useFullPause()
  const P = endingTuning.pour
  // its blobs along the rising edge and its stars: fixed for this flood (hash01 of their number, no Math.random)
  const lumps = useMemo(() => {
    const n = Math.max(1, Math.round(P.lumps))
    return Array.from({ length: n }, (_, i) => ({ x: (i + 0.5) / n + (hash01(`lump${i}`) - 0.5) * 0.4 / n, s: 0.75 + hash01(`size${i}`) * 0.5 }))
  }, [P.lumps])
  const stars = useMemo(() => Array.from({ length: Math.max(0, Math.round(P.stars)) }, (_, i) => ({
    x: hash01(`sx${i}`), y: hash01(`sy${i}`), d: hash01(`sd${i}`) })), [P.stars])
  // (the shake: the whole game, while the tank opens — reduce motion leaves it still, ending.css)
  useEffect(() => {
    if (kind !== 'pour') return
    const body = document.body
    const still = () => { delete body.dataset.endingShake; body.style.removeProperty('--ending-shake-now') }
    body.style.setProperty('--ending-shake-now', `${P.shake * 100}vw`)
    body.dataset.endingShake = ''
    const stop = looksClock.after(P.shakeSeconds * 1000, still)
    return () => { stop(); still() }
  }, [kind, P.shake, P.shakeSeconds])
  const style = {
    '--ending-body': galaxy.body, '--ending-nebula1': galaxy.nebula1, '--ending-nebula2': galaxy.nebula2, '--ending-rim': galaxy.rim,
    '--ending-star': galaxy.starColor, '--ending-lump': `${P.lumpSize * 100}vw`, '--ending-rise-s': `${kind === 'pour' ? P.seconds : endingTuning.console.leaveSeconds}s`,
    '--ending-rise-after': `${kind === 'pour' ? P.shakeSeconds : 0}s`, '--ending-twinkle': `${P.twinkleSeconds}s`,
  } as CSSProperties
  return (
    <div className="ending-flood" data-kind={kind} data-paused={paused || undefined} data-tag="ending-goop" aria-hidden style={style}>
      <div className="ending-goop">
        {lumps.map((l, i) => <span key={`t${i}`} className="ending-lump" style={{ '--x': l.x, '--s': l.s } as CSSProperties} />)}
        {kind === 'carry' && lumps.map((l, i) => <span key={`b${i}`} className="ending-lump" data-under style={{ '--x': 1 - l.x, '--s': l.s } as CSSProperties} />)}
        {stars.map((s, i) => <span key={i} className="ending-star" style={{ '--x': s.x, '--y': s.y, '--d': s.d } as CSSProperties} />)}
        {withVet && <VetClump />}
      </div>
    </div>
  )
}

// The faces in the goop that filled the view: eyes + a mouth each (eyes.json colours); on each line every mouth opens
// at once (the chorus: the first half of chorusTime) and they all talk together (talkFlaps) — restarted by `line`
function GoopFaces({ line }: { line: number }) {
  const paused = useFullPause()
  const M = endingTuning.mouths
  const style = { '--ending-mouth': `${M.size * 100}vmin`, '--ending-eye': eyes.eyeColor, '--ending-pupil': eyes.pupilColor,
    '--ending-mouth-colour': eyes.mouthColor, '--ending-chorus': `${eyes.chorusTime * 0.5}s`, '--ending-open': eyes.chorusOpen,
    '--ending-flap': `${1 / Math.max(0.5, eyes.talkFlaps)}s` } as CSSProperties
  return (
    <div className="ending-faces" data-paused={paused || undefined} aria-hidden style={style}>
      {M.spots.map(([x, y], i) => (
        <span key={`${i}:${line}`} className="ending-face" data-tag={`ending-face-${i}`} style={{ '--x': x, '--y': y } as CSSProperties}>
          <span className="ending-eyes"><span className="ending-eye" /><span className="ending-eye" /></span>
          <span className="ending-mouth" />
        </span>
      ))}
    </div>
  )
}

// F75 the Veteran in the happy ending: his white clump with his eyes (whiteGoop.json colour, eyes.json eye colours),
// riding in the goop at ending.json vet.spot
function VetClump() {
  const V = endingTuning.vet
  const style = { '--x': V.spot[0], '--y': V.spot[1], '--ending-vet': `${V.size * 100}vmin`, '--ending-vet-colour': String(whiteGoop.color),
    '--ending-eye': eyes.eyeColor, '--ending-pupil': eyes.pupilColor } as CSSProperties
  return (
    <span className="ending-vet" data-tag="ending-vet" style={style}>
      <span className="ending-eyes"><span className="ending-eye" /><span className="ending-eye" data-squint /></span>
    </span>
  )
}

/** The ending in the tank (App shows it in the shift once the ending has started). */
export function EndingTank() {
  const view = useSyncExternalStore(ending.subscribe, ending.view)
  // (its point: the top of the face that says the line, where the window is now)
  const [size, setSize] = useState(() => ({ w: innerWidth, h: innerHeight }))
  useEffect(() => {
    const resize = () => setSize({ w: innerWidth, h: innerHeight })
    addEventListener('resize', resize)
    return () => removeEventListener('resize', resize)
  }, [])
  if (!view || view.step.at !== 'tank') return null
  const step = view.step
  const spot = step.id === 'goop' ? endingTuning.mouths.spots[step.face] : null
  const faceTop = spot && { x: spot[0] * size.w, y: spot[1] * size.h - endingTuning.mouths.size * Math.min(size.w, size.h) * 0.55 }
  // (F75: his clump's bottom, where his bubble points — it opens under him: he sits high in the goop, so there's room)
  const V = endingTuning.vet
  const vetBottom = { x: V.spot[0] * size.w, y: V.spot[1] * size.h + V.size * Math.min(size.w, size.h) * 0.45 }
  return (
    <>
      <GoopFlood kind="pour" withVet={view.saved} />
      {step.id === 'goop' && <GoopFaces line={view.index} />}
      {step.id === 'goop' && faceTop && (
        <TalkingBubble key={view.index} lineId={view.index} target={faceTop} placement="top" outline="plain" feel={talk}
          text={goopLine(step.words)} speaker={text.story.goop} onConfirm={ending.next} />
      )}
      {/* F75 the happy ending: he says it out loud — his final-shift bubble (plain outline, his colours) */}
      {step.id === 'vetSays' && (
        <TalkingBubble key={view.index} lineId={view.index} target={vetBottom} placement="bottom" outline="plain" feel={talk} colours={talk.colours}
          text={vetSavedLine(step.words)} speaker={text.story.veteran} onConfirm={ending.next} />
      )}
    </>
  )
}

/** The ending at the console (App shows it on the console; the badge is on the monitor: Console.tsx). */
export function EndingConsole() {
  const view = useSyncExternalStore(ending.subscribe, ending.view)
  const id = view?.step.at === 'console' ? view.step.id : null
  // the empty console: a tap (or a key) moves on sooner
  useEffect(() => {
    if (id !== 'empty') return
    const on = () => ending.next()
    addEventListener('pointerdown', on)
    addEventListener('keydown', on)
    return () => { removeEventListener('pointerdown', on); removeEventListener('keydown', on) }
  }, [id])
  if (!id) return null
  const P = text.payslip
  return (
    <>
      {/* his last line, clear: his bubble and voice, but no static while it waits (squelchEvery 0) */}
      {id === 'vet' && (
        <TalkingBubble key="vet" target='[data-tag="crt"]' placement="bottom" outline="wave" text={E.vet} speaker={text.story.veteran}
          colours={talk.colours} feel={{ ...talk, squelchEvery: 0 }} onConfirm={ending.next} />
      )}
      {/* the last payday: the payday card, its debt row paid off — by them */}
      {id === 'payday' && (
        <Modal title={E.payday.title} actions={<Button onClick={ending.next}>{E.payday.done}</Button>}>
          <Text>{E.payday.message}</Text>
          <ScrollArea label={E.payday.title}>
            <StatList reveal={payslipTuning.lineMs} stats={[
              { label: P.debt, value: E.payday.debtValue.replace('{n}', endingTuning.paidBy.toLocaleString('en')), tone: 'success' },
            ]} />
          </ScrollArea>
        </Modal>
      )}
      {id === 'leave' && <GoopFlood kind="carry" />}
      {id === 'empty' && <span className="ending-empty" role="status">{E.empty}</span>}
    </>
  )
}
