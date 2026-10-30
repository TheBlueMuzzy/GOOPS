// F35: THE STORY MOMENT'S LOOK at the console (storyMoments.ts says which line is up).
//   Management ("mon") — its line types on the monitor (Console.tsx's Crt, with its Got it), like a lesson's line.
//   The Veteran ("spk") — the kit's TalkingBubble (UI kit 0.31.0) pointing at the monitor area, his spiky speech wave
//     with Muzzy's S9 feel (content/tuning/talk.json, live). Muzzy, 2026-10-24: "his messages show up in the same area
//     where the company's messages show up, but his in his cool speechbubble. and it can be 'interrupted' by
//     disappearing and the company talks through the monitor at the top" — a mon line after his just takes over.
//   A moment's `look` (the attention call): the lesson outline round that console part, no dim (Spotlight.tsx).
//   F40 line looks: crackle = his bubble squelches more often while it waits (the same squelch, sooner — talk.json's
//     squelchEvery swapped for moments.json looks.crackleEvery) · cut = he's cut off: once his line has typed out, the
//     moment moves on by itself after looks.cutSeconds (looks clock: the Dev Kit's full pause holds it; a tap still
//     works) — at 30 that's Management cutting in. (The monitor's own looks, flicker / alarm: Console.tsx's Crt.)
// F45: the goop through the speaker ("goop", 41 / 43 / 48) — his bubble's place, the goop's look (below).
// Enter moves a Management line on (the bubble takes its own tap / Enter / Space) — not the sign line (F66): there
// Enter signs the name box (Console.tsx).
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { TalkingBubble } from '../../ui/kit'
import { boxAround, gameColumn } from './goopsLessons'
import { Spotlight } from './Spotlight'
import { storyFile, storyMoments, storyWords } from './storyMoments'
import talk from '../../../content/tuning/talk.json'
import text from '../../../content/text/en.json'

export function StoryView() {
  const view = useSyncExternalStore(storyMoments.subscribe, storyMoments.view)
  const mon = view?.line.voice === 'mon' && !view.line.sign
  useEffect(() => {
    if (!mon) return
    const key = (e: KeyboardEvent) => { if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); storyMoments.next() } }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [mon, view])
  // (a cut line's timer: cancelled when the line goes another way first — a tap, the console leaving)
  const cutTimer = useRef<() => void>(() => {})
  useEffect(() => () => cutTimer.current(), [view])
  if (!view) return null
  const look = view.look
  const line = view.line
  const looks = storyFile.looks
  const cutOff = () => {
    cutTimer.current()
    cutTimer.current = storyMoments.cutAfterTyped()
  }
  return (
    <>
      {look && <Spotlight key={`look:${view.rank}`} layout={() => {
        const el = document.querySelector<HTMLElement>(`[data-tag="${look}"]`)
        const focus = el ? boxAround([el]) : null
        return { focus, holes: focus ? [focus] : [], frame: gameColumn() }
      }} dim={false} />}
      {line.voice === 'spk' && (
        <TalkingBubble key={`${view.rank}:${line.words}`} target='[data-tag="crt"]' placement="bottom" outline="wave"
          text={storyWords(line.words)} speaker={text.story.veteran} colours={talk.colours} onConfirm={storyMoments.next}
          feel={line.crackle ? { ...talk, squelchEvery: looks.crackleEvery } : talk} onTyped={line.cut ? cutOff : undefined} />
      )}
      {/* F63 the goop in your head (31–39): the in-shift whisper's bubble (Whisper.tsx — plain outline, no speech wave,
          the style's own colours) over the same monitor area; a tap moves on (Muzzy 2026-10-25) */}
      {line.voice === 'head' && (
        <TalkingBubble key={`${view.rank}:${line.words}`} target='[data-tag="crt"]' placement="bottom" outline="plain"
          text={storyWords(line.words)} speaker={line.him ? text.story.goopVeteran : text.story.goop} onConfirm={storyMoments.next}
          feel={talk} />
      )}
      {/* F45 the goop through the speaker (41, 43, 48): his bubble's place over the monitor, but the goop's look — the
          head bubble's colours (the style's, not his light ones) with the speaker's speech wave (looks.goopOutline:
          'plain' = the in-your-head outline); screen readers name the goop */}
      {line.voice === 'goop' && (
        <TalkingBubble key={`${view.rank}:${line.words}`} target='[data-tag="crt"]' placement="bottom" outline={looks.goopOutline === 'plain' ? 'plain' : 'wave'}
          text={storyWords(line.words)} speaker={text.story.goop} onConfirm={storyMoments.next}
          feel={line.crackle ? { ...talk, squelchEvery: looks.crackleEvery } : talk} onTyped={line.cut ? cutOff : undefined} />
      )}
    </>
  )
}
