// The game's screens. A working day (F21): the game opens on the console (Muzzy's art) → pull the periscope down → the
// console slides away to the tank and the shift starts → the end report → swipe up (or "Back to the console") → the
// console slides back up and its rank meter fills with the XP. "Next shift" on the report starts the next one straight away.
// Mid-shift (F23/F24): swipe up / W / ↑ → the same console slides over the tank while the shift runs on at
// consoleTimeScale (content/tuning/breakdowns.json); broken machines are repaired on its panels; its gear opens the pause
// menu (which fully pauses; End shift = the run is thrown away, no XP); pulling the periscope goes back to the shift.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Bar, GameOver, Hud, HudText, kitScreens, Pause, Row, Score, ScreenStack, Settings, Stack, ToastStack, Victory, screens, toast, toasts, useScreens } from './kit'
import type { SettingsSchema } from './kit'
import { createShift, type MachineId, type ShiftEngine, type ShiftStatus } from '../engine'
import { ShiftStage, type HudSnapshot } from '../game/ShiftStage'
import { hudLayout } from '../game/hudLayout'
import type { Message } from '../game/messages'
import { gooStyle } from '../game/gooStyle'
import { wallKick } from '../game/wallKick'
import { rankInfo, rewardShift, type Progress, type ShiftReward } from '../progress/progression'
import { loadProgress, saveProgress } from '../progress/save'
import { Console } from './Console'
import { art } from './art'
import { useShort } from './useShort'
import shiftConfig from '../../content/tuning/shift.json'
import breakdowns from '../../content/tuning/breakdowns.json'
import settingsJson from '../../content/ui/settings.json'
import text from '../../content/text/en.json'

const settings = settingsJson as SettingsSchema
const HUD_RESERVE = 128 // CSS px kept free above the tank for the HUD: its two rows (corners, then the crack count)
const METERS_RESERVE = 60 // CSS px kept free under the tank for the machines' stand-in meters (once one is unlocked; a
// phone on its side keeps its tank and shows them in a column beside it instead, the HUD reaching this far past it)
const METERS_SIDE_ROOM = 150
// F26 test layouts ("Meters (test)", src/game/hudLayout.ts). Hug the tank / Bottom strip keep only ONE row on top (the
// Console button; + the score in the strip), so the tank grows into the room the top bars and crack line had.
const TOP_ROW_RESERVE = 68
const TAGS_RESERVE = 40 // Hug the tank: the row of tags (cracks · tank · score) hanging under the tank
const STRIP_RESERVE = 76 // Bottom strip: one row (pressure · tank · cracks) at the bottom …
const STRIP_ROW = 48 // … and a second row when machine meters are unlocked
const STRIP_SIDE_ROOM = 200 // … a column beside the tank on a phone on its side (the crack line is wider than the meters)
// A phone on its side, hugging: the Console button sits BESIDE the tank's top-right corner (not above it), so the tank
// takes the whole height; the HUD column reaches this far past each side of the tank to give the button room
const HUG_SHORT_TOP = 12
const HUG_SHORT_SIDE_ROOM = 72
const MACHINES: MachineId[] = ['laser', 'visor', 'controls']
const fill = (s: string, vars: Record<string, number | string>) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))

// ?seed=123 fixes the shift's random pieces (tests); otherwise every shift is new.
// The shift plays at the player's saved rank (colours, starting junk, crack quota). Dev/tests: ?rank=12 forces one.
function newEngine(progress: Progress): ShiftEngine {
  const params = new URLSearchParams(location.search)
  const seed = Number(params.get('seed')) || Math.floor(Math.random() * 1e9)
  const forced = import.meta.env.DEV ? params.get('rank') : null
  const rank = forced !== null ? Number(forced) : rankInfo(progress).rank
  return createShift(shiftConfig, { seed, rank, wallKick: wallKick.get(), breakdowns })
}

