// F71: the offline copy leaves out the UI kit's own fonts (vite.config.ts globIgnores 'assets/*.woff2'), because
// every text role uses one of the game's own fonts (content/ui/fonts.json, public/fonts). If a role ever names a
// kit font (the Dev Kit's Fonts tab can pick one), this goes red: drop that ignore so the font works offline.
import { describe, expect, it } from 'vitest'
import style from '../content/ui/style.json'
import fontsJson from '../content/ui/fonts.json'

const ROLES = ['font-title', 'font-heading', 'font-body', 'font-numbers'] as const
const gameFonts = fontsJson.fonts.map((f) => f.name)

/** The first font a CSS value names: "'Nokia Cellphone FC', system-ui, sans-serif" → "Nokia Cellphone FC". */
const firstFont = (value: string) => value.split(',')[0].trim().replace(/^['"]|['"]$/g, '')

describe('offline fonts', () => {
  const tweaks = style.tweaks as Record<string, string | undefined>
  for (const role of ROLES) {
    it(`${role} uses one of the game's own fonts (so the kit's can stay out of the offline copy)`, () => {
      const value = tweaks[role]
      expect(value, `${role} isn't set in style.json, so the kit preset's font (a kit font) is used`).toBeDefined()
      expect(gameFonts).toContain(firstFont(value!))
    })
  }
})
