
import { GameState, GoalMark, Crack, ActivePiece, FloatingText, TankCell } from '../types';
import { spawnGoalMark, normalizeX } from '../utils/gameLogic';
import { gameEventBus } from './events/EventBus';
import { GameEventType } from './events/GameEvents';
import { audio } from '../utils/audio';
import { calculateRankDetails } from '../utils/progression';

const GOAL_SPAWN_INTERVAL = 5000;

/**
 * Manages goal spawning and capture/destroy handling.
 * Operates on state passed to it (doesn't own state).
 */
export class GoalManager {
    /**
     * Try to spawn a new goal mark if conditions are met.
     * Returns the new goal (if any) and updated lastSpawnTime.
     * This is the legacy function - use trySpawnCrack for new Crack system.
     */
    trySpawnGoal(
        state: GameState,
        grid: TankCell[][],
        initialTotalScore: number,
        timeLeft: number,
        maxTime: number,
        lastSpawnTime: number
    ): { goal: GoalMark | null; newLastSpawnTime: number } {
        // Don't spawn if we've already cleared enough goals
        if (state.goalsCleared >= state.goalsTarget) {
            return { goal: null, newLastSpawnTime: lastSpawnTime };
        }

        // Check if enough time has passed
        const now = Date.now();
        if (now - lastSpawnTime <= GOAL_SPAWN_INTERVAL) {
            return { goal: null, newLastSpawnTime: lastSpawnTime };
        }

        // Calculate current rank for goal color palette
        const currentRank = calculateRankDetails(initialTotalScore + state.sessionXP).rank;

        // Check if CRACK_DOWN is active (crackDownRemaining > 0)
        const crackDownActive = state.crackDownRemaining > 0;

        // Try to spawn a goal
        const newGoal = spawnGoalMark(grid, state.goalMarks, currentRank, timeLeft, maxTime, crackDownActive);

        if (newGoal) {
            // Decrement CRACK_DOWN counter if active
            if (crackDownActive) {
                state.crackDownRemaining--;
                console.log(`CRACK_DOWN: Crack spawned at y=${newGoal.y} (${state.crackDownRemaining} remaining)`);
            }
            audio.playPop(1);
            return { goal: newGoal, newLastSpawnTime: now };
        }

        return { goal: null, newLastSpawnTime: now };
    }

    /**
     * Try to spawn a new Crack if conditions are met.
     * Creates a root crack cell (no parents) with random growth interval.
     */
    trySpawnCrack(
        state: GameState,
        grid: TankCell[][],
        initialTotalScore: number,
        timeLeft: number,
        maxTime: number,
        lastSpawnTime: number
    ): { crack: Crack | null; newLastSpawnTime: number } {
        // Don't spawn if we've already cleared enough goals
        if (state.goalsCleared >= state.goalsTarget) {
            return { crack: null, newLastSpawnTime: lastSpawnTime };
        }

        // Check if enough time has passed
        const now = Date.now();
        if (now - lastSpawnTime <= GOAL_SPAWN_INTERVAL) {
            return { crack: null, newLastSpawnTime: lastSpawnTime };
        }

        // Calculate current rank for goal color palette
        const currentRank = calculateRankDetails(initialTotalScore + state.sessionXP).rank;

        // Check if CRACK_DOWN is active (crackDownRemaining > 0)
        const crackDownActive = state.crackDownRemaining > 0;

        // Use existing spawnGoalMark to get position/color, then convert to Crack
        // Pass crackCells converted to GoalMark format for position checking
        const existingMarks = state.crackCells.map(c => ({
            id: c.id,
            x: c.x,
            y: c.y,
            color: c.color,
            spawnTime: c.spawnTime
        }));

        const newGoal = spawnGoalMark(grid, existingMarks, currentRank, timeLeft, maxTime, crackDownActive);

        if (newGoal) {
            // Convert GoalMark to Crack
            const newCrack: Crack = {
                id: newGoal.id,
                x: newGoal.x,
                y: newGoal.y,
                color: newGoal.color,
                parentIds: [],  // Root crack - no parents
                childIds: [],   // No children yet
                lastGrowthCheck: now,
                growthInterval: 7000 + Math.random() * 5000,  // Random 7-12 seconds
                spawnTime: newGoal.spawnTime
            };

            // Decrement CRACK_DOWN counter if active
            if (crackDownActive) {
                state.crackDownRemaining--;
                console.log(`CRACK_DOWN: Crack spawned at y=${newCrack.y} (${state.crackDownRemaining} remaining)`);
            }
            audio.playPop(1);
            return { crack: newCrack, newLastSpawnTime: now };
        }

        return { crack: null, newLastSpawnTime: now };
    }

