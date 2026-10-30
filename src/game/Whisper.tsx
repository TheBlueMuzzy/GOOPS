// F35: IN-SHIFT WHISPERS (design/story.md "Story moments": 3 "…cold…" — one whisper you'll doubt, once per device ·
// 8+ one feeling a shift). The goop's first words: a plain kit TalkingBubble (no speech wave, no tap) pointing into the
// tank somewhere along the goop's height, gone again by itself. Its times are rules time (rulesClock), so the pause
// menu and the Dev Kit's pauses hold it. Never while a lesson is up. Numbers: content/story/moments.json whispers;
// words: en.json story.whispers. Scripted checks keep it quiet unless the page has ?story (storyMoments.ts).
// F40: the words grow with the rank (feelings → single words at 15 → names at 24: whisperFor's stages), and from rank 12
// Management answers each one — "THERE ARE NO VOICES IN THE TANK…" — a moment after it goes, through onMonitor (App
// shows it where the in-shift messages show: the monitor itself is up out of sight while you're in the tank).
import { useEffect, useRef, useState } from 'react'
import { TalkingBubble, tipsMemory } from '../ui/kit'
import { rulesClock } from '../devkit/gameClock'
import type { ShiftEngine } from '../engine'
import { lessonTankBox, runner } from './lessons/goopsLessons'
import { COLD_SEEN, monitorDeniesVoices, quietForChecks, storyFile, storyWords, whisperFor } from './lessons/storyMoments'
import talk from '../../content/tuning/talk.json'
import text from '../../content/text/en.json'

export function Whisper({ engine, onMonitor }: { engine: ShiftEngine; onMonitor?(words: string, seconds: number): void }) {
  const monitor = useRef(onMonitor)
  useEffect(() => { monitor.current = onMonitor })
  const [shown, setShown] = useState<{ key: string; x: number; y: number } | null>(null)
  useEffect(() => {
    if (quietForChecks()) return
    const w = storyFile.whispers
    const key = whisperFor(engine.state.rank, tipsMemory().seen(COLD_SEEN), Math.random())
    if (!key) return
    const [lo, hi] = w.afterSeconds
    // (dev / tests: ?whisperAt=2 = after 2 s, like ?rank and ?seed)
    const forced = import.meta.env.DEV ? new URLSearchParams(location.search).get('whisperAt') : null
    const after = forced !== null ? Number(forced) : lo + Math.random() * (hi - lo)
    let hide = () => {}, deny = () => {}
    const cancel = rulesClock.after(after * 1000, () => {
      const tank = lessonTankBox()
      if (!tank || engine.state.status !== 'playing' || runner.view().lessonId) return // (a lesson is talking: not now)
      if (key === 'cold') tipsMemory().markSeen(COLD_SEEN)
      setShown({ key, x: tank.left + (0.25 + Math.random() * 0.5) * (tank.right - tank.left), y: tank.bottom - w.heightInTank * (tank.bottom - tank.top) })
      hide = rulesClock.after(w.showSeconds * 1000, () => {
        setShown(null)
        if (!monitorDeniesVoices(engine.state.rank)) return
        deny = rulesClock.after(w.noVoicesDelaySeconds * 1000, () => {
          if (engine.state.status === 'playing') monitor.current?.(storyWords('noVoices'), w.noVoicesSeconds)
        })
      })
    })
    return () => { cancel(); hide(); deny() }
  }, [engine])
  if (!shown) return null
  return <TalkingBubble key={shown.key} target={{ x: shown.x, y: shown.y }} outline="plain" placement="top" feel={talk}
    text={(text.story.whispers as Record<string, string>)[shown.key] ?? ''} />
}
