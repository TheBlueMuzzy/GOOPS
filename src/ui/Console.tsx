// THE CONSOLE — the game's main menu (F21), drawn from Muzzy's mock-up (art/Example1.svg) with the kit's ArtStage.
// Pull the periscope down (drag it, tap it, or ↓ / Enter) → the console dims and slides away to show the tank (the App
// starts the shift under it). Coming back after shifts it slides up again and the Operator Rank meter fills with the
// XP earned since it last showed, with a rank-up moment at the rank bar (the rank number pops).
// MID-SHIFT (F23/F24): swipe up in a shift → this same console slides over the tank while the shift runs on slowly;
// a broken machine's repair panel comes alive (RepairPanels.tsx), the gear opens the pause menu, and pulling the
// periscope goes back to the same shift. On a phone on its side only the panels show, with a Back to the tank button.
// Off the shift (and for working machines) the panels are drawn switched off. Words come from content/text/en.json.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { useCrtLesson, useSpotlitTags } from '../game/lessons/lessonLine'
import { storyFile, storyMoments, storyWords, type MonitorLook } from '../game/lessons/storyMoments'
import { ArtLayer, ArtStage, Badge, Button, LevelMeter, PullHandle, Row, Screen, Stack, TextInput, TitleArt, fill, screens } from './kit'
import { cleanName, loadOperatorName, nameMaxLength, saveOperatorName } from '../progress/save'
import type { FewerRepairSteps, MachineId } from '../engine'
import { meterSteps, rankInfo, type BadgeTitle, type Progress } from '../progress/progression'
import { ending as endingSteps, type EndingStepId } from '../game/ending'
import endingTuning from '../../content/tuning/ending.json'
import galaxy from '../../content/tuning/galaxy-look.json'
import { ControlsPanel, LaserPanel, LessonTag, VisorPanel } from './RepairPanels'
import { ValvePanel } from './ValvePanel'
import { playUiSound } from '../game/sound'
import { SOUNDS } from '../game/shiftSounds'
import { art } from './art'
import { useShort } from './useShort'
import { CrtLook, TypedText } from '../game/CrtLook'
import { clockPause, looksClock, onClockPause } from '../devkit/gameClock'
import text from '../../content/text/en.json'
import { versionLabel } from '../version'
import { RankSelectButton } from './RankSelect'

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
  midShift?: { machines: ConsoleMachines; breaks: Record<MachineId, number>; onRepair(machine: MachineId): void; fewerRepairSteps?: FewerRepairSteps
    // F64 the final shift: a release-valve stage waiting at the console (stage 0 = the first) — the hatch is open and
    // the valve panel up; onOpen = the needle was held in the green
    valve?: { stage: number; stages: number; onOpen(): void } }
  // F59: the Upgrades button (between shifts only): the scraps in hand, and whether upgrading is unlocked yet (before
  // its rank the button is greyed out, showing the scraps saved so far); onOpen opens the Upgrades screen.
  upgrades?: { scraps: number; open: boolean; opensAt: number; onOpen(): void }
  // F70: RANK SELECT on the bottom row, between the version and the credit (the App says when: a Dev Kit build, between
  // shifts, no lesson or story moment on the console)
  rankSelect?: boolean
  // F65 THE ENDING at the console (src/game/ending.ts): the step playing, and the title the badge had before the win (the
  // goop crosses it out). While it plays the console is bare — no Upgrades, no gear, the periscope still, the monitor
  // blank — but for the badge step, when the monitor shows the badge being rewritten
  ending?: { step: EndingStepId; oldTitle: BadgeTitle }
  // F65 the new career: careers this device finished — from art.json console.career fromCareers the console and its
  // periscope are gold-trimmed (a look only)
  careers?: number
}

const t = text.console
const a = art.console
const format = (n: number) => n.toLocaleString('en')
const MACHINES: MachineId[] = ['laser', 'visor', 'controls']
const NOTHING: string[] = []


