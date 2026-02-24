
import { TrainingStep, TrainingStepId, TrainingPhase } from '../types/training';
import { COLORS } from '../constants';
import { GoopShape } from '../types';

// Phase display names
export const TRAINING_PHASE_NAMES: Record<TrainingPhase, string> = {
  A: 'Enter the Tank',
  B: 'Goop Basics',
  C: 'Pressure & Popping',
  D: 'Cracks & Sealing',
  E: 'Scaffolding',
  F: 'Graduation',
};

/**
 * Tutorial v3 — 13 active steps across 6 phases (A-F).
 *
 * Design spec: .planning/Tutorial3.md
 * Principles: show-then-name-then-do, one concept per step,
 * under 20 words per message, always doing something within 3s.
 *
 * Active step IDs (13):
 *   A1_WELCOME, B1_GOOP_FALLS, B2_FAST_DROP, B3_ROTATION, B4_PRACTICE,
 *   C1_PRESSURE, C2_POP, C3_MERGE_SOLIDIFY, C4_PRACTICE_POP,
 *   D1_CRACK, D2_TANK_ROTATION, E2_SCAFFOLDING, F1_GRADUATION
 *
 * Disabled:
 *   D3_OFFSCREEN — will be re-integrated as parallel listener
 *   E1_SEAL_CRACK — absorbed into D2 (plug→hint→pop cycle)
 */
