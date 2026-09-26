/**
 * GameEvents.ts - Event type definitions
 *
 * All game events are defined here. Events are emitted by systems
 * and can be subscribed to by audio, UI, analytics, etc.
 *
 * C# Note: These map directly to C# event args classes.
 */

import { Coordinate } from '../../types';

// Event type discriminator
export enum GameEventType {
  // Piece events
  PIECE_SPAWNED = 'PIECE_SPAWNED',
  PIECE_MOVED = 'PIECE_MOVED',
  PIECE_ROTATED = 'PIECE_ROTATED',
  PIECE_DROPPED = 'PIECE_DROPPED',
  PIECE_LOCKED = 'PIECE_LOCKED',
  PIECE_SWAPPED = 'PIECE_SWAPPED',

  // Block/Grid events
  GROUP_CLEARED = 'GROUP_CLEARED',
  BLOCKS_FALLING = 'BLOCKS_FALLING',
  BLOCKS_LANDED = 'BLOCKS_LANDED',

  // Scoring events
  SCORE_CHANGED = 'SCORE_CHANGED',
  COMBO_CHANGED = 'COMBO_CHANGED',

  // Timer/Pressure events
  TIME_CHANGED = 'TIME_CHANGED',
  TIME_ADDED = 'TIME_ADDED',
  PRESSURE_CHANGED = 'PRESSURE_CHANGED',

  // Goal events
  GOAL_SPAWNED = 'GOAL_SPAWNED',
  GOAL_CONSUMED = 'GOAL_CONSUMED',

  // Game flow events
  GAME_STARTED = 'GAME_STARTED',
  GAME_PAUSED = 'GAME_PAUSED',
  GAME_RESUMED = 'GAME_RESUMED',
  GAME_OVER = 'GAME_OVER',
  COUNTDOWN_TICK = 'COUNTDOWN_TICK',

  // Input rejection (for audio feedback)
  INPUT_REJECTED = 'INPUT_REJECTED',
}

// Base event interface
export interface GameEvent {
  type: GameEventType;
  timestamp: number;
}

// Piece Events
export interface PieceSpawnedEvent extends GameEvent {
  type: GameEventType.PIECE_SPAWNED;
  pieceType: string;
  color: string;
}

export interface PieceMovedEvent extends GameEvent {
  type: GameEventType.PIECE_MOVED;
  direction: 'left' | 'right';
}

export interface PieceRotatedEvent extends GameEvent {
  type: GameEventType.PIECE_ROTATED;
  clockwise: boolean;
}

export interface PieceDroppedEvent extends GameEvent {
  type: GameEventType.PIECE_DROPPED;
  distance: number;
  isHardDrop: boolean;
}

export interface PieceLockedEvent extends GameEvent {
  type: GameEventType.PIECE_LOCKED;
  position: Coordinate;
}

export interface PieceSwappedEvent extends GameEvent {
  type: GameEventType.PIECE_SWAPPED;
  hadStoredPiece: boolean;
}

// Block/Grid Events
export interface GroupClearedEvent extends GameEvent {
  type: GameEventType.GROUP_CLEARED;
  groupSize: number;
  position: Coordinate;
  color: string;
  combo: number;
  scoreAwarded: number;
  timeAwarded: number;
}

export interface BlocksFallingEvent extends GameEvent {
  type: GameEventType.BLOCKS_FALLING;
  count: number;
}

export interface BlocksLandedEvent extends GameEvent {
  type: GameEventType.BLOCKS_LANDED;
  count: number;
}

// Scoring Events
export interface ScoreChangedEvent extends GameEvent {
  type: GameEventType.SCORE_CHANGED;
  newScore: number;
  delta: number;
}

export interface ComboChangedEvent extends GameEvent {
  type: GameEventType.COMBO_CHANGED;
  newCombo: number;
}

// Timer/Pressure Events
export interface TimeChangedEvent extends GameEvent {
  type: GameEventType.TIME_CHANGED;
  timeLeft: number;
  maxTime: number;
}

export interface TimeAddedEvent extends GameEvent {
  type: GameEventType.TIME_ADDED;
  amount: number;
  reason: 'group_clear' | 'bonus';
}

export interface PressureChangedEvent extends GameEvent {
  type: GameEventType.PRESSURE_CHANGED;
  pressure: number; // 0-1 ratio
  thresholdY: number;
}

// Goal Events
export interface GoalSpawnedEvent extends GameEvent {
  type: GameEventType.GOAL_SPAWNED;
  position: Coordinate;
  color: string;
}

export interface GoalConsumedEvent extends GameEvent {
  type: GameEventType.GOAL_CONSUMED;
  position: Coordinate;
  goalsCleared: number;
  goalsTarget: number;
}

// Game Flow Events
export interface GameStartedEvent extends GameEvent {
  type: GameEventType.GAME_STARTED;
  rank: number;
  goalsTarget: number;
}

export interface GamePausedEvent extends GameEvent {
  type: GameEventType.GAME_PAUSED;
}

export interface GameResumedEvent extends GameEvent {
  type: GameEventType.GAME_RESUMED;
}

export interface GameOverEvent extends GameEvent {
  type: GameEventType.GAME_OVER;
  isWin: boolean;
  finalScore: number;
  goalsCleared: number;
  goalsTarget: number;
}

export interface CountdownTickEvent extends GameEvent {
  type: GameEventType.COUNTDOWN_TICK;
  count: number;
}

// Input Rejection
export interface InputRejectedEvent extends GameEvent {
  type: GameEventType.INPUT_REJECTED;
  reason: 'not_ready' | 'not_submerged' | 'collision';
}

// Union type for all events
export type AnyGameEvent =
  | PieceSpawnedEvent
  | PieceMovedEvent
  | PieceRotatedEvent
  | PieceDroppedEvent
  | PieceLockedEvent
  | PieceSwappedEvent
  | GroupClearedEvent
  | BlocksFallingEvent
  | BlocksLandedEvent
  | ScoreChangedEvent
  | ComboChangedEvent
  | TimeChangedEvent
  | TimeAddedEvent
  | PressureChangedEvent
  | GoalSpawnedEvent
  | GoalConsumedEvent
  | GameStartedEvent
  | GamePausedEvent
  | GameResumedEvent
  | GameOverEvent
  | CountdownTickEvent
  | InputRejectedEvent;

// Helper to create events with timestamp
export function createEvent<T extends GameEvent>(
  type: T['type'],
  data: Omit<T, 'type' | 'timestamp'>
): T {
  return {
    type,
    timestamp: Date.now(),
    ...data,
  } as T;
}
