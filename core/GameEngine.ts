
import { GameState, GridCell, ActivePiece, PieceDefinition, FallingBlock, ScoreBreakdown, GameStats, FloatingText, GoalMark, GamePhase, PieceState, PieceType, Complication, ComplicationType } from '../types';
import {
    TOTAL_WIDTH, TOTAL_HEIGHT, VISIBLE_WIDTH, VISIBLE_HEIGHT, BUFFER_HEIGHT, PER_BLOCK_DURATION, INITIAL_TIME_MS,
    PRESSURE_RECOVERY_BASE_MS, PRESSURE_RECOVERY_PER_UNIT_MS, PRESSURE_TIER_THRESHOLD, PRESSURE_TIER_STEP, PRESSURE_TIER_BONUS_MS,
    PIECES
} from '../constants';
import { COMPLICATION_CONFIG, isComplicationUnlocked } from '../complicationConfig';
import {
    spawnPiece, checkCollision, mergePiece, getRotatedCells, findContiguousGroup,
    updateGroups, getGhostY, updateFallingBlocks, getFloatingBlocks,
    calculateHeightBonus, calculateOffScreenBonus, calculateMultiplier, calculateAdjacencyBonus, createInitialGrid,
    getPaletteForRank
} from '../utils/gameLogic';
import { getGridX } from '../utils/coordinates';
import { calculateRankDetails } from '../utils/progression';
import { gameEventBus } from './events/EventBus';
import { GameEventType } from './events/GameEvents';
import { Command } from './commands/Command';
import { complicationManager } from './ComplicationManager';
import { goalManager } from './GoalManager';

const INITIAL_SPEED = 800; // ms per block
const MIN_SPEED = 100;
const SOFT_DROP_FACTOR = 6; // Reduced from 20 to make it feel less like a hard drop
const LOCK_DELAY_MS = 500;

export class GameEngine {
    public state: GameState;
    private listeners: Set<() => void> = new Set();
    
    // Internal state tracking - Public for Commands to access
    public maxTime: number = INITIAL_TIME_MS;
    public lockStartTime: number | null = null;
    public lastGoalSpawnTime: number = 0;
    public lastComplicationCheckTime: number = 0;
    public isSoftDropping: boolean = false;
    public initialTotalScore: number = 0;
    public powerUps: Record<string, number> = {};
    public isSessionActive: boolean = false;

    private pendingTotalScore: number | null = null;

    // Generate random complication threshold in range [12, 24]
    private randomThreshold(): number {
        return Math.floor(Math.random() * 13) + 12; // 12 to 24 inclusive
    }

    constructor(initialTotalScore: number, powerUps: Record<string, number> = {}) {
        this.initialTotalScore = initialTotalScore;
        this.powerUps = powerUps;
        
        // Calculate initial configuration
        const startRank = calculateRankDetails(initialTotalScore).rank;
        const palette = getPaletteForRank(startRank);
        const goalsTarget = palette.length + startRank;

        this.state = {
            grid: createInitialGrid(startRank),
            boardOffset: 0,
            activePiece: null,
            storedPiece: null,
            score: 0,
            gameOver: false,
            isPaused: false,
            canSwap: true,
            level: 1,
            cellsCleared: 0,
            combo: 0,
            fallingBlocks: [],
            timeLeft: INITIAL_TIME_MS,
            scoreBreakdown: { base: 0, height: 0, offscreen: 0, adjacency: 0, speed: 0 },
            gameStats: { startTime: 0, totalBonusTime: 0, maxGroupSize: 0 },
            floatingTexts: [],
            goalMarks: [],
            goalsCleared: 0,
            goalsTarget: goalsTarget,
            phase: GamePhase.CONSOLE, // Start in Console
            complications: [],
            activeComplicationId: null,
            totalUnitsAdded: 0,
            totalUnitsPopped: 0,
            totalRotations: 0,
            rotationTimestamps: [],
            complicationThresholds: {
                lights: this.randomThreshold(),
                controls: this.randomThreshold(),
                laser: this.randomThreshold()
            },
            primedGroups: new Set(),
            laserCapacitor: 100,  // Starts full
            controlsHeat: 0,      // Starts cool
            complicationCooldowns: {
                [ComplicationType.LIGHTS]: 0,
                [ComplicationType.CONTROLS]: 0,
                [ComplicationType.LASER]: 0
            },

            // Active ability tracking
            activeCharges: {},     // Will be populated based on equipped actives
            crackGoopPopped: 0     // Count of glowing goop popped (for charging actives)
        };

        this.applyUpgrades();
    }

