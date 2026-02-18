
import { TutorialStep, IntercomMessage } from '../types/tutorial';
import { TrainingStepId } from '../types/training';

/**
 * Tutorial step definitions.
 *
 * For now, just 1-2 placeholder steps for testing the state machine.
 * Full content will be defined in Phase 33 (Rank 0 Training Sequence).
 */
export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'WELCOME',
    rank: 0,
    trigger: { type: 'ON_GAME_START', rank: 0 },
    message: {
      keywords: ['Welcome', 'operator'],
      fullText: 'Welcome aboard, operator.',
    },
    autoAdvanceMs: 4000,
  },
  {
    id: 'ROTATE_INTRO',
    rank: 0,
    trigger: { type: 'ON_GAME_START', rank: 0 },
    message: {
      keywords: ['Swipe', 'rotate', 'tank'],
      fullText: 'Swipe left or right to rotate the tank.',
    },
    requiresAction: 'ROTATE',
  },
];

/**
 * Tutorial v2 — Intercom messages for all 14 training steps.
 *
 * Voice: bored shift supervisor reading from a manual he's memorized
 * against his will. Never "please" or "try to." Imperative mood. Brief.
 * Garble system: [brackets] = garbled, no brackets = clear, keywords = green.
 *
 * Average: 7.6 words per message.
 */
export const TRAINING_MESSAGES: Record<TrainingStepId, IntercomMessage> = {
  A1_WELCOME: {
    keywords: ['Operator', 'training', 'periscope'],
    fullText: '[Your] Operator training [begins now]. Drag [the] periscope down [to] start.',
  },
  B1_GOOP_FALLS: {
    keywords: ['goop', 'tank'],
    fullText: '[The] extruder drops goop into [the] tank.',
  },
  B2_FAST_DROP: {
    keywords: ['slow', 'Swipe', 'S', 'fast-drop'],
    fullText: '[Yeah.] It\'s slow. Swipe down or [press] S [to] fast-drop.',
  },
  B3_ROTATION: {
    keywords: ['Rotate', 'Q/E', 'tap', 'left/right', 'tank'],
    fullText: 'Rotate [with] Q/E or tap [the] left/right [side of the] tank.',
  },
  B4_PRACTICE: {
    keywords: [],
    fullText: '[Do it] again.',
  },
  C1_PRESSURE: {
    keywords: ['Pressure'],
    fullText: 'Pressure [builds] over time.',
  },
  C2_POP: {
    keywords: ['Tap', 'goop', 'pressure', 'pop'],
    fullText: 'Tap goop below [the] pressure [line] to pop [it].',
  },
  C3_MERGE_SOLIDIFY: {
    keywords: ['goop', 'merges', 'Bigger', 'vent', 'set'],
    fullText: 'Same-color goop merges. Bigger [blobs] vent more. [Fresh goop] needs a moment to set.',
  },
  C4_PRACTICE_POP: {
    keywords: ['Pop'],
    fullText: 'Pop [it].',
  },
  D1_CRACK: {
    keywords: ['Cracks', 'tank', 'goop', 'seal'],
    fullText: 'Cracks [form in the] tank [wall]. Drop matching [color] goop [on them] to seal.',
  },
  D2_TANK_ROTATION: {
    keywords: ['Swipe', 'left/right', 'A/D', 'spin', 'tank'],
    fullText: 'Swipe left/right [or] A/D [to] spin [the] tank.',
  },
  D3_OFFSCREEN: {
    keywords: ['tank', 'Cracks'],
    fullText: '[You] only see 1/3 [of the] tank. Cracks [can] spawn anywhere.',
  },
  E1_SCAFFOLDING: {
    keywords: ['Cracks', 'pressure', 'goop', 'reach'],
    fullText: 'Cracks [spawn] higher as [the] pressure builds. Stack goop [to] reach [them].',
  },
  F1_GRADUATION: {
    keywords: ['basics', 'goop', 'high'],
    fullText: '[That] covers [the] basics. Don\'t [let the] goop [pile] too high.',
  },
};

/**
 * F1 ending messages — shown when graduation game ends.
 * These are separate from TRAINING_MESSAGES because they're triggered
 * by game conditions within F1, not by step transitions.
 */
export const F1_ENDING_MESSAGES: Record<string, IntercomMessage> = {
  PRESSURE_CAP: {
    keywords: ['Swipe up', 'leave training'],
    fullText: '[I\'ve] stopped [the] pressure [so you can] practice. Swipe up [to] leave training.',
  },
  OVERFLOW: {
    keywords: ['Swipe up', 'end'],
    fullText: '[You] overflowed [the] tank! Training [is] over. Swipe up [to] end.',
  },
};

/**
 * Retry messages shown when the player misses during a training step.
 * Separate from TRAINING_MESSAGES because these aren't keyed by TrainingStepId.
 */
export const TRAINING_RETRY_MESSAGES: Record<string, IntercomMessage> = {
  D2_RETRY: {
    keywords: ['tank', 'goop', 'crack', 'Spin'],
    fullText: 'Try again! Spin [the] tank [to] align [the] goop with [the] crack.',
  },
};
