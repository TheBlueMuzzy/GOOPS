/**
 * PhysicsSystem.ts - Physics and gravity
 *
 * Handles falling blocks physics and piece gravity.
 *
 * C# Note: Maps to a static class with pure methods.
 */

import { FallingBlock, GridCell } from '../../types';
import { TOTAL_HEIGHT } from '../../constants';

// Physics constants
export const FALL_SPEED_FACTOR = 0.02; // Pixels per ms
export const SOFT_DROP_FACTOR = 20;    // Multiplier for soft drop speed
export const LOCK_DELAY_MS = 500;      // Time before piece locks

/**
 * Update falling blocks physics
 * Returns active (still falling) and landed blocks
 */
export function updateFallingBlocks(
  blocks: FallingBlock[],
  grid: GridCell[][],
  dt: number,
  gameSpeed: number
): { active: FallingBlock[]; landed: FallingBlock[] } {
  const active: FallingBlock[] = [];
  const landed: FallingBlock[] = [];
  const fallSpeed = FALL_SPEED_FACTOR * dt;

  // Sort by Y descending to process bottom blocks first
  const sortedBlocks = [...blocks].sort((a, b) => b.y - a.y);

  for (const block of sortedBlocks) {
    const nextY = block.y + fallSpeed;

    // Hit floor
    if (nextY >= TOTAL_HEIGHT - 1) {
      landed.push({ ...block, y: TOTAL_HEIGHT - 1 });
      continue;
    }

    // Check collision with grid
    const checkRow = Math.floor(nextY + 1);
    const col = block.x;

    if (grid[checkRow] && grid[checkRow][col]) {
      landed.push({ ...block, y: Math.floor(nextY) });
    } else {
      active.push({ ...block, y: nextY });
    }
  }

  return { active, landed };
}

/**
 * Calculate gravity movement amount for active piece
 */
export function calculateGravityMovement(
  dt: number,
  gameSpeed: number,
  isSoftDropping: boolean
): number {
  const effectiveSpeed = isSoftDropping
    ? gameSpeed / SOFT_DROP_FACTOR
    : gameSpeed;

  return dt / effectiveSpeed;
}

/**
 * Calculate effective lock delay
 */
export function calculateLockDelay(isSoftDropping: boolean): number {
  return isSoftDropping ? 50 : LOCK_DELAY_MS;
}
