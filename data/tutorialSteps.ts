
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
 * Intercom messages for all 17 training steps.
 *
 * Keyed by TrainingStepId so the training flow controller can look up
 * the message to display at each step.
 */
export const TRAINING_MESSAGES: Record<TrainingStepId, IntercomMessage> = {
  A1_BRIEFING: {
    keywords: ['operator', 'safety training', 'shift'],
    fullText: 'Welcome aboard, operator. Standard safety training is mandatory before your first shift. Pay attention.',
  },
  A2_PERISCOPE: {
    keywords: ['periscope', 'tank', 'drag'],
    fullText: 'Use the periscope to look inside the tank. Drag it down to enter.',
  },
  B1_GOOP_INTRO: {
    keywords: ['goop', 'extruder', 'tank'],
    fullText: 'The goop extruder drops material into the tank. Watch where it lands.',
  },
  B2_FAST_FALL: {
    keywords: ['swipe down', 'press S', 'speed up', 'drop', 'fast-drop'],
    fullText: 'Swipe down or press S to fast-drop. The faster you place it, the better.',
  },
  B3_PIECE_ROTATION: {
    keywords: ['rotate', 'piece', 'tap', 'arrows', 'Q', 'E'],
    fullText: 'Rotate the piece before it lands. Tap the rotation arrows, or press Q and E.',
  },
  C1_POP_INTRO: {
    keywords: ['pop', 'goop', 'pressure', 'tap'],
    fullText: 'Too much goop builds pressure. Tap solid goop to pop it and vent the tank.',
  },
  C2_MERGE: {
    keywords: ['same color', 'merges', 'bigger'],
    fullText: 'Same color goop merges together into bigger blobs. Bigger pops vent more pressure.',
  },
  C3_FILL_TIMING: {
    keywords: ['solid', 'fill', 'pop'],
    fullText: 'Fresh goop needs time to solidify. You can only pop solid goop. The pressure line shows the threshold.',
  },
  D1_CRACK_APPEARS: {
    keywords: ['crack', 'matching', 'seal'],
    fullText: 'A crack in the tank wall. Only matching color goop can seal it. That is literally your one job.',
  },
  D2_TANK_ROTATION: {
    keywords: ['rotate', 'tank', 'swipe left', 'swipe right', 'A', 'D'],
    fullText: 'The goop is not above the crack. Swipe left or right to rotate the tank, or use A and D keys.',
  },
  E1_PRESSURE_REVEAL: {
    keywords: ['pressure', 'rising', 'goop'],
    fullText: 'Notice the pressure gauge. Every piece of goop in the tank adds to it. If it hits maximum capacity, you fail.',
  },
  E2_PRESSURE_THRESHOLD: {
    keywords: ['pressure line', 'above', 'pop'],
    fullText: 'Goop can only be popped when the pressure line rises above it. Watch the line climb.',
  },
  E3_SUCCESSFUL_POP: {
    keywords: ['pop', 'pressure drops', 'bonus'],
    fullText: 'There. Pressure drops when you pop. Bigger groups drop it more. Popping also scores a bonus.',
  },
  F1_CRACK_SEAL: {
    keywords: ['seal', 'crack', 'massive', 'pressure relief'],
    fullText: 'The green goop is sitting on the green crack. Pop it to seal the crack. Sealed cracks give massive pressure relief.',
  },
  G1_OFFSCREEN_CRACK: {
    keywords: ['wraps around', 'rotate', '360'],
    fullText: 'The tank is a cylinder. It wraps around. Keep rotating to see everything. There is more tank than you think.',
  },
  G2_SCAFFOLDING: {
    keywords: ['stack', 'scaffolding', 'reach', 'higher'],
    fullText: 'That crack is too high to reach from the floor. Stack pieces as scaffolding to reach it.',
  },
  G3_SCAFFOLDING_TRADEOFF: {
    keywords: ['balance', 'scaffolding', 'pressure'],
    fullText: 'More goop means more pressure. But sometimes you need scaffolding to reach the cracks. Balance is everything. Training complete.',
  },
};
