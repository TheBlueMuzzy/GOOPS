// THE CONSOLE — the game's main menu (F21), drawn from Muzzy's mock-up (art/Example1.svg) with the kit's ArtStage.
// Pull the periscope down (drag it, tap it, or ↓ / Enter) → the console dims and slides away to show the tank (the App
// starts the shift under it). Coming back after shifts it slides up again and the Operator Rank meter fills with the
// XP earned since it last showed, with a rank-up moment at the rank bar (the rank number pops).
// The repair panels are drawn switched off: breakdowns (F06) come later. Words come from content/text/en.json.
import { useMemo } from 'react'
import { ArtLayer, ArtStage, Button, LevelMeter, PullHandle, Screen, TitleArt, fill } from './kit'
import { meterSteps, rankInfo, type Progress } from '../progress/progression'
import { art } from './art'
import text from '../../content/text/en.json'

export type ConsolePhase = 'idle' | 'leaving' | 'arriving'

type Props = {
  progress: Progress // now
  shownFrom: Progress | null // what the meter showed last time — it fills from there (null: nothing to show)
  phase: ConsolePhase
  onPull(): void // periscope pulled all the way
  onSlideEnd(): void // finished sliding away / back in
  onSettings(): void
}

const t = text.console
const a = art.console
const format = (n: number) => n.toLocaleString('en')

export function Console({ progress, shownFrom, phase, onPull, onSlideEnd, onSettings }: Props) {
  const now = rankInfo(progress)
  const steps = useMemo(() => (shownFrom ? meterSteps(shownFrom, progress) : []), [shownFrom, progress])
  const hint = t.hint // the monitor always says what to do (Muzzy); XP + rank-ups are on the report and the rank bar
  const leaving = phase === 'leaving'
  const off = (name: string) => fill(t.unavailable, { name })

  return (
    <Screen label={t.label} column backdrop={a.backdrop}
      slide={phase === 'idle' ? undefined : phase === 'leaving' ? 'out' : 'in'} slideEdge="bottom" onSlideEnd={onSlideEnd}
      bottom={<TitleArt src={a.title} alt={t.title} size="s" />}
      bottomRight={<Button art={a.settings} onClick={onSettings}>{t.settings}</Button>}>
      <ArtStage size={a.size} view={a.view} viewShort={a.viewShort} label={t.label} bleed align="end">
        <ArtLayer {...a.body} dim={leaving} />
        <ArtLayer {...a.meter} dim={leaving} />
        <ArtLayer at={a.meter.at} text={a.meterText} dim={leaving}>
          <LevelMeter level={now.rank} xp={now.xpIntoRank} xpToNext={now.xpToNext} format={format}
            words={{ label: t.rank, unit: t.xp, max: t.maxRank }} art={a.meterFill}
            steps={steps.length ? steps : undefined} play={phase === 'idle'} />
        </ArtLayer>
        <ArtLayer {...a.laser} off label={off(t.laser)} />
        <ArtLayer {...a.controls} off label={off(t.controls)} />
        <ArtLayer {...a.lights} off label={off(t.lights)} />
        <ArtLayer {...a.words.laser} tone="primary" off>{t.laser}</ArtLayer>
        <ArtLayer {...a.words.controls} tone="primary" off>{t.controls}</ArtLayer>
        <ArtLayer {...a.words.lights} tone="primary" off>{t.lights}</ArtLayer>
        <ArtLayer {...a.words.version} tone="muted" align="start" dim={leaving}>{fill(t.version, { v: import.meta.env.GOOPS_VERSION })}</ArtLayer>
        <ArtLayer {...a.words.credit} tone="muted" align="end" dim={leaving}>{t.credit}</ArtLayer>
        <ArtLayer at={a.periscope.at}>
          <PullHandle label={t.periscope} travel={a.periscope.travel} grip={a.periscope.grip} pulled={leaving} onPull={onPull} disabled={phase === 'arriving'}>
            <img src={a.periscope.src} alt="" draggable={false} />
          </PullHandle>
        </ArtLayer>
        <ArtLayer {...a.monitor} />
        <ArtLayer {...a.words.hint}>{hint}</ArtLayer>
      </ArtStage>
    </Screen>
  )
}
