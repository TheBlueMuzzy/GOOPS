/**
 * GoalSystem.ts - Goal mark spawning and tracking
 *
 * Handles goal spawning, consumption, and win condition.
 *
 * C# Note: Maps to a static class with pure methods.
 */

import { GoalMark, GridCell } from '../../types';
import { TOTAL_WIDTH, TOTAL_HEIGHT, BUFFER_HEIGHT, VISIBLE_HEIGHT } from '../../constants';
import { getPaletteForRank } from './GridSystem';
import { calculatePressure } from './PressureSystem';

// Goal constants
export const GOAL_SPAWN_INTERVAL_MS = 5000;

/**
 * Spawn a new goal mark
 * Returns null if no valid position or all colors already have goals
 */
export function spawnGoalMark(
  grid: GridCell[][],
  existingMarks: GoalMark[],
  rank: number,
  timeLeft: number,
  maxTime: number
): GoalMark | null {
  const palette = getPaletteForRank(rank);

  // Filter colors that already have a goal mark
  const usedColors = new Set(existingMarks.map(m => m.color));
  const availableColors = palette.filter(c => !usedColors.has(c));

  if (availableColors.length === 0) return null;

  const color = availableColors[Math.floor(Math.random() * availableColors.length)];

  // Calculate spawn Y based on pressure line
  const pressure = calculatePressure(timeLeft, maxTime);
  const waterHeightBlocks = 1 + (pressure * (VISIBLE_HEIGHT - 1));
  const pressureLineY = Math.floor(TOTAL_HEIGHT - waterHeightBlocks);

  // Spawn at pressure line (submerged area)
  const spawnY = Math.max(BUFFER_HEIGHT, Math.min(TOTAL_HEIGHT - 1, pressureLineY));

  // Try finding a valid empty spot (up to 20 attempts)
  for (let i = 0; i < 20; i++) {
    const x = Math.floor(Math.random() * TOTAL_WIDTH);
    const y = spawnY;

    // Ensure empty grid cell and no existing mark
    if (!grid[y][x] && !existingMarks.some(m => m.x === x && m.y === y)) {
      return {
        id: generateId(),
        x,
        y,
        color,
        spawnTime: Date.now(),
      };
    }
  }

  return null;
}

/**
 * Remove consumed goals from the list
 */
export function removeConsumedGoals(
  marks: GoalMark[],
  consumedIds: string[]
): GoalMark[] {
  const consumedSet = new Set(consumedIds);
  return marks.filter(m => !consumedSet.has(m.id));
}

/**
 * Check if win condition is met
 */
export function isWinConditionMet(
  goalsCleared: number,
  goalsTarget: number
): boolean {
  return goalsCleared >= goalsTarget;
}

/**
 * Calculate goals target based on rank
 */
export function calculateGoalsTarget(rank: number): number {
  const palette = getPaletteForRank(rank);
  return palette.length + rank;
}

/**
 * Calculate win bonus score
 */
export function calculateWinBonus(rank: number): number {
  return 5000 * rank;
}

// Helper to generate unique IDs
function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}
