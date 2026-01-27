
import { TankSystem } from './types';
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
  [TankSystem.LASER]: {
    unlockRank: 4,
    capacitorMax: 100,       // Full capacitor value
    drainPerUnit: 4,         // Capacitor drain per unit popped
    drainUpgradeEffect: UPGRADES.CAPACITOR_EFFICIENCY.effectPerLevel, // -6.25% drain per upgrade level
  },
  [TankSystem.LIGHTS]: {
    unlockRank: 2,
    // Brightness-based system (player-controlled via fast drop)
    graceBaseSec: 5,           // Base grace period before dimming starts
    gracePerLevel: 0.75,       // +0.75s per CIRCUIT_STABILIZER level (max 8s at level 4)
    dimDurationSec: 5,         // Time to dim from 100% to 10%
    recoverRate: 400,          // % per second when fast dropping (0.25s from 0->100)
    overflarePeak: 110,        // Brief brightness peak after recovery
    overflareUpMs: 50,         // Time to reach overflare peak
    overflareDownMs: 100,      // Time to return from overflare to 100%
    dimThreshold: 10,          // Brightness % that triggers malfunction
    failedBrightness: 5,       // Brightness when malfunction active
    snapToFailMs: 100,         // Time to snap from 10% to 5%
    flickerDipBrightness: 70,  // Brightness during flicker dip
    flickerDipMs: 80,          // Time at dip brightness
    flickerRecoverMs: 120,     // Time to return to 100 from flicker
  },
  [TankSystem.CONTROLS]: {
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
export function calculateCooldownMs(type: TankSystem, currentRank: number): number {
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
export function getUnlockRank(type: TankSystem): number {
  return COMPLICATION_CONFIG[type].unlockRank;
}

/**
 * Check if a complication type is unlocked at the given rank.
 */
export function isComplicationUnlocked(type: TankSystem, rank: number): boolean {
  return rank >= COMPLICATION_CONFIG[type].unlockRank;
}
