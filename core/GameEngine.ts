
import { GameState, GridCell, ActivePiece, PieceDefinition, FallingBlock, ScoreBreakdown, GameStats, FloatingText, GoalMark, GamePhase, PieceState, PieceType, Complication, ComplicationType, DumpPiece } from '../types';
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
import { getGridX, normalizeX } from '../utils/coordinates';
import { calculateRankDetails } from '../utils/progression';
import { gameEventBus } from './events/EventBus';
import { GameEventType } from './events/GameEvents';
import { Command } from './commands/Command';
import { complicationManager } from './ComplicationManager';
import { UPGRADES } from '../constants';
import { goalManager } from './GoalManager';

const INITIAL_SPEED = 800; // ms per block
const MIN_SPEED = 100;
const SOFT_DROP_FACTOR = 6; // Reduced from 20 to make it feel less like a hard drop
const LOCK_DELAY_MS = 500;

// Dump piece constants (GOOP_DUMP ability)
const DUMP_SPAWN_INTERVAL = 80;  // ms between each piece spawn (8 pieces over ~0.64s)
const DUMP_FALL_SPEED = 0.03;    // Grid units per ms (fast fixed speed)

// Expanding cracks constants (rank 30+)
const CRACK_GROWTH_INTERVAL_MS = 5000;  // Check growth every 5 seconds per crack
const MAX_ACTIVE_CRACKS = 8;            // Cap on total active cracks

export class GameEngine {
    public state: GameState;
    private listeners: Set<() => void> = new Set();
    
    // Internal state tracking - Public for Commands to access
    public maxTime: number = INITIAL_TIME_MS;
    public lockStartTime: number | null = null;
    public lastGoalSpawnTime: number = 0;
    public lastComplicationCheckTime: number = 0;
    public isSoftDropping: boolean = false;
    private wasSoftDropping: boolean = false; // For edge detection
    private lightsOverflarePhase: 'none' | 'rising' | 'falling' = 'none';
    private lightsOverflareTime: number = 0; // Time spent in current overflare phase
    private lightsFlickerTime: number = 0; // Time spent in flicker animation
    private lightsFlickerActive: boolean = false; // Currently in flicker animation
    public initialTotalScore: number = 0;
    public powerUps: Record<string, number> = {};
    public isSessionActive: boolean = false;
    public equippedActives: string[] = [];

    private pendingTotalScore: number | null = null;

    // Generate random complication threshold in range [12, 24]
    private randomThreshold(): number {
        return Math.floor(Math.random() * 13) + 12; // 12 to 24 inclusive
    }

    constructor(initialTotalScore: number, powerUps: Record<string, number> = {}, equippedActives: string[] = []) {
        this.initialTotalScore = initialTotalScore;
        this.powerUps = powerUps;
        this.equippedActives = equippedActives;
        
        // Calculate initial configuration
        const startRank = calculateRankDetails(initialTotalScore).rank;
        const palette = getPaletteForRank(startRank);
        const goalsTarget = palette.length + startRank;

        this.state = {
            grid: createInitialGrid(startRank, powerUps),
            boardOffset: 0,
            activePiece: null,
            storedPiece: null,
            nextPiece: null,
            score: 0,
            gameOver: false,
            isPaused: false,
            canSwap: true,
            level: 1,
            cellsCleared: 0,
            combo: 0,
            fallingBlocks: [],
            dumpPieces: [],
            dumpQueue: [],
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
            lightsBrightness: 100,     // Starts at full brightness
            lightsGraceStart: null,    // null = soft dropping, starts as if soft dropping
            lightsFlickered: false,    // No flicker yet this cycle
            complicationCooldowns: {
                [ComplicationType.LIGHTS]: 0,
                [ComplicationType.CONTROLS]: 0,
                [ComplicationType.LASER]: 0
            },

            // Active ability tracking
            activeCharges: {},     // Will be populated based on equipped actives
            crackGoopPopped: 0,    // Count of glowing goop popped (for charging actives)

            // GOOP_COLORIZER tracking
            colorizerColor: null,
            colorizerRemaining: 0,

            // Expanding cracks tracking (rank 30+)
            crackGrowthTimers: {}
        };

        this.applyUpgrades();
    }