    public execute(command: Command) {
        command.execute(this);
    }

    private applyUpgrades() {
        // System upgrades are now applied in complication-specific code (Plans 07-02)
        // Base maxTime remains INITIAL_TIME_MS (no time bonus upgrade)
        this.maxTime = INITIAL_TIME_MS;

        // Reset time if we haven't started playing yet
        if (this.state.gameStats.startTime === 0) {
            this.state.timeLeft = this.maxTime;
        }
    }

    public subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    public emitChange() {
        this.listeners.forEach(l => l());
    }

    public syncTotalScore(score: number) {
        // If we are in Game Over state, we defer the update of initialTotalScore
        // This prevents double-counting the run score which is added by the parent App
        // while we are still displaying the current run's score in the state.
        if (this.state.gameOver) {
            this.pendingTotalScore = score;
        } else {
            this.initialTotalScore = score;
            this.pendingTotalScore = null;
        }
    }

    public startRun() {
        const startRank = calculateRankDetails(this.initialTotalScore).rank;
        const palette = getPaletteForRank(startRank);
        const newTarget = palette.length + startRank;

        this.state = {
            ...this.state,
            grid: createInitialGrid(startRank),
            boardOffset: 0,
            score: 0,
            gameOver: false,
            isPaused: false,
            activePiece: null,
            storedPiece: {
                ...PIECES[Math.floor(Math.random() * PIECES.length)],
                color: palette[Math.floor(Math.random() * palette.length)]
            },
            canSwap: true,
            combo: 0,
            cellsCleared: 0,
            fallingBlocks: [],
            timeLeft: this.maxTime,
            floatingTexts: [],
            goalMarks: [],
            goalsCleared: 0,
            goalsTarget: newTarget,
            gameStats: { startTime: Date.now(), totalBonusTime: 0, maxGroupSize: 0 },
            scoreBreakdown: { base: 0, height: 0, offscreen: 0, adjacency: 0, speed: 0 },
            phase: GamePhase.PERISCOPE,
            complications: [],
            activeComplicationId: null,
            totalUnitsAdded: 0,
            totalUnitsPopped: 0,
            totalRotations: 0,
            rotationTimestamps: [],
            complicationThresholds: {
                lights: this.randomThreshold(),
                controls: this.randomThreshold(),
                laser: this.randomThreshold()
            },
            primedGroups: new Set(),
            laserCapacitor: 100,  // Starts full
            controlsHeat: 0,      // Starts cool
            complicationCooldowns: {
                [ComplicationType.LIGHTS]: 0,
                [ComplicationType.CONTROLS]: 0,
                [ComplicationType.LASER]: 0
            }
        };

        this.lockStartTime = null;
        this.lastGoalSpawnTime = Date.now();
        this.lastComplicationCheckTime = Date.now();
        this.isSoftDropping = false;
        this.isSessionActive = true;
        
        this.spawnNewPiece();
        gameEventBus.emit(GameEventType.GAME_START);
        gameEventBus.emit(GameEventType.MUSIC_START);
        this.emitChange();
    }

    public resetSession() {
        // Go to idle state without starting a run
        this.state.gameOver = false;
        this.isSessionActive = false;
        this.state.phase = GamePhase.CONSOLE;
        this.state.score = 0; // Reset run score
        
        // Apply any pending total score update from the previous run
        if (this.pendingTotalScore !== null) {
            this.initialTotalScore = this.pendingTotalScore;
            this.pendingTotalScore = null;
        }

        this.emitChange();
    }

