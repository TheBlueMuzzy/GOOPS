// RUN CHECK OFF THE PAGE'S MAIN THREAD — both ends of the Web Worker that plays the AI tab's Personality Check, so the
// game and the Dev Kit stay alive (and smooth) while dozens of AI-vs-AI games play. The Dev Kit never imports the
// game's AI: the game writes a tiny worker file that hands its own check function to `serveCheck`, and its runCheck
// starts that worker with `runCheckInWorker`:
//
//   // src/devkit-game/aiCheck.worker.ts — inside the worker
//   import { serveCheck } from '../devkit/ai/checkWorker'
//   import { runArena, devKitSettings } from '../ai/kit/arena'
//   import { reportHtml } from '../ai/kit/report'
//   serveCheck(self, (job, onProgress) => reportHtml(runArena(plug, { ...job, targets, settings: devKitSettings(arenaJson, job.games) }, onProgress).report))
//
//   // src/devkit-game/aiDevKit.ts — on the page
//   runCheck: (options) => runCheckInWorker(() => new Worker(new URL('./aiCheck.worker.ts', import.meta.url), { type: 'module' }), options)
//
// Messages: page → worker { job, extra } (the games, personalities and skills as they are in the tab, unsaved edits
// too; extra = anything else the game's worker needs);
// worker → page { progress: [done, total] } after every game, then { html } or { error }. One check per worker; the
// page closes the worker when the check is done.
import type { DevKitAi } from './aiTypes'

/** What the AI tab's Run check hands the game. */
export type CheckOptions = Parameters<NonNullable<DevKitAi['runCheck']>>[0]
/** The same without the progress callback (a function can't be posted to a worker). */
export type CheckJob = Omit<CheckOptions, 'onProgress'>

/** A Web Worker, or the worker's own `self` (anything that posts and hears messages the same way). */
export interface CheckWorkerLike {
  postMessage(message: unknown): void
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void
  addEventListener(type: 'error', listener: (event: { message?: string }) => void): void
  terminate?(): void
}

type FromWorker = { progress: [number, number] } | { html: string } | { error: string }

/** On the page: start the worker, send it the job, pass its progress on, and resolve with the report page (HTML).
 *  `extra` = anything else the game's worker needs, as plain data (e.g. its word list's full address — a worker's own
 *  address differs from the page's). A check that fails (or a worker that won't start) rejects with the reason. */
export function runCheckInWorker(start: () => CheckWorkerLike, { onProgress, ...job }: CheckOptions, extra?: unknown): Promise<string> {
  return new Promise((resolve, reject) => {
    let worker: CheckWorkerLike
    try {
      worker = start()
    } catch (e) {
      return reject(new Error(`the check's worker didn't start: ${(e as Error).message}`))
    }
    let done = false
    const finish = (then: () => void) => {
      if (done) return
      done = true
      worker.terminate?.()
      then()
    }
    worker.addEventListener('message', (event) => {
      const data = event.data as FromWorker
      if ('progress' in data) return void (done || onProgress(...data.progress))
      if ('html' in data) finish(() => resolve(data.html))
      else finish(() => reject(new Error(data.error || 'the check stopped')))
    })
    worker.addEventListener('error', (event) => finish(() => reject(new Error(event.message || "the check's worker stopped working"))))
    // Plain data only (a personality edited in the tab is plain JSON already)
    worker.postMessage(JSON.parse(JSON.stringify({ job, extra })))
  })
}

/** Inside the worker: run each job with the game's own check function (it may be async — e.g. to fetch a word list
 *  first) and send back progress, then the report page or what went wrong. `extra` = what the page passed along. */
export function serveCheck<Extra = unknown>(scope: CheckWorkerLike, run: (job: CheckJob, onProgress: (done: number, total: number) => void, extra: Extra) => string | Promise<string>): void {
  scope.addEventListener('message', async (event) => {
    const { job, extra } = event.data as { job: CheckJob; extra: Extra }
    try {
      const html = await run(job, (done, total) => scope.postMessage({ progress: [done, total] } satisfies FromWorker), extra)
      scope.postMessage({ html } satisfies FromWorker)
    } catch (e) {
      scope.postMessage({ error: e instanceof Error ? e.message : String(e) } satisfies FromWorker)
    }
  })
}
