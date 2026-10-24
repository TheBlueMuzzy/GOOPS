// F35: THE STORY MOMENT'S LOOK at the console (storyMoments.ts says which line is up).
//   Management ("mon") — its line types on the monitor (Console.tsx's Crt, with its Got it), like a lesson's line.
//   The Veteran ("spk") — the kit's TalkingBubble (UI kit 0.31.0) pointing at the monitor area, his spiky speech wave
//     with Muzzy's S9 feel (content/tuning/talk.json, live). Muzzy, 2026-10-24: "his messages show up in the same area
//     where the company's messages show up, but his in his cool speechbubble. and it can be 'interrupted' by
//     disappearing and the company talks through the monitor at the top" — a mon line after his just takes over.
//   A moment's `look` (the attention call): the lesson outline round that console part, no dim (Spotlight.tsx).
// Enter moves a Management line on (the bubble takes its own tap / Enter / Space).
import { useEffect, useSyncExternalStore } from 'react'
import { TalkingBubble } from '../../ui/kit'
import { boxAround, gameColumn } from './goopsLessons'
import { Spotlight } from './Spotlight'
import { storyMoments, storyWords } from './storyMoments'
import talk from '../../../content/tuning/talk.json'
import text from '../../../content/text/en.json'

export function StoryView() {
  const view = useSyncExternalStore(storyMoments.subscribe, storyMoments.view)
  const mon = view?.line.voice === 'mon'
  useEffect(() => {
    if (!mon) return
    const key = (e: KeyboardEvent) => { if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); storyMoments.next() } }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [mon, view])
  if (!view) return null
  const look = view.look
  return (
    <>
      {look && <Spotlight key={`look:${view.rank}`} layout={() => {
        const el = document.querySelector<HTMLElement>(`[data-tag="${look}"]`)
        const focus = el ? boxAround([el]) : null
        return { focus, holes: focus ? [focus] : [], frame: gameColumn() }
      }} dim={false} />}
      {view.line.voice === 'spk' && (
        <TalkingBubble key={`${view.rank}:${view.line.words}`} target='[data-tag="crt"]' placement="bottom" outline="wave"
          text={storyWords(view.line.words)} speaker={text.story.veteran} feel={talk} colours={talk.colours} onConfirm={storyMoments.next} />
      )}
    </>
  )
}