    public abortRun() {
        if (!this.isSessionActive || this.state.gameOver) return;
        
        // 1. Zero out score and goals to prevent XP gain and Win Bonus
        this.state.score = 0;
        this.state.goalsCleared = 0; 
        
        // 2. Trigger standard Game Over flow (monitor drops, penalties calc, etc)
        // Note: finalizeGame calculates penalty based on leftover blocks. 
        // It subtracts penalty from score. Math.max(0, 0 - penalty) results in 0 final score.
        this.finalizeGame();
    }

    public enterConsole() {
        this.state.phase = GamePhase.CONSOLE;
        this.emitChange();
    }

    public enterPeriscope() {
        if (this.state.gameOver) {
            this.startRun();
        } else {
            this.state.phase = GamePhase.PERISCOPE;
            if (!this.isSessionActive) {
                 this.startRun();
            }
        }
        this.emitChange();
    }
    
    // --- Complication Logic ---

    public resolveComplication(complicationId: string) {
        if (this.state.gameOver) return;

        complicationManager.resolveComplication(
            this.state,
            complicationId,
            this.initialTotalScore,
            this.powerUps
        );

        // Go back to Console after repair to confirm status
        this.state.phase = GamePhase.CONSOLE;
        this.emitChange();
    }

    private checkComplications(dt: number) {
        const { spawned, newLastCheckTime } = complicationManager.checkComplications(
            this.state,
            this.initialTotalScore,
            this.lastComplicationCheckTime
        );

        this.lastComplicationCheckTime = newLastCheckTime;

        if (spawned) {
            complicationManager.spawnComplication(this.state, spawned);
            this.emitChange();
        }
    }

    public finalizeGame() {
        if (this.state.gameOver) return;
        this.state.gameOver = true;
        this.isSessionActive = false;

        // Switch to console to show the End Day screen
        this.state.phase = GamePhase.CONSOLE;

        // 1. Calculate and Apply Win Bonus (Operator Rank * 5000)
        // This ensures the bonus is part of the final score sent to save system
        if (this.state.goalsCleared >= this.state.goalsTarget) {
            const startRank = calculateRankDetails(this.initialTotalScore).rank;
            const winBonus = startRank * 5000;
            this.state.score += winBonus;
        }

        // 2. Calculate Penalty for leftover blocks
        let remainingBlocks = 0;
        for (let y = 0; y < TOTAL_HEIGHT; y++) {
            for (let x = 0; x < TOTAL_WIDTH; x++) {
                if (this.state.grid[y][x]) {
                    remainingBlocks++;
                }
            }
        }

        const penalty = remainingBlocks * 50;
        this.state.gameStats.penalty = penalty;

        // 3. Apply Penalty
        this.state.score = Math.max(0, this.state.score - penalty);

        // 4. Apply XP floor: minimum XP = 100 * starting rank
        // Prevents high-rank players from getting zero-gain runs
        const startingRank = calculateRankDetails(this.initialTotalScore).rank;
        const xpFloor = 100 * startingRank;
        this.state.score = Math.max(xpFloor, this.state.score);

        // 5. Clear any active complications so they don't show on end screen
        this.state.complications = [];
        this.state.activeComplicationId = null;
        this.state.primedGroups.clear();

        gameEventBus.emit(GameEventType.GAME_OVER);
        this.emitChange();
    }

