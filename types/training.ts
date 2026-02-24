
import { TutorialStepId } from './tutorial';
import { GoopShape } from '../types';

// --- Training Step Identifiers ---
// Tutorial v3: 15 steps across 6 phases (A:1, B:4, C:4, D:3, E:2, F:1)

export type TrainingStepId =
  | 'A1_WELCOME'
  | 'B1_GOOP_FALLS'
  | 'B2_FAST_DROP'
  | 'B3_ROTATION'
  | 'B4_PRACTICE'
  | 'C1_PRESSURE'
  | 'C2_POP'
  | 'C3_MERGE_SOLIDIFY'
  | 'C4_PRACTICE_POP'
  | 'D1_CRACK'
  | 'D2_TANK_ROTATION'
  | 'D3_OFFSCREEN'
  | 'E1_SEAL_CRACK'
  | 'E2_SCAFFOLDING'
  | 'F1_GRADUATION';

// Phase groupings (A-F)
export type TrainingPhase = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

// --- Step Configuration ---

// Piece to spawn for this step
export interface PieceSpawn {
  color: string;        // COLORS.RED, COLORS.BLUE, etc.
  shape: GoopShape;     // Which piece shape (T_I, T_T, T_O, etc.)
  rotation?: number;    // Initial rotation steps (0-3, default 0)
  autoFall?: boolean;   // Falls without player input (player watches)
  slowFall?: boolean;   // Falls at reduced speed for learning
}

// Crack to spawn for this step
export interface CrackSpawn {
  color: string;
  placement: 'near-stack' | 'away-from-stack' | 'offscreen' | 'high-offscreen' | 'high' | 'at-pressure-line' | 'offscreen-pressure-line';
  row?: number;         // Specific row override (e.g., D1 crack at row 22)
}

// Which controls the player is allowed to use during this training step
export interface AllowedControls {
  fastDrop?: boolean;
  rotate?: boolean;
  tankRotate?: boolean;
  pop?: boolean;
}

// What to set up before this step activates
export interface StepSetup {
  spawnPiece?: PieceSpawn;
  spawnCrack?: CrackSpawn;
  spawnCracks?: CrackSpawn[];  // Spawn multiple cracks (clears existing, then spawns all)
  pressureRate?: number;        // 0=frozen, 0.3=slow, 1=normal, 2.5=fast
  showPressureLine?: boolean;   // Reveal the pressure indicator
  view?: 'console' | 'tank';   // Which view to be in
  highlightElement?: string;    // UI element to glow/highlight
  allowedControls?: AllowedControls;  // Progressive control gating (undefined = all allowed)
  messagePosition?: 'top' | 'center' | 'bottom';  // Where to show intercom message (default: 'center')
  showWhenPieceBelow?: number;  // Delay showing message until activeGoop.y >= this value (grid rows)
  pauseDelay?: number;          // Start unpaused, then pause + show message after this many ms
  messageDelay?: number;        // For non-pausing steps: delay showing hint message (game keeps running)
  advanceAtRow?: number;        // Auto-advance when active piece reaches this grid row
  advanceAtPressure?: number;   // Auto-advance when PSI reaches this percentage (0-100)
  advanceWhenPressureAbovePieces?: boolean;  // Auto-advance when pressure line rises above highest locked goop
  advancePressureAboveColor?: string;       // Only check goops of this color for the pressure-above check
  highlightGoopColor?: string;  // Pulse-highlight goops of this color (also restricts popping to only this color)
  hintDelay?: number;           // Wait N ms after dismiss; if no action, reshow message (non-dismissible), pause pressure
  retryOnPieceLand?: {           // If piece lands without triggering advance: respawn, show retry message
    retryMessageId: string;      // Key into TRAINING_RETRY_MESSAGES for retry message
    spawnExtraCrack?: CrackSpawn; // Spawn additional crack on each retry
  };

  // --- Free play / continuous features ---
  continuousSpawn?: boolean;         // Auto-spawn next piece after each piece lands (E1, F1)
  pressureCap?: number;              // Cap pressure at this fraction 0-1 (F1: 0.95)
  periodicCrackIntervalMs?: number;  // Spawn a crack every N ms (F1: 10000)
  popLowersPressure?: boolean;       // Popping goop reduces the pressure bar (real gameplay behavior)
  autoSkipMs?: number;               // If step's show condition not met, auto-skip after N ms
  nonDismissible?: boolean;          // Message can't be dismissed — player must perform advance action to proceed
}

// How the player advances past this step
export type StepAdvance =
  | { type: 'tap' }                          // Tap to dismiss message
  | { type: 'action'; action: string }       // Perform specific action
  | { type: 'event'; event: string }         // Wait for game event
  | { type: 'auto'; delayMs: number };       // Auto-advance after delay

// Handler types for the handler registry
export type HandlerType = 'standard' | 'retry' | 'discovery' | 'continuous' | 'freeplay';

// --- Training Step ---

// A single step in the scripted training sequence
export interface TrainingStep {
  id: TrainingStepId;
  phase: TrainingPhase;
  name: string;                     // Human label for this step
  teaches: string;                  // What concept this step introduces
  setup?: StepSetup;                // Game state to configure before step
  pauseGame: boolean;               // True = game pauses while message shows
  advance: StepAdvance;             // How to move to next step
  markComplete?: TutorialStepId;    // Tutorial step to mark complete (unlocks journal pages)
  handlerType: HandlerType;         // Which handler processes this step
}

// The full ordered training sequence
export type TrainingSequence = TrainingStep[];

// --- State Machine Types ---

// Step lifecycle states
export enum StepLifecycleState {
  ENTERING = 'ENTERING',
  WAITING_FOR_TRIGGER = 'WAITING_FOR_TRIGGER',
  MESSAGE_VISIBLE = 'MESSAGE_VISIBLE',
  ARMED = 'ARMED',
  ADVANCING = 'ADVANCING',
}

// Properties derived from the current lifecycle state
export interface StepStateProperties {
  isPaused: boolean;
  isFrozen: boolean;
  messageShown: boolean;
}

// State machine state map — what each lifecycle state means
export const STEP_STATE_MAP: Record<StepLifecycleState, StepStateProperties> = {
  [StepLifecycleState.ENTERING]: {
    isPaused: true,
    isFrozen: true,
    messageShown: false,
  },
  [StepLifecycleState.WAITING_FOR_TRIGGER]: {
    isPaused: false,
    isFrozen: false,
    messageShown: false,
  },
  [StepLifecycleState.MESSAGE_VISIBLE]: {
    isPaused: true,
    isFrozen: true,
    messageShown: true,
  },
  [StepLifecycleState.ARMED]: {
    isPaused: false,
    isFrozen: false,
    messageShown: false,
  },
  [StepLifecycleState.ADVANCING]: {
    isPaused: true,
    isFrozen: true,
    messageShown: false,
  },
};
