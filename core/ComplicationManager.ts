
import { GameState, TankSystem, Complication } from '../types';
import { COMPLICATION_CONFIG, calculateCooldownMs, isComplicationUnlocked } from '../complicationConfig';
import { calculateRankDetails } from '../utils/progression';
import { gameEventBus } from './events/EventBus';
import { GameEventType } from './events/GameEvents';
import { audio } from '../utils/audio';

const COMPLICATION_CHECK_INTERVAL = 1000;

/**
 * Manages complication spawning, checking, and resolution.
 * Operates on state passed to it (doesn't own state).
 */
export class ComplicationManager {
    /**
     * Check and spawn complications based on current state.
     * Returns the type of complication spawned (if any) and updated lastCheckTime.
     */
    checkComplications(
        state: GameState,
        initialTotalScore: number,
        lastCheckTime: number
    ): { spawned: TankSystem | null; newLastCheckTime: number } {
        const now = Date.now();
        if (now - lastCheckTime < COMPLICATION_CHECK_INTERVAL) {
            return { spawned: null, newLastCheckTime: lastCheckTime };
        }

        // Helper to check if a specific complication type is already active
        const hasComplication = (type: TankSystem) =>
            state.complications.some(c => c.type === type);

        // Helper to check if a complication type is on cooldown
        const isOnCooldown = (type: TankSystem) =>
            now < state.complicationCooldowns[type];

        // Complications unlock progressively by starting rank (not mid-run rank)
        const rank = calculateRankDetails(initialTotalScore).rank;
        const controlsConfig = COMPLICATION_CONFIG[TankSystem.CONTROLS];

        let spawned: TankSystem | null = null;

        // LASER: Triggered when capacitor drains to 0
        if (!hasComplication(TankSystem.LASER) &&
            !isOnCooldown(TankSystem.LASER) &&
            isComplicationUnlocked(TankSystem.LASER, rank) &&
            state.laserCapacitor <= 0) {
            spawned = TankSystem.LASER;
        }
        // CONTROLS: Triggered when heat meter reaches max
        else if (!hasComplication(TankSystem.CONTROLS) &&
            !isOnCooldown(TankSystem.CONTROLS) &&
            isComplicationUnlocked(TankSystem.CONTROLS, rank) &&
            state.controlsHeat >= controlsConfig.heatMax) {
            spawned = TankSystem.CONTROLS;
        }

        // LIGHTS: Triggered by brightness system in GameEngine.tickLightsBrightness()

        return { spawned, newLastCheckTime: now };
    }

    /**
     * Spawn a new complication of the given type.
     * Returns the new complication object.
     */
    spawnComplication(state: GameState, type: TankSystem): Complication {
        const id = Math.random().toString(36).substr(2, 9);
        const complication: Complication = {
            id,
            type,
            startTime: Date.now(),
            severity: 1
        };

        // Create new array so React detects the change
        state.complications = [...state.complications, complication];

        gameEventBus.emit(GameEventType.COMPLICATION_SPAWNED, { type });
        return complication;
    }

    /**
     * Resolve an active complication.
     * Mutates state directly (same pattern as GameEngine).
     */
    resolveComplication(
        state: GameState,
        complicationId: string,
        initialTotalScore: number,
        powerUps: Record<string, number>
    ): void {
        // Check which complication type is being resolved
        const complication = state.complications.find(c => c.id === complicationId);
        if (complication) {
            // Reset the corresponding counter so next trigger starts fresh
            switch (complication.type) {
                case TankSystem.LASER:
                    state.laserCapacitor = COMPLICATION_CONFIG[TankSystem.LASER].capacitorMax;
                    state.primedGroups.clear();
                    break;
                case TankSystem.CONTROLS:
                    state.controlsHeat = 0;
                    state.rotationTimestamps = [];
                    break;
                case TankSystem.LIGHTS:
                    // Reset brightness system - lights back to full, grace period starts fresh
                    state.lightsBrightness = 100;
                    state.lightsGraceStart = Date.now(); // Start grace period immediately
                    state.lightsFlickered = false;
                    break;
            }

            // Set cooldown using centralized config
            const rank = calculateRankDetails(initialTotalScore + state.score).rank;
            const cooldownMs = calculateCooldownMs(complication.type, rank);
            state.complicationCooldowns[complication.type] = Date.now() + cooldownMs;
        }

        state.complications = state.complications.filter(c => c.id !== complicationId);
        state.activeComplicationId = null;

        gameEventBus.emit(GameEventType.COMPLICATION_RESOLVED);
        audio.playPop(5); // Success sound
    }

    // NOTE: checkLightsTrigger() removed - LIGHTS is now triggered by brightness system
    // in GameEngine.tickLightsBrightness() based on fast drop behavior

    /**
     * Extend all active complication cooldowns by a percentage.
     * Used by COOLDOWN_BOOSTER active ability.
     * @param state - Current game state
     * @param extensionPercent - Percentage to extend cooldowns (0.25 = 25%)
     */
    extendAllCooldowns(
        state: GameState,
        extensionPercent: number
    ): void {
        const now = Date.now();

        for (const type of Object.values(TankSystem)) {
            const cooldownEnd = state.complicationCooldowns[type];
            if (cooldownEnd > now) {
                // Cooldown is active, extend it
                const remainingMs = cooldownEnd - now;
                const extensionMs = remainingMs * extensionPercent;
                state.complicationCooldowns[type] = cooldownEnd + extensionMs;
            }
        }
    }

    /**
     * Reduce all active complication cooldowns by a percentage.
     * Used by SEALING_BONUS passive effect when sealing crack-goop.
     * @param state - Current game state
     * @param reductionPercent - Percentage to reduce remaining cooldown (0.10 = 10%)
     */
    reduceAllCooldowns(
        state: GameState,
        reductionPercent: number
    ): void {
        const now = Date.now();

        for (const type of Object.values(TankSystem)) {
            const cooldownEnd = state.complicationCooldowns[type];
            if (cooldownEnd > now) {
                // Cooldown is active, reduce remaining time
                const remainingMs = cooldownEnd - now;
                const reductionMs = remainingMs * reductionPercent;
                state.complicationCooldowns[type] = Math.max(now, cooldownEnd - reductionMs);
            }
        }
    }
}

export const complicationManager = new ComplicationManager();
