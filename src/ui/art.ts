// Muzzy's art for the screens (F19, F21): content/ui/art.json says which picture goes where; the files are in public/art/.
// Paths in the JSON are relative, so they work both on the dev server and on the published site (/GOOPS/).
import type { ArtRect, ButtonArt, PanelFrame } from './kit'
import artJson from '../../content/ui/art.json'

const url = (path: string) => `${import.meta.env.BASE_URL}${path}`
const button = (b: ButtonArt): ButtonArt => ({ ...b, up: url(b.up), down: b.down && url(b.down) })
const rect = (r: number[]) => r as ArtRect
const words = (w: { at: number[]; text: number }) => ({ at: rect(w.at), text: w.text })

const end = artJson.end, scene = artJson.console
const layer = (l: { file: string; at: number[] }) => ({ src: url(l.file), at: rect(l.at) })
export const art = {
  end: {
    frame: { ...end.frame, src: url(end.frame.src) } as PanelFrame,
    again: button(end.again as ButtonArt),
    quit: button(end.quit as ButtonArt),
  },
  // the console (main menu): layers cut from the mock-up, placed in its own units (kit ArtStage)
  console: {
    size: scene.size as [number, number],
    view: rect(scene.view),
    viewShort: rect(scene.viewShort),
    backdrop: url(scene.backdrop),
    title: url(scene.title),
    settings: button(scene.settings as ButtonArt),
    body: layer(scene.layers.body),
    meter: layer(scene.layers.meter),
    laser: layer(scene.layers.laser),
    controls: layer(scene.layers.controls),
    lights: layer(scene.layers.lights),
    monitor: layer(scene.layers.monitor),
    periscope: { ...layer(scene.layers.periscope), travel: scene.layers.periscope.travel, grip: scene.layers.periscope.grip },
    // the meter's words + bar sit over its art; the bar picture's shape = width / height
    meterText: scene.meterText,
    meterFill: { fill: url(scene.meterFill.file), ratio: scene.meterFill.at[2] / scene.meterFill.at[3] },
    words: {
      hint: words(scene.words.hint), laser: words(scene.words.laser), controls: words(scene.words.controls),
      lights: words(scene.words.lights), version: words(scene.words.version), credit: words(scene.words.credit),
    },
  },
}
