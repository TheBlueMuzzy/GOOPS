// THE LESSONS TAB (F30) — every lesson in content/lessons/, step by step:
//   ▶ plays the lesson from that step straight away (a new training shift — the same as window.__goops.lesson(id, n)
//     or ?lesson=<id>&step=<n> on the next Start shift)
//   each step's timings (message after, hint after) are edited LIVE — the running lesson uses them the next time the
//   step starts (▶ it again to see) — then Save writes the file (or Copy for Claude on the live link).
// The step the running lesson is on is marked. Shared timings (Got it delay, pause between steps…) are in the Tuning
// tab: content/tuning/lessons.json.
import { useState, useSyncExternalStore } from 'react'
import { CAN_SAVE, copyText, saveContentFile } from '../devkit/saveContent'
import { sendTuning } from '../devkit/tuning/liveTuning'
import { session } from '../game/session'
import { lessonIds, lessonNow, lessonPath, runner } from '../game/lessons/goopsLessons'
import type { Lesson, LessonStep } from '../game/lessons/lessonTypes'
import './lessonsTab.css'

export function LessonsTab() {
  const ids = lessonIds()
  const [id, setId] = useState(ids[0] ?? '')
  const [, setEdits] = useState(0) // a re-render after an edit (the lesson itself lives in goopsLessons' live box)
  const [status, setStatus] = useState<{ text: string; tone: '' | 'is-ok' | 'is-error' }>({ text: '', tone: '' })
  const view = useSyncExternalStore(runner.subscribe, runner.view)
  const lesson = lessonNow(id)
  if (!lesson) return <p className="devkit-not-plugged">No lessons yet (content/lessons/*.json).</p>

  // change one step's number: the whole edited lesson goes out as a live edit ("lesson-<id>")
  const setTiming = (index: number, change: (step: LessonStep, value: number) => LessonStep, raw: string) => {
    const value = Number(raw)
    if (!Number.isFinite(value) || value < 0) return
    const next: Lesson = structuredClone(lesson)
    next.steps[index] = change(next.steps[index], value)
    sendTuning(`lesson-${id}`, next)
    setEdits((n) => n + 1)
    setStatus({ text: 'Changed — ▶ the step to see it. Not saved yet.', tone: '' })
  }
  const play = (step: number) => {
    const ok = session.startLesson?.(id, step) ?? false
    setStatus(ok ? { text: `Playing ${id} from step ${step}.`, tone: 'is-ok' } : { text: 'The game is not ready to start a lesson.', tone: 'is-error' })
  }
  const save = async () => {
    try {
      if (CAN_SAVE) await saveContentFile(lessonPath(id), lessonNow(id)!)
      else if (!(await copyText(JSON.stringify(lessonNow(id), null, 2)))) throw new Error('the browser refused the copy')
      setStatus({ text: CAN_SAVE ? `Saved ${lessonPath(id)}.` : 'Copied — paste it to Claude.', tone: 'is-ok' })
    } catch (e) {
      setStatus({ text: `Couldn't save: ${(e as Error).message}`, tone: 'is-error' })
    }
  }

  return (
    <div className="lessons-tab">
      <div className="lessons-top">
        <select value={id} onChange={(e) => setId(e.target.value)} aria-label="Lesson">
          {ids.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <button className="devkit-btn" onClick={() => play(1)}>▶ From the start</button>
        <button className="devkit-btn devkit-btn-main" onClick={save}>{CAN_SAVE ? 'Save' : 'Copy for Claude'}</button>
      </div>
      <table className="lessons-steps">
        <thead><tr><th /><th>#</th><th>Step</th><th>Message after (s)</th><th>Hint after (s)</th></tr></thead>
        <tbody>
          {lesson.steps.map((step, i) => (
            <tr key={step.id} data-now={view.lessonId === id && view.stepIndex === i ? '' : undefined}>
              <td><button className="devkit-btn" onClick={() => play(i + 1)} aria-label={`Play from step ${i + 1}`}>▶</button></td>
              <td>{i + 1}</td>
              <td title={step.message ?? ''}>{step.id}<span className="lessons-pattern">{step.pattern ?? ''}</span></td>
              <td><input type="number" min={0} step={0.1} value={step.showAfter ?? 0} aria-label={`${step.id}: message after`}
                onChange={(e) => setTiming(i, (s, v) => ({ ...s, showAfter: v }), e.target.value)} /></td>
              <td>{step.hint
                ? <input type="number" min={0} step={0.5} value={step.hint.after} aria-label={`${step.id}: hint after`}
                    onChange={(e) => setTiming(i, (s, v) => ({ ...s, hint: { ...s.hint!, after: v } }), e.target.value)} />
                : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {status.text && <p className={`devkit-status ${status.tone}`}>{status.text}</p>}
    </div>
  )
}
