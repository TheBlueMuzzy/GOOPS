// The game's screens. A working day (F21): the game opens on the console (Muzzy's art) → pull the periscope down → the
// console slides away to the tank and the shift starts → the end report → swipe up (or "Back to the console") → the
// console slides back up and its rank meter fills with the XP. "Next shift" on the report starts the next one straight away.
// Mid-shift (F23/F24): swipe up / W / ↑ → the same console slides over the tank while the shift runs on at
// consoleTimeScale (content/tuning/breakdowns.json); broken machines are repaired on its panels; its gear opens the pause
// menu (which fully pauses; End shift = the run is thrown away, no XP); pulling the periscope goes back to the shift.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Bar, Button, GameOver, Hud, HudText, Modal, Pause, Row, Score, ScreenStack, ScrollArea, Settings, Stack, StatList, Text, TimerRing, ToastStack, Victory, screens, tipsMemory, toast, toasts, useScreens, useTips } from './kit'
import type { SettingsSchema, Stat } from './kit'
import { clampModifiers, createShift, type MachineId, type ResolvedUpgrades, type ShiftEngine, type ShiftStatus } from '../engine'
import { upgradesForShift } from '../progress/upgradeShop'
import { restoreShift, type ShiftSnapshot } from '../engine/snapshot'
import { session } from '../game/session'
import { looksClock, rulesClock } from '../devkit/gameClock'
import { ShiftStage, type HudSnapshot } from '../game/ShiftStage'
import { readoutSetting } from '../game/readoutSetting'
import { messageWords, type Message } from '../game/messages'
import { lessonFromUrl, lessonNow, lessonPlay, runner as lessonRunner } from '../game/lessons/goopsLessons'
import { LessonView } from '../game/lessons/LessonView'
import { StoryView } from '../game/lessons/StoryView'
import { Whisper } from '../game/Whisper'
import { storyMoments } from '../game/lessons/storyMoments'
import { firstBreakdowns } from '../game/lessons/firstBreakdowns'
import { unlockLessons } from '../game/lessons/unlockLessons'
import { FIRST_DAY, firstDay } from '../game/lessons/firstDay'
import { gooStyle } from '../game/gooStyle'
import { wallKick } from '../game/wallKick'
import { soundSettingsChanged } from '../game/sound'
import { getAudio, useAudioSnapshot } from '../audio'
import { freshProgress, isUnlocked, rankInfo, rewardFirstDay, rewardShift, scrapsAt, titleAt, unlockRank, unlocksBetween, type Progress, type ShiftReward } from '../progress/progression'
import { loadProgress, saveProgress } from '../progress/save'
import { makePayslip, type Payslip, type ShiftFacts } from '../progress/payslip'
import { NextWindow } from '../game/NextWindow'
import { Console } from './Console'
import { UpgradesScreen } from './UpgradesScreen'
import { RankSelectScreen } from './RankSelect'
import { rankSelectOn } from '../game/rankSelect'
import { UpgradeShopContext } from './upgradeShopContext'
import { versionLabel } from '../version'
import { art } from './art'
import { useShort } from './useShort'
import { usePortraitLock, useSideways } from './portrait'
import { UprightScreen } from './Upright'
import shiftConfig from '../../content/tuning/shift.json'
import breakdowns from '../../content/tuning/breakdowns.json'
import hudTuning from '../../content/tuning/hud.json'
import settingsJson from '../../content/ui/settings.json'
import text from '../../content/text/en.json'
import payslipTuning from '../../content/tuning/payslip.json'

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
// F34: what the player owns goes in — the upgrades' modifiers and equipped actives (upgradesForShift; a lesson's
// training shift gets none). The App keeps the rest (the repairs' fewer steps, Focus Mode's console speed).
function newEngine(progress: Progress, training = false): { engine: ShiftEngine; upgrades: ResolvedUpgrades } {
  const seed = Number(new URLSearchParams(location.search).get('seed')) || Math.floor(Math.random() * 1e9)
  const rank = playerRank(progress)
  const upgrades = upgradesForShift(progress, training)
  const engine = createShift(shiftConfig, { seed, rank, wallKick: wallKick.get(), breakdowns, swap: !training && isUnlocked('swap', rank),
    modifiers: upgrades.modifiers, abilities: upgrades.abilities, ...(training ? { training: {} } : {}) })
  return { engine, upgrades }
}
const NO_UPGRADES = upgradesForShift(freshProgress(), true)
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
  <Settings schema={settings} onAction={onSettingsAction} version={versionLabel /* the version module: the bottom of every tab (+ About → Version) */} onChange={(values) => {
    gooStyle.setFromSetting(values.gooStyle); wallKick.setFromSetting(values.wallKick); readoutSetting.setFromSettings(values)
    soundSettingsChanged(values)
  }} />
)
// the console between shifts: Settings and the Upgrades shop (one fixed map, so a screen stays mounted while it's used)
// (+ F70 RANK SELECT's list, in a Dev Kit build)
const IDLE_SCREENS = { settings: SettingsScreen, upgrades: UpgradesScreen, ...(rankSelectOn ? { rankSelect: RankSelectScreen } : {}) }
// in-shift messages (F26, src/game/messages.ts decides which): kit toasts just above the goop. How long one stays is
// LOOKS time (src/devkit/gameClock.ts): the Dev Kit's full pause holds it on screen, so the frozen picture stays whole.
const ONE_DAY_S = 86_400 // (the kit's own timer, never reached: the looks clock takes it away)
const onMessage = (m: Message) => {
  if (lessonPlay.messageUp()) return // a lesson message is up: the game's own messages keep quiet (F30)
  // a lesson's training shift (the first day) teaches the wrong colour on a crack itself — its redX step (F68)
  if (m.key === 'wrongCover' && !lessonPlay.realShift()) return
  const id = toast(messageWords(m.key, lessonPlay.inputKind()), { variant: m.danger ? 'danger' : 'neutral', seconds: ONE_DAY_S })
  looksClock.after(m.seconds * 1000, () => toasts.dismiss(id))
}