// THE MONITOR'S SCREEN (F32, Muzzy 2026-10-19: "use the CRT panel at the top of the console as our tutorial bubbles. it
// just toasters down if it needs more room"): its words (the hint), or a lesson's line with its Got it. Words that
// need more room than the screen has make it slide down past the bezel, in the screen's colours (art.json console.crt).
// sign (F66): the line is "PLEASE SIGN HERE" — the name box + Sign + Skip instead of Got it (both move on: onGotIt)
// onTyped (F45): the line has typed out (a cut Management line moves on by itself then: storyMoments.cutAfterTyped)
type CrtLine = { text: string; gotIt: boolean; sign?: boolean; onGotIt(): void; onTyped?(): () => void }

// F66 YOUR NAME (story.md "Your name", TDD D20): rank 0's "PLEASE SIGN HERE" on the monitor — the kit's TextInput (at
// most content/tuning/name.json maxLength letters) with Sign and Skip. Sign keeps the name in the save (trimmed; empty =
// a skip); Skip keeps nothing — you stay Operator #4471. A replay (Settings → Replay lessons) starts from the name kept.
// Enter in the box signs (a form); the game's keys leave a text box alone (input/controls.ts typingIn, the periscope's
// ↓ / Enter above). It sits at the top of the screen, so a phone's keyboard opening below never covers it.
function SignHere({ onDone }: { onDone(): void }) {
  const s = text.story.sign
  const [typed, setTyped] = useState(() => loadOperatorName() ?? '')
  const sign = (e: FormEvent) => {
    e.preventDefault()
    if (cleanName(typed)) saveOperatorName(typed)
    onDone()
  }
  return (
    <form className="crt-sign" onSubmit={sign}>
      <Stack gap="s">
        <TextInput label={s.label} value={typed} maxLength={nameMaxLength()} onChange={(e) => setTyped(e.target.value)}
          autoComplete="off" autoCapitalize="words" spellCheck={false} enterKeyHint="done" data-tag="name" />
        <Row gap="s" justify="center">
          <Button type="submit">{s.sign}</Button>
          <Button variant="secondary" onClick={onDone}>{s.skip}</Button>
        </Row>
      </Stack>
    </form>
  )
}
// F65 THE BADGE (the ending, story.md step 5): on the monitor, after its glitch (looks.glitch*, rank 45's not-a-face), the goop
// crosses out your title (a line drawn through it, console.strikeAfterSeconds + strikeSeconds — content/tuning/ending.json)
// and writes The Savior of Goopkind under it in its own colour (galaxy-look.json rim), then the real acronym types out —
// GRADUAL ONBOARDING OF PERMANENT STAFF. Got it moves on once it's all written.
function EndingBadge({ oldTitle }: { oldTitle: BadgeTitle }) {
  const B = text.ending.badge, C = endingTuning.console
  const [phase, setPhase] = useState(0) // 0 your title · 1 crossed out · 2 the new title typing · 3 the acronym typing · 4 done
  useEffect(() => {
    const strike = looksClock.after(C.strikeAfterSeconds * 1000, () => setPhase(1))
    const write = looksClock.after((C.strikeAfterSeconds + C.strikeSeconds) * 1000, () => setPhase(2))
    return () => { strike(); write() }
  }, [C.strikeAfterSeconds, C.strikeSeconds])
  const name = loadOperatorName()
  return (
    <Stack gap="s" className="crt-badge" data-tag="badge"
      style={{ '--badge-goop': galaxy.rim, '--badge-strike': `${C.strikeSeconds}s` } as CSSProperties}>
      <span className="crt-badge-label">{B.label}</span>
      <span>{name ? fill(B.operator, { name }) : B.noName}</span>
      <span className="crt-badge-old" data-struck={phase >= 1 || undefined} data-tag="badge-old">{text.story.titles[oldTitle]}</span>
      {phase >= 2 && <span className="crt-badge-new" data-tag="badge-new"><TypedText text={text.story.titles.savior} onTyped={() => setPhase((p) => Math.max(p, 3))} /></span>}
      {phase >= 3 && <span className="crt-badge-acronym" data-tag="badge-acronym"><TypedText text={B.acronym} onTyped={() => setPhase(4)} /></span>}
      {phase >= 4 && <Button onClick={endingSteps.next}>{B.next}</Button>}
    </Stack>
  )
}

