import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { applyAccessibility, applyStyle, loadSettings, type SettingsSchema } from './ui/kit'
import { App } from './ui/App'
import style from '../content/ui/style.json'
import settings from '../content/ui/settings.json'
import './ui/app.css'

applyStyle(style)
applyAccessibility(loadSettings(settings as SettingsSchema))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
