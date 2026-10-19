// THE CONSOLE MONITOR'S DOS LOOK (F32, Muzzy 2026-10-19: "the words should type out, one letter at a time (quickly
// though). where the cursor is … there is a blinking rectangle"). The words type out on the LOOKS clock (the Dev Kit's
// full pause holds them; a half pause doesn't), quickly (content/tuning/crt.json lettersPerSecond, live). New words
// type again from the start. Reduce motion: the words are all there at once.
// The look itself (green glow, scan lines, the block cursor) is crt.css; Console.tsx's Crt draws it.
import { useEffect, useReducer, useRef, useState, type CSSProperties } from 'react'
import { looksClock } from '../devkit/gameClock'
import { onTuning } from '../devkit/tuning/liveTuning'
import { reduceMotion } from '../ui/kit'
import crt from '../../content/tuning/crt.json'
import './crt.css'

/** How many letters of a `length`-letter text are typed after `elapsedMs` at `lettersPerSecond` (all of them when
 *  the speed is 0 or less, or with reduce motion). */
export function typedCount(elapsedMs: number, lettersPerSecond: number, length: number, still = false) {
  if (still || !(lettersPerSecond > 0)) return length
  return Math.max(0, Math.min(length, Math.floor((Math.max(0, elapsedMs) / 1000) * lettersPerSecond)))
}

/** The letters of `text` typed so far; starts again from 0 whenever the text changes. */
export function useTyped(text: string) {
  const [typed, setTyped] = useState(() => typedCount(0, crt.lettersPerSecond, text.length, reduceMotion()))
  const [shownFor, setShownFor] = useState(text)
  // (new words: start again — set during render, so the first frame of new words already hides them)
  if (shownFor !== text) {
    setShownFor(text)
    setTyped(typedCount(0, crt.lettersPerSecond, text.length, reduceMotion()))
  }
  const started = useRef({ text, at: 0 })
  useEffect(() => {
    started.current = { text, at: looksClock.now() }
    let frame = 0
    const step = () => {
      const n = typedCount(looksClock.now() - started.current.at, crt.lettersPerSecond, text.length, reduceMotion())
      setTyped(n)
      if (n < text.length) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [text])
  return Math.min(typed, text.length)
}

/** The monitor's look as CSS variables (content/tuning/crt.json), re-read when the Dev Kit edits the file. */
export function useCrtLook(): CSSProperties {
  const [, redraw] = useReducer((n: number) => n + 1, 0)
  useEffect(() => onTuning('crt', redraw), [])
  return {
    '--crt-ink': crt.textColor,
    '--crt-glow': crt.glowColor,
    '--crt-glow-size': crt.glowSize,
    '--crt-glow-strength': `${Math.round(Math.max(0, Math.min(1, crt.glowStrength)) * 100)}%`,
    '--crt-cursor-w': crt.cursorWidth,
    '--crt-blink': `${Math.max(0, crt.cursorBlinkSeconds)}s`,
    '--crt-scan-gap': Math.max(1, crt.scanGap),
    '--crt-scan-line': Math.max(0, Math.min(1, crt.scanLine)),
    '--crt-scan-strength': `${Math.round(Math.max(0, Math.min(1, crt.scanStrength)) * 100)}%`,
    '--crt-wobble': crt.wobble,
    '--crt-wobble-time': `${Math.max(0.5, crt.wobbleSeconds)}s`,
  } as CSSProperties
}
