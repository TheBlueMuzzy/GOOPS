// The game's screens. A working day (F21): the game opens on the console (Muzzy's art) → pull the periscope down → the
// console slides away to the tank and the shift starts → the end report → swipe up (or "Back to the console") → the
// console slides back up and its rank meter fills with the XP. "Next shift" on the report starts the next one straight away.
// Mid-shift (F23/F24): swipe up / W / ↑ → the same console slides over the tank while the shift runs on at
// consoleTimeScale (content/tuning/breakdowns.json); broken machines are repaired on its panels; its gear opens the pause
// menu (which fully pauses; End shift = the run is thrown away, no XP); pulling the periscope goes back to the shift.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Bar, GameOver, Hud, HudText, kitScreens, Pause, Row, Score, ScreenStack, Settings, Stack, ToastStack, Victory, screens, tipsMemory, toast, toasts, useScreens } from './kit'
import type { SettingsSchema } from './kit'
import { createShift, type MachineId, type ShiftEngine, type ShiftStatus } from '../engine'
import { restoreShift, type ShiftSnapshot } from '../engine/snapshot'
import { session } from '../game/session'
import { looksClock } from '../devkit/gameClock'
import { ShiftStage, type HudSnapshot } from '../game/ShiftStage'
import { readoutSetting } from '../game/readoutSetting'
import type { Message } from '../game/messages'
import { lessonFromUrl, lessonNow, lessonPlay, runner as lessonRunner } from '../game/lessons/goopsLessons'
import { LessonView } from '../game/lessons/LessonView'
import { firstBreakdowns } from '../game/lessons/firstBreakdowns'
import { gooStyle } from '../game/gooStyle'
import { wallKick } from '../game/wallKick'
import { soundSettingsChanged } from '../game/sound'
import { getAudio, useAudioSnapshot } from '../audio'
import { rankInfo, rewardShift, type Progress, type ShiftReward } from '../progress/progression'
import { loadProgress, saveProgress } from '../progress/save'
import { Console } from './Console'
import { art } from './art'
import { useShort } from './useShort'
import shiftConfig from '../../content/tuning/shift.json'
import breakdowns from '../../content/tuning/breakdowns.json'
import hudTuning from '../../content/tuning/hud.json'
import settingsJson from '../../content/ui/settings.json'
import text from '../../content/text/en.json'

const settings = settingsJson as SettingsSchema
// the machines' bars in the bottom panel, left to right (Muzzy's mock-up: LASER · CONTROLS · VISOR)
const MACHINES: MachineId[] = ['laser', 'controls', 'visor']
const fill = (s: string, vars: Record<string, number | string>) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))

// ?seed=123 fixes the shift's random pieces (tests); otherwise every shift is new.
// The shift plays at the player's saved rank (colours, starting junk, crack quota). Dev/tests: ?rank=12 forces one.
// training = a lesson's shift (F30, src/engine/training.ts): empty, held still, the lesson sets it up step by step.
function newEngine(progress: Progress, training = false): ShiftEngine {
  const params = new URLSearchParams(location.search)
  const seed = Number(params.get('seed')) || Math.floor(Math.random() * 1e9)
  const forced = import.meta.env.DEV ? params.get('rank') : null
  const rank = forced !== null ? Number(forced) : rankInfo(progress).rank
  return createShift(shiftConfig, { seed, rank, wallKick: wallKick.get(), breakdowns, ...(training ? { training: {} } : {}) })
}
type LessonStart = { id: string; step: number | string }