// drop: how much lower than the mock-up the monitor hangs (F35, art.json monitorDrop) — the screen moves with it
// look (F40): a story line's monitor look — 'flicker' (it heard that) or 'alarm' (red flashes: the Veteran's capture at
// 30); its numbers are content/story/moments.json looks, the CSS is lessons.css
// badge (F65): the monitor shows this instead of a line (the ending's badge)
function Crt({ hint, lesson, drop, look, badge }: { hint: string; lesson: CrtLine | null; drop: number; look?: MonitorLook; badge?: ReactNode }) {
  const c = a.crt, [x, artY, w, h] = a.words.hint.at, y = artY + drop
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
      const height = Math.max((c.screenBottom - c.screenTop) * unit, (artY - c.screenTop) * unit + need)
      const grown = (artY - c.screenTop) * unit + need > (c.screenBottom - c.screenTop) * unit + 0.5
      setFit((old) => (old && Math.abs(old.height - height) < 0.5 && old.grown === grown && Math.abs(old.unit - unit) < 0.001 ? old : { height, grown, unit }))
    }
    const ro = new ResizeObserver(measure)
    ro.observe(inner); ro.observe(layer)
    measure()
    return () => ro.disconnect()
  }, [c.screenBottom, c.screenTop, artY, w])
  const height = fit ? fit.height + 'px' : undefined, unit = fit ? fit.unit + 'px' : undefined
  // F32 (Muzzy: "make it look like old DOS") → F60: the CRT look, one wrapper (src/game/CrtLook.tsx): green glowing
  // words over scan lines, typed out letter by letter with a block cursor where the next letter goes. The preset is
  // the one content/tuning/crt.json use.monitor names (dos; a dropdown in the Dev Kit). The whole text is laid out
  // from the first frame — the letters not typed yet are there, unseen — so the screen never changes size.
  // (a broken machine's hint used to be in the accent colour: every word on the monitor is phosphor green now)
  const words = lesson ? lesson.text : hint
  const looks = storyFile.looks
  return (
    <ArtLayer at={[x, y, w, h]} text={a.words.hint.text}>
      <CrtLook place="monitor" unit={unit} ref={box} className="crt" data-tag="crt" data-grown={fit?.grown || undefined} data-story-look={look}
        style={{ '--story-flicker': `${looks.flickerSeconds}s`, '--story-alarm': `${looks.alarmSeconds}s`, '--story-alarm-colour': looks.alarmColour,
          '--story-glitch': `${looks.glitchSeconds}s`, '--story-glitch-after': `${looks.glitchAfterSeconds}s`, '--story-glitch-colour': looks.glitchColour, '--story-glitch-art': `url("${a.crt.glitch}")`, ...(look === 'alarm' && { '--crt-ink': looks.alarmWords, '--crt-glow': looks.alarmWords }), '--crt-inset': x - c.screenLeft, '--crt-top': artY - c.screenTop, '--crt-room': h, '--crt-w': c.screenWidth, '--crt-screen': c.screen, '--crt-bezel': c.bezel,
          '--crt-bezel-w': c.bezelWidth, '--crt-radius': c.radius, '--crt-h': height, '--u': unit } as CSSProperties}>
        <div ref={body} className="crt-body">
          {badge ?? <>
            <TypedText text={words} className="lesson-words" onTyped={lesson?.onTyped} />
            {lesson?.gotIt && <Button onClick={lesson.onGotIt}>{text.lessons.gotIt}</Button>}
            {lesson?.sign && <SignHere onDone={lesson.onGotIt} />}
          </>}
        </div>
        {/* F45 (45, Management slips): for a beat the screen shows something that isn't a face (art.json crt.glitch) */}
        {look === 'glitch' && <span className="crt-glitch" aria-hidden />}
      </CrtLook>
    </ArtLayer>
  )
}