    public spawnNewPiece(pieceDef?: PieceDefinition, gridOverride?: GridCell[][], offsetOverride?: number) {
        const currentGrid = gridOverride || this.state.grid;
        const currentOffset = offsetOverride !== undefined ? offsetOverride : this.state.boardOffset;
        const currentTotalScore = this.initialTotalScore + this.state.score;
        const currentRank = calculateRankDetails(currentTotalScore).rank;

        const piece = spawnPiece(pieceDef, currentRank);
        
        // LOGIC: Spawn at top center of visible viewport
        // Map visible center to grid coordinate based on board offset
        const spawnVisualX = Math.floor((VISIBLE_WIDTH - 1) / 2);
        const spawnVisualY = 0;

        piece.screenX = spawnVisualX; // Screen Space Source of Truth
        piece.x = getGridX(spawnVisualX, currentOffset); // Grid Space Derived
        
        piece.y = spawnVisualY;
        piece.startSpawnY = spawnVisualY;
        piece.state = PieceState.FALLING; 

        this.lockStartTime = null;

        // Check immediate collision on spawn (Game Over condition)
        if (checkCollision(currentGrid, piece, currentOffset)) {
             this.finalizeGame();
        }

        this.state.activePiece = piece;
        this.state.canSwap = true;
        
        this.emitChange();
    }

    public updateScoreAndStats(pointsToAdd: number, breakdown?: Partial<ScoreBreakdown>) {
        // Score boost upgrade removed - points are now unmodified
        this.state.score += pointsToAdd;

        if (breakdown) {
            this.state.scoreBreakdown.base += (breakdown.base || 0);
            this.state.scoreBreakdown.height += (breakdown.height || 0);
            this.state.scoreBreakdown.offscreen += (breakdown.offscreen || 0);
            this.state.scoreBreakdown.adjacency += (breakdown.adjacency || 0);
            this.state.scoreBreakdown.speed += (breakdown.speed || 0);
        }
    }

    public handleGoals(consumed: string[], destroyed: string[], piece: ActivePiece) {
        goalManager.handleGoals(
            this.state,
            consumed,
            destroyed,
            piece,
            () => this.emitChange()
        );
    }

    // --- Tick Sub-Methods ---

    /**
     * Handle timer countdown. Returns false if game ended (caller should stop processing).
     */
    private tickTimer(dt: number): boolean {
        this.state.timeLeft = Math.max(0, this.state.timeLeft - dt);
        if (this.state.timeLeft <= 0) {
            this.finalizeGame();
            return false;
        }
        return true;
    }

    /**
     * Spawn goal marks at regular intervals.
     */
    private tickGoals(): void {
        const { goal, newLastSpawnTime } = goalManager.trySpawnGoal(
            this.state,
            this.state.grid,
            this.initialTotalScore,
            this.state.timeLeft,
            this.maxTime,
            this.lastGoalSpawnTime
        );

        this.lastGoalSpawnTime = newLastSpawnTime;

        if (goal) {
            this.state.goalMarks.push(goal);
        }
    }

    /**
     * Handle CONTROLS heat dissipation when not actively rotating.
     */
    private tickHeat(dt: number): void {
        const startingRank = calculateRankDetails(this.initialTotalScore).rank;
        const ctrlConfig = COMPLICATION_CONFIG[ComplicationType.CONTROLS];

        if (isComplicationUnlocked(ComplicationType.CONTROLS, startingRank) && this.state.controlsHeat > 0) {
            const now = Date.now();
            const lastRotation = this.state.rotationTimestamps.length > 0
                ? this.state.rotationTimestamps[this.state.rotationTimestamps.length - 1]
                : 0;
            const idleTime = now - lastRotation;

            if (idleTime > ctrlConfig.idleThresholdMs) {
                const controlsLevel = this.powerUps['GEAR_LUBRICATION'] || 0;
                const drainRate = ctrlConfig.dissipationBase * (1 + ctrlConfig.dissipationUpgradeEffect * controlsLevel);
                this.state.controlsHeat = Math.max(0, this.state.controlsHeat - (drainRate * dt / 1000));
            }
        }
    }