// What ranking up from `from` to `to` unlocked (F59: the progression unlocks and the machines, in the order they come)
function gainedBetween(from: number, to: number): string[] {
  const gained: [number, string][] = [
    ...unlocksBetween(from, to).map((u): [number, string] => [unlockRank(u), text.unlocks[u]]),
    ...MACHINES.filter((id) => breakdowns[id].unlockRank > from && breakdowns[id].unlockRank <= to).map((id): [number, string] => [breakdowns[id].unlockRank, text.unlocks[id]]),
  ]
  gained.sort((a, b) => a[0] - b[0])
  return gained.map(([, name]) => name)
}

// The end report's net pay line: what the shift earned; a rank-up if it crossed one, naming what the new rank unlocked
function rankUpLine(r: ShiftReward): string {
  const xp = r.xp.toLocaleString('en')
  if (r.rankUps <= 0) return fill(text.end.xpValue, { xp })
  const what = gainedBetween(r.before.rank, r.after.rank)
  return what.length ? fill(text.end.xpRankUpNew, { xp, rank: r.after.rank, what: what.join(', ') })
    : fill(text.end.xpRankUp, { xp, rank: r.after.rank })
}

// F41: the payslip's rows on the report — gross pay, the fines (none on day one: "Day one is on us"), net pay
const cr = (n: number) => n.toLocaleString('en')
const P = text.payslip
const payWords = (key: string): string => {
  const [group, id] = key.split('.') as [string, string]
  const words = (P as unknown as Record<string, Record<string, string> | string[]>)[group]
  return (Array.isArray(words) ? words[Number(id)] : words?.[id]) ?? key
}
// (UI kit 0.31.0 rows: one at a time, payslip.json lineMs apart; tone = the ▼ / ▲ badge — fines down, net pay up)
function payslipStats(p: Payslip, r: ShiftReward): Stat[] {
  return [
    { label: P.gross, value: fill(P.plus, { n: cr(p.gross) }) },
    ...(p.firstDay ? [{ label: P.firstDay, value: fill(P.minus, { n: 0 }) }]
      : p.fines.map((f): Stat => ({ label: payWords(f.key), value: fill(P.minus, { n: cr(f.amount) }), tone: 'danger' }))),
    { label: P.net, value: rankUpLine(r), tone: 'success' },
  ]
}
// A random pick of fines each shift; fixed under scripted checks so e2e is the same every run
const payslipSeed = () => (import.meta.env.DEV && navigator.webdriver ? 1 : Math.floor(Math.random() * 1e9))

