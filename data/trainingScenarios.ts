
import { TrainingScenario } from '../types/training';
import { COLORS } from '../constants';

/**
 * Rank 0 Training Scenarios.
 *
 * Each scenario teaches exactly one mechanic through gameplay constraints:
 * fewer colors, simpler pieces, specific goals, and longer/infinite time limits.
 *
 * Order: 0TA -> 0TB -> 0TC -> 0TD -> 0TE -> 0TF
 */
export const TRAINING_SCENARIOS: TrainingScenario[] = [
  // 0TA — Tank Rotation
  // Teaches: Rotating the tank (swipe / A / D keys)
  {
    id: '0TA',
    order: 1,
    name: 'Tank Rotation',
    objective: 'Find and seal 2 cracks by rotating the tank',
    concept: 'tank-rotation',
    config: {
      palette: [COLORS.RED],
      maxPieceSize: 1,
      goalsTarget: 2,
      timeLimitMs: null,
      startingJunk: 0,
      allowRotation: true,
    },
    tutorialStepId: 'WELCOME',
    completionStepId: 'ROTATE_INTRO',
  },

  // 0TB — Piece Placement
  // Teaches: Piece rotation (Q/E), soft drop, hard drop
  {
    id: '0TB',
    order: 2,
    name: 'Piece Placement',
    objective: 'Rotate and place pieces to seal 3 cracks',
    concept: 'piece-placement',
    config: {
      palette: [COLORS.RED],
      maxPieceSize: 3,
      goalsTarget: 3,
      timeLimitMs: null,
      startingJunk: 0,
      allowRotation: true,
    },
    tutorialStepId: 'DROP_INTRO',
    completionStepId: 'DROP_INTRO',
  },

  // 0TC — Color Matching
  // Teaches: Goop must match crack color
  {
    id: '0TC',
    order: 3,
    name: 'Color Matching',
    objective: 'Match goop color to crack color to seal 3 cracks',
    concept: 'color-matching',
    config: {
      palette: [COLORS.RED, COLORS.BLUE, COLORS.GREEN],
      maxPieceSize: 4,
      goalsTarget: 3,
      timeLimitMs: null,
      startingJunk: 0,
      allowRotation: true,
    },
    tutorialStepId: 'CRACK_INTRO',
    completionStepId: 'CRACK_INTRO',
  },

  // 0TD — Pop Timing
  // Teaches: Scaffolding vs pressure tradeoff
  {
    id: '0TD',
    order: 4,
    name: 'Pop Timing',
    objective: 'Stack goop to reach high cracks — but watch the pressure',
    concept: 'pop-timing',
    config: {
      palette: [COLORS.RED, COLORS.BLUE, COLORS.GREEN],
      maxPieceSize: 4,
      goalsTarget: 4,
      timeLimitMs: 60000,
      startingJunk: 0,
      allowRotation: true,
    },
    tutorialStepId: 'POP_TIMING',
    completionStepId: 'POP_TIMING',
  },

  // 0TE — Cylindrical Wrapping
  // Teaches: Tank wraps around — pieces on the edge continue on the other side
  {
    id: '0TE',
    order: 5,
    name: 'Cylindrical Wrapping',
    objective: "Cracks span the tank's edge — use wrapping to seal them",
    concept: 'cylindrical-wrapping',
    config: {
      palette: [COLORS.RED, COLORS.BLUE],
      maxPieceSize: 4,
      goalsTarget: 3,
      timeLimitMs: null,
      startingJunk: 0,
      allowRotation: true,
      gridPreset: 'WRAP_DEMO',
    },
    tutorialStepId: 'WRAP_INTRO',
    completionStepId: 'WRAP_INTRO',
  },

  // 0TF — First Real Shift
  // Teaches: Putting it all together in a real game
  {
    id: '0TF',
    order: 6,
    name: 'First Real Shift',
    objective: 'Complete your first real shift',
    concept: 'full-game',
    config: {
      palette: [COLORS.RED, COLORS.BLUE, COLORS.GREEN, COLORS.YELLOW],
      maxPieceSize: 4,
      goalsTarget: 4,
      timeLimitMs: 75000,
      startingJunk: 0,
      allowRotation: true,
    },
    tutorialStepId: 'FIRST_SHIFT',
    completionStepId: 'FIRST_SHIFT',
  },
];

/**
 * Get the next incomplete training scenario.
 * Returns the first scenario whose completionStepId is NOT in completedSteps,
 * or null if all scenarios are complete.
 */
export const getNextTrainingScenario = (
  completedSteps: string[]
): TrainingScenario | null => {
  return (
    TRAINING_SCENARIOS.find(
      (scenario) => !completedSteps.includes(scenario.completionStepId)
    ) ?? null
  );
};

/**
 * Check if all training scenarios are complete.
 * Returns true if every scenario's completionStepId is in completedSteps.
 */
export const isTrainingComplete = (completedSteps: string[]): boolean => {
  return TRAINING_SCENARIOS.every((scenario) =>
    completedSteps.includes(scenario.completionStepId)
  );
};
