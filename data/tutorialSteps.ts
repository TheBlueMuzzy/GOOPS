
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
 * Intercom messages for all 14 training steps.
 *
 * Keyed by TrainingStepId so the training flow controller can look up
 * the message to display at each step.
 *
 * Keywords are single words that render as green (clear) text.
 * Non-keyword text gets garbled by the intercom renderer.
 */
export const TRAINING_MESSAGES: Record<TrainingStepId, IntercomMessage> = {
  A1_BRIEFING: {
    keywords: ['Operator', 'shift'],
    fullText: '[Welcome] Operator. [You must complete] training [before your first] shift.',
  },
  A2_PERISCOPE: {
    keywords: ['periscope', 'tank'],
    fullText: '[Use the] periscope [to] look inside [the] tank. Drag [it] down [to] start [your shift].',
  },
  B1_GOOP_INTRO: {
    keywords: ['goop', 'tank'],
    fullText: '[The goop] extruder [drops] goop into [the] tank. [The goop] drops slowly.',
  },
  B1B_SLOW_COMMENT: {
    keywords: ['slow'],
    fullText: '[Yeah.] It\'s slow.',
  },
  B2_FAST_FALL: {
    keywords: ['fast-drop'],
    fullText: 'Swipe down or [press] S [to] fast-drop. [The] faster [you place it, the] better.',
  },
  B3_PIECE_ROTATION: {
    keywords: ['Rotate'],
    fullText: 'Rotate [the goop before it lands]. Tap [the left/right side of the] screen or [press] Q/E [to rotate].',
  },
  C1_POP_INTRO: {
    keywords: ['Pressure', 'laser', 'goop', 'pressure'],
    fullText: 'Pressure [increases] over time. [Use the] laser [to] pop goop [to] vent [some of the] pressure.',
  },
  C2_MERGE: {
    keywords: ['goop', 'merges'],
    fullText: 'Same color goop merges [together into] bigger [goop]. Popping bigger [goops] vents more [pressure].',
  },
  C3_FILL_TIMING: {
    keywords: ['goop', 'pressure'],
    fullText: 'Fresh goop needs [time to] solidify before [it can be] popped. [The] pressure must [be] high [enough] as well.',
  },
  D1_CRACK_APPEARS: {
    keywords: ['Cracks', 'tank', 'goop', 'laser'],
    fullText: 'You [have] one job! Cracks form in [the] tank [wall]. Cover [them with matching] color goop. [Then] seal [them] with [the] laser.',
  },
  D2_TANK_ROTATION: {
    keywords: ['tank', 'goop', 'crack'],
    fullText: 'Swipe left/right or [use] A/D to spin [the] tank. [This will] align the [falling] goop [with the] crack.',
  },
  D3_OFFSCREEN_CRACKS: {
    keywords: ['tank', 'Cracks'],
    fullText: '[You] only see 1/3 [of the] tank [at a time]. Cracks [can] form anywhere. Spin [the] tank [to] find [the next] crack.',
  },
  E1_SCAFFOLDING: {
    keywords: ['Cracks', 'pressure', 'goop', 'cracks'],
    fullText: 'Cracks [form] higher [as the] pressure increases. Stack goop [to] reach higher cracks.',
  },
  F1_CLEANUP: {
    keywords: ['goop', 'shift', 'tank'],
    fullText: "Clear [as much] residual goop [as possible] before [the] shift end. Don't let [the] goop overflow [the top of] the tank!",
  },
  F2_PRACTICE: {
    keywords: ['pressure', 'tank'],
    fullText: "We'll turn [the] pressure off [so you can] practice. When [you're] done practicing, [just let the goop] overflow [the] tank.",
  },
};