// console = on the console · leaving = sliding away to the tank · shift = in the tank (report included) · arriving = sliding back
// peekIn / peek / peekOut = mid-shift: the console sliding over the running tank / on it / sliding away back to the shift
type Mode = 'console' | 'leaving' | 'shift' | 'arriving' | 'peekIn' | 'peek' | 'peekOut'
const PEEK: Mode[] = ['peekIn', 'peek', 'peekOut']

export function App() {
  const [mode, setMode] = useState<Mode>('console')
  const [engine, setEngine] = useState<ShiftEngine | null>(null)
  const [hud, setHud] = useState<HudSnapshot | null>(null)
  const [result, setResult] = useState<{ status: ShiftStatus; score: number; sealed: number; needed: number; cause: 'integrity' | 'overflow'; reward: ShiftReward; payslip: Payslip } | null>(null)
  // F41: the payday on screen (0 = the first) and what the report's button asked for, done after the last payday
  const [payIndex, setPayIndex] = useState(0)
  const afterPay = useRef<(() => void) | null>(null)
  // F41: what really happened in this shift, for the fines (machines that broke, refused zaps, time at the console)
  const facts = useRef({ broke: new Set<MachineId>(), refusedZaps: 0, consoleMs: 0, peekSince: 0 })
  useEffect(() => session.listen((events) => {
    for (const e of events) {
      if (e.type === 'breakdown') facts.current.broke.add(e.machine)
      else if (e.type === 'reject' && e.action === 'pop' && e.cell !== undefined && e.reason !== 'lessonColour') facts.current.refusedZaps++ // (a lesson's "not this colour" isn't the player's slip)
    }
  }), [])
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
  // F34: the running shift's upgrades (set with its engine): the repair panels' fewer steps, Focus Mode's console speed
  const [upgrades, setUpgrades] = useState<ResolvedUpgrades>(NO_UPGRADES)

  // F30 lessons: the lesson to start once the tank is on screen (a training shift is made for it); ?lesson=<id>&step=<n>
  // (dev) makes the first "Start shift" play that lesson
  const pendingLesson = useRef<LessonStart | null>(null)
  const urlLesson = useRef<LessonStart | null>(lessonFromUrl())
  const freshShift = useRef(false) // F59: a real shift just started — its unlock lesson (if any) plays once the tank shows
  const start = useCallback((lesson?: LessonStart) => {
    lessonPlay.stop()
    const made = newEngine(progressRef.current, !!lesson)
    const e = lesson ? lessonPlay.attach(made.engine) : made.engine
    setUpgrades(made.upgrades)
    // a real shift: its machines' first breakdowns may start their lessons (F32)
    if (!lesson) { lessonPlay.watch(e); firstBreakdowns.newShift() }
    pendingLesson.current = lesson ?? null
    freshShift.current = !lesson
    engineRef.current = e
    facts.current = { broke: new Set(), refusedZaps: 0, consoleMs: 0, peekSince: 0 }
    setResult(null); setHud(null); setEngine(e)
  }, [])
  // the periscope is down: the shift is made (paused) under the console, which slides away to show it
  // (F31: while the first day is due, its shift — at the phase it got to; the console's own step, A1, is done)
  const leaveConsole = useCallback(() => {
    if (storyMoments.playing()) return // (F35: the periscope waits for a story moment — Console disables it too)
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
    if (mode === 'shift' && result && !screens.current.includes('end') && !screens.current.includes('payday')) { lessonPlay.screen('reportClosed'); toConsole() } // (Esc / Back finish day one too)
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
    // (its upgrades: the modifiers it was saved with; the repairs' fewer steps from what's owned now — a lesson's: none)
    const owned = upgradesForShift(progressRef.current, !!o?.training)
    setUpgrades({ ...owned, modifiers: clampModifiers(o?.modifiers) })
    engineRef.current = e
    setResult(null); setHud(null); setEngine(e); setMode('shift')
  }, [])
  useEffect(() => { session.restore = restoreSnapshot; return () => { session.restore = null } }, [restoreSnapshot])
  useEffect(() => { session.engine = engine; session.inShift = !!engine && mode !== 'console' }, [engine, mode])
  // at the console mid-shift the machines' break-progress pauses (Muzzy, 2026-10-18; src/engine/machines.ts)
  useEffect(() => { engine?.act({ type: 'console', on: PEEK.includes(mode) }) }, [engine, mode])
  // (F41: time at the console mid-shift, for "Unscheduled console loitering")
  useEffect(() => {
    const f = facts.current
    if (PEEK.includes(mode)) { if (!f.peekSince) f.peekSince = performance.now() }
    else if (f.peekSince) { f.consoleMs += performance.now() - f.peekSince; f.peekSince = 0 }
  }, [mode])
  const onEnd = useCallback((status: ShiftStatus) => {
    const e = engineRef.current
    if (!e) return
    // the final score (after the leftover penalty) becomes XP — saved right away
    // (F31: the first day's shift tops it up to rank 1 when it started at rank 0 — the report says the rank-up)
    const dayOne = firstDay.running()
    const reward = (dayOne ? rewardFirstDay : rewardShift)(progressRef.current, e.state.score)
    progressRef.current = reward.progress
    setProgress(reward.progress)
    saveProgress(reward.progress)
    // F41: the payslip — fines from what really happened first (src/progress/payslip.ts)
    const f = facts.current, s = e.state
    const shiftFacts: ShiftFacts = { ruptured: s.ruptureReason !== null, broke: [...f.broke], openCracks: s.cracks.length,
      goopLeft: (s.leftoverPenalty ?? 0) > 0, refusedZaps: f.refusedZaps,
      consoleSeconds: (f.consoleMs + (f.peekSince ? performance.now() - f.peekSince : 0)) / 1000 }
    const payslip = makePayslip(reward, shiftFacts, { firstDay: dayOne, seed: payslipSeed(), extras: P.extras.length })
    setPayIndex(0); afterPay.current = null
    setResult({ status, score: e.state.score, sealed: e.state.cracksSealed, needed: e.state.cracksNeeded,
      cause: e.state.ruptureReason ?? 'integrity', reward, payslip })
    toasts.current.forEach((t) => toasts.dismiss(t.id)) // a rupture alert must not sit on the report
    if (modeRef.current === 'shift') screens.push('end')
    else { // at the console mid-shift: back to the tank first, then the report
      endPending.current = true
      while (screens.current.length) screens.pop()
      setMode((m) => (m === 'peekIn' || m === 'peek' ? 'peekOut' : m))
    }
  }, [])

  const screenMap = useMemo(() => ({
    settings: SettingsScreen,
    pause: () => (
      <Pause words={text.pause} onSettings={() => screens.push('settings')} onQuit={toConsole} />
    ),
    end: () => {
      if (!result) return null
      // F41: the payslip — gross, fines, net pay (= what the shift earned, and a rank-up if it crossed one, F59: and
      // what that rank unlocked). Net pay replaces the Score row: they were the same number (bar the minimum XP), and
      // a phone has little room. A long list scrolls inside the report from UI kit 0.31.0 (framework F113).
      const stats = [{ label: text.end.cracks, value: `${result.sealed} / ${result.needed}` }, ...payslipStats(result.payslip, result.reward)]
      // (F31: a lesson hears the report close — the first day's last step is "back to the console")
      // F41: a rank-up first plays its payday (one screen per rank crossed), then does what the button asked
      // (the report closes as the payday opens: day one's last lesson step ends there, not over the payday)
      const thenPay = (go: () => void) => () => {
        lessonPlay.screen('reportClosed')
        if (!result.payslip.paydays.length) return go()
        afterPay.current = go
        setPayIndex(0)
        screens.replace('payday')
      }
      const again = thenPay(() => { while (screens.current.length) screens.pop(); start() })
      const back = thenPay(toConsole)
      // Day one ends at the console, never straight into a shift (Muzzy 2026-10-24: "that button just shouldn't be
      // available just for the 1 end after the tutorial") — its report has only "Back to the console"
      if (result.payslip.firstDay) return (
        <Victory words={{ title: text.end.wonTitle, continue: text.end.quit, swipe: text.end.swipe }}
          message={result.cause === 'overflow' ? text.end.wonOverflow : text.end.wonCracks}
          frame={art.end.frame} art={{ continue: art.end.quit }} stats={stats} reveal={payslipTuning.lineMs}
          onContinue={back} onSwipeUp={back} />
      )
      return result.status === 'won'
        ? <Victory words={{ title: text.end.wonTitle, continue: text.end.again, quit: text.end.quit, swipe: text.end.swipe }}
            message={result.cause === 'overflow' ? text.end.wonOverflow : text.end.wonCracks}
            frame={art.end.frame} art={{ continue: art.end.again, quit: art.end.quit }} stats={stats} reveal={payslipTuning.lineMs}
            onContinue={again} onQuit={back} onSwipeUp={back} />
        : <GameOver words={{ title: text.end.lostTitle, retry: text.end.again, quit: text.end.quit, swipe: text.end.swipe }}
            message={result.cause === 'overflow' ? text.end.lostOverflow : text.end.lostCracks}
            frame={art.end.frame} art={{ retry: art.end.again, quit: art.end.quit }} stats={stats} reveal={payslipTuning.lineMs}
            onRetry={again} onQuit={back} onSwipeUp={back} />
    },
    // F41: payday — the Company takes exactly the payment due, itemised, then the passage debt and the rank-up.
    // Every payday has the same rows, so the card is the same size each time. Closed another way (Esc, phone Back):
    // back to the console, like the report.
    payday: () => {
      const day = result?.payslip.paydays[payIndex]
      if (!result || !day) return null
      const last = payIndex >= result.payslip.paydays.length - 1
      // (the last Pay up runs the report's choice once, even on a quick double tap)
      const pay = () => {
        if (!last) return setPayIndex((i) => i + 1)
        const go = afterPay.current
        afterPay.current = null
        go?.()
      }
      const what = gainedBetween(day.from, day.to)
      return (
        <Modal title={P.paydayTitle} actions={<Button onClick={pay}>{P.pay}</Button>}>
          <Text>{fill(P.paydayMessage, { due: cr(day.due) })}</Text>
          {/* (the bill's rows scroll on a short phone — no scroll bar, the edge fades; Pay up stays in view) */}
          {/* (one at a time like the report's rows; a second payday's new rows replay the reveal — UI kit 0.32.0) */}
          <ScrollArea label={P.paydayTitle}>
            <StatList reveal={payslipTuning.lineMs} stats={[
              ...day.items.map((item): Stat => ({ label: payWords(item.key), value: fill(P.minus, { n: cr(item.amount) }), tone: 'danger' })),
              { label: P.debt, value: fill(P.debtValue, { n: cr(day.debt), interest: cr(day.interest) }), tone: 'danger' },
              { label: P.rankUp, value: what.length ? fill(P.rankUpNew, { rank: day.to, what: what.join(', ') }) : fill(P.rankUpValue, { rank: day.to }), tone: 'success' },
              // F35: a rank that starts a new title band says the new title (story.md "Rank titles")
              ...(titleAt(day.to) !== titleAt(day.from) ? [{ label: P.newTitle, value: text.story.titles[titleAt(day.to)], tone: 'success' as const }] : []),
            ]} />
          </ScrollArea>
        </Modal>
      )
    },
  }), [result, start, toConsole, payIndex])

  // the console between shifts: Settings, and the Upgrades screen (F59 opens it from its rank; F34 the shop: buy, take
  // back, equip — src/ui/UpgradesScreen.tsx). What it changes is saved at once.
  const rank = playerRank(progress)
  const scraps = Math.max(0, scrapsAt(rank, progress))
  const changeUpgrades = useCallback((p: Progress) => {
    progressRef.current = p
    setProgress(p)
    saveProgress(p)
  }, [])
  const shop = useMemo(() => ({ progress, rank, onChange: changeUpgrades }), [progress, rank, changeUpgrades])
  const openUpgrades = useCallback(() => { screens.push('upgrades'); lessonPlay.screen('upgradesOpened') }, [])
  // F59: on the console between shifts at upgrading's rank, its unlock lesson (once per device: unlockLessons.ts)
  // F31: while the first day is due, its first step instead (pull the periscope) — again after Replay lessons (tips).
  // Between shifts the rules clock runs (no shift uses it then; a console lesson's hint does).
  // F35: the rank's story moment comes first (storyMoments.ts); the console's lessons wait until it's over.
  const tips = useTips()
  const storyUp = useSyncExternalStore(storyMoments.subscribe, storyMoments.playing)
  useEffect(() => {
    if (mode !== 'console') return
    rulesClock.scale = 1
    if (storyMoments.atConsole(rank)) return
    if (dayDue(progress)) firstDay.atConsole()
    else unlockLessons.atConsole(rank)
  }, [mode, rank, progress, tips, storyUp])
  // (the console going away mid-moment — a Dev Kit snapshot, a lesson started from the Dev Kit: it plays again next time)
  useEffect(() => { if (mode !== 'console') storyMoments.stop() }, [mode])

  // the console mid-shift: Settings and the pause menu (End shift throws the run away)
  const consoleScreens = useMemo(() => ({
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
  const lessonOn = !!useSyncExternalStore(lessonRunner.subscribe, lessonRunner.view).lessonId
  // F70: RANK SELECT — a Dev Kit build, between shifts, and not while a lesson or a story moment is on the console
  const showRankSelect = rankSelectOn && !peeking && !lessonOn && !storyUp
  // at the console mid-shift the tank runs on under it, a little quieter (content/audio.json snapshots.console)
  useAudioSnapshot(getAudio(), peeking ? 'console' : null)
  // how fast the shift runs: full in the tank, slowed at the console mid-shift, stopped under any menu or a slide.
  // A first-breakdown lesson freezes the tank at the console instead (F32): the rules clock runs at full speed for the
  // lesson's own timers and the lesson holds the tank still (lessonPlay.speed)
  // (a phone held sideways: paused under the "Turn your phone upright" card, the game's own pause)
  // (F31: the end report isn't a menu that pauses: the shift has ended, so the rules clock running changes nothing in
  // the tank — but a lesson on the report, day one's "back to the console", keeps its own timers)
  const menuOpen = open.some((id) => id !== 'end')
  const speed = menuOpen || sideways ? 0 : mode === 'shift' ? 1 : peeking
    ? (lessonPlay.consoleFrozen() ? 1 : breakdowns.consoleTimeScale * upgrades.modifiers.consoleTimeScaleMult) : 0 // (F34: × Focus Mode)
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
    return <Bar key={id} plain label={text.hud[id]} labelAt="above" width={short ? 1 : hudTuning.bars.machineWidth} atMost={!short} thickness="m"
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
  // F34: with an active equipped its charge button takes ~50 px of the top row, and the widest count a real game shows
  // ("CRACKS 56 / 57", "QUOTA MET · 99" beside a 5-digit score) no longer fits a 360 / 390 phone even shrunk to the
  // body-text floor (kit HudText fit) — so then the count drops its name: "56 / 57", and past the quota the same count in
  // the accent colour ("61 / 57"). Known when the shift starts, so it never switches mid-shift. (Ask Muzzy in SPRINT Notes.)
  const shortCount = !short && !!engine?.state.abilities?.length && !ruptured && !!hud
  const status = <HudText size="l" fit tone={ruptured || quotaMet ? 'accent' : 'normal'}>
    {shortCount ? fill(text.hud.cracksShort, { n: hud.cracksSealed, total: hud.cracksNeeded }) : statusText}</HudText>
  // F59: the next-piece window, from its rank (known when the shift starts, like the machines)
  const showNext = !!engine && isUnlocked('nextPiece', engine.state.rank)
  const nextWindow = hud && showNext ? <NextWindow piece={hud.next} label={text.hud.next} /> : undefined
  // The panel: the window at the left, the bars to its right — the machines in a row (each at most bars.machineWidth of
  // that room, never narrower than its name: the kit Bar's atMost) over the integrity bar. (A short window: the crack count heads the
  // panel column, the machine bars stack beside the window, and the tank takes the whole height.)
  const bars = short ? <>{machineBars}{integrityBar}</>
    : <>{unlocked.length > 0 && <Row gap="s" justify="center" className="hud-machines">{machineBars}</Row>}{integrityBar}</>
  const panelRow = <Row gap="s" className="hud-panel">{nextWindow}<Stack gap="s" className="hud-panel-bars">{bars}</Stack></Row>
  const panel = hud && (short ? <Stack gap="s">{status}{panelRow}</Stack> : panelRow)
  // F34: the equipped active's charge button (Cooldown Booster) — in the top row beside the Console button, so it never
  // covers the tank or the bars. A ring that fills as it charges, on a grey button; full = the bright (primary) button,
  // which glows in the style. Tap it (or F / Numpad .) to fire; not full = the engine refuses, nothing happens.
  const ability = hud?.ability
  const abilityName = ability ? (text.upgrades.items as Record<string, { name: string }>)[ability.id]?.name ?? ability.id : ''
  const abilityPct = ability ? Math.floor(ability.charge * 100) : 0
  const abilityWords = ability && fill(ability.ready ? text.hud.abilityReady : text.hud.abilityCharging, { name: abilityName, n: abilityPct })
  const abilityButton = ability && (
    <Button variant={ability.ready ? 'primary' : 'secondary'} icon aria-label={abilityWords || ''} title={abilityWords || ''} sound={ability.ready ? 'tap' : false}
      className="hud-ability" data-tag="ability" data-ready={ability.ready || undefined} onClick={() => engineRef.current?.act({ type: 'ability', id: ability.id })}>
      <TimerRing seconds={abilityPct} total={100} warnAt={-1} label={abilityWords || ''} />
      {/* a lightning bolt (Muzzy, 2026-10-22), drawn in the button's colour */}
      <svg className="hud-ability-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.5 2 4 13.5h6.5L9 22l10-12.5h-6.5L13.5 2z" /></svg>
    </Button>
  )
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
              vitals={<Score value={hud.score} compact />} status={short ? undefined : status} currency={abilityButton || undefined}
              banner={hud.holdProgress !== null ? <Bar label={text.hud.swap} value={Math.round(hud.holdProgress * 100)} variant="accent" width="s" /> : undefined}
              dock={panel} dockSide={short ? 'right' : 'bottom'} dockTight />
          )}
        </ScreenStack>
      )}
      {mode !== 'shift' && (
        <UpgradeShopContext.Provider value={shop}>
        <ScreenStack screens={peeking ? consoleScreens : IDLE_SCREENS}>
          <Console progress={progress} shownFrom={peeking ? null : meterFrom} onSlideEnd={consoleSlid}
            phase={mode === 'console' || mode === 'peek' ? 'idle' : mode === 'leaving' || mode === 'peekOut' ? 'leaving' : 'arriving'}
            onPull={peeking ? peekOut : leaveConsole} onSettings={() => screens.push(peeking ? 'pause' : 'settings')}
            midShift={peeking && hud ? { machines: hud.machines, breaks: hud.breaks, onRepair: repair, fewerRepairSteps: upgrades.fewerRepairSteps } : undefined}
            upgrades={peeking ? undefined : { scraps, open: isUnlocked('upgrades', rank), opensAt: unlockRank('upgrades'), onOpen: openUpgrades }}
            rankSelect={showRankSelect} />
        </ScreenStack>
        </UpgradeShopContext.Provider>
      )}
      <ToastStack place="at" variant="plain" /* just above the goop; words, not button-like plates (Muzzy 2026-10-18) */ />
      {/* F30: a lesson's message — in the tank a bubble in the kit Callout look; at the console mid-shift (F32) its words
          are on the monitor and this draws the spotlight; over a menu only a step's reaction ("That's the pause menu…") */}
      {/* (F59: and on the console between shifts — the Upgrades unlock lesson outlines its button there) */}
      {/* (F31: and over the end report — day one's last step points at its "Back to the console") */}
      {(mode === 'shift' || peeking || mode === 'console') && <LessonView overMenu={menuOpen} atConsole={mode !== 'shift'} />}
      {mode === 'console' && !menuOpen && <StoryView />}
      {/* F35: the goop's first whispers in a real shift (not a lesson's training shift) */}
      {engine && lessonPlay.realShift() && (mode === 'shift' || peeking) && !result && !menuOpen && <Whisper engine={engine} />}
      {sideways && <UprightScreen />}
    </>
  )
}
