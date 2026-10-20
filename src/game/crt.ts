// THE CRT LOOK — its knobs and its typing (F60). The pieces you put on screen are in CrtLook.tsx (<CrtLook> + <TypedText>);
// this file is what they share: the presets (content/tuning/crt.json), the preset as CSS variables (crt.css reads
// them), and the typing (letters on the LOOKS clock: the Dev Kit's full pause holds them, a half pause doesn't).
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { looksClock } from '../devkit/gameClock'
import { reduceMotion } from '../ui/kit'
import crt from '../../content/tuning/crt.json'

export type CrtPreset = (typeof crt.presets)['dos']
export type CrtPresetName = keyof typeof crt.presets
export type CrtPlace = keyof typeof crt.use

/** A preset's knobs by name (today's values, Dev Kit edits included); an unknown name falls back to "off". */
export function crtPreset(name: string): CrtPreset {
  const presets = crt.presets as Record<string, CrtPreset>
  return presets[name] ?? presets.off
}

/** The preset a place uses (crt.json use.<place>, picked in the Dev Kit). */
export const crtPresetFor = (place: CrtPlace): string => crt.use[place]

/** How many letters of a `length`-letter text are typed after `elapsedMs` at `lettersPerSecond` (all of them when
 *  the speed is 0 or less, or with reduce motion). */
export function typedCount(elapsedMs: number, lettersPerSecond: number, length: number, still = false) {
  if (still || !(lettersPerSecond > 0)) return length
  return Math.max(0, Math.min(length, Math.floor((Math.max(0, elapsedMs) / 1000) * lettersPerSecond)))
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
const percent = (n: number) => `${Math.round(clamp01(n) * 100)}%`

/** A preset as CSS variables (crt.css reads them). `unit` = what the scan-line sizes count in (px by default). */
export function crtVars(p: CrtPreset, unit = '1px'): CSSProperties {
  const gap = Math.max(1, p.scanGap)
  return {
    '--crt-unit': unit,
    '--crt-ink': p.textColor,
    '--crt-glow': p.glowColor,
    '--crt-glow-size': p.glowSize,
    '--crt-glow-strength': percent(p.glowStrength),
    '--crt-cursor-w': p.cursorWidth,
    '--crt-blink': `${Math.max(0, p.cursorBlinkSeconds)}s`,
    '--crt-scan-gap': gap,
    '--crt-scan-width': Math.max(0, Math.min(gap, p.scanWidth)),
    '--crt-scan-alpha': percent(p.scanAlpha),
    // one roll = the lines move down by one gap (scanSpeed: units per second)
    '--crt-scan-roll': `${p.scanSpeed > 0 ? gap / p.scanSpeed : 1}s`,
    '--crt-wobble': p.wobbleSize,
    '--crt-wobble-time': `${Math.max(0.5, p.wobbleSeconds)}s`,
  } as CSSProperties
}

/** The letters of `text` typed so far at `lettersPerSecond` (looks clock); starts again from 0 whenever the text
 *  changes. Speed 0 (or reduce motion) = all of it at once. */
export function useTyping(text: string, lettersPerSecond: number) {
  const speed = useRef(lettersPerSecond)
  useLayoutEffect(() => { speed.current = lettersPerSecond }, [lettersPerSecond]) // (live: a Dev Kit edit mid-typing)
  const [typed, setTyped] = useState(() => typedCount(0, lettersPerSecond, text.length, reduceMotion()))
  const [shownFor, setShownFor] = useState(text)
  // (new words: start again — set during render, so the first frame of new words already hides them)
  if (shownFor !== text) {
    setShownFor(text)
    setTyped(typedCount(0, lettersPerSecond, text.length, reduceMotion()))
  }
  useEffect(() => {
    const at = looksClock.now()
    let frame = 0
    const step = () => {
      const n = typedCount(looksClock.now() - at, speed.current, text.length, reduceMotion())
      setTyped(n)
      if (n < text.length) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [text])
  return Math.min(typed, text.length)
}
