
import { GameEventType } from '../core/events/GameEvents';

// Tutorial Step Identifiers
// Rank 0 training steps
export type TutorialStepId =
  | 'WELCOME'
  | 'ROTATE_INTRO'
  | 'DROP_INTRO'
  | 'CRACK_INTRO'
  | 'POP_TIMING'
  | 'WRAP_INTRO'
  | 'FIRST_SHIFT'
  // Future phase placeholders
  | 'COMPLICATION_LIGHTS'
  | 'COMPLICATION_LASER'
  | 'COMPLICATION_CONTROLS'
  | 'UPGRADE_INTRO'
  | 'ABILITY_INTRO';

// How a tutorial step gets triggered
export type TutorialTrigger =
  | { type: 'ON_RANK_REACH'; rank: number }
  | { type: 'ON_EVENT'; event: GameEventType }
  | { type: 'ON_GAME_START'; rank: number }
  | { type: 'ON_FIRST_ACTION'; action: string }
  | { type: 'MANUAL' };

// Intercom message — keywords render clearly through static; fullText is the complete message
export interface IntercomMessage {
  keywords: string[];
  fullText: string;
}

// A single tutorial step definition
export interface TutorialStep {
  id: TutorialStepId;
  rank: number;
  trigger: TutorialTrigger;
  message: IntercomMessage;
  requiresAction?: string;
  autoAdvanceMs?: number;
}

// Runtime tutorial state managed by useTutorial hook
export interface TutorialState {
  activeStep: TutorialStepId | null;
  completedSteps: TutorialStepId[];
  dismissed: boolean;
}
