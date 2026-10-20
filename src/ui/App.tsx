// The game's screens. A working day (F21): the game opens on the console (Muzzy's art) → pull the periscope down → the
// console slides away to the tank and the shift starts → the end report → swipe up (or "Back to the console") → the
// console slides back up and its rank meter fills with the XP. "Next shift" on the report starts the next one straight away.
// Mid-shift (F23/F24): swipe up / W / ↑ → the same console slides over the tank while the shift runs on at
// consoleTimeScale (content/tuning/breakdowns.json); broken machines are repaired on its panels; its gear opens the pause
// menu (which fully pauses; End shift = the run is thrown away, no XP); pulling the periscope goes back to the shift.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Bar, GameOver, Hud, HudText, kitScreens, Modal, Pause, Row, Score, ScreenStack, Settings, Stack, Text, ToastStack, Victory, screens, tipsMemory, toast, toasts, useScreens, useTips } from './kit'
import type { SettingsSchema } from './kit'
import { createShift, type MachineId, type ShiftEngine, type ShiftStatus } from '../engine'
import { restoreShift, type ShiftSnapshot } from '../engine/snapshot'
import { session } from '../game/session'
import { looksClock, rulesClock } from '../devkit/gameClock'
import { ShiftStage, type HudSnapshot } from '../game/ShiftStage'
import { readoutSetting } from '../game/readoutSetting'
import type { Message } from '../game/messages'
import { lessonFromUrl, lessonNow, lessonPlay, runner as lessonRunner } from '../game/lessons/goopsLessons'
import { LessonView } from '../game/lessons/LessonView'
import { firstBreakdowns } from '../game/lessons/firstBreakdowns'
import { unlockLessons } from '../game/lessons/unlockLessons'
import { FIRST_DAY, firstDay } from '../game/lessons/firstDay'
import { gooStyle } from '../game/gooStyle'
import { wallKick } from '../game/wallKick'
import { soundSettingsChanged } from '../game/sound'
import { getAudio, useAudioSnapshot } from '../audio'
import { isUnlocked, rankInfo, rewardFirstDay, rewardShift, scrapsAt, unlockRank, unlocksBetween, type Progress, type ShiftReward } from '../progress/progression'
import { loadProgress, saveProgress } from '../progress/save'
import { NextWindow } from '../game/NextWindow'
import { Console } from './Console'
import { art } from './art'
import { useShort } from './useShort'
import { usePortraitLock, useSideways } from './portrait'
import { UprightScreen } from './Upright'
import shiftConfig from '../../content/tuning/shift.json'
import breakdowns from '../../content/tuning/breakdowns.json'
import hudTuning from '../../content/tuning/hud.json'
import settingsJson from '../../content/ui/settings.json'
import text from '../../content/text/en.json'

const settings = settingsJson as SettingsSchema
// the machines' bars in the bottom panel, left to right (Muzzy's second mock-up, 2026-10-19: VISOR · LASER · CONTROLS —
// the order they unlock in, so a new one joins at the right)
const MACHINES: MachineId[] = ['visor', 'laser', 'controls']
const fill = (s: string, vars: Record<string, number | string>) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))

// The rank the player plays at: their saved rank. Dev/tests: ?rank=12 forces one. The shift (colours, starting junk,
// crack quota) and everything a rank unlocks (F59: isUnlocked — the next-piece window, swap, the Upgrades button) use it.
function playerRank(progress: Progress): number {
  return forcedRank() ?? rankInfo(progress).rank
}
const forcedRank = () => {
  const forced = import.meta.env.DEV ? new URLSearchParams(location.search).get('rank') : null
  return forced !== null ? Number(forced) : null
}
// F31: should "your first day" play? (a fresh save, or after Replay lessons — never under a forced ?rank=N ≥ 1)
const dayDue = (progress: Progress) => firstDay.due(playerRank(progress), forcedRank() !== null)

