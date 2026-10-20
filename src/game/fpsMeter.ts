// THE FRAME-RATE READOUT (F38) — "58 fps · worst 21 ms" in the top-left corner, over everything, on any screen.
// On with ?fps in the address, or from the Dev Kit's Perf tab (remembered on this device — an installed app has no
// address bar). Measured on its own animation frame loop, so it counts what the screen really shows. The words change
// by setting textContent every content/tuning/perf.json meterEveryMs — never React state per frame.
// e2e/perf.mjs measures the same way and judges the numbers against perf.json's pass line.
import perf from '../../content/tuning/perf.json'
import './fpsMeter.css'

const KEY = 'goops-fps' // localStorage: "on" = the Dev Kit switched it on
let box: HTMLElement | null = null
let raf = 0
const listeners = new Set<() => void>()

function remembered(): boolean {
  try { return localStorage.getItem(KEY) === 'on' } catch { return false }
}
function remember(on: boolean) {
  try { if (on) localStorage.setItem(KEY, 'on'); else localStorage.removeItem(KEY) } catch { /* private mode: just this visit */ }
}

function start() {
  box = document.createElement('div')
  box.className = 'fps-meter'
  box.setAttribute('aria-hidden', 'true')
  box.textContent = '… fps'
  document.body.appendChild(box)
  let frames = 0, worst = 0, last = performance.now(), since = last
  const frame = (now: number) => {
    worst = Math.max(worst, now - last)
    last = now
    frames++
    if (now - since >= perf.meterEveryMs && box) {
      const fps = Math.round((frames * 1000) / (now - since))
      box.textContent = `${fps} fps · worst ${Math.round(worst)} ms`
      box.dataset.fps = String(fps)
      box.classList.toggle('is-low', fps < perf.passMedianFps)
      frames = 0; worst = 0; since = now
    }
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)
}

export const fpsMeter = {
  isOn: () => box !== null,
  /** At start-up: on when the address has ?fps, or the Dev Kit switched it on earlier. */
  startIfAsked() {
    if (new URLSearchParams(location.search).has('fps') || remembered()) this.show(true, false)
  },
  /** On / off (the Dev Kit's Perf tab). remember: keep it on for the next visit too. */
  show(on: boolean, rememberIt = true) {
    if (rememberIt) remember(on)
    if (on && !box) start()
    if (!on && box) { cancelAnimationFrame(raf); box.remove(); box = null }
    listeners.forEach((f) => f())
  },
  subscribe(f: () => void) { listeners.add(f); return () => { listeners.delete(f) } },
}
