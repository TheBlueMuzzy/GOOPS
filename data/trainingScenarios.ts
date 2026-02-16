
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
 * Tutorial v2 — 14 steps across 6 phases (A-F).
 *
 * Design spec: .planning/Tutorial2.md
 * Principles: show-then-name-then-do, one concept per step,
 * under 20 words per message, always doing something within 3s.
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
  },

  {
    // B2: Same piece still falling. Acknowledge slowness + teach fast-drop.
    // "Yeah. It's slow. Drag down or press S to fast-drop."
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
  },

  {
    // B4: Practice rep. Blue 2x2 (simple, no rotation needed). Breather.
    // "Do it again."
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
  },

  // ═══════════════════════════════════════════════════════════════
  // Phase C — Pressure & Popping (4 steps)
  // Introduce threat, first pop, merge+solidify, second pop
  // ═══════════════════════════════════════════════════════════════

  {
    // C1: "Pressure builds over time." — 4 words.
    // Dismiss → pressure rises fast (2.5 rate) → reaches yellow goop in ~3s → auto-advance.
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
  },

  {
    // C2: "Tap goop below the pressure line to pop it."
    // Pressure frozen (0). Yellow goop pulses. Reshow after 3s (non-dismissible).
    // Game NOT paused — player can pop while reading.
    id: 'C2_POP',
    phase: 'C',
    name: 'Pop',
    teaches: 'how-to-pop',
    setup: {
      pressureRate: 0,  // Frozen — focus on learning to pop
      allowedControls: { fastDrop: false, rotate: false, tankRotate: false },
      highlightGoopColor: COLORS.YELLOW,
      reshowAfterMs: 3000,
      reshowNonDismissible: true,
      popLowersPressure: true,
    },
    pauseGame: false,  // Game running, player can pop while reading
    advance: { type: 'action', action: 'pop-goop' },
  },

  {
    // C3: Merge + solidify in one message.
    // "Same-color goop merges. Bigger blobs vent more. Fresh goop needs a moment to set."
    // Shows 1.5s after C2's pop (let droplets fade, merge animation play).
    // Pressure 0.3125 (moderate, needs to reach merged blue).
    id: 'C3_MERGE_SOLIDIFY',
    phase: 'C',
    name: 'Merge & Solidify',
    teaches: 'merge-and-fill-timing',
    setup: {
      pressureRate: 0.3125,
      allowedControls: { fastDrop: true, rotate: true, tankRotate: false, pop: false },
      pauseDelay: 1500,  // Wait for pop droplets + merge animation
    },
    pauseGame: true,
    advance: { type: 'tap' },  // Acknowledge merge+solidify info
    markComplete: 'POP_TIMING',
  },

  {
    // C4: "Pop it." — second pop rep. Merged blue visible, pressure frozen.
    // Blue goop pulses (highlight). Player waits for solidify, then pops.
    // Message shows after 2s delay. Game NOT paused — player can pop while reading.
    id: 'C4_PRACTICE_POP',
    phase: 'C',
    name: 'Practice Pop',
    teaches: 'second-pop-rep',
    setup: {
      pressureRate: 0,  // Frozen — focus on pop timing, not pressure management
      allowedControls: { fastDrop: true, rotate: true, tankRotate: false },
      highlightGoopColor: COLORS.BLUE,  // Pulse blue goop, restrict popping to blue
      messageDelay: 2000,  // Wait for fill context to settle
      popLowersPressure: true,
    },
    pauseGame: false,  // Game running so player can pop while reading
    advance: { type: 'action', action: 'pop-goop' },
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
      allowedControls: { fastDrop: true, rotate: true, tankRotate: false, pop: false },
      pauseDelay: 2500,  // Let C4 droplets fade, crack spawns and becomes visible
    },
    pauseGame: true,
    advance: { type: 'tap' },
    markComplete: 'CRACK_INTRO',
  },

  {
    // D2: Tank rotation. Green T_O piece. Crack is off to one side.
    // "Swipe left/right or A/D to spin the tank."
    // All controls enabled. Message at row 8. Advance on crack-sealed.
    // Retry: freeze → 1s → pop all → 1.5s → new crack + retry msg + new piece.
    id: 'D2_TANK_ROTATION',
    phase: 'D',
    name: 'Tank Rotation',
    teaches: 'tank-rotation-input',
    setup: {
      spawnPiece: { color: COLORS.GREEN, shape: GoopShape.T_O },
      pressureRate: 0.46875,
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
  },

  {
    // D3: Offscreen discovery. Green crack visible.
    // Triggers when ANY crack rotated offscreen. Auto-skip after 15s.
    // If auto-skipped, trigger stays armed through E and F phases (persistent).
    id: 'D3_OFFSCREEN',
    phase: 'D',
    name: 'Offscreen Cracks',
    teaches: 'cylindrical-awareness',
    setup: {
      spawnCrack: { color: COLORS.GREEN, placement: 'near-stack' },
      pressureRate: 0.46875,
      allowedControls: { fastDrop: true, rotate: true, tankRotate: true },
      showWhenCracksOffscreen: true,
      autoSkipMs: 15000,  // Auto-advance if player never rotates crack offscreen
      popLowersPressure: true,
    },
    pauseGame: true,  // Pause when cracks-offscreen message appears
    advance: { type: 'tap' },
    markComplete: 'WRAP_INTRO',
  },

  // ═══════════════════════════════════════════════════════════════
  // Phase E — Scaffolding (1 step)
  // Stack goop to reach a high crack
  // ═══════════════════════════════════════════════════════════════

  {
    // E1: High crack at row 10-12. Pieces spawn continuously.
    // "Cracks spawn higher as Pressure builds. Stack goop to reach them."
    // Safety: auto-advance after 90s.
    id: 'E1_SCAFFOLDING',
    phase: 'E',
    name: 'Build Scaffolding',
    teaches: 'scaffolding-strategy',
    setup: {
      spawnCrack: { color: COLORS.GREEN, placement: 'at-pressure-line' },
      pressureRate: 0.46875,
      allowedControls: { fastDrop: true, rotate: true, tankRotate: true },
      messagePosition: 'top',
      continuousSpawn: true,   // Auto-spawn next piece after each lands
      autoSkipMs: 90000,       // Safety: move to graduation if stuck
      popLowersPressure: true,
    },
    pauseGame: true,  // Pause for message. Dismiss → continuous play begins.
    advance: { type: 'event', event: 'crack-sealed' },
  },

  // ═══════════════════════════════════════════════════════════════
  // Phase F — Graduation (1 step)
  // Free play with all mechanics, gentle pressure, caps at 95%
  // ═══════════════════════════════════════════════════════════════

  {
    // F1: Graduation game. All mechanics active.
    // Continuous pieces, periodic cracks every ~20s, pressure at 0.2 rate.
    // Pressure caps at 95% → practice msg → swipe up → console.
    // Stack overflow → end msg → swipe up → console.
    // Pop lowers pressure (real game behavior).
    id: 'F1_GRADUATION',
    phase: 'F',
    name: 'Graduation',
    teaches: 'free-play',
    setup: {
      pressureRate: 0.2,
      allowedControls: { fastDrop: true, rotate: true, tankRotate: true },
      messagePosition: 'top',
      continuousSpawn: true,
      pressureCap: 0.95,
      periodicCrackIntervalMs: 20000,
      popLowersPressure: true,
    },
    pauseGame: true,  // Pause for graduation message. Dismiss → free play begins.
    advance: { type: 'action', action: 'swipe-up' },  // Swipe up to leave training
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
