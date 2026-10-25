// UI PROBLEMS ON A REAL PAGE — one function that runs IN the browser (page.evaluate(findProblems, options)) and lists
// what's wrong with what's on screen right now, each as one plain line starting with its kind:
//   "wider:"   the page is wider than the screen (a phone quietly zooms out to fit it)
//   "small:"   a control smaller than 44×44 px (a fingertip misses it)
//   "clipped:" a control cut off at the edge of a box that hides overflow (its outline / shadow too) or past the
//              screen edge (and not in something that scrolls), or text cut off
//   "overlap:" two things on screen sit on top of each other (text over text, a control over text…) — new in 0.18.0;
//              and a solid chip, badge or panel slid part-way onto a bar, meter or picture — 0.33.1 — or onto
//              another card's words — 0.33.2
//   "focus:"   a focus ring showing although nobody used the keyboard
//   "faint:"   text too faint to read against what's behind it: under 4.5:1, or 3:1 for big text (24 px, or 18.66 px
//              bold) — the WCAG AA line. Skipped where it can't be judged: text over a picture, gradient, canvas or
//              video, text with an outline or shadow (Cartoon ink, Neon glow), and disabled controls. — 0.21.0
//   "edge:"    something in a drawn box (a card, chip, badge, button: a border, shadow or its own background) closer than
//              2 px to the box's inside edge — text, an icon, a picture, an avatar or a badge. Things meant to run edge
//              to edge (a cover picture, a divider) carry data-ui-bleed; things in a scroll area, hanging outside the
//              box or moving right now (a "+4" floating away) are skipped. Words are measured by their ink. — 0.21.0
//   "grows:"   a card that grew after it first appeared (noted by the kit's useFixedSize, fixedSize.ts) — 0.21.0
// Used by the gallery's screenshots (scripts/shoot.mjs) and by a game's npm run check:framework (conformance.mjs).
// Skipped: the Dev Kit (#devkit-root), anything hidden, inert or aria-hidden, anything inside [data-ui-check="skip"]
// (a game's on-purpose overlap, e.g. a title drawn over its own shadow copy), and things covered by something else
// (a dialog over the HUD: the HUD underneath isn't "overlapping" it).
// Self-contained on purpose: page.evaluate sends the function's text to the page, so it can't use imports.
export function findProblems({ screenWidth = innerWidth, checkFocus = true } = {}) {
  const problems = []
  const SKIP = '#devkit-root, [data-ui-check="skip"], [inert], [aria-hidden="true"]'
  const name = (el) => (el.getAttribute('aria-label') ?? el.getAttribute('alt') ?? el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 30) || `<${el.tagName.toLowerCase()}>`
  // The part of an element you can actually see: its box cut by every ancestor that hides overflow (a scroll area, a
  // panel) and by the screen — null when nothing of it shows (a row scrolled out of its list)
  const visibleBox = (el) => {
    const b = el.getBoundingClientRect()
    let left = b.left, top = b.top, right = b.right, bottom = b.bottom
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const s = getComputedStyle(p)
      if (s.overflowX === 'visible' && s.overflowY === 'visible') continue
      const c = p.getBoundingClientRect()
      if (s.overflowX !== 'visible') { left = Math.max(left, c.left); right = Math.min(right, c.right) }
      if (s.overflowY !== 'visible') { top = Math.max(top, c.top); bottom = Math.min(bottom, c.bottom) }
    }
    left = Math.max(left, 0); top = Math.max(top, 0); right = Math.min(right, innerWidth); bottom = Math.min(bottom, innerHeight)
    return right - left > 0.5 && bottom - top > 0.5 ? { left, top, right, bottom } : null
  }
  const shown = (el, { onScreen = true } = {}) => {
    if (el.closest(SKIP)) return false
    const box = el.getBoundingClientRect()
    if (box.width <= 2 || box.height <= 2) return false // hidden, or "for screen readers only" (1×1, clipped away)
    if (onScreen && !visibleBox(el)) return false // off the screen, or scrolled out of its box
    let opacity = 1
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const s = getComputedStyle(e)
      if (s.visibility === 'hidden' || s.display === 'none') return false
      opacity *= Number(s.opacity)
    }
    return opacity > 0.05
  }

  if (document.documentElement.scrollWidth > screenWidth) {
    problems.push(`wider: the page is wider than the screen (${document.documentElement.scrollWidth} > ${screenWidth})`)
  }
  const allControls = [...document.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [role="switch"], [role="tab"], [role="slider"], [tabindex="0"]')]
  // A control past the screen's edge (part or all of it) can't be pressed — unless it sits in something that scrolls
  for (const el of allControls.filter((e) => shown(e, { onScreen: false }))) {
    const box = el.getBoundingClientRect()
    const pageScrolls = document.documentElement.scrollHeight > innerHeight + 1 // a long page: below the fold is fine
    const outSideways = box.left < -0.5 || box.right > innerWidth + 0.5
    const outUpDown = !pageScrolls && (box.top < -0.5 || box.bottom > innerHeight + 0.5)
    if (!outSideways && !outUpDown) continue
    let scrolls = false
    for (let p = el.parentElement; p && p !== document.documentElement && !scrolls; p = p.parentElement) {
      const s = getComputedStyle(p)
      scrolls = /(auto|scroll)/.test(s.overflowX + s.overflowY) && (p.scrollHeight > p.clientHeight + 1 || p.scrollWidth > p.clientWidth + 1)
    }
    if (!scrolls) problems.push(`clipped: "${name(el)}" is past the edge of the screen`)
  }
  const controls = allControls.filter((e) => shown(e))
  for (const el of controls) {
    const box = el.getBoundingClientRect()
    if (box.width < 43.5 || box.height < 43.5) problems.push(`small: ${Math.round(box.width)}×${Math.round(box.height)} px — "${name(el)}"`)
    // Clipped inside a box: a scroll area or panel that hides overflow cuts off outlines and drop shadows drawn just
    // outside a control (Cartoon's ink). Controls need a little room from the box's left/right edge.
    for (let clip = el.parentElement; clip && clip !== document.body; clip = clip.parentElement) {
      if (getComputedStyle(clip).overflowX === 'visible') continue
      const edge = clip.getBoundingClientRect()
      const room = 3 // px of clearance for an outline or shadow
      if (box.left < edge.left + room - 0.5 || box.right > edge.right - room + 0.5) problems.push(`clipped: "${name(el)}" at the edge of a box that hides overflow`)
      break // only the nearest clipping box matters
    }
  }

  // Text: elements holding words themselves (not only through children)
  const texts = [...document.querySelectorAll('body *')].filter((el) =>
    !['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(el.tagName) &&
    [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && shown(el))
  for (const el of texts) {
    const s = getComputedStyle(el)
    if ((s.overflowX === 'hidden' || s.overflowX === 'clip') && el.scrollWidth > el.clientWidth + 1) problems.push(`clipped: text cut off — "${name(el)}"`)
  }

  // Overlap: two shown things whose VISIBLE parts cross (each cut by the boxes that clip it) and neither holds the
  // other — and both really show at that point: going down from the top, both are reached before anything else that
  // paints (a dialog over the HUD, the scroll area's own background). What's on top is asked of the browser with every
  // element hit-testable for a moment (HUD words are often pointer-events: none, which elementsFromPoint looks through).
  const things = [...new Set([...controls, ...texts])]
  const crossing = (a, b) => {
    if (!a || !b) return null
    const left = Math.max(a.left, b.left), right = Math.min(a.right, b.right), top = Math.max(a.top, b.top), bottom = Math.min(a.bottom, b.bottom)
    return right - left > 2 && bottom - top > 2 ? { x: (left + right) / 2, y: (top + bottom) / 2 } : null
  }
  const paints = (el) => {
    if (['CANVAS', 'IMG', 'VIDEO', 'svg', 'INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return true
    const s = getComputedStyle(el)
    return s.backgroundColor !== 'rgba(0, 0, 0, 0)' || s.backgroundImage !== 'none' || [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
  }
  const part = (el, x) => el === x || x.contains(el) // x itself or something inside it

  // ---- colours (0.21.0) ----
  // A colour as [r, g, b, alpha] whatever way CSS wrote it (rgb(), color-mix(), oklch()…): the browser paints it on
  // one pixel and we read the pixel back.
  const pixel = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true })
  const colours = new Map()
  const rgba = (css) => {
    if (!colours.has(css)) {
      pixel.clearRect(0, 0, 1, 1)
      pixel.fillStyle = 'rgba(0, 0, 0, 0)'
      pixel.fillStyle = css
      pixel.fillRect(0, 0, 1, 1)
      const [r, g, b, a] = pixel.getImageData(0, 0, 1, 1).data
      colours.set(css, [r, g, b, a / 255])
    }
    return colours.get(css)
  }
  const seeThrough = (css) => rgba(css)[3] < 0.05
  // One colour laid over another (both [r, g, b, alpha]; the one under is solid) → the solid colour you see
  const over = (top, under) => [0, 1, 2].map((i) => top[i] * top[3] + under[i] * (1 - top[3])).concat(1)
  const light = ([r, g, b]) => { // WCAG relative luminance
    const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const contrast = (a, b) => { const [hi, lo] = [light(a), light(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05) }
  const pictureLike = (el) => ['IMG', 'CANVAS', 'VIDEO', 'svg', 'PICTURE'].includes(el.tagName) || getComputedStyle(el).backgroundImage !== 'none'

  // Faint text: the text's colour against everything painted behind it at the middle of its first line (going down from
  // the text: each background colour until a solid one; see-through ones mixed in; the page itself is white).
  // Fading by opacity counts on the text and its holders up to its background — a faded whole card (dim) fades its
  // background too, so it's left alone. Returns the plain-words problem, or '' (fine, or can't be judged).
  const faintText = (el) => {
    if (el.closest('svg, [disabled], [aria-disabled="true"]')) return ''
    const s = getComputedStyle(el)
    if (s.textShadow !== 'none' || parseFloat(s.webkitTextStrokeWidth) > 0) return '' // an outline or glow: can't judge
    const words = [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim())
    const range = document.createRange()
    range.selectNodeContents(words)
    const line = range.getClientRects()[0]
    if (!line) return ''
    const x = line.left + line.width / 2, y = line.top + line.height / 2
    if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return ''
    const layers = []
    let reached = false
    for (const below of document.elementsFromPoint(x, y)) {
      if (!reached) {
        if (below === el) reached = true
        else if (el.contains(below)) continue // a word inside the text (a <strong>)
        else if (paints(below)) return '' // something covers the text here
        else continue
      }
      if (pictureLike(below)) return ''
      const bg = rgba(getComputedStyle(below).backgroundColor)
      if (bg[3] > 0.01) layers.push(bg)
      if (bg[3] > 0.99) break
    }
    if (!reached) return ''
    const behind = layers.reduceRight((under, top) => over(top, under), [255, 255, 255, 1])
    let alpha = rgba(s.color)[3]
    for (let e = el; e && e !== document.documentElement && seeThrough(getComputedStyle(e).backgroundColor); e = e.parentElement) alpha *= Number(getComputedStyle(e).opacity)
    if (alpha < 0.05) return '' // invisible text (e.g. a gradient painted through it): not "faint"
    const ratio = contrast(over([...rgba(s.color).slice(0, 3), alpha], behind), behind)
    const size = parseFloat(s.fontSize)
    const big = size >= 24 || (size >= 18.66 && Number(s.fontWeight) >= 700)
    const needs = big ? 3 : 4.5
    return ratio < needs ? `${ratio.toFixed(1)}:1 against its background (needs ${needs}:1${big ? ' for big text' : ''})` : ''
  }

  // ---- breathing room (0.21.0) ----
  // A drawn box: a border all round, a shadow, a picture or gradient, or its own background colour (different from the
  // one it sits on). A line on one side only is a divider (list rows), not a box. The page and anything as big as the
  // screen don't count.
  const drawsBox = (el) => {
    if (el === document.body || el === document.documentElement) return false
    const box = el.getBoundingClientRect()
    if (box.width >= innerWidth - 1 && box.height >= innerHeight - 1) return false
    const s = getComputedStyle(el)
    if (['Top', 'Right', 'Bottom', 'Left'].every((side) => parseFloat(s[`border${side}Width`]) > 0 && !seeThrough(s[`border${side}Color`]))) return true
    if (s.boxShadow !== 'none' || s.backgroundImage !== 'none') return true
    if (seeThrough(s.backgroundColor)) return false
    let p = el.parentElement
    while (p && seeThrough(getComputedStyle(p).backgroundColor)) p = p.parentElement
    return !p || getComputedStyle(p).backgroundColor !== s.backgroundColor
  }
  const scrolls = (el) => { const s = getComputedStyle(el); return /(auto|scroll)/.test(s.overflowX + s.overflowY) && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1) }
  // Words are measured by the words themselves (not their element, which may be wider): side to side as wide as they
  // run, top to bottom by their ink — the letters' real top and bottom (the browser measures them in that font), not
  // the extra space a font keeps above and below (a ‹ in an icon button is much smaller than its line).
  const wordsBox = (nodes) => {
    const range = document.createRange()
    const rects = nodes.flatMap((n) => {
      range.selectNodeContents(n)
      const s = getComputedStyle(n.parentElement)
      pixel.font = s.font
      const words = n.textContent.trim()
      const ink = pixel.measureText(s.textTransform === 'uppercase' ? words.toUpperCase() : words)
      return [...range.getClientRects()].map((r) => {
        const scale = r.height / (ink.fontBoundingBoxAscent + ink.fontBoundingBoxDescent) // < 1 when shrunk (a pinned chip)
        const baseline = r.top + ink.fontBoundingBoxAscent * scale // a line's box starts that far above its baseline
        return { left: r.left, right: r.right, top: baseline - ink.actualBoundingBoxAscent * scale, bottom: baseline + ink.actualBoundingBoxDescent * scale }
      })
    })
    if (!rects.length) return null
    return { left: Math.min(...rects.map((r) => r.left)), top: Math.min(...rects.map((r) => r.top)), right: Math.max(...rects.map((r) => r.right)), bottom: Math.max(...rects.map((r) => r.bottom)) }
  }
  const wordsIn = (el, deep) => {
    if (!deep) return [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim())
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    const out = []
    while (walker.nextNode()) if (walker.currentNode.textContent.trim() && !moving(walker.currentNode.parentElement)) out.push(walker.currentNode)
    return out
  }
  // Something moving right now (a "+4" floating up and away) is passing by, not sitting in the box: not judged
  const moving = (el) => el.getAnimations?.().some((a) => a.playState === 'running') ?? false
  // Text, an icon or a picture closer than ~2 px to the inside edge of the box around it → the plain-words problem, or ''.
  // (flagged under 1.5 px, so half a pixel of rounding doesn't count)
  // Text: its own box counts too (a badge's words). A picture, avatar or badge is measured against the box it sits in;
  // an icon made of a character (role="img" around ★) by its character.
  const tooClose = (el, isText) => {
    if (!shown(el) || moving(el) || el.closest('[data-ui-bleed]') || el.parentElement?.closest('svg')) return '' // (an svg's own insides: its icon counts as one)
    const boxItem = ['IMG', 'svg', 'CANVAS', 'VIDEO'].includes(el.tagName) || el.matches('.kit-avatar, .kit-badge')
    const content = !isText && boxItem ? el.getBoundingClientRect() : wordsBox(wordsIn(el, !isText))
    if (!content) return ''
    let box = isText ? el : el.parentElement
    for (; box && !drawsBox(box); box = box.parentElement) if (scrolls(box)) return ''
    if (!box || scrolls(box)) return ''
    const b = box.getBoundingClientRect()
    const s = getComputedStyle(box)
    // Its border as drawn: a box shrunk by a transform (a chip pinned to the table) has a thinner border on screen than
    // its style says (0.33.2: Pixel's 4px border at a pin scale of 0.44 is 1.75px, not 4 — the words had 3.5px of room)
    const k = box.offsetWidth ? b.width / box.offsetWidth : 1
    const inside = { left: b.left + parseFloat(s.borderLeftWidth) * k, top: b.top + parseFloat(s.borderTopWidth) * k, right: b.right - parseFloat(s.borderRightWidth) * k, bottom: b.bottom - parseFloat(s.borderBottomWidth) * k }
    const midX = (content.left + content.right) / 2, midY = (content.top + content.bottom) / 2
    if (midX < b.left || midX > b.right || midY < b.top || midY > b.bottom) return '' // it sits outside the box, not in it
    const room = Math.min(content.left - inside.left, content.top - inside.top, inside.right - content.right, inside.bottom - content.bottom)
    if (room >= 1.5) return ''
    const what = box.classList[0] ? `.${box.classList[0]}` : `<${box.tagName.toLowerCase()}>`
    return `touches the edge of its box (${what}${box === el ? ', its own' : ''}) — ${Math.max(0, Math.round(room))} px of room`
  }

  const boxes = things.map(visibleBox)
  const hitAll = document.createElement('style')
  hitAll.textContent = '* { pointer-events: auto !important; }'
  document.head.appendChild(hitAll)
  try {
    for (const el of texts) {
      const faint = faintText(el)
      if (faint) problems.push(`faint: "${name(el)}" is hard to read — ${faint}`)
    }
    const items = [...texts.map((el) => [el, true]), ...[...document.querySelectorAll('img, svg, canvas, video, .kit-avatar, .kit-badge, [role="img"]')].map((el) => [el, false])]
    for (const [el, isText] of items) {
      const edge = tooClose(el, isText)
      if (edge) problems.push(`edge: "${name(el)}" ${edge}`)
    }
    const crossed = [] // pairs already said as "X × Y" (the covered-piece check below doesn't say them twice)
    for (let i = 0; i < things.length; i++) {
      for (let j = i + 1; j < things.length; j++) {
        const a = things[i], b = things[j]
        if (a.contains(b) || b.contains(a)) continue
        const at = crossing(boxes[i], boxes[j])
        if (!at) continue
        let seenA = false, seenB = false
        for (const el of document.elementsFromPoint(at.x, at.y)) {
          if (part(el, a)) seenA = true
          else if (part(el, b)) seenB = true
          else if (el.contains(a) && el.contains(b)) continue // a box around both: under them
          else if (paints(el)) break // something else — or one's own card / dialog — covers the other there
          if (seenA && seenB) break
        }
        if (seenA && seenB) { problems.push(`overlap: "${name(a)}" × "${name(b)}"`); crossed.push([a, b]) }
      }
    }
    // Covered bars and pictures (0.33.1): a solid piece (a chip, badge, button or panel — its own background, not
    // see-through) that slid part-way onto a bar, meter or picture. Those hold no words, so the check above never saw
    // them (the coins chip sat on the end of the Health bar on an upright Cozy phone). On-purpose layering is left alone:
    //   - laid WHOLLY over it (a dialog over the HUD) or sitting wholly ON it (a chip on a backdrop picture): only a
    //     piece crossing the bar's or picture's edge — part of it showing, part hidden — is a collision
    //   - in the bar's own card (the nearest drawn box around it, inside its screen slot): a badge on its portrait's
    //     corner, a label on its own bar
    //   - floating in the top layer (a toast, a tooltip, a modal dialog), or moving right now (a "+4" floating away)
    //   - anything under an open screen (inert) or skipped (see the header)
    const covered = [...document.querySelectorAll('[role="progressbar"], [role="meter"], progress, meter, img, svg, canvas, video, [role="img"], .kit-avatar')]
      .filter((el) => !el.parentElement?.closest('svg') && shown(el))
    const solid = (el) => {
      if (el === document.body || el === document.documentElement) return false
      const s = getComputedStyle(el)
      return rgba(s.backgroundColor)[3] >= 0.5 || s.backgroundImage !== 'none'
    }
    const floats = (el) => !!el.closest(':popover-open, dialog:modal') || moving(el)
    const covers = [...document.querySelectorAll('body *')].filter((el) => solid(el) && drawsBox(el) && shown(el) && !floats(el))
    const ownCard = (el) => {
      for (let p = el.parentElement; p && p !== document.body && !p.matches('[data-slot], .kit-layer, .kit-screen'); p = p.parentElement) if (drawsBox(p)) return p
      return null
    }
    const inside = (small, big) => small.left >= big.left - 0.5 && small.right <= big.right + 0.5 && small.top >= big.top - 0.5 && small.bottom <= big.bottom + 0.5
    // Text too (0.33.2): a solid piece over part of another card's words (the coins chip on "Score 120") — the
    // text-over-text check above stops at the chip's background ("something covers it there"), so it never said.
    // The words are measured by the words themselves (their element may be much wider); the piece must be ON TOP of
    // them there. Kept: a label on its own chip and text inside the piece (the piece holds it), a badge in the text's
    // own card, a dialog wholly over the words or words wholly on a backdrop panel. (A piece wholly inside a run of words
    // still counts for text: a "×2" sitting on the middle of a title hides letters.)
    const targets = [...covered.map((el) => [el, false]), ...texts.filter((el) => !covered.includes(el)).map((el) => [el, true])]
    for (const [target, isText] of targets) {
      const seen = visibleBox(target)
      const words = isText ? wordsBox(wordsIn(target, false)) : seen
      const tBox = words && seen && {
        left: Math.max(words.left, seen.left), top: Math.max(words.top, seen.top),
        right: Math.min(words.right, seen.right), bottom: Math.min(words.bottom, seen.bottom),
      }
      if (!tBox || tBox.right <= tBox.left || tBox.bottom <= tBox.top) continue
      const card = ownCard(target)
      const found = []
      for (const piece of covers) {
        if (piece.contains(target) || target.contains(piece) || card?.contains(piece)) continue
        if (found.some((f) => f.contains(piece))) continue // one line per piece: not again for the coin inside the chip
        if (isText && crossed.some(([a, b]) => (part(a, piece) && b === target) || (part(b, piece) && a === target))) continue // said already as "X × Y"
        const pBox = visibleBox(piece)
        const at = crossing(tBox, pBox)
        if (!at || inside(tBox, pBox) || (!isText && inside(pBox, tBox))) continue
        let seenT = false, seenP = false
        for (const el of document.elementsFromPoint(at.x, at.y)) {
          if (part(el, piece)) seenP = true
          else if (part(el, target)) {
            if (isText && !seenP && solid(target)) break // the words' own chip lies over the piece here: it's the piece that's covered
            seenT = true
          }
          else if (el.contains(piece) && el.contains(target)) continue // a box around both: under them
          else if (paints(el)) break // something else covers them there
          if (seenT && seenP) break
        }
        if (!seenT || !seenP) continue
        found.push(piece)
        problems.push(`overlap: "${name(piece)}" covers part of "${name(target)}"`)
      }
    }
  } finally {
    hitAll.remove()
  }

  // Cards that grew after they appeared — noted as it happens by the kit's useFixedSize (fixedSize.ts, dev builds)
  // (emptied once read, so growth seen on the first screen isn't blamed again on the next one)
  for (const g of window.__uiGrowth ?? []) problems.push(`grows: "${g.name}" grew from ${g.from} to ${g.to} px after it appeared`)
  window.__uiGrowth = []

  const ring = checkFocus && document.querySelector(':focus-visible')
  if (ring && !ring.closest('#devkit-root')) problems.push(`focus: a focus ring shows without keyboard use — "${name(ring)}"`)
  return [...new Set(problems)]
}
