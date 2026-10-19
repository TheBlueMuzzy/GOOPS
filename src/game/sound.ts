// SOUND — the game's one audio engine (the framework Audio module in src/audio/), made once at start-up (main.tsx).
// Code never names a file: it says WHAT happened — playSound('goop.land') — and content/audio.json says what that
// sounds like (files, loudness, variation, volume group, how often it may repeat).
// Settings → Audio (content/ui/settings.json, the UI kit's standard ids) drives the volume groups: at start here, then
// live from the Settings screen (App.tsx). The kit's buttons, sliders and switches play ui.tap / ui.back /
// ui.toggle.on / ui.toggle.off (UI kit setControlSound). Dev + Playwright: window.__audioLog (every play and drop, with why).
import audioJson from '../../content/audio.json'
import { applyAudioSettings, createAudio, exposeLog, getAudio, seededRandom, setAudio } from '../audio'
import { onTuning } from '../devkit/tuning/liveTuning'
import { setControlSound, type SettingsValues } from '../ui/kit'

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
  applyAudioSettings(audio, settings)
  setControlSound((kind) => audio.play(`ui.${kind}`)) // ui.tap · ui.back · ui.toggle.on · ui.toggle.off
  if (import.meta.env.DEV || navigator.webdriver) exposeLog(audio) // e2e tests read it; the console too
  onTuning('audio', (data) => audio.setConfig(data)) // a Dev Kit edit of content/audio.json applies at once
}

/** The Settings screen changed: the volume groups, Sound on/off, mono… follow at once. */
export function soundSettingsChanged(values: SettingsValues) {
  const audio = getAudio()
  if (audio) applyAudioSettings(audio, values)
}
