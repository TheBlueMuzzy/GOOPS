
import { GameState, ComplicationType, Complication, GridCell } from '../types';
import { COMPLICATION_CONFIG, calculateCooldownMs, isComplicationUnlocked } from '../complicationConfig';
import { TOTAL_WIDTH, TOTAL_HEIGHT, VISIBLE_HEIGHT, BUFFER_HEIGHT } from '../constants';
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
    ): { spawned: ComplicationType | null; newLastCheckTime: number } {
        const now = Date.now();
        if (now - lastCheckTime < COMPLICATION_CHECK_INTERVAL) {
            return { spawned: null, newLastCheckTime: lastCheckTime };
        }

        // Helper to check if a specific complication type is already active
        const hasComplication = (type: ComplicationType) =>
            state.complications.some(c => c.type === type);

        // Helper to check if a complication type is on cooldown
        const isOnCooldown = (type: ComplicationType) =>
            now < state.complicationCooldowns[type];

        // Complications unlock progressively by starting rank (not mid-run rank)
        const rank = calculateRankDetails(initialTotalScore).rank;
        const controlsConfig = COMPLICATION_CONFIG[ComplicationType.CONTROLS];

        let spawned: ComplicationType | null = null;

        // LASER: Triggered when capacitor drains to 0
        if (!hasComplication(ComplicationType.LASER) &&
            !isOnCooldown(ComplicationType.LASER) &&
            isComplicationUnlocked(ComplicationType.LASER, rank) &&
            state.laserCapacitor <= 0) {
            spawned = ComplicationType.LASER;
        }
        // CONTROLS: Triggered when heat meter reaches max
        else if (!hasComplication(ComplicationType.CONTROLS) &&
            !isOnCooldown(ComplicationType.CONTROLS) &&
            isComplicationUnlocked(ComplicationType.CONTROLS, rank) &&
            state.controlsHeat >= controlsConfig.heatMax) {
            spawned = ComplicationType.CONTROLS;
        }

        // LIGHTS: Triggered on piece lock (handled by checkLightsTrigger)

        return { spawned, newLastCheckTime: now };
    }

    /**
     * Spawn a new complication of the given type.
     * Returns the new complication object.
     */
    spawnComplication(state: GameState, type: ComplicationType): Complication {
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
                case ComplicationType.LASER:
                    state.laserCapacitor = COMPLICATION_CONFIG[ComplicationType.LASER].capacitorMax;
                    state.primedGroups.clear();
                    break;
                case ComplicationType.CONTROLS:
                    state.controlsHeat = 0;
                    state.rotationTimestamps = [];
                    break;
                case ComplicationType.LIGHTS:
                    // No counter to reset - chance automatically resumes after resolution
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

    /**
     * Check if LIGHTS complication should trigger on piece lock.
     * Returns true if LIGHTS should spawn.
     */
    checkLightsTrigger(
        state: GameState,
        initialTotalScore: number,
        maxTime: number,
        powerUps: Record<string, number>,
        grid: GridCell[][]
    ): boolean {
        const startingRank = calculateRankDetails(initialTotalScore).rank;
        const hasLightsActive = state.complications.some(c => c.type === ComplicationType.LIGHTS);
        const lightsOnCooldown = Date.now() < state.complicationCooldowns[ComplicationType.LIGHTS];
        const lightsConfig = COMPLICATION_CONFIG[ComplicationType.LIGHTS];

        if (!isComplicationUnlocked(ComplicationType.LIGHTS, startingRank) || hasLightsActive || lightsOnCooldown) {
            return false;
        }

        // Find highest goop row (lowest Y value with any block)
        let highestGoopY = TOTAL_HEIGHT;
        for (let y = 0; y < TOTAL_HEIGHT; y++) {
            for (let x = 0; x < TOTAL_WIDTH; x++) {
                if (grid[y][x]) {
                    highestGoopY = y;
                    break;
                }
            }
            if (highestGoopY < TOTAL_HEIGHT) break;
        }

        // Calculate pressure line Y position
        const pressureRatio = Math.max(0, 1 - (state.timeLeft / maxTime));
        const waterHeightBlocks = 1 + (pressureRatio * (VISIBLE_HEIGHT - 1));
        const pressureLineY = BUFFER_HEIGHT + (VISIBLE_HEIGHT - waterHeightBlocks);

        // Gap = rows between pressure line and highest goop
        const gap = highestGoopY - pressureLineY;

        // Random threshold from config range
        const gapRange = lightsConfig.pressureGapMax - lightsConfig.pressureGapMin + 1;
        const gapThreshold = Math.floor(Math.random() * gapRange) + lightsConfig.pressureGapMin;

        // Trigger chance with upgrade modifier
        const lightsLevel = powerUps['LIGHTS'] || 0;
        const triggerChance = lightsConfig.triggerChanceBase - (lightsConfig.triggerUpgradeEffect * lightsLevel);

        return gap >= gapThreshold && Math.random() < triggerChance;
    }
}

export const complicationManager = new ComplicationManager();
