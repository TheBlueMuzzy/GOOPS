// Muzzy's art for the screens (F19, F21): content/ui/art.json says which picture goes where; the files are in public/art/.
// Paths in the JSON are relative, so they work both on the dev server and on the published site (/GOOPS/).
import type { ArtRect, ButtonArt, PanelFrame } from './kit'
import artJson from '../../content/ui/art.json'

const url = (path: string) => `${import.meta.env.BASE_URL}${path}`
const button = (b: ButtonArt): ButtonArt => ({ ...b, up: url(b.up), down: b.down && url(b.down) })
const rect = (r: number[]) => r as ArtRect
const words = (w: { at: number[]; text: number }) => ({ at: rect(w.at), text: w.text })

const end = artJson.end, scene = artJson.console, fix = scene.repairs
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
    crt: scene.crt, // F32: the monitor's screen as the lesson message (its colours and edges)
    monitorDrop: scene.monitorDrop, // F35: how much lower the monitor hangs at rest (0 while a lesson shows the periscope)
    periscope: { ...layer(scene.layers.periscope), travel: scene.layers.periscope.travel, grip: scene.layers.periscope.grip },
    // the meter's words + bar sit over its art; the bar picture's shape = width / height
    meterText: scene.meterText,
    meterFill: { fill: url(scene.meterFill.file), ratio: scene.meterFill.at[2] / scene.meterFill.at[3] },
    words: {
      hint: words(scene.words.hint), laser: words(scene.words.laser), controls: words(scene.words.controls),
      lights: words(scene.words.lights), version: words(scene.words.version), credit: words(scene.words.credit),
      rankSelect: words(scene.words.rankSelect), creditBeside: words(scene.words.creditBeside), // F70
    },
  },
  // the repair panels' moving parts (F24), drawn over the panels: lamps, slider knobs, the dial, the visor's buttons
  repairs: {
    viewShort: rect(fix.viewShort),
    lampOn: url(fix.lampOn),
    lampOff: url(fix.lampOff),
    knob: url(fix.knob),
    knobShare: fix.knobShare,
    laser: { sliders: fix.laser.sliders.map(rect), lamps: fix.laser.lamps.map((pair) => pair.map(rect)) },
    controls: { dial: url(fix.controls.dial.file), dialAt: rect(fix.controls.dial.at), lamps: fix.controls.lamps.map(rect), angles: fix.controls.angles },
    visor: {
      slider: rect(fix.visor.slider), track: url(fix.visor.track.file), topLamp: rect(fix.visor.topLamp), bottomLamp: rect(fix.visor.bottomLamp),
      buttons: fix.visor.buttons.map((b) => ({ art: button({ up: b.up, down: b.down, label: 'hidden', size: 'fill' }), at: rect(b.at), lamp: rect(b.lamp) })),
    },
  },
}
