
import { ComplicationType } from './types';
import { UPGRADES } from './constants';

/**
 * Centralized configuration for all complication-related values.
 * Single source of truth for triggers, thresholds, and effects.
 *
 * Note: Upgrade effects (drainUpgradeEffect, triggerUpgradeEffect, dissipationUpgradeEffect)
 * are now sourced from UPGRADES in constants.ts for consistency.
 */

// Per-complication configuration
export const COMPLICATION_CONFIG = {
  [ComplicationType.LASER]: {
    unlockRank: 4,
    capacitorMax: 100,       // Full capacitor value
    drainPerUnit: 4,         // Capacitor drain per unit popped
    drainUpgradeEffect: UPGRADES.CAPACITOR_EFFICIENCY.effectPerLevel, // -6.25% drain per upgrade level
  },
  [ComplicationType.LIGHTS]: {
    unlockRank: 2,
    triggerChanceBase: 0.20,  // 20% base trigger chance
    triggerUpgradeEffect: UPGRADES.CIRCUIT_STABILIZER.effectPerLevel, // -7.5% per upgrade level
    pressureGapMin: 3,        // Minimum rows between pressure and goop
    pressureGapMax: 5,        // Maximum rows (random in range)
  },
  [ComplicationType.CONTROLS]: {
    unlockRank: 6,
    heatMax: 100,             // Heat threshold for trigger
    heatPerRotation: 5,       // Heat added per rotation
    dissipationBase: 50,      // Heat drain per second when idle
    dissipationUpgradeEffect: UPGRADES.GEAR_LUBRICATION.effectPerLevel, // +12.5% per upgrade level
    idleThresholdMs: 200,     // Idle time before dissipation starts
  },
} as const;

// Cooldown configuration (shared across all complications)
export const COOLDOWN_CONFIG = {
  minSeconds: 8,  // Minimum cooldown duration
  maxSeconds: 20, // Base cooldown at unlock rank
  // Formula: max(minSeconds, maxSeconds - (rank - unlockRank))
} as const;

/**
 * Calculate cooldown duration in milliseconds for a complication type.
 * @param type The complication type
 * @param currentRank The player's current rank
 * @returns Cooldown duration in milliseconds
 */
export function calculateCooldownMs(type: ComplicationType, currentRank: number): number {
  const unlockRank = COMPLICATION_CONFIG[type].unlockRank;
  const cooldownSeconds = Math.max(
    COOLDOWN_CONFIG.minSeconds,
    COOLDOWN_CONFIG.maxSeconds - (currentRank - unlockRank)
  );
  return cooldownSeconds * 1000;
}

/**
 * Get the unlock rank for a complication type.
 */
export function getUnlockRank(type: ComplicationType): number {
  return COMPLICATION_CONFIG[type].unlockRank;
}

/**
 * Check if a complication type is unlocked at the given rank.
 */
export function isComplicationUnlocked(type: ComplicationType, rank: number): boolean {
  return rank >= COMPLICATION_CONFIG[type].unlockRank;
}
