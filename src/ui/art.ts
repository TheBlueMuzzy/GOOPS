// Muzzy's art for the screens (F19): content/ui/art.json says which picture goes where; the files are in public/art/.
// Paths in the JSON are relative, so they work both on the dev server and on the published site (/GOOPS/).
import type { ButtonArt, PanelFrame } from './kit'
import artJson from '../../content/ui/art.json'

const url = (path: string) => `${import.meta.env.BASE_URL}${path}`
const button = (b: ButtonArt): ButtonArt => ({ ...b, up: url(b.up), down: b.down && url(b.down) })

const menu = artJson.menu, end = artJson.end
export const art = {
  menu: {
    backdrop: url(menu.backdrop),
    title: url(menu.title),
    start: button(menu.start as ButtonArt),
    settings: button(menu.settings as ButtonArt),
  },
  end: {
    frame: { ...end.frame, src: url(end.frame.src) } as PanelFrame,
    again: button(end.again as ButtonArt),
    quit: button(end.quit as ButtonArt),
  },
}