const SettingsScreen = () => (
  <Settings schema={settings} onChange={(values) => {
    gooStyle.setFromSetting(values.gooStyle); wallKick.setFromSetting(values.wallKick); hudLayout.setFromSettings(values)
  }} />
)
// in-shift messages (F26, src/game/messages.ts decides which): kit toasts, where "Messages (test)" puts them
const onMessage = (m: Message) => toast(text.messages[m.key], { variant: m.danger ? 'danger' : 'neutral', seconds: m.seconds })

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
  const layout = useSyncExternalStore(hudLayout.subscribe, hudLayout.get)
  const engineRef = useRef<ShiftEngine | null>(null)
  const [saved] = useState(loadProgress)
  const [progress, setProgress] = useState(saved) // for the console; progressRef for the handlers
  const progressRef = useRef<Progress>(saved)
  // the console's meter: the progress it showed when it was last on screen, so coming back it fills from there
  const meterShown = useRef<Progress>(saved)
  const [meterFrom, setMeterFrom] = useState<Progress | null>(null)
  const modeRef = useRef(mode)
  useEffect(() => { modeRef.current = mode }, [mode])

  const start = useCallback(() => {
    const e = newEngine(progressRef.current)
    engineRef.current = e
    setResult(null); setHud(null); setEngine(e)
  }, [])
  // the periscope is down: the shift is made (paused) under the console, which slides away to show it
  const leaveConsole = useCallback(() => { start(); setMeterFrom(null); setMode('leaving') }, [start])
  // back to the console (swipe up / "Back to the console" / End shift): it slides up over the tank, the meter fills
  const toConsole = useCallback(() => {
    while (screens.current.length) screens.pop()
    toasts.current.forEach((t) => toasts.dismiss(t.id))
    setMeterFrom(meterShown.current)
    meterShown.current = progressRef.current
    setMode('arriving')
  }, [])
  // The report closed some other way (Esc, phone Back) after the shift ended: that means "back to the console" too,
  // never a frozen, finished tank
  // (a shift that ended while its player was at the console mid-shift: the console slides away, then the report opens)
  const endPending = useRef(false)
  useEffect(() => {
    if (mode === 'shift' && endPending.current) { endPending.current = false; screens.push('end') }
  }, [mode])
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
    setMode('console')
  }, [])
  const repair = useCallback((machine: MachineId) => engineRef.current?.act({ type: 'repair', machine }), [])
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
  // how fast the shift runs: full in the tank, slowed at the console mid-shift, stopped under any menu or a slide
  const speed = open.length ? 0 : mode === 'shift' ? 1 : peeking ? breakdowns.consoleTimeScale : 0
  const meters = hud ? MACHINES.filter((id) => hud.machines[id].unlocked) : []
  // stand-in meters for the unlocked machines (F24; their real home is the parked HUD rethink): laser charge, visor
  // signal, controls heat (rises as it overheats). A row under the tank; a column beside it on a phone on its side.
  const meterBars = hud && meters.map((id) => {
    const m = hud.machines[id], level = id === 'controls' ? 1 - m.health : m.health
    return <Bar key={id} label={text.hud[id]} value={Math.round(level * 100)} showLabel
      variant={m.broken ? 'danger' : id === 'controls' ? (level > 0.7 ? 'danger' : 'accent') : level < 0.3 ? 'danger' : 'primary'} />
  })
  const quotaMet = hud && hud.cracksSealed >= hud.cracksNeeded
  const ruptured = hud?.phase === 'rupture'
  const statusText = !hud ? '' : ruptured ? text.hud.rupture
    : quotaMet ? fill(text.hud.cracksDone, { n: hud.cracksSealed, total: hud.cracksNeeded })
    : fill(text.hud.cracks, { n: hud.cracksSealed, total: hud.cracksNeeded })
  const pressureBar = hud && <Bar label={text.hud.pressure} value={Math.round(hud.pressure * 100)} variant={hud.pressure > 0.8 ? 'danger' : 'primary'} showLabel />
  const tankBar = hud && <Bar label={text.hud.integrity} value={Math.round(hud.integrity * 100)} variant={hud.integrity < 0.3 || ruptured ? 'danger' : 'accent'} showLabel />
  const status = <HudText tone={ruptured || quotaMet ? 'accent' : 'normal'}>{statusText}</HudText>

  // F26 "Meters (test)": where the tank sits and what the HUD shows around it
  //   top   = today: bars top-left, crack line top-centre, score top-right; machine meters under / beside the tank
  //   hug   = no top bars: tags on the tank (pressure % on its line, cracks · tank % · score under it — beside it on a
  //           phone on its side) + the tank's walls glowing with its integrity; machine meters stay where they are
  //   strip = pressure, tank, cracks + machine meters in one strip under the tank (a column beside it on a phone on its
  //           side); the score stays top-right beside the Console button
  const m = layout.meters
  const reserveTop = m === 'top' ? HUD_RESERVE : m === 'hug' && short ? HUG_SHORT_TOP : TOP_ROW_RESERVE
  const reserveBottom = m === 'top' ? (meters.length && !short ? METERS_RESERVE : undefined)
    : m === 'hug' ? (short ? undefined : TAGS_RESERVE + (meters.length ? METERS_RESERVE : 0))
    : short ? undefined : STRIP_RESERVE + (meters.length ? STRIP_ROW : 0)
  const sideRoom = !short ? undefined : m === 'strip' ? STRIP_SIDE_ROOM : meters.length ? METERS_SIDE_ROOM : m === 'hug' ? HUG_SHORT_SIDE_ROOM : undefined
  const tags = m === 'hug' && hud ? {
    pressure: <HudText size="s" live tone={hud.pressure > 0.8 ? 'accent' : 'normal'}>{fill(text.hud.pressureTag, { n: Math.round(hud.pressure * 100) })}</HudText>,
    cracks: <HudText size="s" tone={ruptured || quotaMet ? 'accent' : 'normal'}>{statusText}</HudText>,
    tank: <HudText size="s" live tone={hud.integrity < 0.3 || ruptured ? 'accent' : 'normal'}>{fill(text.hud.tankTag, { n: Math.round(hud.integrity * 100) })}</HudText>,
    score: <HudText size="s" live>{fill(text.hud.scoreTag, { n: hud.score })}</HudText>,
  } : undefined
  // the strip: the shift's meters in a row, then the machines' row; a column on a phone on its side. Its crack line is
  // small text (the bars' label size), so pressure · tank · cracks stay on ONE row even on a 360 px phone
  const stripStatus = <HudText size="s" tone={ruptured || quotaMet ? 'accent' : 'normal'}>{statusText}</HudText>
  const strip = m === 'strip' && hud ? (short
    ? <Stack gap="xs">{pressureBar}{tankBar}{stripStatus}{meterBars}</Stack>
    : <Stack gap="s"><Row gap="s">{pressureBar}{tankBar}{stripStatus}</Row>{meters.length > 0 && <Row gap="s">{meterBars}</Row>}</Stack>) : undefined
  const machinesRow = meters.length && !short ? <Row gap="s">{meterBars}</Row> : undefined
  const machinesColumn = meters.length && short ? <Stack gap="xs">{meterBars}</Stack> : undefined
  return (
    <>
      {engine && mode !== 'console' && (
        <ShiftStage engine={engine} speed={speed} inputOn={mode === 'shift' && !open.length} reserveTop={reserveTop}
          reserveBottom={reserveBottom} hudSideRoom={sideRoom} rim={m === 'hug'} pins={tags} pinLayout={short ? 'column' : 'row'}
          messagesAtStack={layout.messages === 'stack'} messagesClearTop={m === 'top' ? HUD_RESERVE : TOP_ROW_RESERVE}
          onHud={setHud} onEnd={onEnd} onMessage={onMessage} onConsole={peekIn} />
      )}
      {mode === 'shift' && (
        <ScreenStack overlay screens={screenMap}>
          {hud && (
            <Hud words={{ pause: text.hud.pause }} onPause={() => screens.push('pause')}
              vitals={m === 'top' ? <Stack gap="s">{pressureBar}{tankBar}</Stack> : undefined}
              status={m === 'top' ? status : undefined}
              currency={m === 'hug' ? undefined : <Score value={hud.score} />}
              banner={hud.holdProgress !== null ? <Bar label={text.hud.swap} value={Math.round(hud.holdProgress * 100)} variant="accent" width="s" /> : undefined}
              actions={m === 'strip' && !short ? strip : machinesRow}
              bottomLeft={m === 'strip' && short ? strip : machinesColumn} />
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
      <ToastStack place={layout.messages === 'stack' ? 'at' : 'center'} variant="plain" /* words, not button-like plates (Muzzy 2026-10-18) */ />
    </>
  )
}
