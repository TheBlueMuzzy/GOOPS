// The game's screens. Console-lite (a plain menu) stands in for the real console-as-menu until that's designed.
import { useCallback, useMemo, useState } from 'react'
import { Bar, GameOver, Hud, HudText, MainMenu, Pause, Score, ScreenStack, Settings, Stack, ToastStack, Victory, screens, toast, useScreens } from './kit'
import type { SettingsSchema } from './kit'
import { createShift, type ShiftEngine, type ShiftStatus } from '../engine'
import { ShiftStage, type HudSnapshot } from '../game/ShiftStage'
import { gooStyle } from '../game/gooStyle'
import { wallKick } from '../game/wallKick'
import { art } from './art'
import shiftConfig from '../../content/tuning/shift.json'
import settingsJson from '../../content/ui/settings.json'
import text from '../../content/text/en.json'

const settings = settingsJson as SettingsSchema
const HUD_RESERVE = 76 // CSS px kept free above the tank for the HUD
const fill = (s: string, vars: Record<string, number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))

// ?seed=123 fixes the shift's random pieces (tests); otherwise every shift is new.
function newEngine(): ShiftEngine {
  const fixed = Number(new URLSearchParams(location.search).get('seed'))
  const seed = fixed || Math.floor(Math.random() * 1e9)
  return createShift(shiftConfig, { seed, rank: 1, wallKick: wallKick.get() })
}

const SettingsScreen = () => (
  <Settings schema={settings} onChange={(values) => { gooStyle.setFromSetting(values.gooStyle); wallKick.setFromSetting(values.wallKick) }} />
)
const onAlert = (kind: 'quotaMet' | 'rupture') =>
  kind === 'quotaMet' ? toast(text.hud.quotaMetToast) : toast(text.hud.ruptureToast, { variant: 'danger', seconds: 4 })

export function App() {
  const [engine, setEngine] = useState<ShiftEngine | null>(null)
  const [hud, setHud] = useState<HudSnapshot | null>(null)
  const [result, setResult] = useState<{ status: ShiftStatus; score: number; sealed: number; needed: number } | null>(null)
  const open = useScreens()

  const start = useCallback(() => { setResult(null); setHud(null); setEngine(newEngine()) }, [])
  const toMenu = useCallback(() => { while (screens.current.length) screens.pop(); setEngine(null); setResult(null) }, [])
  const onEnd = useCallback((status: ShiftStatus) => {
    setEngine((e) => {
      if (e) setResult({ status, score: e.state.score, sealed: e.state.cracksSealed, needed: e.state.cracksNeeded })
      return e
    })
    screens.push('end')
  }, [])

  const screenMap = useMemo(() => ({
    settings: SettingsScreen,
    pause: () => (
      <Pause words={text.pause} onSettings={() => screens.push('settings')} onQuit={toMenu} />
    ),
    end: () => result && (result.status === 'won'
      ? <Victory words={{ title: text.end.wonTitle, continue: text.end.again }} message={text.end.wonMessage}
          frame={art.end.frame} art={{ continue: art.end.again }}
          stats={[{ label: text.end.score, value: String(result.score) }, { label: text.end.cracks, value: `${result.sealed} / ${result.needed}` }]}
          onContinue={() => { screens.pop(); start() }} />
      : <GameOver words={{ title: text.end.lostTitle, retry: text.end.again, quit: text.end.quit }} message={text.end.lostMessage}
          frame={art.end.frame} art={{ retry: art.end.again, quit: art.end.quit }}
          stats={[{ label: text.end.score, value: String(result.score) }, { label: text.end.cracks, value: `${result.sealed} / ${result.needed}` }]}
          onRetry={() => { screens.pop(); start() }} onQuit={toMenu} />),
  }), [result, start, toMenu])

  if (!engine) {
    return (
      <ScreenStack screens={{ settings: SettingsScreen }}>
        <MainMenu title={text.menu.title} subtitle={text.menu.subtitle} titleArt={art.menu.title} backdrop={art.menu.backdrop}
          items={[{ label: text.menu.start, onClick: start, primary: true, art: art.menu.start },
            { label: text.menu.settings, onClick: () => screens.push('settings'), art: art.menu.settings }]} />
      </ScreenStack>
    )
  }

  const quotaMet = hud && hud.cracksSealed >= hud.cracksNeeded
  const ruptured = hud?.phase === 'rupture'
  const statusText = !hud ? '' : ruptured ? text.hud.rupture
    : quotaMet ? fill(text.hud.cracksDone, { n: hud.cracksSealed, total: hud.cracksNeeded })
    : fill(text.hud.cracks, { n: hud.cracksSealed, total: hud.cracksNeeded })
  return (
    <>
      <ShiftStage engine={engine} paused={open.length > 0} reserveTop={HUD_RESERVE} onHud={setHud} onEnd={onEnd} onAlert={onAlert}
        onConsole={() => { if (!screens.current.length) screens.push('pause') }} />
      <ScreenStack overlay screens={screenMap}>
        {hud && (
          <Hud words={{ pause: text.hud.pause }} onPause={() => screens.push('pause')}
            vitals={(
              <Stack gap="s">
                <Bar label={text.hud.pressure} value={Math.round(hud.pressure * 100)} variant={hud.pressure > 0.8 ? 'danger' : 'primary'} width="s" />
                <Bar label={text.hud.integrity} value={Math.round(hud.integrity * 100)} variant={hud.integrity < 0.3 || ruptured ? 'danger' : 'accent'} width="s" />
              </Stack>
            )}
            status={<HudText tone={ruptured || quotaMet ? 'accent' : 'normal'}>{statusText}</HudText>}
            currency={<Score value={hud.score} />}
            banner={hud.holdProgress !== null ? <Bar label={text.hud.swap} value={Math.round(hud.holdProgress * 100)} variant="accent" width="s" /> : undefined} />
        )}
      </ScreenStack>
      <ToastStack place="center" />
    </>
  )
}