// ?seed=123 fixes the shift's random pieces (tests); otherwise every shift is new.
// training = a lesson's shift (F30, src/engine/training.ts): empty, held still, the lesson sets it up step by step.
// Swap works only from its rank, and never in a lesson's shift (F59).
function newEngine(progress: Progress, training = false): ShiftEngine {
  const seed = Number(new URLSearchParams(location.search).get('seed')) || Math.floor(Math.random() * 1e9)
  const rank = playerRank(progress)
  return createShift(shiftConfig, { seed, rank, wallKick: wallKick.get(), breakdowns, swap: !training && isUnlocked('swap', rank),
    ...(training ? { training: {} } : {}) })
}
type LessonStart = { id: string; step: number | string }

// (Replay lessons, F32: the device forgets which lessons it has seen — each machine's plays again at its next break;
// F31: and the first day plays again from the start at the next pull of the periscope, whatever the rank)
const onSettingsAction = (id: string) => {
  if (id !== 'replayLessons') return
  firstDay.replay()
  tipsMemory().resetTips()
  const shown = toast(text.lessons.replayed, { seconds: ONE_DAY_S })
  looksClock.after(3000, () => toasts.dismiss(shown))
}
const SettingsScreen = () => (
  <Settings schema={settings} onAction={onSettingsAction} onChange={(values) => {
    gooStyle.setFromSetting(values.gooStyle); wallKick.setFromSetting(values.wallKick); readoutSetting.setFromSettings(values)
    soundSettingsChanged(values)
  }} />
)
// in-shift messages (F26, src/game/messages.ts decides which): kit toasts just above the goop. How long one stays is
// LOOKS time (src/devkit/gameClock.ts): the Dev Kit's full pause holds it on screen, so the frozen picture stays whole.
const ONE_DAY_S = 86_400 // (the kit's own timer, never reached: the looks clock takes it away)
const onMessage = (m: Message) => {
  if (lessonPlay.messageUp()) return // a lesson message is up: the game's own messages keep quiet (F30)
  const id = toast(text.messages[m.key], { variant: m.danger ? 'danger' : 'neutral', seconds: ONE_DAY_S })
  looksClock.after(m.seconds * 1000, () => toasts.dismiss(id))
}

// The end report's XP line: what the shift earned; a rank-up if it crossed one, naming what the new rank unlocked (F59:
// the progression unlocks and the machines, in the order they come)
function rankUpLine(r: ShiftReward): string {
  const xp = r.xp.toLocaleString('en')
  if (r.rankUps <= 0) return fill(text.end.xpValue, { xp })
  const from = r.before.rank, to = r.after.rank
  const gained: [number, string][] = [
    ...unlocksBetween(from, to).map((u): [number, string] => [unlockRank(u), text.unlocks[u]]),
    ...MACHINES.filter((id) => breakdowns[id].unlockRank > from && breakdowns[id].unlockRank <= to).map((id): [number, string] => [breakdowns[id].unlockRank, text.unlocks[id]]),
  ]
  gained.sort((a, b) => a[0] - b[0])
  return gained.length ? fill(text.end.xpRankUpNew, { xp, rank: to, what: gained.map(([, name]) => name).join(', ') })
    : fill(text.end.xpRankUp, { xp, rank: to })
}

// console = on the console · leaving = sliding away to the tank · shift = in the tank (report included) · arriving = sliding back
// peekIn / peek / peekOut = mid-shift: the console sliding over the running tank / on it / sliding away back to the shift
type Mode = 'console' | 'leaving' | 'shift' | 'arriving' | 'peekIn' | 'peek' | 'peekOut'
const PEEK: Mode[] = ['peekIn', 'peek', 'peekOut']

