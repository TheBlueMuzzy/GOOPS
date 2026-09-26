/**
 * ScoreSystem.ts - Score calculations
 *
 * Handles all score calculations, combos, and bonuses.
 *
 * C# Note: Maps to a static class with pure methods.
 */

import { GridCell, Coordinate, ScoreBreakdown } from '../../types';
import { TOTAL_HEIGHT, TOTAL_WIDTH, VISIBLE_WIDTH } from '../../constants';
import { normalizeX } from './GridSystem';

// Score constants
export const BASE_BLOCK_SCORE = 10;
export const HEIGHT_BONUS_PER_ROW = 10;
export const OFF_SCREEN_BONUS = 50;
export const ADJACENCY_BONUS_PER_NEIGHBOR = 5;
export const COMBO_MULTIPLIER_INCREMENT = 0.1;
export const HARD_DROP_SCORE_PER_ROW = 2;

/**
 * Calculate height bonus (higher blocks = more points)
 */
export function calculateHeightBonus(y: number): number {
  return Math.max(0, (TOTAL_HEIGHT - y) * HEIGHT_BONUS_PER_ROW);
}

/**
 * Calculate off-screen bonus (blocks far from view center)
 */
export function calculateOffScreenBonus(x: number, boardOffset: number): number {
  const center = normalizeX(boardOffset + VISIBLE_WIDTH / 2);
  let dist = Math.abs(x - center);
  if (dist > TOTAL_WIDTH / 2) dist = TOTAL_WIDTH - dist;

  if (dist > VISIBLE_WIDTH / 2) {
    return OFF_SCREEN_BONUS;
  }
  return 0;
}

/**
 * Calculate combo multiplier
 */
export function calculateMultiplier(combo: number): number {
  return 1 + (combo * COMBO_MULTIPLIER_INCREMENT);
}

/**
 * Calculate adjacency bonus (neighboring blocks of different colors)
 */
export function calculateAdjacencyBonus(
  grid: GridCell[][],
  group: Coordinate[]
): number {
  let neighborsCount = 0;
  const groupKeys = new Set(group.map(g => `${g.x},${g.y}`));

  group.forEach(({ x, y }) => {
    const neighbors = [
      { x: normalizeX(x + 1), y },
      { x: normalizeX(x - 1), y },
      { x, y: y + 1 },
      { x, y: y - 1 },
    ];

    neighbors.forEach(n => {
      if (n.y >= 0 && n.y < TOTAL_HEIGHT) {
        if (grid[n.y][n.x] && !groupKeys.has(`${n.x},${n.y}`)) {
          neighborsCount++;
        }
      }
    });
  });

  return neighborsCount * ADJACENCY_BONUS_PER_NEIGHBOR;
}

/**
 * Calculate total score for clearing a group
 */
export function calculateGroupClearScore(
  grid: GridCell[][],
  group: Coordinate[],
  boardOffset: number,
  combo: number
): { total: number; breakdown: ScoreBreakdown } {
  const breakdown: ScoreBreakdown = {
    base: 0,
    height: 0,
    offscreen: 0,
    adjacency: 0,
    speed: 0,
  };

  const multiplier = calculateMultiplier(combo);
  const adjacencyScore = calculateAdjacencyBonus(grid, group);
  breakdown.adjacency = adjacencyScore;

  let total = adjacencyScore;

  group.forEach(pt => {
    const baseScore = BASE_BLOCK_SCORE;
    const heightScore = calculateHeightBonus(pt.y);
    const offScreenScore = calculateOffScreenBonus(pt.x, boardOffset);

    const blockScore = (baseScore + heightScore + offScreenScore) * multiplier;
    total += blockScore;

    breakdown.base += baseScore * multiplier;
    breakdown.height += heightScore * multiplier;
    breakdown.offscreen += offScreenScore * multiplier;
  });

  return { total: Math.floor(total), breakdown };
}

/**
 * Calculate score for hard drop
 */
export function calculateHardDropScore(distance: number): number {
  return distance * HARD_DROP_SCORE_PER_ROW;
}

/**
 * Apply score boost from upgrades
 */
export function applyScoreBoost(score: number, boostLevel: number): number {
  const boostMultiplier = 1 + (boostLevel * 0.10); // 10% per level
  return Math.ceil(score * boostMultiplier);
}

/**
 * Add breakdown values with boost applied
 */
export function addBreakdownWithBoost(
  existing: ScoreBreakdown,
  addition: Partial<ScoreBreakdown>,
  boostMultiplier: number
): ScoreBreakdown {
  return {
    base: existing.base + (addition.base || 0) * boostMultiplier,
    height: existing.height + (addition.height || 0) * boostMultiplier,
    offscreen: existing.offscreen + (addition.offscreen || 0) * boostMultiplier,
    adjacency: existing.adjacency + (addition.adjacency || 0) * boostMultiplier,
    speed: existing.speed + (addition.speed || 0) * boostMultiplier,
  };
}
