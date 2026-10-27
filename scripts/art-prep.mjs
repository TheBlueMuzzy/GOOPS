// ART PREP — turns Muzzy's art/ SVGs into the files the game serves from public/art/ (F19).
// art/ stays the source: re-run this after Muzzy changes a file there.   Run: node scripts/art-prep.mjs
//   - copied as they are: the background and the coloured buttons (up + down)
//   - Title.svg: its words are turned into shapes, so the logo looks right without shipping the font
//     (a picture can't load fonts — it would fall back to a plain system font)
//   - EndGameFrame.svg: EndGameScreen.svg with only the monitor frame kept (the mock-up's words, meter, stat boxes and
//     arrow removed — the game writes the real report inside), plus width/height so the kit can cut it nine ways
//   - Console*.svg (F21): the console's layers cut out of Muzzy's mock-up Example1.svg — each named group (Monitor,
//     Periscope, Reset_Laser…) in its own file, cropped to the box in content/ui/art.json `console.layers` (the same
//     box the game places it at, so they line up exactly as he drew them). Their words are taken out (the game writes
//     them in the kit's style: the fonts can't ship), and so are the bits that would do nothing or show fake numbers
//     (the meter's fill, the trash can of WIPE SAVE DATA). ConsoleMeterFill.svg = the meter's full green bar, which
//     the game reveals as XP comes in.
// Which file goes where on screen: content/ui/art.json. Full sort of art/: .planning/research/art-map.md
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import opentype from 'opentype.js'

const OUT = 'public/art'
mkdirSync(OUT, { recursive: true })

// (F24: the repair panels' moving parts — lamps, the slider knob, the dial, the third arcade button — drawn by the game
// over the panels, which art-prep strips of the same parts; see console.repairs in art.json)
for (const file of ['Background.svg', 'Btn_Green-Up.svg', 'Btn_Green-Down.svg', 'Btn_Blue-Up.svg', 'Btn_Blue-Down.svg', 'Btn_Settings.svg',
  'Btn_Purple-up.svg', 'Btn_Purple-Down.svg', 'Light-On.svg', 'Light-Off.svg', 'SliderHandle.svg', 'Dial.svg']) {
  copyFileSync(`art/${file}`, `${OUT}/${file}`)
}

