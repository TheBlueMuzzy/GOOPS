// SOUND — the game's one audio engine (the framework Audio module in src/audio/), made once at start-up (main.tsx).
// Code never names a file: it says WHAT happened — playGameSound(SOUNDS.land) — and content/audio.json says what that
// sounds like (files, loudness, variation, volume group, how often it may repeat). Which moment gets which sound:
// shiftSounds.ts (the tank's events, from ShiftStage's frame loop), the console (periscope, repair steps) and the UI kit's
// own controls (ui.tap / ui.back / ui.toggle.on / ui.toggle.off, through setControlSound).
// ON THE RULES CLOCK: a game moment asked for while the rules clock stands still (a menu, either Dev Kit pause) is not
// played — and the Dev Kit's full pause also mutes the engine, so a tap on the Dev Kit can't wake a frozen sound.
// Settings → Audio (content/ui/settings.json, the UI kit's standard ids) drives the volume groups: at start here, then
// live from the Settings screen (App.tsx). Dev + Playwright: window.__audioLog (every play and drop, with why).
import audioJson from '../../content/audio.json'
import { applyAudioSettings, createAudio, exposeLog, getAudio, playSound, seededRandom, setAudio, type PlayOptions } from '../audio'
import type { ShiftEvent } from '../engine'
import { clockPause, onClockPause, rulesClock } from '../devkit/gameClock'
import { onTuning } from '../devkit/tuning/liveTuning'
import { setControlSound, type SettingsValues } from '../ui/kit'
import { shiftSounds, type SoundId } from './shiftSounds'

let settingsNow: SettingsValues = {}

/** Make the engine (once). Nothing plays until the player's first tap — the engine unlocks itself then. */
export function startSound(settings: SettingsValues) {
  if (getAudio()) return
  const audio = createAudio(audioJson, {
    baseUrl: import.meta.env.BASE_URL, // (the game lives under /GOOPS/)
    // its OWN dice for variants and random pitch: a sound never uses up the game's Math.random
    rng: seededRandom(Date.now() >>> 0),
    logSize: 1000, // a whole shift's worth, for e2e/sound.mjs
  })
  setAudio(audio)
  settingsNow = settings
  applyAudioSettings(audio, settings)
  setControlSound((kind) => playUiSound(`ui.${kind}` as SoundId)) // ui.tap · ui.back · ui.toggle.on · ui.toggle.off
  if (import.meta.env.DEV || navigator.webdriver) exposeLog(audio) // e2e tests read it; the console too
  onTuning('audio', (data) => audio.setConfig(data)) // a Dev Kit edit of content/audio.json applies at once
  // the Dev Kit's full pause: silent until it lets go (then the player's own Sound setting again)
  onClockPause((mode) => {
    if (mode === 'full') audio.setMuted(true)
    else applyAudioSettings(audio, settingsNow)
  })
}

/** The Settings screen changed: the volume groups, Sound on/off, mono… follow at once. */
export function soundSettingsChanged(values: SettingsValues) {
  settingsNow = values
  const audio = getAudio()
  if (audio && clockPause() !== 'full') applyAudioSettings(audio, values)
}

/** A moment in the shift (the tank, the machines): only while the rules clock runs. */
export function playGameSound(id: SoundId, options?: PlayOptions) {
  if (rulesClock.rate <= 0) return null
  return playSound(id, options)
}

/** The console and the menus: they work while the game is paused, but not under a Dev Kit pause. */
export function playUiSound(id: SoundId) {
  if (clockPause()) return null
  return playSound(id)
}

/** One frame's engine events (ShiftStage's frame loop) → their sounds. */
export function playShiftSounds(events: readonly ShiftEvent[]) {
  for (const cue of shiftSounds(events)) playGameSound(cue.id, cue.pitch !== undefined ? { pitch: cue.pitch, volumeDb: cue.volumeDb } : undefined)
}
