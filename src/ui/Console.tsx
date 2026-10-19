// THE CONSOLE — the game's main menu (F21), drawn from Muzzy's mock-up (art/Example1.svg) with the kit's ArtStage.
// Pull the periscope down (drag it, tap it, or ↓ / Enter) → the console dims and slides away to show the tank (the App
// starts the shift under it). Coming back after shifts it slides up again and the Operator Rank meter fills with the
// XP earned since it last showed, with a rank-up moment at the rank bar (the rank number pops).
// MID-SHIFT (F23/F24): swipe up in a shift → this same console slides over the tank while the shift runs on slowly;
// a broken machine's repair panel comes alive (RepairPanels.tsx), the gear opens the pause menu, and pulling the
// periscope goes back to the same shift. On a phone on its side only the panels show, with a Back to the tank button.
// Off the shift (and for working machines) the panels are drawn switched off. Words come from content/text/en.json.
import { useMemo } from 'react'
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
        <LaserPanel key={key('laser')} live={live('laser')} onRepair={repair('laser')} fewerSteps={fewer('laser')} />
        <ControlsPanel key={key('controls')} live={live('controls')} onRepair={repair('controls')} fewerSteps={fewer('controls')} />
        <VisorPanel key={key('visor')} live={live('visor')} onRepair={repair('visor')} fewerSteps={fewer('visor')} />
        <ArtLayer {...a.words.version} tone="muted" align="start" dim={leaving}>{fill(t.version, { v: import.meta.env.GOOPS_VERSION })}</ArtLayer>
        <ArtLayer {...a.words.credit} tone="muted" align="end" dim={leaving}>{t.credit}</ArtLayer>
        <ArtLayer at={a.periscope.at}>
          <PullHandle label={midShift ? t.backToTank : t.periscope} travel={a.periscope.travel} grip={a.periscope.grip} pulled={leaving}
            onPull={() => { playUiSound(SOUNDS.periscope); onPull() } /* the clunk as it reaches the end */}
            disabled={phase === 'arriving' || (!!midShift && short) /* a phone on its side: Back to the tank does it (the periscope is mostly off screen) */}>
            <img src={a.periscope.src} alt="" draggable={false} />
          </PullHandle>
        </ArtLayer>
        <ArtLayer {...a.monitor} />
        {/* (a lesson pointing at the monitor points at its words, and its message goes to their side, clear of the
            periscope under them — the kit flips it where there's no room) */}
        <ArtLayer {...a.words.hint} tone={broken.length ? 'accent' : undefined}><LessonTag tag="monitor" placement="left" />{hint}</ArtLayer>
      </ArtStage>
    </Screen>
  )
}