    /**
     * Update falling blocks (gravity after pop).
     */
    private tickFallingBlocks(dt: number): void {
        if (this.state.fallingBlocks.length === 0) return;

        const gameSpeed = INITIAL_SPEED;
        const { active, landed } = updateFallingBlocks(this.state.fallingBlocks, this.state.grid, dt, gameSpeed);

        if (landed.length > 0) {
            gameEventBus.emit(GameEventType.PIECE_DROPPED);
            const newGrid = this.state.grid.map(row => [...row]);
            let landUpdates = false;

            landed.forEach(b => {
                if (b.y >= 0 && b.y < TOTAL_HEIGHT) {
                    newGrid[Math.floor(b.y)][b.x] = { ...b.data, timestamp: Date.now() };
                    landUpdates = true;
                }
            });

            if (landUpdates) {
                this.state.grid = updateGroups(newGrid);
            }
            this.state.fallingBlocks = active;
        } else {
            this.state.fallingBlocks = active;
        }
    }

    /**
     * Handle active piece gravity, locking, and LIGHTS complication trigger.
     */
    private tickActivePiece(dt: number): void {
        if (!this.state.activePiece) return;

        const gameSpeed = INITIAL_SPEED;
        const gravitySpeed = this.isSoftDropping
            ? gameSpeed / SOFT_DROP_FACTOR
            : gameSpeed;

        const moveAmount = dt / gravitySpeed;
        const nextY = this.state.activePiece.y + moveAmount;

        // Maintain Grid X based on Screen X and Board Offset
        const currentGridX = getGridX(this.state.activePiece.screenX, this.state.boardOffset);
        const nextPiece = { ...this.state.activePiece, y: nextY, x: currentGridX };

        if (checkCollision(this.state.grid, nextPiece, this.state.boardOffset)) {
            if (this.lockStartTime === null) {
                this.lockStartTime = Date.now();
            }

            const lockedTime = Date.now() - this.lockStartTime;
            const effectiveLockDelay = this.isSoftDropping ? 50 : LOCK_DELAY_MS;

            if (lockedTime > effectiveLockDelay) {
                this.lockActivePiece();
            }
        } else {
            this.state.activePiece = nextPiece;
            this.lockStartTime = null;
        }
    }

    /**
     * Lock the active piece, handle goals, check LIGHTS trigger, spawn new piece.
     */
    private lockActivePiece(): void {
        if (!this.state.activePiece) return;

        const y = getGhostY(this.state.grid, this.state.activePiece, this.state.boardOffset);
        const finalPiece = { ...this.state.activePiece, y };

        const { grid: newGrid, consumedGoals, destroyedGoals } = mergePiece(this.state.grid, finalPiece, this.state.goalMarks);

        if (consumedGoals.length > 0 || destroyedGoals.length > 0) {
            this.handleGoals(consumedGoals, destroyedGoals, finalPiece);
        }

        // LIGHTS complication trigger
        this.checkLightsTrigger(newGrid);

        gameEventBus.emit(GameEventType.PIECE_DROPPED);
        this.state.grid = newGrid;

        this.spawnNewPiece(undefined, newGrid);
        this.state.combo = 0;
        this.isSoftDropping = false;
    }

    /**
     * Check if LIGHTS complication should trigger on piece lock.
     */
    private checkLightsTrigger(newGrid: GridCell[][]): void {
        const shouldTrigger = complicationManager.checkLightsTrigger(
            this.state,
            this.initialTotalScore,
            this.maxTime,
            this.powerUps,
            newGrid
        );

        if (shouldTrigger) {
            complicationManager.spawnComplication(this.state, ComplicationType.LIGHTS);
            this.emitChange();
        }
    }

    // --- Main Loop ---

    public tick(dt: number) {
        if (!this.isSessionActive || this.state.gameOver || this.state.isPaused) return;

        // Timer - stop if game ended
        if (!this.tickTimer(dt)) return;

        // Goals
        this.tickGoals();

        // Complications check
        this.checkComplications(dt);

        // Heat dissipation
        this.tickHeat(dt);

        // Falling blocks
        this.tickFallingBlocks(dt);

        // Active piece gravity
        this.tickActivePiece(dt);

        this.emitChange();
    }
}
