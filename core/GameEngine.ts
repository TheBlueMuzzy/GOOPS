
import { GameState, GridCell, ActivePiece, PieceDefinition, FallingBlock, ScoreBreakdown, GameStats, FloatingText, GoalMark, GamePhase, PieceState, PieceType, Complication, ComplicationType } from '../types';
import { 
    TOTAL_WIDTH, TOTAL_HEIGHT, VISIBLE_WIDTH, VISIBLE_HEIGHT, PER_BLOCK_DURATION, INITIAL_TIME_MS, 
    PRESSURE_RECOVERY_BASE_MS, PRESSURE_RECOVERY_PER_UNIT_MS, PRESSURE_TIER_THRESHOLD, PRESSURE_TIER_STEP, PRESSURE_TIER_BONUS_MS, UPGRADE_CONFIG
} from '../constants';
import { 
    spawnPiece, checkCollision, mergePiece, getRotatedCells, normalizeX, findContiguousGroup, 
    updateGroups, getGhostY, updateFallingBlocks, getFloatingBlocks,
    calculateHeightBonus, calculateOffScreenBonus, calculateMultiplier, calculateAdjacencyBonus, createInitialGrid,
    spawnGoalMark, spawnGoalBurst, getPaletteForRank
} from '../utils/gameLogic';
import { getGridX } from '../utils/coordinates';
import { calculateRankDetails } from '../utils/progression';
import { gameEventBus } from './events/EventBus';
import { GameEventType } from './events/GameEvents';
import { audio } from '../utils/audio';
import { Command } from './commands/Command';

