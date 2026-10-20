// "TURN YOUR PHONE UPRIGHT" (F32, Muzzy: portrait only — src/ui/portrait.ts): a touch phone held sideways sees this
// card over the whole game; it catches every tap (the kit's overlay, above everything) while App pauses the shift.
import type { CSSProperties } from 'react'
import { EmptyState, Panel, Screen } from './kit'
import { art } from './art'
import text from '../../content/text/en.json'

export function UprightScreen() {
  const t = text.upright
  return (
    <div className="kit-overlay" data-open data-upright role="alertdialog" aria-modal aria-label={t.label} style={{ '--kit-overlay-z': 2147482000 } as CSSProperties}>
      <Screen label={t.label} backdrop={art.console.backdrop}>
        <Panel><EmptyState title={t.title} message={t.message} /></Panel>
      </Screen>
    </div>
  )
}
