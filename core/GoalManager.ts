
import { GameState, GoalMark, ActivePiece, FloatingText, GridCell } from '../types';
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
     */
    trySpawnGoal(
        state: GameState,
        grid: GridCell[][],
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
        const currentRank = calculateRankDetails(initialTotalScore + state.score).rank;

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
        const goalsToRemove = [...consumed, ...destroyed];
        state.goalMarks = state.goalMarks.filter(g => !goalsToRemove.includes(g.id));

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

        destroyed.forEach(id => {
            gameEventBus.emit(GameEventType.ACTION_REJECTED);
        });
    }
}

export const goalManager = new GoalManager();
