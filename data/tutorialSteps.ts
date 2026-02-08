
import { TutorialStep } from '../types/tutorial';

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
