import { GameState, CrackCell, GamePhase } from '../types';
import { TANK_HEIGHT, BUFFER_HEIGHT } from '../constants';
import { normalizeX } from '../utils/coordinates';
import { calculateRankDetails } from '../utils/progression';
import { goalManager } from './GoalManager';

// Expanding cracks constants (rank 30+)
const CRACK_GROWTH_INTERVAL_MS = 5000;  // Check growth every 5 seconds per crack
const MAX_ACTIVE_CRACKS = 8;            // Cap on total active cracks

export class CrackManager {
    /**
     * Tick crack growth for rank 30+ (Expanding Cracks mechanic).
     * Uses per-cell timers with random 3-5s intervals.
     * Spread chance = 10% base + pressureRatio, with leaf penalty.
     * Supports 8-direction spread and same-color merge.
     *
     * All parameters passed fresh each tick to avoid stale references after startRun().
     */
    public tickGrowth(
        state: GameState,
        initialTotalScore: number,
        powerUps: Record<string, number>,
        maxTime: number
    ): void {
        // Only active at rank 30+
        const startingRank = calculateRankDetails(initialTotalScore).rank;
        console.log('[CRACK DEBUG] tickGrowth called | score:', initialTotalScore, '| rank:', startingRank, '| phase:', state.phase, '| cells:', state.crackCells.length);

        if (startingRank < 30) {
            console.log('[CRACK DEBUG] Skipping - rank < 30');
            return;
        }

        // Don't grow when in Console or Minigame phases
        if (state.phase === GamePhase.CONSOLE ||
            state.phase === GamePhase.COMPLICATION_MINIGAME) {
            console.log('[CRACK DEBUG] Skipping - phase is', state.phase);
            return;
        }

        console.log('[CRACK DEBUG] Processing', state.crackCells.length, 'cells, maxTime:', maxTime);
        const now = Date.now();

        // Process each crack cell for growth
        for (const cell of state.crackCells) {
            // Skip spreading if this cell is covered by ANY goop (stops growth)
            if (state.grid[cell.y]?.[cell.x]) continue;

            // Check if timer elapsed (per-cell timer)
            if (now - cell.lastGrowthCheck < cell.growthInterval) continue;

            // Reset timer with new random interval
            cell.lastGrowthCheck = now;
            cell.growthInterval = 5000 + Math.random() * 5000; // Random 7-12s

            // Calculate spread chance
            const pressureRatio = Math.max(0, 1 - (state.timeLeft / maxTime));
            const baseChance = Math.min(1.0, 0.10 + pressureRatio);

            // Apply SLOW_CRACKS offset: -5% per level
            const slowCracksLevel = powerUps['SLOW_CRACKS'] || 0;
            const slowCracksOffset = slowCracksLevel * 0.05;
            let effectiveChance = Math.max(0, baseChance - slowCracksOffset);

            // Leaf penalty: 50% chance if no children
            const isLeaf = cell.childIds.length === 0;
            if (isLeaf) {
                effectiveChance *= 0.5;
            }

            // Distance penalty: 25% reduction per hop from root
            const distance = this.getDistanceFromRoot(cell, state.crackCells);
            const distanceMultiplier = Math.max(0.10, 1 - (distance * 0.25));
            effectiveChance *= distanceMultiplier;

            // Roll for spread
            if (Math.random() > effectiveChance) continue;

            // Get all 8 adjacent positions (orthogonal + diagonal)
            const adjacentSpots = [
                { x: normalizeX(cell.x + 1), y: cell.y },      // Right
                { x: normalizeX(cell.x - 1), y: cell.y },      // Left
                { x: cell.x, y: cell.y + 1 },                   // Down
                { x: cell.x, y: cell.y - 1 },                   // Up
                { x: normalizeX(cell.x + 1), y: cell.y - 1 },  // Up-Right
                { x: normalizeX(cell.x - 1), y: cell.y - 1 },  // Up-Left
                { x: normalizeX(cell.x + 1), y: cell.y + 1 },  // Down-Right
                { x: normalizeX(cell.x - 1), y: cell.y + 1 }   // Down-Left
            ];

            // Filter to valid targets
            const validTargets: { x: number; y: number; existingCrack?: CrackCell }[] = [];

            for (const spot of adjacentSpots) {
                // Must be in valid grid range
                if (spot.y < BUFFER_HEIGHT || spot.y >= TANK_HEIGHT) continue;

                // Check for existing same-color crack (merge target)
                const existingCrack = state.crackCells.find(
                    c => c.x === spot.x && c.y === spot.y && c.color === cell.color
                );

                if (existingCrack) {
                    // Can merge if not already connected
                    if (!cell.childIds.includes(existingCrack.id) &&
                        !cell.parentIds.includes(existingCrack.id)) {
                        validTargets.push({ ...spot, existingCrack });
                    }
                    continue;
                }

                // Check for any existing crack (can't grow into different color)
                const anyExistingCrack = state.crackCells.find(
                    c => c.x === spot.x && c.y === spot.y
                );
                if (anyExistingCrack) continue;

                // Check for empty cell (can grow into empty cells only)
                if (!state.grid[spot.y][spot.x]) {
                    validTargets.push(spot);
                }
            }

            if (validTargets.length === 0) continue;

            // Pick random valid target
            const target = validTargets[Math.floor(Math.random() * validTargets.length)];

            if (target.existingCrack) {
                // MERGE: Connect to existing same-color crack
                target.existingCrack.parentIds.push(cell.id);
                cell.childIds.push(target.existingCrack.id);
                console.log(`Crack merged: ${cell.id} -> ${target.existingCrack.id} at (${target.x}, ${target.y})`);
            } else {
                // NEW CRACK: Check if we can add more crack groups
                const currentCrackCount = goalManager.countCracks(state.crackCells);
                if (currentCrackCount >= MAX_ACTIVE_CRACKS) continue;

                // Create new crack cell connected to parent
                const newCrack: CrackCell = {
                    id: Math.random().toString(36).substr(2, 9),
                    x: target.x,
                    y: target.y,
                    color: cell.color,  // Same color as parent
                    parentIds: [cell.id],
                    childIds: [],
                    lastGrowthCheck: now,
                    growthInterval: 5000 + Math.random() * 5000,  // Random 7-12s
                    spawnTime: now
                };

                // Add child reference to parent
                cell.childIds.push(newCrack.id);

                // Add to crackCells array
                state.crackCells.push(newCrack);

                // Also add to goalMarks for backward compatibility
                state.goalMarks.push({
                    id: newCrack.id,
                    x: newCrack.x,
                    y: newCrack.y,
                    color: newCrack.color,
                    spawnTime: newCrack.spawnTime
                });

                console.log(`Crack grew: ${cell.id} -> ${newCrack.id} at (${target.x}, ${target.y}), pressure: ${(pressureRatio * 100).toFixed(1)}%, chance: ${(effectiveChance * 100).toFixed(1)}%`);
            }
        }
    }

    /**
     * Calculate distance from root for a crack cell.
     * Follows parentIds until reaching a cell with no parents (root).
     * Returns 0 for root cells.
     */
    private getDistanceFromRoot(cell: CrackCell, crackCells: CrackCell[]): number {
        if (cell.parentIds.length === 0) return 0;

        let distance = 0;
        let currentId = cell.id;
        const visited = new Set<string>();

        while (true) {
            if (visited.has(currentId)) break; // Prevent infinite loops from merges
            visited.add(currentId);

            const current = crackCells.find(c => c.id === currentId);
            if (!current || current.parentIds.length === 0) break;

            distance++;
            // Follow first parent (for merged cells, just pick one path)
            currentId = current.parentIds[0];

            // Safety limit
            if (distance > 20) break;
        }

        return distance;
    }
}