// (Replay lessons, F32: the device forgets which lessons it has seen — each machine's plays again at its next break)
const onSettingsAction = (id: string) => {
  if (id !== 'replayLessons') return
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
  const start = useCallback((lesson?: LessonStart) => {
    lessonPlay.stop()
    const e = lesson ? lessonPlay.attach(newEngine(progressRef.current, true)) : newEngine(progressRef.current)
    // a real shift: its machines' first breakdowns may start their lessons (F32)
    if (!lesson) { lessonPlay.watch(e); firstBreakdowns.newShift() }
    pendingLesson.current = lesson ?? null
    engineRef.current = e
    setResult(null); setHud(null); setEngine(e)
  }, [])
  // the periscope is down: the shift is made (paused) under the console, which slides away to show it
  const leaveConsole = useCallback(() => {
    const lesson = urlLesson.current
    urlLesson.current = null
    start(lesson ?? undefined); setMeterFrom(null); setMode('leaving')
  }, [start])
  // the tank is on screen: a lesson waiting for it starts now
  useEffect(() => {
    const lesson = pendingLesson.current
    if (mode === 'shift' && engine && lesson) { pendingLesson.current = null; lessonPlay.start(lesson.id, lesson.step) }
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
  const peekIn = useCallback(() => { if (modeRef.current === 'shift' && !screens.current.length) setMode('peekIn') }, [])
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
    const reward = rewardShift(progressRef.current, e.state.score)
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
        { label: text.end.xp, value: result.reward.rankUps > 0
          ? fill(text.end.xpRankUp, { xp: result.reward.xp.toLocaleString('en'), rank: result.reward.after.rank })
          : fill(text.end.xpValue, { xp: result.reward.xp.toLocaleString('en') }) }]
      const again = () => { screens.pop(); start() }
      return result.status === 'won'
        ? <Victory words={{ title: text.end.wonTitle, continue: text.end.again, quit: text.end.quit, swipe: text.end.swipe }}
            message={result.cause === 'overflow' ? text.end.wonOverflow : text.end.wonCracks}
            frame={art.end.frame} art={{ continue: art.end.again, quit: art.end.quit }} stats={stats}
            onContinue={again} onQuit={toConsole} onSwipeUp={toConsole} />
        : <GameOver words={{ title: text.end.lostTitle, retry: text.end.again, quit: text.end.quit, swipe: text.end.swipe }}
            message={result.cause === 'overflow' ? text.end.lostOverflow : text.end.lostCracks}
            frame={art.end.frame} art={{ retry: art.end.again, quit: art.end.quit }} stats={stats}
            onRetry={again} onQuit={toConsole} onSwipeUp={toConsole} />
    },
  }), [result, start, toConsole])

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
  const speed = open.length ? 0 : mode === 'shift' ? 1 : peeking ? (lessonPlay.consoleFrozen() ? 1 : breakdowns.consoleTimeScale) : 0
  // The HUD (F26, Muzzy's mock-up 2026-10-18): ONE top row — score · cracks (big, shrinking to fit) · Console button —
  // then the tank, then a panel under it: the unlocked machines' bars with big names above (one centred, two or three
  // evenly spaced), and the long integrity bar with its name inside. A phone on its side: the panel is a column beside
  // the tank, headed by the crack count; the score and the Console button sit in the top corners beside the tank. Every bar reads the same way: full = good (laser charge, controls' room before overheating, visor signal,
  // tank integrity); below bars.lowAt it turns red and pulses, a broken machine flashes (content/tuning/hud.json).
  // The pressure readout hangs on the pressure line (ShiftStage); messages show just above the goop.
  // (Which bars the panel holds is known when the shift starts — machines unlock between shifts — so its height never
  // changes mid-shift.)
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
  // (a phone on its side: the crack count heads the panel column, and the tank takes the whole height)
  const panel = hud && (short
    ? <Stack gap="s">{status}{machineBars}{integrityBar}</Stack>
    : <Stack gap="s">{unlocked.length > 0 && <Row gap="l" justify="center">{machineBars}</Row>}<Row justify="center">{integrityBar}</Row></Stack>)
  const readout = hud && <HudText size="s" live numbers>{fill(text.hud.pressureReadout, { n: Math.round(hud.pressure * 100) })}</HudText>
  return (
    <>
      {engine && mode !== 'console' && (
        <ShiftStage engine={engine} speed={speed} inputOn={mode === 'shift' && !open.length}
          panel={unlocked.length ? 'machines' : 'integrity'} side={short} readout={readout}
          onHud={setHud} onEnd={onEnd} onMessage={onMessage} onConsole={peekIn} />
      )}
      {mode === 'shift' && (
        <ScreenStack overlay screens={screenMap}>
          {hud && (
            <Hud words={{ pause: text.hud.pause }} onPause={() => screens.push('pause')} oneRow
              vitals={<Score value={hud.score} compact />}
              status={short ? undefined : status}
              banner={hud.holdProgress !== null ? <Bar label={text.hud.swap} value={Math.round(hud.holdProgress * 100)} variant="accent" width="s" /> : undefined}
              dock={panel} dockSide={short ? 'right' : 'bottom'} />
          )}
        </ScreenStack>
      )}
      {mode !== 'shift' && (
        <ScreenStack screens={peeking ? consoleScreens : { settings: SettingsScreen }}>
          <Console progress={progress} shownFrom={peeking ? null : meterFrom} onSlideEnd={consoleSlid}
            phase={mode === 'console' || mode === 'peek' ? 'idle' : mode === 'leaving' || mode === 'peekOut' ? 'leaving' : 'arriving'}
            onPull={peeking ? peekOut : leaveConsole} onSettings={() => screens.push(peeking ? 'pause' : 'settings')}
            midShift={peeking && hud ? { machines: hud.machines, breaks: hud.breaks, onRepair: repair } : undefined} />
        </ScreenStack>
      )}
      <ToastStack place="at" variant="plain" /* just above the goop; words, not button-like plates (Muzzy 2026-10-18) */ />
      {/* F30: a lesson's message (kit Callout), over the running tank or the console mid-shift (F32); over a menu only a
          step's reaction ("That's the pause menu…") */}
      {(mode === 'shift' || peeking) && <LessonView overMenu={open.length > 0} />}
    </>
  )
}