const INITIAL_SPEED = 800; // ms per block
const MIN_SPEED = 100;
const SOFT_DROP_FACTOR = 6; // Reduced from 20 to make it feel less like a hard drop
const LOCK_DELAY_MS = 500;
const GOAL_SPAWN_INTERVAL = 5000;
const COMPLICATION_CHECK_INTERVAL = 1000;

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
            activeComplicationId: null
        };

        this.applyUpgrades();
    }

    public execute(command: Command) {
        command.execute(this);
    }

    private applyUpgrades() {
        const timeBonusLevel = this.powerUps[UPGRADE_CONFIG.TIME_BONUS.id] || 0;
        const stabilityLevel = this.powerUps[UPGRADE_CONFIG.STABILITY.id] || 0;
        
        this.maxTime = INITIAL_TIME_MS + (timeBonusLevel * UPGRADE_CONFIG.TIME_BONUS.effectPerLevel);
        
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
            storedPiece: null,
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
            activeComplicationId: null
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
        
        this.state.complications = this.state.complications.filter(c => c.id !== complicationId);
        this.state.activeComplicationId = null;
        
        // Go back to Console after repair to confirm status
        this.state.phase = GamePhase.CONSOLE; 
        
        gameEventBus.emit(GameEventType.COMPLICATION_RESOLVED);
        audio.playPop(5); // Success sound
        this.emitChange();
    }

    private spawnComplication(type: ComplicationType) {
        const id = Math.random().toString(36).substr(2, 9);
        this.state.complications.push({
            id,
            type,
            startTime: Date.now(),
            severity: 1
        });
        
        gameEventBus.emit(GameEventType.COMPLICATION_SPAWNED, { type });
        this.emitChange();
    }

    private checkComplications(dt: number) {
        const now = Date.now();
        if (now - this.lastComplicationCheckTime < COMPLICATION_CHECK_INTERVAL) return;
        this.lastComplicationCheckTime = now;

        if (this.state.complications.length > 0) return; 

        const rank = calculateRankDetails(this.initialTotalScore + this.state.score).rank;
        if (rank < 2) return; 

        // 5% chance per check (approx every 20s)
        if (Math.random() < 0.05) {
            this.spawnComplication(ComplicationType.BLOWN_FUSE);
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
        const scoreBoostLevel = this.powerUps[UPGRADE_CONFIG.SCORE_BOOST.id] || 0;
        const boostMod = 1 + (scoreBoostLevel * UPGRADE_CONFIG.SCORE_BOOST.effectPerLevel);
        const finalPoints = Math.ceil(pointsToAdd * boostMod);

        this.state.score += finalPoints;

        if (breakdown) {
            this.state.scoreBreakdown.base += (breakdown.base || 0) * boostMod;
            this.state.scoreBreakdown.height += (breakdown.height || 0) * boostMod;
            this.state.scoreBreakdown.offscreen += (breakdown.offscreen || 0) * boostMod;
            this.state.scoreBreakdown.adjacency += (breakdown.adjacency || 0) * boostMod;
            this.state.scoreBreakdown.speed += (breakdown.speed || 0) * boostMod;
        }
    }

    public handleGoals(consumed: string[], destroyed: string[], piece: ActivePiece) {
        const goalsToRemove = [...consumed, ...destroyed];
        this.state.goalMarks = this.state.goalMarks.filter(g => !goalsToRemove.includes(g.id));

        consumed.forEach(id => {
            const cx = normalizeX(piece.x); 
            const cy = Math.floor(piece.y);
            const textId = Math.random().toString(36).substr(2, 9);
            this.state.floatingTexts.push({
                id: textId, text: 'CAPTURED!', x: cx, y: cy, life: 1, color: '#facc15'
            });
            setTimeout(() => {
                this.state.floatingTexts = this.state.floatingTexts.filter(ft => ft.id !== textId);
                this.emitChange();
            }, 1000);
            gameEventBus.emit(GameEventType.GOAL_CAPTURED, { count: 1 });
        });

        destroyed.forEach(id => {
            gameEventBus.emit(GameEventType.ACTION_REJECTED);
        });
    }

    // --- Main Loop ---

    public tick(dt: number) {
        if (!this.isSessionActive || this.state.gameOver || this.state.isPaused) return;
        
        // Always run timers if not paused
        this.state.timeLeft = Math.max(0, this.state.timeLeft - dt);
        if (this.state.timeLeft <= 0) {
            this.finalizeGame();
            return;
        }

        // Goals Spawn
        if (this.state.goalsCleared < this.state.goalsTarget) {
            if (Date.now() - this.lastGoalSpawnTime > GOAL_SPAWN_INTERVAL) {
                const currentRank = calculateRankDetails(this.initialTotalScore + this.state.score).rank;
                const newGoal = spawnGoalMark(this.state.grid, this.state.goalMarks, currentRank, this.state.timeLeft, this.maxTime);
                if (newGoal) {
                    this.state.goalMarks.push(newGoal);
                    audio.playPop(1);
                }
                this.lastGoalSpawnTime = Date.now();
            }
        }
        
        this.checkComplications(dt);

        const stabilityLevel = this.powerUps[UPGRADE_CONFIG.STABILITY.id] || 0;
        const stabilityMod = stabilityLevel * UPGRADE_CONFIG.STABILITY.effectPerLevel;
        const gameSpeed = INITIAL_SPEED * (1 + stabilityMod); 

        // Falling Blocks
        if (this.state.fallingBlocks.length > 0) {
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
                     this.state.fallingBlocks = active;
                } else {
                     this.state.fallingBlocks = active;
                }
            } else {
                this.state.fallingBlocks = active;
            }
        }

        // Active Piece Gravity
        if (this.state.activePiece) {
            const gravitySpeed = this.isSoftDropping 
                ? gameSpeed / SOFT_DROP_FACTOR 
                : gameSpeed;
                
            const moveAmount = dt / gravitySpeed;
            const nextY = this.state.activePiece.y + moveAmount;
            
            // Maintain Grid X based on Screen X and Board Offset
            // This ensures if board moved during tick (via commands), piece stays screen-static
            const currentGridX = getGridX(this.state.activePiece.screenX, this.state.boardOffset);
            
            const nextPiece = { ...this.state.activePiece, y: nextY, x: currentGridX };
            
            if (checkCollision(this.state.grid, nextPiece, this.state.boardOffset)) {
                if (this.lockStartTime === null) {
                    this.lockStartTime = Date.now();
                }

                const lockedTime = Date.now() - this.lockStartTime;
                const effectiveLockDelay = this.isSoftDropping ? 50 : LOCK_DELAY_MS;

                if (lockedTime > effectiveLockDelay) {
                    // Lock it
                    const y = getGhostY(this.state.grid, this.state.activePiece, this.state.boardOffset);
                    const finalPiece = { ...this.state.activePiece, y };
                    
                    const { grid: newGrid, consumedGoals, destroyedGoals } = mergePiece(this.state.grid, finalPiece, this.state.goalMarks);
                    
                    if (consumedGoals.length > 0 || destroyedGoals.length > 0) {
                        this.handleGoals(consumedGoals, destroyedGoals, finalPiece);
                    }

                    gameEventBus.emit(GameEventType.PIECE_DROPPED);
                    this.state.grid = newGrid;
                    
                    this.spawnNewPiece(undefined, newGrid);
                    this.state.combo = 0;
                    this.isSoftDropping = false;
                }
            } else {
                this.state.activePiece = nextPiece;
                this.lockStartTime = null; 
            }
        }
        
        this.emitChange();
    }
}
