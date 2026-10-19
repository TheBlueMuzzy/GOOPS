import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { applyAccessibility, applyStyle, loadGameFonts, loadSettings, type SettingsSchema } from './ui/kit'
import { App } from './ui/App'
import style from '../content/ui/style.json'
import fonts from '../content/ui/fonts.json'
import settings from '../content/ui/settings.json'
import { startSound } from './game/sound'
import './ui/app.css'

// The game's own fonts (public/fonts/, listed in content/ui/fonts.json) — style.json's font tweaks may name them
loadGameFonts(fonts, import.meta.env.BASE_URL)
applyStyle(style)
const saved = loadSettings(settings as SettingsSchema)
applyAccessibility(saved)
startSound(saved) // the audio engine (src/game/sound.ts); it unlocks itself on the first tap

// Dev Kit (` key or triple-tap) — always in local dev; in release builds only while content/devkit.json
// "inReleaseBuilds" is true (until 1.0). When both are false this import is dead code and never ships.
// A release build loads it only once the first screen is up and the phone is idle (so it's not in the first download).
if (import.meta.env.DEV) {
  import('./devkit/mount').then((m) => m.mountDevKit())
} else if (__DEVKIT_IN_RELEASE__) {
  const mount = () => import('./devkit/mount').then((m) => m.mountDevKit())
  const whenIdle = () => ('requestIdleCallback' in window ? requestIdleCallback(mount, { timeout: 3000 }) : setTimeout(mount, 1000))
  if (document.readyState === 'complete') whenIdle()
  else addEventListener('load', whenIdle, { once: true })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