// Title: every <tspan> letter drawn as a path at its own x, in the From Where You Are font
{
  const svg = readFileSync('art/Title.svg', 'utf8')
  const font = opentype.loadSync('fonts/FromWhereYouAre-4Y86.ttf')
  const size = Number(svg.match(/font-size:\s*([\d.]+)px/)[1])
  const fill = svg.match(/\.cls-1\s*\{[^}]*fill:\s*(#[0-9a-f]+)/i)[1]
  const [, tx, ty] = svg.match(/<text[^>]*transform="translate\(([\d.]+) ([\d.]+)\)"/)
  const letters = [...svg.matchAll(/<tspan[^>]*x="([\d.]+)"[^>]*>([^<]+)<\/tspan>/g)]
  const d = letters.map(([, x, ch]) => font.getPath(ch, Number(x), 0, size).toPathData(2)).join('')
  const viewBox = svg.match(/viewBox="([^"]+)"/)[1]
  writeFileSync(`${OUT}/Title.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">
  <!-- made by scripts/art-prep.mjs from art/Title.svg (words turned into shapes) -->
  <path transform="translate(${tx} ${ty})" fill="${fill}" d="${d}"/>
</svg>
`)
  console.log(`Title.svg: ${letters.length} letters outlined`)
}

// End-game frame: the outer case, the orange top, the screen's rim and the dark screen — everything after is mock-up
{
  const svg = readFileSync('art/EndGameScreen.svg', 'utf8')
  const screenRect = svg.match(/\s*<rect class="cls-32"[^>]*\/>/)
  if (!screenRect) throw new Error('EndGameScreen.svg: the dark screen (rect.cls-32) is missing — check the file')
  const [, , , w, h] = svg.match(/viewBox="(([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+))"/).slice(1).map(Number)
  const frame = svg.slice(0, screenRect.index + screenRect[0].length)
    .replace(/<svg ([^>]*)>/, `<svg $1 width="${w}" height="${h}">`)
    .replace(/<\?xml[^>]*>\s*/, '')
  writeFileSync(`${OUT}/EndGameFrame.svg`, `${frame}\n  </g>\n</svg>\n`)
  console.log(`EndGameFrame.svg: ${w} × ${h}`)

  // F65 the end-game screen (after the ending): the whole mock-up — frame, rank meter, the four stat boxes — with its
  // words taken out (the game writes the real ones: content/ui/art.json endGame.words) and the swipe arrow (a button sits
  // there instead). The meter's fill runs the whole track: the career ends at the top rank.
  const words = [...svg.matchAll(/<text[\s\S]*?<\/text>/g)].length
  const arrow = /\s*<path class="cls-18" d="M268\.4,808\.13[^>]*\/>/
  if (!arrow.test(svg) || !/id="Meter_Fill"[^>]*h366\.31/.test(svg)) throw new Error('EndGameScreen.svg: the swipe arrow or the meter fill moved — check the file')
  const screen = svg
    .replace(/<svg ([^>]*)>/, `<svg $1 width="${w}" height="${h}">`)
    .replace(/<\?xml[^>]*>\s*/, '')
    .replace(/\s*<text[\s\S]*?<\/text>/g, '')
    .replace(arrow, '')
    .replace(/<path id="Meter_Fill"([^>]*?) d="[^"]*"\/>/, '<rect id="Meter_Fill"$1 x="49.07" y="223.09" width="486.02" height="19.77" rx="9.885"/>')
  writeFileSync(`${OUT}/EndGameScreen.svg`, screen)
  console.log(`EndGameScreen.svg: ${words} words + the arrow taken out, the meter full`)
}

// The console (F21): layers cut out of the mock-up, each cropped to its box in art.json
{
  const { console: scene } = JSON.parse(readFileSync('content/ui/art.json', 'utf8'))
  const svg = readFileSync(scene.source, 'utf8')
  const defs = svg.match(/<defs>[\s\S]*?<\/defs>/)[0] // the colour classes every group uses
  const out = (file, [x, y, w, h], body) => writeFileSync(`public/${file}`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${w}" height="${h}">
  <!-- made by scripts/art-prep.mjs from ${scene.source} -->
  ${defs}
${body}
</svg>
`)
  for (const [name, layer] of Object.entries(scene.layers)) {
    let body = layer.groups.map((id) => element(svg, id)).join('\n')
    for (const id of layer.strip ?? []) body = body.replace(element(body, id), '')
    // stripClasses: single shapes of these colour classes (a repair panel's knobs, dial face and lamps: the game draws them)
    for (const cls of layer.stripClasses ?? []) body = body.replace(new RegExp(`\\s*<\\w+ class="${cls}"[^>]*/>`, 'g'), '')
    body = body.replace(/<text[\s\S]*?<\/text>/g, '') // words: the game writes them
    out(layer.file, layer.at, body)
    console.log(`${layer.file}: ${name} (${layer.groups.join(' + ')})`)
  }
  // F32: the visor slider's track (its shapes, by colour class, out of the lights panel — which strips them), in a file
  // of its own, so the game can place it higher than the mock-up had it (Muzzy: its bottom lamp overlapped the track)
  {
    const track = scene.repairs.visor.track, panel = element(svg, 'Reset_Lights')
    const shapes = track.classes.map((cls) => {
      const shape = panel.match(new RegExp(`<\\w+ class="${cls}"[^>]*/>`))
      if (!shape) throw new Error(`art: no ${cls} shape in Reset_Lights — was the visor track redrawn?`)
      return `  ${shape[0]}`
    })
    out(track.file, track.from, shapes.join('\n'))
    console.log(`${track.file}: the visor slider's track (${track.classes.join(' + ')})`)
  }
  // the meter's bar, full: a rounded strip in the meter's green, revealed left to right by the game
  const fill = scene.meterFill, [, , w, h] = fill.at
  const green = svg.match(new RegExp(`\\.${fill.colourOf}\\b[^{]*\\{[^}]*fill:\\s*(#[0-9a-f]+)`, 'i'))[1]
  out(fill.file, fill.at, `  <rect x="${fill.at[0]}" y="${fill.at[1]}" width="${w}" height="${h}" rx="${h / 2}" fill="${green}"/>`)
  console.log(`${fill.file}: the meter's full bar (${green})`)
}
console.log(`art → ${OUT}/`)

// One element by its id, with everything inside it: a <g id="…"> … </g> (nested groups counted), or a single tag.
function element(svg, id) {
  const start = svg.search(new RegExp(`<\\w+[^>]*\\sid="${id}"`))
  if (start < 0) throw new Error(`art: no element with id="${id}" — was it renamed in the art file?`)
  const open = svg.slice(start).match(/^<(\w+)[^>]*?(\/?)>/)
  if (open[2] === '/') return open[0]
  const tag = open[1], pattern = new RegExp(`<${tag}\\b[^>]*?(/?)>|</${tag}>`, 'g')
  pattern.lastIndex = start
  let depth = 0
  for (let m; (m = pattern.exec(svg));) {
    if (m[0].startsWith('</')) depth--
    else if (m[1] !== '/') depth++
    if (depth === 0) return svg.slice(start, m.index + m[0].length)
  }
  throw new Error(`art: <${tag} id="${id}"> never closes`)
}
