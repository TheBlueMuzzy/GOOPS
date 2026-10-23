// MENU HEADER — the one top row every menu card shares (0.10.0): ‹ back on the left, the title, an action on the right.
//   <MenuHeader title="Settings" onBack={() => screens.pop()} />
//   <MenuHeader title="New game" onBack={close} action={<Button onClick={start}>Start</Button>} />
// ‹ only shows when onBack is given (Pause has Resume instead). It's a square icon button that sounds like a Back,
// read out as backLabel ("Back"). Muzzy 2026-10-13: "'main menu' as a button there might feel weird. where a back
// button would do the same with much less space. < = back."
// The title takes the room that's left and wraps onto a second line on a narrow phone; the ‹ and the action keep
// their size. A title that isn't plain words (e.g. "Room ABCD" with a box round the code) can be passed as-is.
// Beside an action (0.27.0, Goops' "UPGRAD / ES" at 360 wide): a plain-words title that won't fit on one line first
// drops a step to the style's heading size (--text-heading), and only then wraps — between words, never inside one.
// A word still too wide (a ‹ and an action on a 360-wide phone) drops one more step, to body size; still too wide
// (a wide pixel font), the action moves under the title instead (fitMenuTitle).
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { Button, Text } from '../controls'

type MenuHeaderProps = { title: ReactNode; onBack?: () => void; backLabel?: string; action?: ReactNode }

export function MenuHeader({ title, onBack, backLabel = 'Back', action }: MenuHeaderProps) {
  const titleBox = useRef<HTMLDivElement>(null)
  const fits = Boolean(action) && typeof title === 'string'
  useLayoutEffect(() => {
    const box = titleBox.current
    if (!box) return
    if (!fits) { delete box.dataset.fit; return } // the action went away: back to the full title size (F108 review)
    fitMenuTitle(box)
    if (typeof ResizeObserver === 'undefined') return // (tests without a browser)
    const refit = new ResizeObserver(() => fitMenuTitle(box)) // a turned phone, the text size setting, a restyle
    refit.observe(box)
    let on = true
    void document.fonts?.ready.then(() => { if (on) fitMenuTitle(box) }) // a font arriving changes the words' width
    return () => { on = false; refit.disconnect() }
  }, [fits, title])
  return (
    <div className="kit-menu-header" data-action={action ? '' : undefined}>
      {onBack && <Button variant="secondary" icon sound="back" aria-label={backLabel} onClick={onBack}>‹</Button>}
      <div ref={titleBox} className="kit-menu-header-title">{typeof title === 'string' ? <Text kind="title">{title}</Text> : title}</div>
      {action && <div className="kit-menu-header-action">{action}</div>}
    </div>
  )
}

/** Picks the title's size for the room it has (.kit-menu-header-title → data-fit): "" = title size, it fits on one
 *  line · "small" = a step down (heading size), wrapping between words if it must · "smaller" = body size, when a
 *  word is still too wide at heading size (a ‹ AND an action on a 360-wide phone) · "tight" = last resort, a word too
 *  wide even at body size: heading size again, and the action moves under the title (kit CSS). The first check is with
 *  the words on one line (data-fit="measure", kit CSS). Self-contained, so the look tests can run it in a browser. */
export function fitMenuTitle(box: HTMLElement) {
  const words = box.firstElementChild as HTMLElement | null
  if (!words) return
  box.dataset.fit = 'measure' // title size, all on one line
  if (words.scrollWidth <= box.clientWidth + 1) { box.dataset.fit = ''; return }
  for (const step of ['small', 'smaller']) { // heading size, then body size; wrapping between words
    box.dataset.fit = step
    if (words.scrollWidth <= box.clientWidth + 1) return
  }
  box.dataset.fit = 'tight' // one word is too wide even at body size: the action moves under the title
}