// F45 THE HATCH under the panels (ranks 46, 47: the release valve is named): from art.json hatch.fromRank it's on the
// console's front; while a story line says rattle it rattles (lessons.css, numbers moments.json looks.rattle*) — the
// key restarts it for each line. Looks clock: the Dev Kit's full pause holds it.
// F64 (the final shift): while a valve stage waits it's OPEN (art.json console.valve.openFile) and a button that shuts
// and opens the valve panel over the repair panels (shut it to repair a machine, tap it again for the valve).
function Hatch({ rattle, dim, valve }: { rattle: string | null; dim: boolean; valve?: { up: boolean; onToggle(): void } }) {
  const [paused, setPaused] = useState(() => clockPause() === 'full')
  useEffect(() => onClockPause((mode) => setPaused(mode === 'full')), [])
  const looks = storyFile.looks
  if (valve) return (
    <ArtLayer at={a.hatch.at} dim={dim}>
      <Button art={{ up: a.valve.hatchOpen, down: a.valve.hatchOpen, label: 'hidden', size: 'fill' }} onClick={valve.onToggle}
        data-tag="hatch" aria-pressed={valve.up}>{valve.up ? t.valve.hatchClose : t.valve.hatchOpen}</Button>
    </ArtLayer>
  )
  return (
    <ArtLayer at={a.hatch.at} dim={dim}>
      <div key={rattle ?? 'still'} className="console-hatch" data-tag="hatch" data-knobs="hatch" data-rattle={rattle ? '' : undefined}
        data-paused={paused || undefined}
        style={{ '--rattle': `${looks.rattleSeconds}s`, '--rattle-times': looks.rattleTimes, '--rattle-shake': looks.rattleShake } as CSSProperties}>
        <img src={a.hatch.src} alt="" draggable={false} />
      </div>
    </ArtLayer>
  )
}

// F59: the console's Upgrades button, over the GOOPS title — the scraps count on it; grey (and asleep) until upgrading
// unlocks, then it opens the Upgrades screen. data-tag: the unlock lesson outlines it (content/lessons/unlock-upgrades.json).
function UpgradesButton({ scraps, open, opensAt, onOpen }: NonNullable<Props['upgrades']>) {
  const n = format(Math.max(0, scraps))
  return (
    <Button variant="secondary" compact disabled={!open} onClick={onOpen} data-tag="upgrades" data-placement="top"
      aria-label={open ? fill(t.upgradesOpen, { n }) : fill(t.upgradesLocked, { n, rank: opensAt })}>
      {t.upgrades} <Badge variant={open ? 'primary' : 'neutral'}>{n}</Badge>
    </Button>
  )
}

