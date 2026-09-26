/**
 * GameState.ts - Immutable game state container
 *
 * This is the single source of truth for all game state.
 * All state mutations happen through the GameEngine, which creates
 * new state objects rather than mutating existing ones.
 *
 * C# Note: This maps to a class with init-only properties or a record type.
 */

import {
  GridCell, ActivePiece, PieceDefinition, FallingBlock,
  FloatingText, GoalMark, ScoreBreakdown, GameStats
} from '../types';
import { TOTAL_WIDTH, TOTAL_HEIGHT, INITIAL_TIME_MS, UPGRADE_CONFIG } from '../constants';
import { createInitialGrid, getPaletteForRank } from './systems/GridSystem';
import { calculateRankDetails } from '../utils/progression';

// Core game state - framework agnostic
export interface CoreGameState {
  // Grid
  grid: GridCell[][];
  boardOffset: number;

  // Pieces
  activePiece: ActivePiece | null;
  storedPiece: PieceDefinition | null;
  canSwap: boolean;

  // Falling blocks (sticky gravity)
  fallingBlocks: FallingBlock[];

  // Scoring
  score: number;
  combo: number;
  cellsCleared: number;
  scoreBreakdown: ScoreBreakdown;

  // Timer/Pressure
  timeLeft: number;
  maxTime: number;

  // Goals
  goalMarks: GoalMark[];
  goalsCleared: number;
  goalsTarget: number;

  // Game flow - matches original: countdown is number|null, separate gameOver/isPaused flags
  countdown: number | null;
  gameOver: boolean;
  isPaused: boolean;

  // Stats
  gameStats: GameStats;

  // Visual effects
  floatingTexts: FloatingText[];

  // Input state
  isSoftDropping: boolean;

  // Meta
  currentRank: number;
  gameSpeed: number;
}

// Configuration passed when creating a new game
export interface GameConfig {
  initialTotalScore: number;
  timeBonusLevel: number;
  stabilityLevel: number;
  scoreBoostLevel: number;
}

// Default configuration
export const DEFAULT_CONFIG: GameConfig = {
  initialTotalScore: 0,
  timeBonusLevel: 0,
  stabilityLevel: 0,
  scoreBoostLevel: 0,
};

const INITIAL_SPEED = 800;

// Factory function to create initial state
export function createInitialState(config: GameConfig = DEFAULT_CONFIG): CoreGameState {
  const rank = calculateRankDetails(config.initialTotalScore).rank;
  const palette = getPaletteForRank(rank);

  // Calculate max time from upgrades
  const maxTime = INITIAL_TIME_MS + (config.timeBonusLevel * UPGRADE_CONFIG.TIME_BONUS.effectPerLevel);

  // Calculate initial speed from upgrades
  const stabilityMod = config.stabilityLevel * UPGRADE_CONFIG.STABILITY.effectPerLevel;
  const gameSpeed = INITIAL_SPEED * (1 + stabilityMod);

  // Win condition: palette colors + rank
  const goalsTarget = palette.length + rank;

  return {
    grid: createInitialGrid(rank),
    boardOffset: 0,
    activePiece: null,
    storedPiece: null,
    canSwap: true,
    fallingBlocks: [],
    score: 0,
    combo: 0,
    cellsCleared: 0,
    scoreBreakdown: { base: 0, height: 0, offscreen: 0, adjacency: 0, speed: 0 },
    timeLeft: maxTime,
    maxTime,
    goalMarks: [],
    goalsCleared: 0,
    goalsTarget,
    countdown: 2, // Original starts at 2
    gameOver: false,
    isPaused: false,
    gameStats: { startTime: 0, totalBonusTime: 0, maxGroupSize: 0 },
    floatingTexts: [],
    isSoftDropping: false,
    currentRank: rank,
    gameSpeed,
  };
}

// Helper to create empty grid
export function createEmptyGrid(): GridCell[][] {
  return Array(TOTAL_HEIGHT).fill(null).map(() => Array(TOTAL_WIDTH).fill(null));
}

// Immutable state update helper
export function updateState(
  state: CoreGameState,
  updates: Partial<CoreGameState>
): CoreGameState {
  return { ...state, ...updates };
}

// Deep clone state (for undo/replay features)
export function cloneState(state: CoreGameState): CoreGameState {
  return {
    ...state,
    grid: state.grid.map(row => [...row]),
    fallingBlocks: state.fallingBlocks.map(b => ({ ...b, data: { ...b.data } })),
    goalMarks: state.goalMarks.map(g => ({ ...g })),
    floatingTexts: state.floatingTexts.map(t => ({ ...t })),
    scoreBreakdown: { ...state.scoreBreakdown },
    gameStats: { ...state.gameStats },
    activePiece: state.activePiece ? {
      ...state.activePiece,
      definition: { ...state.activePiece.definition },
      cells: state.activePiece.cells.map(c => ({ ...c })),
    } : null,
    storedPiece: state.storedPiece ? { ...state.storedPiece } : null,
  };
}