    /**
     * Handle consumed and destroyed goals after piece lock.
     * Creates floating text for captures and emits events.
     */
    handleGoals(
        state: GameState,
        consumed: string[],
        destroyed: string[],
        piece: ActivePiece,
        emitChange: () => void
    ): void {
        // Only remove consumed goals - non-matching cracks persist under goop
        state.goalMarks = state.goalMarks.filter(g => !consumed.includes(g.id));

        // Also remove from crackCells (for new crack system rendering)
        const consumedSet = new Set(consumed);
        consumed.forEach(id => {
            const cell = state.crackCells.find(c => c.id === id);
            if (cell) {
                // Update parent/child references before removing
                cell.parentIds.forEach(parentId => {
                    const parent = state.crackCells.find(c => c.id === parentId);
                    if (parent) {
                        parent.childIds = parent.childIds.filter(cid => cid !== id);
                    }
                });
                cell.childIds.forEach(childId => {
                    const child = state.crackCells.find(c => c.id === childId);
                    if (child) {
                        child.parentIds = child.parentIds.filter(pid => pid !== id);
                    }
                });
            }
        });
        state.crackCells = state.crackCells.filter(c => !consumedSet.has(c.id));

        consumed.forEach(id => {
            const cx = normalizeX(piece.x);
            const cy = Math.floor(piece.y);
            const textId = Math.random().toString(36).substr(2, 9);

            state.floatingTexts.push({
                id: textId,
                text: 'Laser to Seal',
                x: cx,
                y: cy,
                life: 1,
                color: '#facc15'
            });

            // Schedule removal of floating text
            setTimeout(() => {
                state.floatingTexts = state.floatingTexts.filter(ft => ft.id !== textId);
                emitChange();
            }, 1000);

            gameEventBus.emit(GameEventType.GOAL_CAPTURED, { count: 1 });
        });
        // destroyed goals (non-matching color) are ignored - crack persists
    }

    /**
     * Handle consumed cracks using the new Crack system.
     * Only removes the specific cells that were covered by matching goop.
     * Remaining crack cells stay and can continue spreading from uncovered cells.
     */
    handleCrackConsumption(
        state: GameState,
        consumedIds: string[],
        piece: ActivePiece,
        emitChange: () => void
    ): void {
        if (consumedIds.length === 0) return;

        const removedIds = new Set(consumedIds);

        // Update parent/child references before removing cells
        consumedIds.forEach(id => {
            const cell = state.crackCells.find(c => c.id === id);
            if (!cell) return;

            // Remove this cell from its parents' childIds
            cell.parentIds.forEach(parentId => {
                const parent = state.crackCells.find(c => c.id === parentId);
                if (parent) {
                    parent.childIds = parent.childIds.filter(cid => cid !== id);
                }
            });

            // Remove this cell from its children's parentIds
            cell.childIds.forEach(childId => {
                const child = state.crackCells.find(c => c.id === childId);
                if (child) {
                    child.parentIds = child.parentIds.filter(pid => pid !== id);
                }
            });
        });

        // Remove only the consumed cells (not the whole connected group)
        state.crackCells = state.crackCells.filter(c => !removedIds.has(c.id));

        // Also sync to goalMarks for backward compatibility
        state.goalMarks = state.goalMarks.filter(g => !removedIds.has(g.id));

        // Create floating text for captures (only one per seal action)
        if (consumedIds.length > 0) {
            const cx = normalizeX(piece.x);
            const cy = Math.floor(piece.y);
            const textId = Math.random().toString(36).substr(2, 9);

            state.floatingTexts.push({
                id: textId,
                text: consumedIds.length > 1 ? `Sealed ${consumedIds.length}` : 'Sealed',
                x: cx,
                y: cy,
                life: 1,
                color: '#facc15'
            });

            setTimeout(() => {
                state.floatingTexts = state.floatingTexts.filter(ft => ft.id !== textId);
                emitChange();
            }, 1000);

            gameEventBus.emit(GameEventType.GOAL_CAPTURED, { count: consumedIds.length });
        }
    }

    /**
     * Count the number of connected crack groups (connected components).
     * Max 8 crack groups enforced.
     */
    countCracks(crackCells: Crack[]): number {
        if (crackCells.length === 0) return 0;

        const visited = new Set<string>();
        let componentCount = 0;

        for (const cell of crackCells) {
            if (visited.has(cell.id)) continue;

            // BFS/DFS to mark all connected cells
            const queue = [cell.id];
            while (queue.length > 0) {
                const currentId = queue.shift()!;
                if (visited.has(currentId)) continue;
                visited.add(currentId);

                const current = crackCells.find(c => c.id === currentId);
                if (!current) continue;

                // Add all connected cells (parents and children)
                current.parentIds.forEach(pid => {
                    if (!visited.has(pid)) queue.push(pid);
                });
                current.childIds.forEach(cid => {
                    if (!visited.has(cid)) queue.push(cid);
                });
            }

            componentCount++;
        }

        return componentCount;
    }

    /**
     * Get all cells in the same connected crack as the given cell.
     * Uses BFS to traverse parent/child relationships.
     */
    getConnectedComponent(cellId: string, crackCells: Crack[]): Crack[] {
        const visited = new Set<string>();
        const component: Crack[] = [];
        const queue = [cellId];

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            if (visited.has(currentId)) continue;
            visited.add(currentId);

            const cell = crackCells.find(c => c.id === currentId);
            if (!cell) continue;

            component.push(cell);

            // Add all connected cells
            cell.parentIds.forEach(pid => {
                if (!visited.has(pid)) queue.push(pid);
            });
            cell.childIds.forEach(cid => {
                if (!visited.has(cid)) queue.push(cid);
            });
        }

        return component;
    }

    /**
     * Check if a cell is a leaf (has no children).
     * Leaf cells have reduced spread chance.
     */
    isLeafCell(cellId: string, crackCells: Crack[]): boolean {
        const cell = crackCells.find(c => c.id === cellId);
        return cell ? cell.childIds.length === 0 : true;
    }
}

export const goalManager = new GoalManager();