export function Console({ progress, shownFrom, phase, onPull, onSlideEnd, onSettings, midShift, upgrades, rankSelect, ending, careers = 0 }: Props) {
  const now = rankInfo(progress)
  // (only the XP moves the meter: buying an upgrade changes the progress but must not replay the fill — F34)
  const totalXp = progress.totalXp
  const steps = useMemo(() => (shownFrom ? meterSteps(shownFrom, { totalXp, scrapsSpent: 0 }) : []), [shownFrom, totalXp])
  const short = useShort()
  const leaving = phase === 'leaving'
  const broken = MACHINES.filter((id) => midShift?.machines[id].broken)
  // the monitor always says what to do (Muzzy); XP + rank-ups are on the report and the rank bar
  const valve = midShift?.valve
  const hint = ending ? '' : !midShift ? t.hint : broken.length ? fill(t.hintRepair, { name: t.machineNames[broken[0]] })
    : valve ? fill(t.hintValve, { n: valve.stage + 1 }) : t.hintBack
  // F64: the valve panel is up while a stage waits, unless the player shut the hatch (to repair) — each stage opens it again
  const [shutAt, setShutAt] = useState<number | null>(null)
  const valveUp = !!valve && shutAt !== valve.stage
  const live = (id: MachineId) => !!midShift?.machines[id].broken && !leaving
  const repair = (id: MachineId) => () => midShift?.onRepair(id)
  const key = (id: MachineId) => `${id}-${midShift?.breaks[id] ?? 0}`
  const fewer = (id: MachineId) => midShift?.fewerRepairSteps?.[id] ?? 0
  // F32: a lesson's line goes on the monitor's screen; a panel a lesson shows off ("Fixed!") looks lit, not switched off
  const lessonLine = useCrtLesson()
  // F35: a story moment's Management line types on the monitor too (the Veteran's lines are his bubble: StoryView.tsx)
  const story = useSyncExternalStore(storyMoments.subscribe, storyMoments.view)
  // (F66: the sign line has the name box's Sign / Skip instead of Got it)
  // (F45: a cut Management line — 45's slip, "HUMAN RESOURCE." — has no Got it: once typed it corrects itself)
  const storyLine = story?.line.voice === 'mon' ? { text: storyWords(story.line.words), gotIt: !story.line.sign && !story.line.cut, sign: story.line.sign,
    onGotIt: storyMoments.next, onTyped: story.line.cut ? storyMoments.cutAfterTyped : undefined }
    // (while the Veteran talks, the monitor's "pull down the periscope" would be wrong — the periscope waits: blank)
    : story ? { text: '', gotIt: false, onGotIt: storyMoments.next } : null
  const spotlit = useSpotlitTags()
  // F35: between shifts the monitor hangs lower (more room for its words) — not while a lesson shows the periscope, and
  // not mid-shift, where the periscope is the way back to the tank (it would hide the top of its grip)
  const drop = midShift || spotlit.includes('periscope') ? 0 : a.monitorDrop
  const showcase = (id: MachineId) => !!midShift && spotlit.includes(`panel-${id}`)
  // (and while a lesson step outlines a part, only that part answers — the other controls shake: RepairPanels.tsx)
  const outlined = midShift ? spotlit : NOTHING
  // F31 (tutorial.md A1, "Press ↓ or Enter to pull the periscope"): between shifts ↓ or Enter pulls it from anywhere,
  // not only once its grip has the keyboard's focus — the grip is clicked, so it slides down and clunks as a tap does.
  // (Not over Settings or Upgrades, not on a held key's repeats, never in a text box / slider / select, and Enter on a focused button stays that button's.)
  const idle = !midShift && phase === 'idle'
  useEffect(() => {
    if (!idle) return
    const key = (e: KeyboardEvent) => {
      if (e.repeat || screens.current.length || (e.code !== 'ArrowDown' && e.code !== 'Enter' && e.code !== 'NumpadEnter')) return
      const target = e.target as HTMLElement | null
      if (target?.closest?.(e.code === 'ArrowDown' ? 'input, select, textarea' : 'button, input, select, textarea')) return // (a Dev Kit slider / field keeps its ↓)
      const grip = document.querySelector<HTMLButtonElement>('.kit-pull-grip:not(:disabled)')
      if (!grip) return
      e.preventDefault()
      grip.click()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [idle])

  // F65 the gold trim: on the parts art.json career.layers names, once a career is done (not in the ending itself)
  const G = a.career, gold = careers >= G.fromCareers && !ending
  const trim = (part: string) => (gold && G.layers.includes(part) ? 'career-gold' : undefined)
  // (its colour and sizes on the page root, like the HUD's sizes — the kit's art stage takes no style of its own)
  useEffect(() => {
    const root = document.documentElement.style
    root.setProperty('--kit-career-gold', G.colour)
    root.setProperty('--kit-career-trim', `${G.trimRem}rem`)
    root.setProperty('--kit-career-glow', `${G.glowRem}rem`)
  }, [G.colour, G.trimRem, G.glowRem])
  return (
    <Screen label={t.label} column backdrop={a.backdrop}
      slide={phase === 'idle' ? undefined : phase === 'leaving' ? 'out' : 'in'} slideEdge="bottom" onSlideEnd={onSlideEnd}
      // (F59: between shifts the Upgrades button sits over the title — the corners beside it are too narrow on a phone)
      bottom={upgrades ? <Stack gap="s"><UpgradesButton {...upgrades} /><TitleArt src={a.title} alt={t.title} size="s" /></Stack>
        : <TitleArt src={a.title} alt={t.title} size="s" />}
      bottomLeft={midShift && short ? <Button variant="secondary" onClick={onPull} disabled={phase !== 'idle'}>{t.backToTank}</Button> : undefined}
      bottomRight={ending ? undefined : <Button art={a.settings} onClick={onSettings}>{t.settings}</Button>}>
      <ArtStage size={a.size} view={a.view} viewShort={midShift ? art.repairs.viewShort : a.viewShort} label={t.label} bleed align="end"
        className={gold ? 'career-gold-console' : undefined}>
        <ArtLayer {...a.body} dim={leaving} className={trim('body')} />
        <ArtLayer {...a.meter} dim={leaving} className={trim('meter')} />
        <ArtLayer at={a.meter.at} text={a.meterText} dim={leaving}>
          <LevelMeter level={now.rank} xp={now.xpIntoRank} xpToNext={now.xpToNext} format={format}
            words={{ label: t.rank, unit: t.xp, max: t.maxRank }} art={a.meterFill}
            steps={steps.length ? steps : undefined} play={phase === 'idle'} />
        </ArtLayer>
        <LaserPanel key={key('laser')} live={live('laser')} onRepair={repair('laser')} fewerSteps={fewer('laser')} showcase={showcase('laser')} outlined={outlined} />
        <ControlsPanel key={key('controls')} live={live('controls')} onRepair={repair('controls')} fewerSteps={fewer('controls')} showcase={showcase('controls')} outlined={outlined} />
        <VisorPanel key={key('visor')} live={live('visor')} onRepair={repair('visor')} fewerSteps={fewer('visor')} showcase={showcase('visor')} outlined={outlined} />
        {valveUp && <ValvePanel key={valve.stage} stage={valve.stage} stages={valve.stages} live={!leaving} onOpen={valve.onOpen} />}
        {(now.rank >= a.hatch.fromRank || valve) && <Hatch dim={leaving} rattle={story?.line.rattle ? `${story.rank}:${story.line.words}` : null}
          valve={valve && { up: valveUp, onToggle: () => setShutAt(valveUp ? valve.stage : null) }} />}
        <ArtLayer data-version-spot="main-menu" {...a.words.version} tone="muted" align="start" dim={leaving}>{versionLabel}</ArtLayer>
        {rankSelect && <ArtLayer {...a.words.rankSelect} align="center" dim={leaving}><RankSelectButton /></ArtLayer>}
        <ArtLayer {...(rankSelect ? a.words.creditBeside : a.words.credit)} tone="muted" align="end" dim={leaving}>{rankSelect ? t.creditShort : t.credit}</ArtLayer>
        {/* (with RANK SELECT — Dev Kit builds only — the short credit: on a phone the words can't shrink below 10 px,
            and the whole credit leaves the row no room inside the console's dark strip) */}
        <ArtLayer at={a.periscope.at} className={trim('periscope')}>
          <PullHandle label={midShift ? t.backToTank : t.periscope} travel={a.periscope.travel} grip={a.periscope.grip} pulled={leaving}
            onPull={() => { playUiSound(SOUNDS.periscope); onPull() } /* the clunk as it reaches the end */}
            disabled={phase === 'arriving' || (!!midShift && short) /* a phone on its side: Back to the tank does it (the periscope is mostly off screen) */
              || (!midShift && !!story) /* F35: a story moment is short and not skippable — the shift waits for it */
              || !!ending /* F65: the ending — there's no next shift for this operator */}>
            <img src={a.periscope.src} alt="" draggable={false} />
          </PullHandle>
        </ArtLayer>
        <ArtLayer {...a.monitor} at={[a.monitor.at[0], a.monitor.at[1] + drop, a.monitor.at[2], a.monitor.at[3]]} className={trim('monitor')}><LessonTag tag="monitor" /></ArtLayer>
        <Crt hint={hint} lesson={ending ? null : storyLine ?? lessonLine} drop={drop} look={ending?.step === 'badge' ? 'glitch' : story?.line.monitor}
          badge={ending?.step === 'badge' ? <EndingBadge oldTitle={ending.oldTitle} /> : undefined} />{/* (F59: between shifts too — the Upgrades unlock lesson) */}
      </ArtStage>
    </Screen>
  )
}