    public execute(command: Command) {
        command.execute(this);
    }

    private applyUpgrades() {
        // Base time from constants
        let baseTime = INITIAL_TIME_MS;

        // PRESSURE_CONTROL: +5 seconds per level (max 8 levels = +40s)
        const pressureLevel = this.powerUps['PRESSURE_CONTROL'] || 0;
        if (pressureLevel > 0) {
            const bonusMs = pressureLevel * 5 * 1000; // 5 seconds per level
            baseTime += bonusMs;
        }

        this.maxTime = baseTime;

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

        // Generate next piece for preview
        const nextPieceDef = {
            ...PIECES[Math.floor(Math.random() * PIECES.length)],
            color: palette[Math.floor(Math.random() * palette.length)]
        };

        this.state = {
            ...this.state,
            grid: createInitialGrid(startRank, this.powerUps),
            boardOffset: 0,
            score: 0,
            gameOver: false,
            isPaused: false,
            activePiece: null,
            storedPiece: {
                ...PIECES[Math.floor(Math.random() * PIECES.length)],
                color: palette[Math.floor(Math.random() * palette.length)]
            },
            nextPiece: nextPieceDef,
            canSwap: true,
            combo: 0,
            cellsCleared: 0,
            fallingBlocks: [],
            dumpPieces: [],
            dumpQueue: [],
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
            lightsBrightness: 100,     // Starts at full brightness
            lightsGraceStart: null,    // null = soft dropping, starts as if soft dropping
            lightsFlickered: false,    // No flicker yet this cycle
            complicationCooldowns: {
                [ComplicationType.LIGHTS]: 0,
                [ComplicationType.CONTROLS]: 0,
                [ComplicationType.LASER]: 0
            },

            // GOOP_COLORIZER tracking - reset on new run
            colorizerColor: null,
            colorizerRemaining: 0,

            // Expanding cracks tracking - reset on new run
            crackGrowthTimers: {}
        };

        this.lockStartTime = null;
        this.lastGoalSpawnTime = Date.now();
        this.lastComplicationCheckTime = Date.now();
        this.isSoftDropping = false;
        this.isSessionActive = true;

        // Initialize active ability charges for equipped actives
        const initialCharges: Record<string, number> = {};
        this.equippedActives.forEach(id => {
            initialCharges[id] = 0; // Start at 0% charge
        });
        this.state.activeCharges = initialCharges;

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

    /**
     * Activate an active ability.
     */
    public activateAbility(upgradeId: string) {
        if (this.state.gameOver) return;

        const upgrade = UPGRADES[upgradeId as keyof typeof UPGRADES];
        if (!upgrade || upgrade.type !== 'active') return;

        // Execute ability effect based on type
        switch (upgradeId) {
            case 'COOLDOWN_BOOSTER': {
                // Extend all complication cooldowns: 25% / 35% / 50% based on level
                const level = this.powerUps[upgradeId] || 1;
                const extensionValues = [0.25, 0.35, 0.50]; // Level 1/2/3
                const extensionPercent = extensionValues[Math.min(level, 3) - 1];
                complicationManager.extendAllCooldowns(this.state, extensionPercent);
                console.log(`COOLDOWN_BOOSTER activated: +${extensionPercent * 100}% cooldown extension`);
                break;
            }
            case 'GOOP_DUMP': {
                // Drop same-color blocks from the top (rain effect)
                // Use the current falling piece's color if available, else random from palette
                const palette = getPaletteForRank(calculateRankDetails(this.initialTotalScore).rank);
                const targetColor = this.state.activePiece?.definition.color
                    || palette[Math.floor(Math.random() * palette.length)];

                // Level determines number of waves: 1 / 2 / 3
                const dumpLevel = this.powerUps[upgradeId] || 1;
                const waveCount = Math.min(dumpLevel, 3);
                const piecesPerWave = 18; // 60% coverage of 30-column cylinder
                const waveDelay = 600; // ms between waves

                // Create all waves with appropriate delays
                const allPieces: DumpPiece[] = [];
                for (let wave = 0; wave < waveCount; wave++) {
                    // Pick random X positions for this wave
                    for (let i = 0; i < piecesPerWave; i++) {
                        allPieces.push({
                            id: Math.random().toString(36).substr(2, 9),
                            color: targetColor,
                            x: Math.floor(Math.random() * TOTAL_WIDTH),
                            y: -1,  // Start above visible area
                            spawnDelay: (wave * waveDelay) + (i * DUMP_SPAWN_INTERVAL)
                        });
                    }
                }

                // Add to queue (pieces will move to active when delay expires)
                this.state.dumpQueue.push(...allPieces);
                console.log(`GOOP_DUMP activated: ${waveCount} wave(s), ${allPieces.length} total ${targetColor} pieces`);
                break;
            }
            case 'GOOP_COLORIZER': {
                // Lock next N pieces to current falling piece's color
                // Level 1: 6 pieces, Level 2: 7 pieces, Level 3: 8 pieces
                const targetColor = this.state.activePiece?.definition.color;
                if (!targetColor) {
                    console.log('GOOP_COLORIZER: No active piece to match color');
                    break;
                }

                const colorizerLevel = this.powerUps[upgradeId] || 1;
                const pieceCountByLevel = [6, 7, 8]; // Level 1/2/3
                const pieceCount = pieceCountByLevel[Math.min(colorizerLevel, 3) - 1];

                this.state.colorizerColor = targetColor;
                this.state.colorizerRemaining = pieceCount;
                console.log(`GOOP_COLORIZER activated: next ${pieceCount} pieces will be ${targetColor}`);
                break;
            }
            // Future actives: CRACK_DOWN
            default:
                console.log(`Active ability ${upgradeId} not yet implemented`);
        }
    }

    /**
     * Add charge to active abilities. Called when crack-goop is sealed.
     */
    public chargeActiveAbilities(amount: number) {
        // Charge all equipped actives
        Object.keys(this.state.activeCharges).forEach(id => {
            const current = this.state.activeCharges[id] || 0;
            this.state.activeCharges[id] = Math.min(100, current + amount);
        });
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

        // AUTO_POPPER: Each remaining block has a chance to auto-pop before penalty
        // Base decay is 20% (block survives with 20% chance, pops with 80% chance).
        // Each level reduces decay by 4%, so block has higher survival chance at higher levels.
        // Wait - actually the design says "decay" is the penalty per unit.
        // Re-reading: "Base decay: -20% per unit. Each level reduces decay by 4%"
        // This means: at level 0, each goop unit decays (causes) 20% penalty.
        // With AUTO_POPPER, we reduce that percentage. But that's not quite how it's implemented.
        // The plan says: "Each remaining unit has chance to auto-pop"
        // So: (1 - decayChance) = pop chance. At level 0: 80% pop, 20% survive.
        // At level 4: 96% pop, 4% survive.
        const autoPopperLevel = this.powerUps['AUTO_POPPER'] || 0;
        if (autoPopperLevel > 0) {
            const originalCount = remainingBlocks;
            // Decay chance per unit: 0.20 - (level * 0.04)
            // Level 0: 20% decay (80% auto-pop)
            // Level 1: 16% decay (84% auto-pop)
            // Level 2: 12% decay (88% auto-pop)
            // Level 3: 8% decay (92% auto-pop)
            // Level 4: 4% decay (96% auto-pop)
            const decayChance = 0.20 - (autoPopperLevel * 0.04);
            let autoPoppedCount = 0;

            for (let i = 0; i < originalCount; i++) {
                // Each unit has (1 - decayChance) chance to auto-pop
                if (Math.random() > decayChance) {
                    autoPoppedCount++;
                }
            }

            remainingBlocks -= autoPoppedCount;
            console.log(`AUTO_POPPER: ${autoPoppedCount} of ${originalCount} goop auto-popped (${remainingBlocks} remaining)`);
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
        const palette = getPaletteForRank(currentRank);

        // If no specific piece provided and we have a queued next piece, use it
        let pieceToSpawn = pieceDef;
        if (!pieceToSpawn && this.state.nextPiece) {
            pieceToSpawn = this.state.nextPiece;
            // Generate new next piece for the queue
            const newNext = {
                ...PIECES[Math.floor(Math.random() * PIECES.length)],
                color: palette[Math.floor(Math.random() * palette.length)]
            };
            this.state.nextPiece = newNext;
        }

        const piece = spawnPiece(pieceToSpawn, currentRank);

        // Apply GOOP_COLORIZER effect if active
        if (this.state.colorizerRemaining > 0 && this.state.colorizerColor) {
            // Override the piece color
            piece.definition = {
                ...piece.definition,
                color: this.state.colorizerColor
            };
            this.state.colorizerRemaining--;

            // Also update nextPiece if it exists (so preview shows correct color)
            if (this.state.nextPiece && this.state.colorizerRemaining > 0) {
                this.state.nextPiece = {
                    ...this.state.nextPiece,
                    color: this.state.colorizerColor
                };
            }

            console.log(`GOOP_COLORIZER: Spawned ${this.state.colorizerColor} piece (${this.state.colorizerRemaining} remaining)`);

            // Clear colorizer when done
            if (this.state.colorizerRemaining === 0) {
                this.state.colorizerColor = null;
            }
        }

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
        // FOCUS_MODE: slow time during minigames (-10% per level)
        const focusLevel = this.powerUps['FOCUS_MODE'] || 0;
        const isInMinigame = this.state.phase === GamePhase.COMPLICATION_MINIGAME;
        const timeMultiplier = (isInMinigame && focusLevel > 0)
            ? (1 - focusLevel * 0.10)  // At level 4: 0.60 (40% slower)
            : 1;

        this.state.timeLeft = Math.max(0, this.state.timeLeft - (dt * timeMultiplier));
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
     * Handle LIGHTS brightness system: dims when not soft dropping, recovers when soft dropping.
     * Player must "work faster" (soft drop) to keep the lights on.
     */
    private tickLightsBrightness(dt: number): void {
        const startingRank = calculateRankDetails(this.initialTotalScore).rank;
        const lightsConfig = COMPLICATION_CONFIG[ComplicationType.LIGHTS];

        // Only run if LIGHTS is unlocked
        if (!isComplicationUnlocked(ComplicationType.LIGHTS, startingRank)) return;

        // Skip if not in PERISCOPE phase (don't dim during console/minigame)
        if (this.state.phase !== GamePhase.PERISCOPE) return;

        // Skip if already in malfunction state
        const hasLightsActive = this.state.complications.some(c => c.type === ComplicationType.LIGHTS);
        if (hasLightsActive) {
            // Keep at failed brightness during malfunction
            this.state.lightsBrightness = lightsConfig.failedBrightness;
            return;
        }

        const now = Date.now();

        // Edge detection: started soft dropping
        if (this.isSoftDropping && !this.wasSoftDropping) {
            // Start recovery - clear grace timer, begin lerping to 100
            this.state.lightsGraceStart = null;
            this.state.lightsFlickered = false;
            this.lightsOverflarePhase = 'none';
            this.lightsFlickerActive = false;
        }

        // Edge detection: stopped soft dropping
        if (!this.isSoftDropping && this.wasSoftDropping) {
            // Start grace period
            this.state.lightsGraceStart = now;
            this.state.lightsFlickered = false;
            this.lightsOverflarePhase = 'none';
            this.lightsFlickerActive = false;
        }

        // Update tracking
        this.wasSoftDropping = this.isSoftDropping;

        // Calculate grace period with upgrade bonus
        const stabilizerLevel = this.powerUps['CIRCUIT_STABILIZER'] || 0;
        const graceDuration = (lightsConfig.graceBaseSec + lightsConfig.gracePerLevel * stabilizerLevel) * 1000;

        if (this.isSoftDropping) {
            // RECOVERING: Lerp brightness toward 100, then overflare
            if (this.state.lightsBrightness < 100) {
                // Lerp up at constant rate
                const increase = (lightsConfig.recoverRate * dt) / 1000;
                this.state.lightsBrightness = Math.min(100, this.state.lightsBrightness + increase);

                // If we just reached 100, start overflare
                if (this.state.lightsBrightness >= 100) {
                    this.lightsOverflarePhase = 'rising';
                    this.lightsOverflareTime = 0;
                }
            } else if (this.lightsOverflarePhase === 'rising') {
                // Rising to overflare peak
                this.lightsOverflareTime += dt;
                const progress = Math.min(1, this.lightsOverflareTime / lightsConfig.overflareUpMs);
                this.state.lightsBrightness = 100 + (lightsConfig.overflarePeak - 100) * progress;

                if (progress >= 1) {
                    this.lightsOverflarePhase = 'falling';
                    this.lightsOverflareTime = 0;
                }
            } else if (this.lightsOverflarePhase === 'falling') {
                // Falling back to 100 from overflare
                this.lightsOverflareTime += dt;
                const progress = Math.min(1, this.lightsOverflareTime / lightsConfig.overflareDownMs);
                this.state.lightsBrightness = lightsConfig.overflarePeak - (lightsConfig.overflarePeak - 100) * progress;

                if (progress >= 1) {
                    this.lightsOverflarePhase = 'none';
                    this.state.lightsBrightness = 100;
                }
            }
            // else: at 100, no overflare, just hold
        } else {
            // NOT SOFT DROPPING: Grace period, then dim
            if (this.state.lightsGraceStart === null) {
                // First tick after game start or other edge case - start grace
                this.state.lightsGraceStart = now;
            }

            const elapsed = now - this.state.lightsGraceStart;

            if (elapsed < graceDuration) {
                // In grace period - hold at current brightness (should be 100)
                // Handle ongoing flicker animation even in grace (if started at edge)
                if (this.lightsFlickerActive) {
                    this.lightsFlickerTime += dt;
                    const totalFlickerTime = lightsConfig.flickerDipMs + lightsConfig.flickerRecoverMs;

                    if (this.lightsFlickerTime < lightsConfig.flickerDipMs) {
                        // Dipping down
                        const progress = this.lightsFlickerTime / lightsConfig.flickerDipMs;
                        this.state.lightsBrightness = 100 - (100 - lightsConfig.flickerDipBrightness) * progress;
                    } else if (this.lightsFlickerTime < totalFlickerTime) {
                        // Recovering back up
                        const recoverProgress = (this.lightsFlickerTime - lightsConfig.flickerDipMs) / lightsConfig.flickerRecoverMs;
                        this.state.lightsBrightness = lightsConfig.flickerDipBrightness + (100 - lightsConfig.flickerDipBrightness) * recoverProgress;
                    } else {
                        // Flicker complete
                        this.lightsFlickerActive = false;
                        this.state.lightsBrightness = 100;
                    }
                }
            } else if (elapsed >= graceDuration && !this.state.lightsFlickered) {
                // At end of grace period - trigger flicker warning
                this.state.lightsFlickered = true;
                this.lightsFlickerActive = true;
                this.lightsFlickerTime = 0;
                // Emit flicker event for sound/additional effects
                gameEventBus.emit(GameEventType.LIGHTS_FLICKER, {});
            } else if (this.lightsFlickerActive) {
                // Continue flicker animation
                this.lightsFlickerTime += dt;
                const totalFlickerTime = lightsConfig.flickerDipMs + lightsConfig.flickerRecoverMs;

                if (this.lightsFlickerTime < lightsConfig.flickerDipMs) {
                    // Dipping down
                    const progress = this.lightsFlickerTime / lightsConfig.flickerDipMs;
                    this.state.lightsBrightness = 100 - (100 - lightsConfig.flickerDipBrightness) * progress;
                } else if (this.lightsFlickerTime < totalFlickerTime) {
                    // Recovering back up
                    const recoverProgress = (this.lightsFlickerTime - lightsConfig.flickerDipMs) / lightsConfig.flickerRecoverMs;
                    this.state.lightsBrightness = lightsConfig.flickerDipBrightness + (100 - lightsConfig.flickerDipBrightness) * recoverProgress;
                } else {
                    // Flicker complete, start dimming
                    this.lightsFlickerActive = false;
                }
            } else {
                // Past grace period - dimming
                const dimElapsed = elapsed - graceDuration;
                const dimDuration = lightsConfig.dimDurationSec * 1000;
                const dimProgress = Math.min(1, dimElapsed / dimDuration);

                // Lerp from 100 to dimThreshold
                this.state.lightsBrightness = 100 - (100 - lightsConfig.dimThreshold) * dimProgress;

                // Check for malfunction trigger
                if (this.state.lightsBrightness <= lightsConfig.dimThreshold) {
                    // Snap to failed brightness and trigger malfunction
                    this.state.lightsBrightness = lightsConfig.failedBrightness;
                    complicationManager.spawnComplication(this.state, ComplicationType.LIGHTS);
                }
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
     * Update dump pieces (GOOP_DUMP ability): process queue, fall, and land.
     */
    private tickDumpPieces(dt: number): void {
        // Process queue: decrement spawnDelay, move to active when delay <= 0
        const stillQueued: DumpPiece[] = [];
        for (const piece of this.state.dumpQueue) {
            piece.spawnDelay -= dt;
            if (piece.spawnDelay <= 0) {
                // Move to active pieces
                this.state.dumpPieces.push(piece);
            } else {
                stillQueued.push(piece);
            }
        }
        this.state.dumpQueue = stillQueued;

        // No active dump pieces? Nothing more to do
        if (this.state.dumpPieces.length === 0) return;

        // Move active pieces down and check for landing
        const stillFalling: DumpPiece[] = [];
        const newGrid = this.state.grid.map(row => [...row]);
        let gridChanged = false;

        for (const piece of this.state.dumpPieces) {
            // Move down by fall speed
            piece.y += DUMP_FALL_SPEED * dt;

            // Check for collision with grid or floor
            const gridY = Math.floor(piece.y);
            const gridX = piece.x;

            // Check if landed (hit floor or existing block below)
            let landed = false;

            if (gridY >= TOTAL_HEIGHT - 1) {
                // Hit floor
                landed = true;
            } else if (gridY >= 0 && newGrid[gridY + 1]?.[gridX]) {
                // Hit existing block below
                landed = true;
            }

            if (landed && gridY >= 0 && gridY < TOTAL_HEIGHT) {
                // Place in grid as a single-block goop
                newGrid[gridY][gridX] = {
                    id: piece.id,
                    groupId: Math.random().toString(36).substr(2, 9),
                    timestamp: Date.now(),
                    color: piece.color,
                    groupMinY: gridY,
                    groupMaxY: gridY,
                    groupSize: 1
                };
                gridChanged = true;
            } else if (!landed) {
                stillFalling.push(piece);
            }
            // If landed but out of bounds (gridY < 0), piece is lost (shouldn't happen normally)
        }

        this.state.dumpPieces = stillFalling;

        if (gridChanged) {
            this.state.grid = updateGroups(newGrid);
        }
    }

    /**
     * Handle active piece gravity, locking, and LIGHTS complication trigger.
     */
    private tickActivePiece(dt: number): void {
        if (!this.state.activePiece) return;

        // DENSE_GOOP: +12.5% fall speed per level (reduces interval between drops)
        const denseLevel = this.powerUps['DENSE_GOOP'] || 0;
        const speedMultiplier = 1 + (denseLevel * 0.125); // 1.0, 1.125, 1.25, 1.375, 1.5
        const adjustedSpeed = INITIAL_SPEED / speedMultiplier;

        const gravitySpeed = this.isSoftDropping
            ? adjustedSpeed / SOFT_DROP_FACTOR
            : adjustedSpeed;

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

        // LIGHTS complication is now triggered by brightness system (tickLightsBrightness)
        // No random trigger on piece lock anymore

        // Laser capacitor refill: +15% on piece lock (only when no active LASER complication)
        const hasActiveLaser = this.state.complications.some(c => c.type === ComplicationType.LASER);
        if (!hasActiveLaser) {
            this.state.laserCapacitor = Math.min(100, this.state.laserCapacitor + 10);
        }

        gameEventBus.emit(GameEventType.PIECE_DROPPED);
        this.state.grid = newGrid;

        this.spawnNewPiece(undefined, newGrid);
        this.state.combo = 0;
        this.isSoftDropping = false;
    }


    // --- Main Loop ---

    /**
     * Passive charging for active abilities.
     * Each ability has its own charge time.
     */
    private tickActiveCharges(dt: number): void {
        // Auto-fix: initialize charges for equipped actives if missing
        if (Object.keys(this.state.activeCharges).length === 0 && this.equippedActives.length > 0) {
            this.equippedActives.forEach(id => {
                this.state.activeCharges[id] = this.state.activeCharges[id] ?? 0;
            });
        }

        // Charge rates per ability (100 / seconds to full charge)
        const chargeRates: Record<string, number> = {
            'COOLDOWN_BOOSTER': 100 / 20,  // 20s to full = 5%/sec
            'GOOP_DUMP': 100 / 15,         // 15s to full = 6.67%/sec
            'GOOP_COLORIZER': 100 / 25,    // 25s to full = 4%/sec
            'CRACK_DOWN': 100 / 30         // 30s to full = 3.33%/sec
        };

        Object.keys(this.state.activeCharges).forEach(id => {
            const current = this.state.activeCharges[id] || 0;
            if (current < 100) {
                const chargePerSecond = chargeRates[id] || 3; // Default 3%/sec if unknown
                const chargeAmount = (dt / 1000) * chargePerSecond;
                const newCharge = Math.min(100, current + chargeAmount);
                this.state.activeCharges[id] = newCharge;
            }
        });
    }

    /**
     * Tick crack growth for rank 30+ (Expanding Cracks mechanic).
     * Every 5s per crack, there's a chance to spawn an adjacent crack.
     * Growth chance = pressureRatio - SLOW_CRACKS offset.
     */
    private tickCrackGrowth(): void {
        // Only active at rank 30+
        const startingRank = calculateRankDetails(this.initialTotalScore).rank;
        if (startingRank < 30) return;

        // Don't grow when in Console or Minigame phases
        if (this.state.phase === GamePhase.CONSOLE ||
            this.state.phase === GamePhase.COMPLICATION_MINIGAME) return;

        // Cap at max active cracks
        if (this.state.goalMarks.length >= MAX_ACTIVE_CRACKS) return;

        const now = Date.now();
        const palette = getPaletteForRank(startingRank);

        // Initialize timers for any new cracks that don't have one
        for (const goal of this.state.goalMarks) {
            if (this.state.crackGrowthTimers[goal.id] === undefined) {
                this.state.crackGrowthTimers[goal.id] = now;
            }
        }

        // Clean up timers for goals that no longer exist
        const activeGoalIds = new Set(this.state.goalMarks.map(g => g.id));
        for (const id of Object.keys(this.state.crackGrowthTimers)) {
            if (!activeGoalIds.has(id)) {
                delete this.state.crackGrowthTimers[id];
            }
        }

        // Check each crack for growth
        for (const goal of this.state.goalMarks) {
            const lastCheck = this.state.crackGrowthTimers[goal.id];
            if (now - lastCheck < CRACK_GROWTH_INTERVAL_MS) continue;

            // Update timer
            this.state.crackGrowthTimers[goal.id] = now;

            // Cap check again (in case we've hit max during this tick)
            if (this.state.goalMarks.length >= MAX_ACTIVE_CRACKS) break;

            // Calculate growth chance = pressure ratio
            const pressureRatio = Math.max(0, 1 - (this.state.timeLeft / this.maxTime));

            // Apply SLOW_CRACKS offset: -5% per level
            const slowCracksLevel = this.powerUps['SLOW_CRACKS'] || 0;
            const slowCracksOffset = slowCracksLevel * 0.05;
            const effectiveGrowthChance = Math.max(0, pressureRatio - slowCracksOffset);

            // Roll for growth
            if (Math.random() > effectiveGrowthChance) continue;

            // Try to spawn an adjacent crack
            const adjacentSpots = [
                { x: normalizeX(goal.x + 1), y: goal.y },
                { x: normalizeX(goal.x - 1), y: goal.y },
                { x: goal.x, y: goal.y + 1 },
                { x: goal.x, y: goal.y - 1 }
            ].filter(spot =>
                spot.y >= BUFFER_HEIGHT &&
                spot.y < TOTAL_HEIGHT &&
                !this.state.grid[spot.y][spot.x] &&
                !this.state.goalMarks.some(m => m.x === spot.x && m.y === spot.y)
            );

            if (adjacentSpots.length === 0) continue;

            // Pick a random adjacent spot and spawn a new crack with a color from the palette
            const spot = adjacentSpots[Math.floor(Math.random() * adjacentSpots.length)];

            // Filter colors that already have a goal mark
            const activeColors = new Set(this.state.goalMarks.map(m => m.color));
            const availableColors = palette.filter(c => !activeColors.has(c));

            // If no available colors, use a random one from palette
            const color = availableColors.length > 0
                ? availableColors[Math.floor(Math.random() * availableColors.length)]
                : palette[Math.floor(Math.random() * palette.length)];

            const newCrack = {
                id: Math.random().toString(36).substr(2, 9),
                x: spot.x,
                y: spot.y,
                color,
                spawnTime: now
            };

            this.state.goalMarks.push(newCrack);
            this.state.crackGrowthTimers[newCrack.id] = now;

            console.log(`Crack grew: ${goal.id} -> ${newCrack.id} at (${spot.x}, ${spot.y}), color: ${color}, pressure: ${(pressureRatio * 100).toFixed(1)}%, effective chance: ${(effectiveGrowthChance * 100).toFixed(1)}%`);
        }
    }

    public tick(dt: number) {
        if (!this.isSessionActive || this.state.gameOver || this.state.isPaused) return;

        // Timer - stop if game ended
        if (!this.tickTimer(dt)) return;

        // Goals
        this.tickGoals();

        // Crack growth (rank 30+ expanding cracks mechanic)
        this.tickCrackGrowth();

        // Complications check
        this.checkComplications(dt);

        // Heat dissipation
        this.tickHeat(dt);

        // Lights brightness (player-controlled via soft drop)
        this.tickLightsBrightness(dt);

        // Falling blocks
        this.tickFallingBlocks(dt);

        // Dump pieces (GOOP_DUMP ability rain effect)
        this.tickDumpPieces(dt);

        // Active piece gravity
        this.tickActivePiece(dt);

        // Active ability charging (passive)
        this.tickActiveCharges(dt);

        this.emitChange();
    }
}