export const TRAINING_SEQUENCE: TrainingStep[] = [

  // ═══════════════════════════════════════════════════════════════
  // Phase A — Enter the Tank (1 step)
  // Welcome + periscope merged into one action
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'A1_WELCOME',
    phase: 'A',
    name: 'Welcome',
    teaches: 'premise-and-entry',
    setup: {
      view: 'console',
      pressureRate: 0,
      highlightElement: 'periscope',
      messagePosition: 'top',
    },
    pauseGame: true,
    advance: { type: 'action', action: 'drag-periscope' },
    markComplete: 'WELCOME',
    handlerType: 'standard',
  },

  // ═══════════════════════════════════════════════════════════════
  // Phase B — Goop Basics (4 steps, 2 piece falls)
  // Watch, fast-drop, rotate, practice
  // ═══════════════════════════════════════════════════════════════

  {
    // B1: First piece falls. Player watches. No controls.
    // Auto-advances to B2 when piece reaches row 8.
    id: 'B1_GOOP_FALLS',
    phase: 'B',
    name: 'Goop Falls',
    teaches: 'what-goop-is',
    setup: {
      view: 'tank',
      spawnPiece: { color: COLORS.BLUE, shape: GoopShape.T_I, rotation: 1, autoFall: true },
      pressureRate: 0,
      allowedControls: { fastDrop: false, rotate: false, tankRotate: false, pop: false },
      advanceAtRow: 8,  // Auto-advance at ~25% down viewport
    },
    pauseGame: false,  // Game running, piece falling, message visible
    advance: { type: 'event', event: 'piece-landed' },  // Fallback if piece lands before row 8
    handlerType: 'standard',
  },

  {
    // B2: Same piece still falling. Acknowledge slowness + teach fast-drop.
    // Controls: fast-drop enabled. Advance when piece lands.
    id: 'B2_FAST_DROP',
    phase: 'B',
    name: 'Fast-Drop',
    teaches: 'fast-drop-input',
    setup: {
      // No spawn — same piece from B1 still falling
      pressureRate: 0,
      allowedControls: { fastDrop: true, rotate: false, tankRotate: false, pop: false },
    },
    pauseGame: false,  // Piece keeps falling, player can fast-drop
    advance: { type: 'event', event: 'piece-landed' },
    handlerType: 'standard',
  },

  {
    // B3: New piece (yellow T_T). Teach rotation.
    // Piece spawns and falls. After 1.2s, game pauses + message shows.
    // Dismiss → piece resumes → player rotates and drops.
    id: 'B3_ROTATION',
    phase: 'B',
    name: 'Rotation',
    teaches: 'piece-rotation-input',
    setup: {
      spawnPiece: { color: COLORS.YELLOW, shape: GoopShape.T_T },
      pressureRate: 0,
      allowedControls: { fastDrop: true, rotate: true, tankRotate: false, pop: false },
      pauseDelay: 1200,  // See piece moving, then freeze to read
    },
    pauseGame: true,
    advance: { type: 'event', event: 'piece-landed' },
    markComplete: 'DROP_INTRO',
    handlerType: 'standard',
  },

  {
    // B4: Practice rep. Blue 2x2 (simple, no rotation needed). Breather.
    id: 'B4_PRACTICE',
    phase: 'B',
    name: 'Practice',
    teaches: 'practice-basics',
    setup: {
      spawnPiece: { color: COLORS.BLUE, shape: GoopShape.T_O },
      pressureRate: 0,
      allowedControls: { fastDrop: true, rotate: true, tankRotate: false, pop: false },
    },
    pauseGame: true,  // Message shows immediately, dismiss → piece falls
    advance: { type: 'event', event: 'piece-landed' },
    handlerType: 'standard',
  },

  // ═══════════════════════════════════════════════════════════════
  // Phase C — Pressure & Popping (4 steps)
  // Introduce threat, first pop, merge+solidify, second pop
  // ═══════════════════════════════════════════════════════════════

  {
    // C1: "Pressure builds over time."
    // Dismiss → pressure rises fast (2.5 rate) → reaches yellow goop → auto-advance.
    // All controls disabled — watch only.
    id: 'C1_PRESSURE',
    phase: 'C',
    name: 'Pressure Rises',
    teaches: 'pressure-concept',
    setup: {
      pressureRate: 2.5,
      allowedControls: { fastDrop: false, rotate: false, tankRotate: false, pop: false },
      advanceWhenPressureAbovePieces: true,
      advancePressureAboveColor: COLORS.YELLOW,
      autoSkipMs: 10000,  // Safety fallback
    },
    pauseGame: true,  // Pause for message. Dismiss → pressure starts rising.
    advance: { type: 'auto', delayMs: 60000 },  // Never fires — pressure-above-pieces advances first
    handlerType: 'standard',
  },

  {
    // C2: "Tap goop below the pressure line to pop it."
    // Pressure frozen (0). Yellow goop pulses. Hint reshow after 3s (non-dismissible).
    // Game NOT paused — player can pop while reading.
    id: 'C2_POP',
    phase: 'C',
    name: 'Pop',
    teaches: 'how-to-pop',
    setup: {
      pressureRate: 0,  // Frozen — focus on learning to pop
      allowedControls: { fastDrop: false, rotate: false, tankRotate: false },
      highlightGoopColor: COLORS.YELLOW,
      hintDelay: 3000,  // Wait 3s after dismiss; if no pop, reshow non-dismissible + pause pressure
      popLowersPressure: true,
    },
    pauseGame: false,  // Game running, player can pop while reading
    advance: { type: 'action', action: 'pop-goop' },
    handlerType: 'standard',
  },

  {
    // C3: Merge + solidify in one message.
    // Shows 1.5s after C2's pop (let droplets fade, merge animation play).
    // Pressure 0.3125 (moderate).
    id: 'C3_MERGE_SOLIDIFY',
    phase: 'C',
    name: 'Merge & Solidify',
    teaches: 'merge-and-fill-timing',
    setup: {
      pressureRate: 0.3125,
      pauseDelay: 1500,  // Wait for pop droplets + merge animation
    },
    pauseGame: true,
    advance: { type: 'tap' },  // Acknowledge merge+solidify info
    markComplete: 'POP_TIMING',
    handlerType: 'standard',
  },

  {
    // C4: "Pop it." — second pop rep. Merged blue visible, pressure frozen.
    // Blue goop pulses (highlight). Message shows after 2s delay.
    // Hint reshow after 3s if player hasn't popped (non-dismissible reminder).
    id: 'C4_PRACTICE_POP',
    phase: 'C',
    name: 'Practice Pop',
    teaches: 'second-pop-rep',
    setup: {
      pressureRate: 0,  // Frozen — focus on pop timing, not pressure management
      allowedControls: { fastDrop: true, rotate: true, tankRotate: false },
      highlightGoopColor: COLORS.BLUE,  // Pulse blue goop, restrict popping to blue
      messageDelay: 2000,  // Wait for fill context to settle
      hintDelay: 3000,  // Wait 3s after dismiss; if no pop, reshow non-dismissible + pause pressure
      popLowersPressure: true,
    },
    pauseGame: false,  // Game running so player can pop while reading
    advance: { type: 'action', action: 'pop-goop' },
    handlerType: 'standard',
  },

  // ═══════════════════════════════════════════════════════════════
  // Phase D — Cracks & Tank Rotation (3 steps)
  // See crack, learn tank rotation, discover cylinder
  // ═══════════════════════════════════════════════════════════════

  {
    // D1: Crack appears. "Cracks form in the tank wall. Drop matching color goop on them to seal."
    // Spawns green crack near-stack, right side, row 22.
    // Pressure 0 — just reading about cracks.
    // 2.5s delay after C4's pop.
    id: 'D1_CRACK',
    phase: 'D',
    name: 'Crack Appears',
    teaches: 'crack-sealing',
    setup: {
      spawnCrack: { color: COLORS.GREEN, placement: 'near-stack', row: 22 },
      pressureRate: 0,
      pauseDelay: 2500,  // Let C4 droplets fade, crack spawns and becomes visible
    },
    pauseGame: true,
    advance: { type: 'tap' },
    markComplete: 'CRACK_INTRO',
    handlerType: 'standard',
  },

  {
    // D2: Tank rotation. Green T_O piece. Crack is off to one side.
    // "Swipe left/right or A/D to spin the tank."
    // All controls enabled. Message at row 8. Advance on crack-sealed.
    // Retry: keep old cracks, add extra near bottom, respawn piece, retry message.
    id: 'D2_TANK_ROTATION',
    phase: 'D',
    name: 'Tank Rotation',
    teaches: 'tank-rotation-input',
    setup: {
      spawnPiece: { color: COLORS.GREEN, shape: GoopShape.T_O },
      pressureRate: 0,          // No pressure during D2 — retries would push cracks too high for E1
      allowedControls: { fastDrop: true, rotate: true, tankRotate: true },
      showWhenPieceBelow: 8,  // Show when piece reaches ~25% down viewport
      retryOnPieceLand: {
        retryMessageId: 'D2_RETRY',
        spawnExtraCrack: { color: COLORS.GREEN, placement: 'near-stack' },
      },
      popLowersPressure: true,
    },
    pauseGame: true,  // Pause when position-gated message shows
    advance: { type: 'event', event: 'crack-sealed' },
    markComplete: 'ROTATE_INTRO',
    handlerType: 'retry',
  },

  // D3_OFFSCREEN commented out — discovery interrupt will be re-integrated later
  // as a parallel listener, not a step in the sequence.
  // {
  //   id: 'D3_OFFSCREEN',
  //   phase: 'D',
  //   name: 'Offscreen Cracks',
  //   teaches: 'cylindrical-awareness',
  //   setup: {
  //     pressureRate: 0.46875,
  //     allowedControls: { fastDrop: true, rotate: true, tankRotate: true },
  //     autoSkipMs: 15000,
  //     messageDelay: 999999,
  //     popLowersPressure: true,
  //   },
  //   pauseGame: false,
  //   advance: { type: 'tap' },
  //   markComplete: 'WRAP_INTRO',
  //   handlerType: 'discovery',
  // },

  // ═══════════════════════════════════════════════════════════════
  // Phase E — Scaffolding (1 step)
  // D2 already handles plug → hint → pop. E2 teaches scaffolding concept.
  // ═══════════════════════════════════════════════════════════════

  // E1_SEAL_CRACK removed from sequence — D2 now handles the full plug→hint→pop
  // cycle using its retry handler. After D2's pop (GOAL_CAPTURED), advances directly to E2.
  // The E1 message ("Pop the goop to seal the crack") is still referenced by D2's
  // post-plug hint (useTrainingFlow.ts retryOnPieceLand handler).

  {
    // E2: Scaffolding concept. Shows after pop animation settles (1.5s delay).
    // "Cracks spawn higher as pressure builds. Stack goop to reach them."
    // Spawns 2 cracks (different colors): one on-screen, one off-screen.
    // Reinforces the message about cracks appearing everywhere.
    id: 'E2_SCAFFOLDING',
    phase: 'E',
    name: 'Scaffolding',
    teaches: 'scaffolding-strategy',
    setup: {
      pressureRate: 0.46875,
      pauseDelay: 1500,  // Wait for pop droplets + blobs to disappear
      spawnCracks: [
        { color: COLORS.RED, placement: 'at-pressure-line' },              // Visible on-screen, below pressure line
        { color: COLORS.BLUE, placement: 'offscreen-pressure-line' },      // Off-screen, same height range
      ],
    },
    pauseGame: true,
    advance: { type: 'tap' },
    handlerType: 'standard',
  },

  // ═══════════════════════════════════════════════════════════════
  // Phase F — Graduation (1 step)
  // Free play with all mechanics, gentle pressure, caps at 95%
  // ═══════════════════════════════════════════════════════════════

  {
    // F1: Graduation game. All mechanics active.
    // Continuous pieces, periodic cracks every 10s, pressure at 0.5 rate.
    // Pressure caps at 95% → practice msg → swipe up → console.
    // Stack overflow → end msg → swipe up → console.
    // Pop lowers pressure (real game behavior).
    id: 'F1_GRADUATION',
    phase: 'F',
    name: 'Graduation',
    teaches: 'free-play',
    setup: {
      pressureRate: 0.5,
      allowedControls: { fastDrop: true, rotate: true, tankRotate: true },
      messagePosition: 'top',
      continuousSpawn: true,
      pressureCap: 0.95,
      periodicCrackIntervalMs: 10000,
      popLowersPressure: true,
      pauseDelay: 2000,  // 2s breathing room after E2 before showing graduation message
    },
    pauseGame: true,  // Delayed pause for graduation message. Dismiss → free play begins.
    advance: { type: 'action', action: 'swipe-up' },  // Swipe up to leave training
    markComplete: 'FIRST_SHIFT',
    handlerType: 'freeplay',
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
