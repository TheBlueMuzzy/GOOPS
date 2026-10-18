// F26 test layouts: where the meters sit and where messages show, from two Settings rows so Muzzy can try (and mix)
// them in the real game. Read live: changing a row mid-shift moves the HUD straight away.
//   "Meters (test)"   (metersTest):   Top (today) · Hug the tank · Bottom strip
//   "Messages (test)" (messagesTest): Centre (today) · At the stack
// The pick gets built for real in F26 task 4; these rows go then.
import { loadSettings } from '../ui/kit'
import settings from '../../content/ui/settings.json'

export type MetersLayout = 'top' | 'hug' | 'strip'
export type MessagesLayout = 'centre' | 'stack'
export interface HudLayout { meters: MetersLayout; messages: MessagesLayout }

const toMeters = (v: unknown): MetersLayout => (v === 'Hug the tank' ? 'hug' : v === 'Bottom strip' ? 'strip' : 'top')
const toMessages = (v: unknown): MessagesLayout => (v === 'At the stack' ? 'stack' : 'centre')

const listeners = new Set<() => void>()
const saved = loadSettings(settings)
let current: HudLayout = { meters: toMeters(saved.metersTest), messages: toMessages(saved.messagesTest) }

export const hudLayout = {
  get: () => current, // the same object until something changes (useSyncExternalStore needs that)
  setFromSettings(values: Record<string, unknown>) {
    const next = { meters: toMeters(values.metersTest), messages: toMessages(values.messagesTest) }
    if (next.meters === current.meters && next.messages === current.messages) return
    current = next
    listeners.forEach((l) => l())
  },
  subscribe(l: () => void) {
    listeners.add(l)
    return () => { listeners.delete(l) }
  },
}
