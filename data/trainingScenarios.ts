
import { TrainingStep, TrainingStepId, TrainingPhase } from '../types/training';
import { COLORS } from '../constants';
import { GoopShape } from '../types';

// Phase display names
export const TRAINING_PHASE_NAMES: Record<TrainingPhase, string> = {
  A: 'Console Briefing',
  B: 'Goop Basics',
  C: 'Pressure & Popping',
  D: 'Cracks & Sealing',
  E: 'Scaffolding',
  F: 'Endgame',
};

/**
 * The scripted rank 0 training sequence.
 *
 * One continuous guided experience — NOT discrete levels.
 * The flow controller reads these steps and orchestrates game state.
 * Intercom message content is defined separately in tutorialSteps.ts.
 *
 * 15 steps across 6 phases (A-F).
 * Pressure introduced at C1, cracks at D1, free practice at F2.
 */
export const TRAINING_SEQUENCE: TrainingStep[] = [

  // ═══════════════════════════════════════════════════════════════
  // Phase A: Console Briefing
  // Player learns the premise and how to enter the tank
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'A1_BRIEFING',
    phase: 'A',
    name: 'Welcome Briefing',
    teaches: 'game-premise',
    setup: {
      view: 'console',
      pressureRate: 0,
      messagePosition: 'top',
    },
    pauseGame: true,
    advance: { type: 'tap' },
    markComplete: 'WELCOME',
  },

  {
    id: 'A2_PERISCOPE',
    phase: 'A',
    name: 'Enter the Tank',
    teaches: 'periscope-navigation',
    setup: {
      view: 'console',
      highlightElement: 'periscope',
      messagePosition: 'top',
    },
    pauseGame: true,
    advance: { type: 'action', action: 'drag-periscope' },
  },

  // ═══════════════════════════════════════════════════════════════
  // Phase B: Goop Basics
  // Player watches a piece fall, then learns fast-fall and rotation
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'B1_GOOP_INTRO',
    phase: 'B',
    name: 'Goop Introduction',
    teaches: 'what-goop-is',
    setup: {
      view: 'tank',
      spawnPiece: { color: COLORS.BLUE, shape: GoopShape.T_I, rotation: 1, autoFall: true },
      pressureRate: 0,
      allowedControls: { fastDrop: false, rotate: false, tankRotate: false },
      advanceAtRow: 8,  // Auto-advance to B1B when piece reaches ~25% down visually
    },
    pauseGame: false,
    advance: { type: 'event', event: 'piece-landed' },  // Fallback if piece lands before 50%
  },

  {
    id: 'B1B_SLOW_COMMENT',
    phase: 'B',
    name: 'Slow Comment',
    teaches: 'patience-acknowledgment',
    setup: {
      // No new piece spawn — the B1 piece is still falling
      pressureRate: 0,
      allowedControls: { fastDrop: false, rotate: false, tankRotate: false },
      advanceAtRow: 11,  // Auto-advance to B2 when piece reaches ~40% down
    },
    pauseGame: false,  // Piece continues falling while "slow" message shows
    advance: { type: 'event', event: 'piece-landed' },  // Fallback if piece lands before 40%
  },

  {
    id: 'B2_FAST_FALL',
    phase: 'B',
    name: 'Fast Fall',
    teaches: 'fast-fall-input',
    setup: {
      // No new piece spawn — same B1 piece still falling, now with fast-drop enabled
      allowedControls: { fastDrop: true, rotate: false, tankRotate: false },
    },
    pauseGame: false,  // Piece continues falling, player can fast-drop
    advance: { type: 'event', event: 'piece-landed' },  // Piece lands → advance
  },

  {
    id: 'B3_PIECE_ROTATION',
    phase: 'B',
    name: 'Piece Rotation',
    teaches: 'piece-rotation-input',
    setup: {
      spawnPiece: { color: COLORS.YELLOW, shape: GoopShape.T_T },
      allowedControls: { fastDrop: true, rotate: true, tankRotate: false },
      pauseDelay: 1200,  // Piece starts falling, then message appears after 1.2s
    },
    pauseGame: true,
    advance: { type: 'event', event: 'piece-landed' },  // Wait for piece to land after rotation
    markComplete: 'DROP_INTRO',
  },

  {
    id: 'B4_PRACTICE',
    phase: 'B',
    name: 'Practice Drop',
    teaches: 'practice-basics',
    setup: {
      spawnPiece: { color: COLORS.BLUE, shape: GoopShape.T_O },
      allowedControls: { fastDrop: true, rotate: true, tankRotate: false },
    },
    pauseGame: true,
    advance: { type: 'event', event: 'piece-landed' },
  },

  // ═══════════════════════════════════════════════════════════════
  // Phase C: Pressure & Popping
  // Pressure starts rising. Learn to pop goop to vent it.
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'C1_POP_INTRO',
    phase: 'C',
    name: 'Pressure & Laser',
    teaches: 'pressure-and-popping',
    setup: {
      // No piece spawn — let pressure rise over existing pieces from B-phase
      pressureRate: 0.5,
      allowedControls: { fastDrop: false, rotate: false, tankRotate: false, pop: false },
      advanceAtPressure: 5,  // Advance when PSI reaches 5%
    },
    pauseGame: true,
    advance: { type: 'auto', delayMs: 60000 },  // Safety fallback
  },

  {
    id: 'C1B_PRESSURE_RISING',
    phase: 'C',
    name: 'Pressure Rising',
    teaches: 'pressure-pacing',
    setup: {
      pressureRate: 0.5,
      allowedControls: { fastDrop: false, rotate: false, tankRotate: false, pop: false },
      advanceWhenPressureAbovePieces: true,  // Advance when pressure line passes yellow goop
      advancePressureAboveColor: COLORS.YELLOW,  // Only check yellow — don't wait for pressure to cover all blues too
    },
    pauseGame: true,
    advance: { type: 'auto', delayMs: 60000 },  // Safety fallback
  },

  {
    id: 'C1C_POP_INSTRUCTION',
    phase: 'C',
    name: 'Pop Instruction',
    teaches: 'how-to-pop',
    setup: {
      pressureRate: 0,  // Freeze pressure while reading
      allowedControls: { fastDrop: false, rotate: false, tankRotate: false },
      highlightGoopColor: COLORS.YELLOW,  // Pulse yellow goop, only yellow can be popped
    },
    pauseGame: true,
    advance: { type: 'action', action: 'pop-goop' },
  },

  {
    id: 'C2_MERGE',
    phase: 'C',
    name: 'Color Merging',
    teaches: 'same-color-merge',
    setup: {
      pressureRate: 0.2,
      allowedControls: { fastDrop: true, rotate: true, tankRotate: false },
      pauseDelay: 1000,  // Wait 1s after pop before showing merge message
    },
    pauseGame: true,
    advance: { type: 'event', event: 'goop-merged' },
  },

  {
    id: 'C3_FILL_TIMING',
    phase: 'C',
    name: 'Solidify Timing',
    teaches: 'fill-delay-mechanic',
    setup: {
      pressureRate: 0.2,
      allowedControls: { fastDrop: true, rotate: true, tankRotate: false },
    },
    pauseGame: true,
    advance: { type: 'tap' },
    markComplete: 'POP_TIMING',
  },

  // ═══════════════════════════════════════════════════════════════
  // Phase D: Cracks & Sealing
  // Introduce cracks, tank rotation, and offscreen awareness
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'D1_CRACK_APPEARS',
    phase: 'D',
    name: 'Crack + Seal',
    teaches: 'crack-sealing',
    setup: {
      spawnCrack: { color: COLORS.GREEN, placement: 'near-stack' },
      pressureRate: 0.3,
      allowedControls: { fastDrop: true, rotate: true, tankRotate: false },
    },
    pauseGame: true,
    advance: { type: 'action', action: 'pop-goop' },
    markComplete: 'CRACK_INTRO',
  },

  {
    id: 'D2_TANK_ROTATION',
    phase: 'D',
    name: 'Tank Rotation',
    teaches: 'tank-rotation-input',
    setup: {
      spawnPiece: { color: COLORS.GREEN, shape: GoopShape.T_O },
      pressureRate: 0.3,
      allowedControls: { fastDrop: true, rotate: true, tankRotate: true },
    },
    pauseGame: true,
    advance: { type: 'action', action: 'rotate-tank' },
    markComplete: 'ROTATE_INTRO',
  },

  {
    id: 'D3_OFFSCREEN_CRACKS',
    phase: 'D',
    name: 'Offscreen Cracks',
    teaches: 'cylindrical-awareness',
    setup: {
      pressureRate: 0.3,
      allowedControls: { fastDrop: true, rotate: true, tankRotate: true },
    },
    pauseGame: true,
    advance: { type: 'tap' },
    markComplete: 'WRAP_INTRO',
  },

  // ═══════════════════════════════════════════════════════════════
  // Phase E: Scaffolding
  // Stack goop to reach higher cracks
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'E1_SCAFFOLDING',
    phase: 'E',
    name: 'Build Scaffolding',
    teaches: 'scaffolding-strategy',
    setup: {
      pressureRate: 0.3,
      allowedControls: { fastDrop: true, rotate: true, tankRotate: true },
      messagePosition: 'top',
    },
    pauseGame: true,
    advance: { type: 'event', event: 'crack-sealed' },
  },

  // ═══════════════════════════════════════════════════════════════
  // Phase F: Endgame
  // Cleanup message, then free practice until overflow
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'F1_CLEANUP',
    phase: 'F',
    name: 'Clear Residual',
    teaches: 'cleanup-before-end',
    setup: {
      pressureRate: 0,
      allowedControls: { fastDrop: true, rotate: true, tankRotate: true },
      messagePosition: 'top',
    },
    pauseGame: true,
    advance: { type: 'tap' },
  },

  {
    id: 'F2_PRACTICE',
    phase: 'F',
    name: 'Practice Mode',
    teaches: 'free-practice',
    setup: {
      pressureRate: 0,
      allowedControls: { fastDrop: true, rotate: true, tankRotate: true },
      messagePosition: 'top',
    },
    pauseGame: true,
    advance: { type: 'event', event: 'game-over' },
    markComplete: 'FIRST_SHIFT',
  },
];

// --- Helper Functions ---

/**
 * Get the next incomplete training step.
 * Returns the first step whose id is NOT in completedStepIds, or null if done.
 */
export function getNextTrainingStep(
  completedStepIds: string[]
): TrainingStep | null {
  return TRAINING_SEQUENCE.find(step => !completedStepIds.includes(step.id)) ?? null;
}

/**
 * Check if all training steps are complete.
 */
export function isTrainingComplete(completedStepIds: string[]): boolean {
  return TRAINING_SEQUENCE.every(step => completedStepIds.includes(step.id));
}

/**
 * Get all steps in a specific training phase.
 */
export function getPhaseSteps(phase: TrainingPhase): TrainingStep[] {
  return TRAINING_SEQUENCE.filter(step => step.phase === phase);
}

/**
 * Get a specific training step by id.
 */
export function getTrainingStep(id: TrainingStepId): TrainingStep | null {
  return TRAINING_SEQUENCE.find(step => step.id === id) ?? null;
}