export function App() {
  const [mode, setMode] = useState<Mode>('console')
  const [engine, setEngine] = useState<ShiftEngine | null>(null)
  const [hud, setHud] = useState<HudSnapshot | null>(null)
  const [result, setResult] = useState<{ status: ShiftStatus; score: number; sealed: number; needed: number; cause: 'integrity' | 'overflow'; reward: ShiftReward } | null>(null)
  const open = useScreens()
  const short = useShort()
  // portrait only (F32, Muzzy): locked upright where the browser allows it; a touch phone held sideways gets the
  // "Turn your phone upright" card and the shift pauses under it (src/ui/portrait.ts)
  const sideways = useSideways()
  usePortraitLock()
  const engineRef = useRef<ShiftEngine | null>(null)
  const [saved] = useState(loadProgress)
  const [progress, setProgress] = useState(saved) // for the console; progressRef for the handlers
  const progressRef = useRef<Progress>(saved)
  // the console's meter: the progress it showed when it was last on screen, so coming back it fills from there
  const meterShown = useRef<Progress>(saved)
  const [meterFrom, setMeterFrom] = useState<Progress | null>(null)
  const modeRef = useRef(mode)
  useEffect(() => { modeRef.current = mode }, [mode])

  // F30 lessons: the lesson to start once the tank is on screen (a training shift is made for it); ?lesson=<id>&step=<n>
  // (dev) makes the first "Start shift" play that lesson
  const pendingLesson = useRef<LessonStart | null>(null)
  const urlLesson = useRef<LessonStart | null>(lessonFromUrl())
  const freshShift = useRef(false) // F59: a real shift just started — its unlock lesson (if any) plays once the tank shows
  const start = useCallback((lesson?: LessonStart) => {
    lessonPlay.stop()
    const e = lesson ? lessonPlay.attach(newEngine(progressRef.current, true)) : newEngine(progressRef.current)
    // a real shift: its machines' first breakdowns may start their lessons (F32)
    if (!lesson) { lessonPlay.watch(e); firstBreakdowns.newShift() }
    pendingLesson.current = lesson ?? null
    freshShift.current = !lesson
    engineRef.current = e
    setResult(null); setHud(null); setEngine(e)
  }, [])
  // the periscope is down: the shift is made (paused) under the console, which slides away to show it
  // (F31: while the first day is due, its shift — at the phase it got to; the console's own step, A1, is done)
  const leaveConsole = useCallback(() => {
    const lesson = urlLesson.current ?? (dayDue(progressRef.current) ? { id: FIRST_DAY, step: firstDay.startStep() } : null)
    urlLesson.current = null
    start(lesson ?? undefined); setMeterFrom(null); setMode('leaving')
  }, [start])
  // the tank is on screen: a lesson waiting for it starts now — or, at the start of a real shift, what this rank
  // unlocked that the device hasn't been shown yet (F59, one per shift start: unlockLessons.ts)
  useEffect(() => {
    const lesson = pendingLesson.current
    if (mode === 'shift' && engine && lesson) { pendingLesson.current = null; lessonPlay.start(lesson.id, lesson.step) }
    else if (mode === 'shift' && engine && freshShift.current) { freshShift.current = false; unlockLessons.shiftStarted(engine.state.rank) }
  }, [mode, engine])
  // back to the console (swipe up / "Back to the console" / End shift): it slides up over the tank, the meter fills
  const toConsole = useCallback(() => {
    while (screens.current.length) screens.pop()
    toasts.current.forEach((t) => toasts.dismiss(t.id))
    setMeterFrom(meterShown.current)
    meterShown.current = progressRef.current
    lessonPlay.stop() // (a lesson ends with its shift)
    setMode('arriving')
  }, [])
  // The report closed some other way (Esc, phone Back) after the shift ended: that means "back to the console" too,
  // never a frozen, finished tank
  // (a shift that ended while its player was at the console mid-shift: the console slides away, then the report opens)
  const endPending = useRef(false)
  useEffect(() => {
    if (mode === 'shift' && endPending.current) { endPending.current = false; screens.push('end') }
  }, [mode])
  // the Dev Kit's Lessons tab / window.__goops.lesson (F30): a lesson from any step, straight to the tank
  const startLessonNow = useCallback((id: string, step: number | string = 1) => {
    if (!lessonNow(id)) return false
    while (screens.current.length) screens.pop()
    toasts.current.forEach((t) => toasts.dismiss(t.id))
    endPending.current = false
    start({ id, step }); setMeterFrom(null); setMode('shift')
    return true
  }, [start])
  useEffect(() => { session.startLesson = startLessonNow; return () => { session.startLesson = null } }, [startLessonNow])
  useEffect(() => {
    if (mode === 'shift' && result && !screens.current.includes('end')) toConsole()
  }, [mode, result, open, toConsole])
  // (the last shift's engine stays in state on the console, unmounted; the next pull replaces it)
  const consoleSlid = useCallback(() => setMode((m) => (m === 'leaving' || m === 'peekOut' ? 'shift' : m === 'arriving' ? 'console' : m === 'peekIn' ? 'peek' : m)), [])
  // mid-shift: to the console and back (swipe up / W / ↑ in the shift; the periscope or Back to the tank on the console)
  // (F31: not while a lesson step leaves the console out of its controls — day one, before free play)
  const peekIn = useCallback(() => { if (modeRef.current === 'shift' && !screens.current.length && lessonPlay.consoleOn()) setMode('peekIn') }, [])
  const peekOut = useCallback(() => setMode((m) => (m === 'peek' ? 'peekOut' : m)), [])
  // End shift from the console mid-shift: the run is thrown away (no XP) and the console stays
  const endAtConsole = useCallback(() => {
    while (screens.current.length) screens.pop()
    toasts.current.forEach((t) => toasts.dismiss(t.id))
    lessonPlay.stop()
    setMode('console')
  }, [])
  const repair = useCallback((machine: MachineId) => engineRef.current?.act({ type: 'repair', machine }), [])
  // The Dev Kit's Snapshots (src/devkit-game/goopsAdapter.ts): a saved moment → a new engine carrying on from it, on
  // the tank straight away (menus closed); null → back to the console. Junk throws (restoreShift says why).
  const restoreSnapshot = useCallback((snapshot: ShiftSnapshot | null) => {
    lessonPlay.stop() // (a snapshot puts back the shift, not a lesson's place in it)
    // (a snapshot saved before F59 has no swap option: give it the one its rank has, not "on")
    const o = snapshot?.options
    if (o && o.swap === undefined) o.swap = !o.training && isUnlocked('swap', o.rank)
    const e = snapshot && restoreShift(shiftConfig, snapshot, breakdowns)
    if (e) { lessonPlay.watch(e); firstBreakdowns.newShift() }
    while (screens.current.length) screens.pop()
    toasts.current.forEach((t) => toasts.dismiss(t.id))
    endPending.current = false
    setMeterFrom(null)
    if (!e) { setMode('console'); return }
    engineRef.current = e
    setResult(null); setHud(null); setEngine(e); setMode('shift')
  }, [])
  useEffect(() => { session.restore = restoreSnapshot; return () => { session.restore = null } }, [restoreSnapshot])
  useEffect(() => { session.engine = engine; session.inShift = !!engine && mode !== 'console' }, [engine, mode])
  // at the console mid-shift the machines' break-progress pauses (Muzzy, 2026-10-18; src/engine/machines.ts)
  useEffect(() => { engine?.act({ type: 'console', on: PEEK.includes(mode) }) }, [engine, mode])
  const onEnd = useCallback((status: ShiftStatus) => {
    const e = engineRef.current
    if (!e) return
    // the final score (after the leftover penalty) becomes XP — saved right away
    // (F31: the first day's shift tops it up to rank 1 when it started at rank 0 — the report says the rank-up)
    const reward = (firstDay.running() ? rewardFirstDay : rewardShift)(progressRef.current, e.state.score)
    progressRef.current = reward.progress
    setProgress(reward.progress)
    saveProgress(reward.progress)
    setResult({ status, score: e.state.score, sealed: e.state.cracksSealed, needed: e.state.cracksNeeded,
      cause: e.state.ruptureReason ?? 'integrity', reward })
    toasts.current.forEach((t) => toasts.dismiss(t.id)) // a rupture alert must not sit on the report
    if (modeRef.current === 'shift') screens.push('end')
    else { // at the console mid-shift: back to the tank first, then the report
      endPending.current = true
      while (screens.current.length) screens.pop()
      setMode((m) => (m === 'peekIn' || m === 'peek' ? 'peekOut' : m))
    }
  }, [])

  const screenMap = useMemo(() => ({
    ...kitScreens, // (Pause's End shift asks first)
    settings: SettingsScreen,
    pause: () => (
      <Pause words={text.pause} onSettings={() => screens.push('settings')} onQuit={toConsole} />
    ),
    end: () => {
      if (!result) return null
      const stats = [{ label: text.end.score, value: String(result.score) }, { label: text.end.cracks, value: `${result.sealed} / ${result.needed}` },
        // what the shift earned, and a rank-up if it crossed one
        // (F59: and what that rank unlocked)
        { label: text.end.xp, value: rankUpLine(result.reward) }]
      // (F31: a lesson hears the report close — the first day's last step is "back to the console")
      const again = () => { lessonPlay.screen('reportClosed'); screens.pop(); start() }
      const back = () => { lessonPlay.screen('reportClosed'); toConsole() }
      return result.status === 'won'
        ? <Victory words={{ title: text.end.wonTitle, continue: text.end.again, quit: text.end.quit, swipe: text.end.swipe }}
            message={result.cause === 'overflow' ? text.end.wonOverflow : text.end.wonCracks}
            frame={art.end.frame} art={{ continue: art.end.again, quit: art.end.quit }} stats={stats}
            onContinue={again} onQuit={back} onSwipeUp={back} />
        : <GameOver words={{ title: text.end.lostTitle, retry: text.end.again, quit: text.end.quit, swipe: text.end.swipe }}
            message={result.cause === 'overflow' ? text.end.lostOverflow : text.end.lostCracks}
            frame={art.end.frame} art={{ retry: art.end.again, quit: art.end.quit }} stats={stats}
            onRetry={again} onQuit={back} onSwipeUp={back} />
    },
  }), [result, start, toConsole])

  // the console between shifts: Settings, and the Upgrades screen (F59, from its rank: the scraps in hand — alpha has no
  // upgrades to buy yet, so it says when they come)
  const rank = playerRank(progress)
  const scraps = Math.max(0, scrapsAt(rank, progress))
  const idleScreens = useMemo(() => ({
    ...kitScreens, // (Settings' buttons ask first: Replay lessons)
    settings: SettingsScreen,
    upgrades: () => (
      <Modal title={text.upgrades.title} onBack={() => screens.pop()} backLabel={text.upgrades.back}>
        <Text kind="heading">{fill(text.upgrades.scraps, { n: scraps.toLocaleString('en') })}</Text>
        <Text>{text.upgrades.soon}</Text>
      </Modal>
    ),
  }), [scraps])
  const openUpgrades = useCallback(() => { screens.push('upgrades'); lessonPlay.screen('upgradesOpened') }, [])
  // F59: on the console between shifts at upgrading's rank, its unlock lesson (once per device: unlockLessons.ts)
  // F31: while the first day is due, its first step instead (pull the periscope) — again after Replay lessons (tips).
  // Between shifts the rules clock runs (no shift uses it then; a console lesson's hint does).
  const tips = useTips()
  useEffect(() => {
    if (mode !== 'console') return
    rulesClock.scale = 1
    if (dayDue(progress)) firstDay.atConsole()
    else unlockLessons.atConsole(rank)
  }, [mode, rank, progress, tips])

  // the console mid-shift: Settings and the pause menu (End shift throws the run away)
  const consoleScreens = useMemo(() => ({
    ...kitScreens,
    settings: SettingsScreen,
    pause: () => <Pause words={text.pause} onSettings={() => screens.push('settings')} onQuit={endAtConsole} />,
  }), [endAtConsole])

  const peeking = PEEK.includes(mode)
  // F32 lessons hear what the player does on screen: the console opening mid-shift (W / ↑ / flick up — the first few
  // visits outside a lesson get a one-line note), back in the tank, the pause menu opening and closing
  const lastMode = useRef(mode)
  useEffect(() => {
    const was = lastMode.current
    lastMode.current = mode
    if (mode === 'peekIn' && was === 'shift') { lessonPlay.screen('consoleOpened'); firstBreakdowns.consoleVisited(short) }
    if (mode === 'shift' && was === 'peekOut') lessonPlay.screen('consoleClosed')
  }, [mode, short])
  const pauseOpen = open.includes('pause')
  const lastPause = useRef(pauseOpen)
  useEffect(() => {
    if (pauseOpen !== lastPause.current) lessonPlay.screen(pauseOpen ? 'pauseOpened' : 'pauseClosed')
    lastPause.current = pauseOpen
  }, [pauseOpen])
  // (re-drawn when a lesson changes: it may freeze the tank at the console)
  useSyncExternalStore(lessonRunner.subscribe, lessonRunner.view)
  // at the console mid-shift the tank runs on under it, a little quieter (content/audio.json snapshots.console)
  useAudioSnapshot(getAudio(), peeking ? 'console' : null)
  // how fast the shift runs: full in the tank, slowed at the console mid-shift, stopped under any menu or a slide.
  // A first-breakdown lesson freezes the tank at the console instead (F32): the rules clock runs at full speed for the
  // lesson's own timers and the lesson holds the tank still (lessonPlay.speed)
  // (a phone held sideways: paused under the "Turn your phone upright" card, the game's own pause)
  // (F31: the end report isn't a menu that pauses: the shift has ended, so the rules clock running changes nothing in
  // the tank — but a lesson on the report, day one's "back to the console", keeps its own timers)
  const menuOpen = open.some((id) => id !== 'end')
  const speed = menuOpen || sideways ? 0 : mode === 'shift' ? 1 : peeking ? (lessonPlay.consoleFrozen() ? 1 : breakdowns.consoleTimeScale) : 0
  // The HUD (F26, Muzzy's mock-up 2026-10-18; F59 his second, 2026-10-19): ONE top row — score · CRACKS x / y (big,
  // shrinking to fit) · Console button — then the tank, then ONE panel under it: at its left the next-piece window (from
  // its rank; tall, big cells), and to its right the unlocked machines' bars in a row with big names above (centred),
  // over one long integrity bar with its name inside. A short window: the panel is a column beside the tank, headed by
  // the crack count, the window beside the stacked bars; the score and the Console button sit in the top corners beside
  // the tank.
  // Every bar reads the same way: full = good (laser charge, controls' room before overheating, visor signal,
  // tank integrity); below bars.lowAt it turns red and pulses, a broken machine flashes (content/tuning/hud.json).
  // The pressure readout hangs on the pressure line (ShiftStage); messages show just above the goop.
  // (Which bars the panel holds, and the window, are known when the shift starts — they unlock between shifts — so its
  // height never changes mid-shift.)
  const unlocked = engine ? MACHINES.filter((id) => engine.state.machines?.[id].unlocked) : []
  const low = hudTuning.bars.lowAt
  const machineBars = hud && unlocked.map((id) => {
    const m = hud.machines[id], alert = m.broken ? 'flash' : m.health < low ? 'pulse' : undefined
    return <Bar key={id} plain label={text.hud[id]} labelAt="above" width={short ? 1 : hudTuning.bars.machineWidth} thickness="m"
      value={Math.round(m.health * 100)} variant={alert ? 'danger' : 'primary'} alert={alert} />
  })
  const quotaMet = hud && hud.cracksSealed >= hud.cracksNeeded
  const ruptured = hud?.phase === 'rupture'
  const statusText = !hud ? '' : ruptured ? text.hud.rupture
    : quotaMet ? fill(text.hud.cracksDone, { n: hud.cracksSealed, total: hud.cracksNeeded })
    : fill(text.hud.cracks, { n: hud.cracksSealed, total: hud.cracksNeeded })
  const integrityAlert = ruptured ? 'flash' : hud && hud.integrity < low ? 'pulse' : undefined
  const integrityBar = hud && <Bar plain label={text.hud.integrity} labelAt="inside" width={short ? 1 : hudTuning.bars.integrityWidth} thickness="l"
    value={Math.round(hud.integrity * 100)} variant={integrityAlert ? 'danger' : 'primary'} alert={integrityAlert} />
  const status = <HudText size="l" fit tone={ruptured || quotaMet ? 'accent' : 'normal'}>{statusText}</HudText>
  // F59: the next-piece window, from its rank (known when the shift starts, like the machines)
  const showNext = !!engine && isUnlocked('nextPiece', engine.state.rank)
  const nextWindow = hud && showNext ? <NextWindow piece={hud.next} label={text.hud.next} /> : undefined
  // The panel: the window at the left, the bars to its right — the machines in a row (each at most bars.machineWidth of
  // that room, never narrower than its name; app.css) over the integrity bar. (A short window: the crack count heads the
  // panel column, the machine bars stack beside the window, and the tank takes the whole height.)
  const bars = short ? <>{machineBars}{integrityBar}</>
    : <>{unlocked.length > 0 && <Row gap="s" justify="center" className="hud-machines">{machineBars}</Row>}{integrityBar}</>
  const panelRow = <Row gap="s" className="hud-panel">{nextWindow}<Stack gap="s" className="hud-panel-bars">{bars}</Stack></Row>
  const panel = hud && (short ? <Stack gap="s">{status}{panelRow}</Stack> : panelRow)
  const readout = hud && <HudText size="s" live numbers>{fill(text.hud.pressureReadout, { n: Math.round(hud.pressure * 100) })}</HudText>
  return (
    <>
      {engine && mode !== 'console' && (
        <ShiftStage engine={engine} speed={speed} inputOn={mode === 'shift' && !open.length && !sideways}
          panel={unlocked.length ? 'machines' : 'integrity'} side={short} nextWindow={showNext && !short}
          readout={readout}
          onHud={setHud} onEnd={onEnd} onMessage={onMessage} onConsole={peekIn} />
      )}
      {mode === 'shift' && (
        <ScreenStack overlay screens={screenMap}>
          {hud && (
            <Hud words={{ pause: text.hud.pause }} onPause={() => { if (lessonPlay.pauseOn()) screens.push('pause') }} oneRow
              vitals={<Score value={hud.score} compact />} status={short ? undefined : status}
              banner={hud.holdProgress !== null ? <Bar label={text.hud.swap} value={Math.round(hud.holdProgress * 100)} variant="accent" width="s" /> : undefined}
              dock={panel} dockSide={short ? 'right' : 'bottom'} />
          )}
        </ScreenStack>
      )}
      {mode !== 'shift' && (
        <ScreenStack screens={peeking ? consoleScreens : idleScreens}>
          <Console progress={progress} shownFrom={peeking ? null : meterFrom} onSlideEnd={consoleSlid}
            phase={mode === 'console' || mode === 'peek' ? 'idle' : mode === 'leaving' || mode === 'peekOut' ? 'leaving' : 'arriving'}
            onPull={peeking ? peekOut : leaveConsole} onSettings={() => screens.push(peeking ? 'pause' : 'settings')}
            midShift={peeking && hud ? { machines: hud.machines, breaks: hud.breaks, onRepair: repair } : undefined}
            upgrades={peeking ? undefined : { scraps, open: isUnlocked('upgrades', rank), opensAt: unlockRank('upgrades'), onOpen: openUpgrades }} />
        </ScreenStack>
      )}
      <ToastStack place="at" variant="plain" /* just above the goop; words, not button-like plates (Muzzy 2026-10-18) */ />
      {/* F30: a lesson's message — in the tank a bubble in the kit Callout look; at the console mid-shift (F32) its words
          are on the monitor and this draws the spotlight; over a menu only a step's reaction ("That's the pause menu…") */}
      {/* (F59: and on the console between shifts — the Upgrades unlock lesson outlines its button there) */}
      {/* (F31: and over the end report — day one's last step points at its "Back to the console") */}
      {(mode === 'shift' || peeking || mode === 'console') && <LessonView overMenu={menuOpen} atConsole={mode !== 'shift'} />}
      {sideways && <UprightScreen />}
    </>
  )
}
