/**
 * PressureSystem.ts - Timer and pressure mechanics
 *
 * Handles the pressure/water level system, time recovery,
 * and tap eligibility based on pressure threshold.
 *
 * C# Note: Maps to a static class with pure methods.
 */

import {
  TOTAL_HEIGHT, VISIBLE_HEIGHT,
  PRESSURE_RECOVERY_BASE_MS, PRESSURE_RECOVERY_PER_UNIT_MS,
  PRESSURE_TIER_THRESHOLD, PRESSURE_TIER_STEP, PRESSURE_TIER_BONUS_MS
} from '../../constants';

/**
 * Calculate pressure ratio (0 = full time, 1 = no time)
 */
export function calculatePressure(timeLeft: number, maxTime: number): number {
  if (timeLeft <= 0) return 1;
  return Math.max(0, 1 - (timeLeft / maxTime));
}

/**
 * Calculate the Y threshold for block tapping eligibility.
 * Blocks must have their group's top (minY) below this line.
 */
export function calculatePressureThresholdY(
  timeLeft: number,
  maxTime: number
): number {
  const pressure = calculatePressure(timeLeft, maxTime);
  // At pressure 0: threshold is at bottom (row 18)
  // At pressure 1: threshold moves up to row 3
  return (TOTAL_HEIGHT - 1) - (pressure * (VISIBLE_HEIGHT - 1));
}

/**
 * Check if a group is eligible for tapping based on pressure
 */
export function isGroupSubmerged(
  groupMinY: number,
  timeLeft: number,
  maxTime: number
): boolean {
  const thresholdY = calculatePressureThresholdY(timeLeft, maxTime);
  // Group must have its top (minY) at or below the threshold
  return groupMinY >= thresholdY;
}

/**
 * Calculate time recovery for clearing a group
 */
export function calculateTimeRecovery(groupSize: number): number {
  const baseRecovery = PRESSURE_RECOVERY_BASE_MS;
  const unitRecovery = groupSize * PRESSURE_RECOVERY_PER_UNIT_MS;

  let tierRecovery = 0;
  if (groupSize >= PRESSURE_TIER_THRESHOLD) {
    const tier = Math.floor((groupSize - PRESSURE_TIER_THRESHOLD) / PRESSURE_TIER_STEP) + 1;
    tierRecovery = tier * PRESSURE_TIER_BONUS_MS;
  }

  return baseRecovery + unitRecovery + tierRecovery;
}

/**
 * Check if a group is ready to be tapped (fill animation complete)
 */
export function isGroupReady(
  groupTimestamp: number,
  groupSize: number,
  perBlockDuration: number
): boolean {
  const totalDuration = groupSize * perBlockDuration;
  const elapsed = Date.now() - groupTimestamp;
  return elapsed >= totalDuration;
}

/**
 * Calculate fill progress for a group (0-1)
 */
export function calculateFillProgress(
  groupTimestamp: number,
  groupSize: number,
  perBlockDuration: number
): number {
  const totalDuration = groupSize * perBlockDuration;
  const elapsed = Date.now() - groupTimestamp;
  return Math.min(1, elapsed / totalDuration);
}

/**
 * Calculate water height in blocks for rendering
 */
export function calculateWaterHeight(
  timeLeft: number,
  maxTime: number
): number {
  const pressure = calculatePressure(timeLeft, maxTime);
  return 1 + (pressure * (VISIBLE_HEIGHT - 1));
}

/**
 * Update time with decay
 */
export function updateTime(
  currentTime: number,
  dt: number,
  maxTime: number
): number {
  return Math.max(0, currentTime - dt);
}

/**
 * Add time with cap
 */
export function addTime(
  currentTime: number,
  amount: number,
  maxTime: number
): number {
  return Math.min(maxTime, currentTime + amount);
}
