// THE CONSOLE — the game's main menu (F21), drawn from Muzzy's mock-up (art/Example1.svg) with the kit's ArtStage.
// Pull the periscope down (drag it, tap it, or ↓ / Enter) → the console dims and slides away to show the tank (the App
// starts the shift under it). Coming back after shifts it slides up again and the Operator Rank meter fills with the
// XP earned since it last showed, with a rank-up moment at the rank bar (the rank number pops).
// MID-SHIFT (F23/F24): swipe up in a shift → this same console slides over the tank while the shift runs on slowly;
// a broken machine's repair panel comes alive (RepairPanels.tsx), the gear opens the pause menu, and pulling the
// periscope goes back to the same shift. On a phone on its side only the panels show, with a Back to the tank button.
// Off the shift (and for working machines) the panels are drawn switched off. Words come from content/text/en.json.
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useCrtLesson, useSpotlitTags } from '../game/lessons/lessonLine'
import { ArtLayer, ArtStage, Button, LevelMeter, PullHandle, Screen, TitleArt, fill } from './kit'
import type { FewerRepairSteps, MachineId } from '../engine'
import { meterSteps, rankInfo, type Progress } from '../progress/progression'
import { ControlsPanel, LaserPanel, LessonTag, VisorPanel } from './RepairPanels'
import { playUiSound } from '../game/sound'
import { SOUNDS } from '../game/shiftSounds'
import { art } from './art'
import { useShort } from './useShort'
import text from '../../content/text/en.json'

export type ConsolePhase = 'idle' | 'leaving' | 'arriving'
export type ConsoleMachines = Record<MachineId, { broken: boolean }>

type Props = {
  progress: Progress // now
  shownFrom: Progress | null // what the meter showed last time — it fills from there (null: nothing to show)
  phase: ConsolePhase
  onPull(): void // periscope pulled all the way
  onSlideEnd(): void // finished sliding away / back in
  onSettings(): void // the gear (mid-shift: the pause menu)
  // mid-shift only: the machines now, how many times each has broken (a new puzzle each time), and a repair solved.
  // fewerRepairSteps: upgrades that shorten the repairs (resolveUpgrades; none yet, so left out = 0)
  midShift?: { machines: ConsoleMachines; breaks: Record<MachineId, number>; onRepair(machine: MachineId): void; fewerRepairSteps?: FewerRepairSteps }
}

const t = text.console
const a = art.console
const format = (n: number) => n.toLocaleString('en')
const MACHINES: MachineId[] = ['laser', 'visor', 'controls']


// THE MONITOR'S SCREEN (F32, Muzzy 2026-10-19: "use the CRT panel at the top of the console as our tutorial bubbles. it
// just toasters down if it needs more room"): its words (the hint), or a lesson's line with its Got it. Words that
// need more room than the screen has make it slide down past the bezel, in the screen's colours (art.json console.crt).
type CrtLine = { text: string; gotIt: boolean; onGotIt(): void }
function Crt({ hint, accent, lesson }: { hint: string; accent: boolean; lesson: CrtLine | null }) {
  const c = a.crt, [x, y, w, h] = a.words.hint.at
  const box = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState<{ height: number; grown: boolean; unit: number } | null>(null)
  // measure: the words' own height vs the words box and the screen's bottom edge (px, from the layer's px per unit)
  useLayoutEffect(() => {
    const el = box.current, inner = body.current, layer = el?.parentElement
    if (!el || !inner || !layer) return
    // the screen is drawn from its top edge; the words start at the words box (y) and need `need` px; the screen ends
    // where the art's does unless the words need more — then it's longer (grown: the toaster)
    const measure = () => {
      const unit = layer.clientWidth / w, need = Math.max(layer.clientHeight, inner.offsetHeight)
      const height = Math.max((c.screenBottom - c.screenTop) * unit, (y - c.screenTop) * unit + need)
      const grown = (y - c.screenTop) * unit + need > (c.screenBottom - c.screenTop) * unit + 0.5
      setFit((old) => (old && Math.abs(old.height - height) < 0.5 && old.grown === grown && Math.abs(old.unit - unit) < 0.001 ? old : { height, grown, unit }))
    }
    const ro = new ResizeObserver(measure)
    ro.observe(inner); ro.observe(layer)
    measure()
    return () => ro.disconnect()
  }, [c.screenBottom, c.screenTop, y, w])
  const height = fit ? fit.height + 'px' : undefined, unit = fit ? fit.unit + 'px' : undefined
  return (
    <ArtLayer at={[x, y, w, h]} text={a.words.hint.text} tone={!lesson && accent ? 'accent' : undefined}>
      <div ref={box} className="crt" data-tag="crt" data-grown={fit?.grown || undefined}
        style={{ '--crt-inset': x - c.screenLeft, '--crt-top': y - c.screenTop, '--crt-room': h, '--crt-w': c.screenWidth, '--crt-screen': c.screen, '--crt-bezel': c.bezel,
          '--crt-bezel-w': c.bezelWidth, '--crt-radius': c.radius, '--crt-h': height, '--u': unit } as CSSProperties}>
        <div ref={body} className="crt-body">
          <span className="lesson-words">{lesson ? lesson.text : hint}</span>
          {lesson?.gotIt && <Button onClick={lesson.onGotIt}>{text.lessons.gotIt}</Button>}
        </div>
      </div>
    </ArtLayer>
  )
}

