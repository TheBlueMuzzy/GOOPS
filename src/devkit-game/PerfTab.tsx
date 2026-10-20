// THE PERF TAB (F38) — switches the frame-rate readout on / off (src/game/fpsMeter.ts). Remembered on this device, so
// an installed app (no address bar for ?fps) keeps showing it after a restart. The pass line and how often the
// readout updates are in the Tuning tab: content/tuning/perf.json.
import { useSyncExternalStore } from 'react'
import { fpsMeter } from '../game/fpsMeter'
import perf from '../../content/tuning/perf.json'
import './perfTab.css'

export function PerfTab() {
  const on = useSyncExternalStore(fpsMeter.subscribe, fpsMeter.isOn)
  return (
    <div className="devkit-perf">
      <p>Frame rate in the top-left corner: frames per second, and the slowest frame since the last update. Aim: {perf.targetFps} fps;
        the speed test passes at {perf.passMedianFps}+ with no frame over {perf.passWorstFrameMs} ms.</p>
      <button className={on ? 'devkit-btn devkit-btn-main' : 'devkit-btn'} aria-pressed={on} onClick={() => fpsMeter.show(!on)}>
        {on ? 'Hide frame rate' : 'Show frame rate'}
      </button>
      <p>Also: add <code>?fps</code> to the address.</p>
    </div>
  )
}
