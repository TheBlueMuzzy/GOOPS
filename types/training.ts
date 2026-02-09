
import { TutorialStepId } from './tutorial';

// --- Training Step Identifiers ---

// Each step in the scripted rank 0 training sequence
export type TrainingStepId =
  | 'A1_BRIEFING'
  | 'A2_PERISCOPE'
  | 'B1_GOOP_INTRO'
  | 'B1B_SLOW_COMMENT'
  | 'B2_FAST_FALL'
  | 'B3_PIECE_ROTATION'
  | 'C1_POP_INTRO'
  | 'C2_MERGE'
  | 'C3_FILL_TIMING'
  | 'D1_CRACK_APPEARS'
  | 'D2_TANK_ROTATION'
  | 'D3_OFFSCREEN_CRACKS'
  | 'E1_SCAFFOLDING'
  | 'F1_CLEANUP'
  | 'F2_PRACTICE';

// Phase groupings (A-G)
export type TrainingPhase = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

// --- Step Configuration ---

// Piece to spawn for this step
export interface PieceSpawn {
  color: string;        // COLORS.RED, COLORS.BLUE, etc.
  size: number;         // 1=Mono, 2=Duo, 3=Tri, 4=Tetra
  autoFall?: boolean;   // Falls without player input (player watches)
  slowFall?: boolean;   // Falls at reduced speed for learning
}

// Crack to spawn for this step
export interface CrackSpawn {
  color: string;
  placement: 'near-stack' | 'away-from-stack' | 'offscreen' | 'high-offscreen';
}

// Which controls the player is allowed to use during this training step
export interface AllowedControls {
  fastDrop?: boolean;
  rotate?: boolean;
  tankRotate?: boolean;
}

// What to set up before this step activates
export interface StepSetup {
  spawnPiece?: PieceSpawn;
  spawnCrack?: CrackSpawn;
  pressureRate?: number;        // 0=frozen, 0.3=slow, 1=normal
  showPressureLine?: boolean;   // Reveal the pressure indicator
  view?: 'console' | 'tank';   // Which view to be in
  highlightElement?: string;    // UI element to glow/highlight
  allowedControls?: AllowedControls;  // Progressive control gating (undefined = all allowed)
  messagePosition?: 'top' | 'center' | 'bottom';  // Where to show intercom message (default: 'center')
}

// How the player advances past this step
export type StepAdvance =
  | { type: 'tap' }                          // Tap to dismiss message
  | { type: 'action'; action: string }       // Perform specific action
  | { type: 'event'; event: string }         // Wait for game event
  | { type: 'auto'; delayMs: number };       // Auto-advance after delay

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
}

// The full ordered training sequence
export type TrainingSequence = TrainingStep[];