export function Console({ progress, shownFrom, phase, onPull, onSlideEnd, onSettings, midShift }: Props) {
  const now = rankInfo(progress)
  const steps = useMemo(() => (shownFrom ? meterSteps(shownFrom, progress) : []), [shownFrom, progress])
  const short = useShort()
  const leaving = phase === 'leaving'
  const broken = MACHINES.filter((id) => midShift?.machines[id].broken)
  // the monitor always says what to do (Muzzy); XP + rank-ups are on the report and the rank bar
  const hint = !midShift ? t.hint : broken.length ? fill(t.hintRepair, { name: t.machineNames[broken[0]] }) : t.hintBack
  const live = (id: MachineId) => !!midShift?.machines[id].broken && !leaving
  const repair = (id: MachineId) => () => midShift?.onRepair(id)
  const key = (id: MachineId) => `${id}-${midShift?.breaks[id] ?? 0}`
  const fewer = (id: MachineId) => midShift?.fewerRepairSteps?.[id] ?? 0
  // F32: a lesson's line goes on the monitor's screen; a panel a lesson shows off ("Fixed!") looks lit, not switched off
  const lessonLine = useCrtLesson()
  const spotlit = useSpotlitTags()
  const showcase = (id: MachineId) => !!midShift && spotlit.includes(`panel-${id}`)

  return (
    <Screen label={t.label} column backdrop={a.backdrop}
      slide={phase === 'idle' ? undefined : phase === 'leaving' ? 'out' : 'in'} slideEdge="bottom" onSlideEnd={onSlideEnd}
      bottom={<TitleArt src={a.title} alt={t.title} size="s" />}
      bottomLeft={midShift && short ? <Button variant="secondary" onClick={onPull} disabled={phase !== 'idle'}>{t.backToTank}</Button> : undefined}
      bottomRight={<Button art={a.settings} onClick={onSettings}>{t.settings}</Button>}>
      <ArtStage size={a.size} view={a.view} viewShort={midShift ? art.repairs.viewShort : a.viewShort} label={t.label} bleed align="end">
        <ArtLayer {...a.body} dim={leaving} />
        <ArtLayer {...a.meter} dim={leaving} />
        <ArtLayer at={a.meter.at} text={a.meterText} dim={leaving}>
          <LevelMeter level={now.rank} xp={now.xpIntoRank} xpToNext={now.xpToNext} format={format}
            words={{ label: t.rank, unit: t.xp, max: t.maxRank }} art={a.meterFill}
            steps={steps.length ? steps : undefined} play={phase === 'idle'} />
        </ArtLayer>
        <LaserPanel key={key('laser')} live={live('laser')} onRepair={repair('laser')} fewerSteps={fewer('laser')} showcase={showcase('laser')} />
        <ControlsPanel key={key('controls')} live={live('controls')} onRepair={repair('controls')} fewerSteps={fewer('controls')} showcase={showcase('controls')} />
        <VisorPanel key={key('visor')} live={live('visor')} onRepair={repair('visor')} fewerSteps={fewer('visor')} showcase={showcase('visor')} />
        <ArtLayer {...a.words.version} tone="muted" align="start" dim={leaving}>{fill(t.version, { v: import.meta.env.GOOPS_VERSION })}</ArtLayer>
        <ArtLayer {...a.words.credit} tone="muted" align="end" dim={leaving}>{t.credit}</ArtLayer>
        <ArtLayer at={a.periscope.at}>
          <PullHandle label={midShift ? t.backToTank : t.periscope} travel={a.periscope.travel} grip={a.periscope.grip} pulled={leaving}
            onPull={() => { playUiSound(SOUNDS.periscope); onPull() } /* the clunk as it reaches the end */}
            disabled={phase === 'arriving' || (!!midShift && short) /* a phone on its side: Back to the tank does it (the periscope is mostly off screen) */}>
            <img src={a.periscope.src} alt="" draggable={false} />
          </PullHandle>
        </ArtLayer>
        <ArtLayer {...a.monitor}><LessonTag tag="monitor" /></ArtLayer>
        <Crt hint={hint} accent={broken.length > 0} lesson={midShift ? lessonLine : null} />
      </ArtStage>
    </Screen>
  )
}
