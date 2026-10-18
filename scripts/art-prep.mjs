// ART PREP — turns Muzzy's art/ SVGs into the files the game serves from public/art/ (F19).
// art/ stays the source: re-run this after Muzzy changes a file there.   Run: node scripts/art-prep.mjs
//   - copied as they are: the background and the coloured buttons (up + down)
//   - Title.svg: its words are turned into shapes, so the logo looks right without shipping the font
//     (a picture can't load fonts — it would fall back to a plain system font)
//   - EndGameFrame.svg: EndGameScreen.svg with only the monitor frame kept (the mock-up's words, meter, stat boxes and
//     arrow removed — the game writes the real report inside), plus width/height so the kit can cut it nine ways
// Which file goes where on screen: content/ui/art.json. Full sort of art/: .planning/research/art-map.md
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import opentype from 'opentype.js'

const OUT = 'public/art'
mkdirSync(OUT, { recursive: true })

for (const file of ['Background.svg', 'Btn_Green-Up.svg', 'Btn_Green-Down.svg', 'Btn_Blue-Up.svg', 'Btn_Blue-Down.svg']) {
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
}
console.log(`art → ${OUT}/`)
