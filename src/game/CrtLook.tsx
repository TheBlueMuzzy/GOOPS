// THE CRT LOOK — one reusable piece (F60; first built by hand for the console monitor in F32, Muzzy 2026-10-19: "make
// it look like old DOS"). Muzzy, sprint 08 retro: "that render shader should be accessible to apply to things in the
// future, and should feel pretty simple/fast to apply." So putting it on something is one wrapper and a preset name:
//
//   <CrtLook preset="dos" className="my-panel">        ← a fixed preset (dos · amber · off)
//     <TypedText text={words} />                       ← the words: typed out with a block cursor (or all at once)
//   </CrtLook>
//
//   <CrtLook place="monitor">…</CrtLook>               ← the preset Muzzy picks for this place in the Dev Kit
//                                                        (content/tuning/crt.json use.monitor — a dropdown, live)
//
// A look only changes how things are drawn, never a rule (.planning/research/looks-module.md). Surface: a DOM panel
// and its text. Engine: CSS (crt.css). Layers, each switched on or off per preset in content/tuning/crt.json:
//   tint (the words' colour) · glow · scanLines (static or rolling) · wobble (phase jitter) · typing (+ block cursor)
// Clock: the LOOKS clock — the Dev Kit's full pause holds the typing, the wobble, the blink and the roll; a half pause
// doesn't. Reduce motion: the words are all there at once, no wobble, no blink, no roll (the look itself stays).
// Accessibility: TypedText keeps the whole text for screen readers (.crt-read); the typed copy is aria-hidden.
// Every knob is live in the Dev Kit's Tuning tab (crt.json is imported live; the wrapper redraws on an edit).
// The knobs, the CSS variables and the typing itself: crt.ts. The CSS: crt.css.
import { createContext, useContext, useEffect, useLayoutEffect, useReducer, useState, type HTMLAttributes, type Ref } from 'react'
import { clockPause, onClockPause } from '../devkit/gameClock'
import { onTuning } from '../devkit/tuning/liveTuning'
import { crtPreset, crtPresetFor, crtVars, useTyping, type CrtPlace, type CrtPreset, type CrtPresetName } from './crt'
import './crt.css'

// What the words inside a look need from it: its preset, and a way to say "still typing" (the cursor holds still then)
type LookContext = { preset: CrtPreset; setTyping(typing: boolean): void }
const Look = createContext<LookContext | null>(null)

type CrtLookProps = HTMLAttributes<HTMLDivElement> & {
  preset?: CrtPresetName | (string & {}) // a fixed preset…
  place?: CrtPlace // …or the one crt.json use.<place> names (Muzzy picks it in the Dev Kit)
  unit?: string // what the scan-line sizes count in (a CSS length; the console monitor: one of its art units)
  ref?: Ref<HTMLDivElement>
}

/** The CRT look on a panel: a div with the preset's layers on it, and everything inside it. */
export function CrtLook({ preset, place, unit, className, style, children, ref, ...rest }: CrtLookProps) {
  // redraw when the Dev Kit edits crt.json (the values themselves are read live) or pauses the looks clock
  const [, redraw] = useReducer((n: number) => n + 1, 0)
  useEffect(() => onTuning('crt', redraw), [])
  const [paused, setPaused] = useState(() => clockPause() === 'full')
  useEffect(() => onClockPause((mode) => setPaused(mode === 'full')), [])
  const [typing, setTyping] = useState(false)

  const name = place ? crtPresetFor(place) : (preset ?? 'off')
  const p = crtPreset(name)
  const on = (layer: boolean) => (layer ? '' : undefined)
  return (
    <div ref={ref} {...rest} className={className ? `crt-look ${className}` : 'crt-look'} data-look={name}
      data-tint={on(p.tint)} data-glow={on(p.glow)} data-scan={on(p.scanLines)} data-roll={on(p.scanLines && p.scanSpeed > 0)}
      data-wobble={on(p.wobble && p.wobbleSize !== 0)} data-typing={on(typing)}
      data-blink={p.cursorBlinkSeconds > 0 ? undefined : 'off'} data-paused={on(paused)}
      style={{ ...crtVars(p, unit), ...style }}>
      <Look.Provider value={{ preset: p, setTyping }}>{children}</Look.Provider>
    </div>
  )
}

/** Words in a CRT look: typed out letter by letter with a block cursor where the next letter goes (when the look's
 *  typing layer is on), else all there at once. The whole text is laid out from the first frame — the letters not
 *  typed yet are there, unseen — so the box never changes size. Screen readers get the whole text (.crt-read). */
export function TypedText({ text, className }: { text: string; className?: string }) {
  const look = useContext(Look)
  const typingOn = !!look?.preset.typing
  const typed = useTyping(text, typingOn && look ? look.preset.lettersPerSecond : 0)
  const typing = typingOn && typed < text.length
  // (before the paint, so the look knows from the first frame: the cursor holds still while letters come)
  const setTyping = look?.setTyping
  useLayoutEffect(() => setTyping?.(typing), [setTyping, typing])
  useLayoutEffect(() => () => setTyping?.(false), [setTyping])
  return (
    <>
      <span className="crt-read">{text}</span>
      <span className={className ? `crt-words ${className}` : 'crt-words'} aria-hidden>
        {typingOn ? <>{text.slice(0, typed)}<span className="crt-cursor" /><span className="crt-rest">{text.slice(typed)}</span></> : text}
      </span>
    </>
  )
}
