
import { GameState, TankCell, ActivePiece, GoopTemplate, FallingBlock, ScoreBreakdown, GameStats, FloatingText, GoalMark, CrackCell, ScreenType, GoopState, GoopShape, Complication, TankSystem, DumpPiece } from '../types';
import {
    TANK_WIDTH, TANK_HEIGHT, TANK_VIEWPORT_WIDTH, TANK_VIEWPORT_HEIGHT, BUFFER_HEIGHT, PER_BLOCK_DURATION, SESSION_DURATION,
    PRESSURE_RECOVERY_BASE_MS, PRESSURE_RECOVERY_PER_UNIT_MS, PRESSURE_TIER_THRESHOLD, PRESSURE_TIER_STEP, PRESSURE_TIER_BONUS_MS,
    PIECES,
    TETRA_NORMAL, TETRA_CORRUPTED,
    PENTA_NORMAL, PENTA_CORRUPTED,
    HEXA_NORMAL, HEXA_CORRUPTED,
    CORRUPTION_CHANCE, MIRROR_CHANCE
} from '../constants';
import { COMPLICATION_CONFIG, isComplicationUnlocked } from '../complicationConfig';
import {
    spawnPiece, checkCollision, mergePiece, getRotatedCells, findContiguousGroup,
    updateGroups, getGhostY, updateFallingBlocks, getFloatingBlocks,
    calculateHeightBonus, calculateOffScreenBonus, calculateMultiplier, calculateAdjacencyBonus, createInitialGrid,
    getPaletteForRank, processWildConversions
} from '../utils/gameLogic';
import { COLORS } from '../constants';
import { getGridX, normalizeX } from '../utils/coordinates';
import { calculateRankDetails } from '../utils/progression';
import { splitPiece } from '../utils/pieceUtils';
import { gameEventBus } from './events/EventBus';
import { GameEventType } from './events/GameEvents';
import { Command } from './commands/Command';
import { complicationManager } from './ComplicationManager';
import { UPGRADES } from '../constants';
import { goalManager } from './GoalManager';
import { CrackManager } from './CrackManager';

const ACTIVE_GOOP_SPEED = 780; // ms per block
const MIN_SPEED = 100;
const FAST_DROP_FACTOR = 8; // Snappier fast drop for new piece system
const LOCK_DELAY_MS = 500;

// Dump piece constants (GOOP_DUMP ability)
const DUMP_SPAWN_INTERVAL = 80;  // ms between each piece spawn (8 pieces over ~0.64s)
const DUMP_FALL_SPEED = 0.03;    // Grid units per ms (fast fixed speed)

export class GameEngine {
    public state: GameState;
    private listeners: Set<() => void> = new Set();
    
    // Internal state tracking - Public for Commands to access
    public maxTime: number = SESSION_DURATION;
    public lockStartTime: number | null = null;
    public lockResetCount: number = 0;  // Move reset counter (max 10 resets before force lock)
    public lastGoalSpawnTime: number = 0;
    public lastComplicationCheckTime: number = 0;
    public isFastDropping: boolean = false;
    private wasFastDropping: boolean = false; // For edge detection
    private lightsOverflarePhase: 'none' | 'rising' | 'falling' = 'none';
    private lightsOverflareTime: number = 0; // Time spent in current overflare phase
    private lightsFlickerTime: number = 0; // Time spent in flicker animation
    private lightsFlickerActive: boolean = false; // Currently in flicker animation
    private lightsGracePausedAt: number | null = null; // When grace timer was paused (console/minigame)
    public initialTotalScore: number = 0;
    public powerUps: Record<string, number> = {};
    public isSessionActive: boolean = false;
    public equippedActives: string[] = [];
    private crackManager: CrackManager;

    private pendingTotalScore: number | null = null;

    // Generate random complication threshold in range [12, 24]
    private randomThreshold(): number {
        return Math.floor(Math.random() * 13) + 12; // 12 to 24 inclusive
    }

    // Check if piece has any adjacent wild cells in the grid (for wild conversion)
    private hasAdjacentWild(grid: TankCell[][], piece: ActivePiece): boolean {
        for (const cell of piece.cells) {
            const x = normalizeX(piece.x + cell.x);
            const y = Math.floor(piece.y + cell.y);
            if (y < 0 || y >= TANK_HEIGHT) continue;

            const neighbors = [
                { x: normalizeX(x + 1), y },
                { x: normalizeX(x - 1), y },
                { x, y: y + 1 },
                { x, y: y - 1 }
            ];

            for (const n of neighbors) {
                if (n.y >= 0 && n.y < TANK_HEIGHT) {
                    const neighborCell = grid[n.y][n.x];
                    if (neighborCell?.isWild) return true;
                }
            }
        }
        return false;
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
            tankRotation: 0,
            activeGoop: null,
            storedPiece: null,
            nextPiece: null,
            sessionXP: 0,
            gameOver: false,
            isPaused: false,
            canSwap: true,
            level: 1,
            cellsCleared: 0,
            popStreak: 0,
            fallingBlocks: [],
            dumpPieces: [],
            dumpQueue: [],
            sessionTime: SESSION_DURATION,
            scoreBreakdown: { base: 0, height: 0, offscreen: 0, adjacency: 0, speed: 0 },
            gameStats: { startTime: 0, totalBonusTime: 0, maxGroupSize: 0 },
            floatingTexts: [],
            goalMarks: [],
            crackCells: [],
            goalsCleared: 0,
            goalsTarget: goalsTarget,
            phase: ScreenType.ConsoleScreen, // Start in Console
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
            prePoppedGoopGroups: new Set(),
            laserCharge: 100,  // Starts full
            controlsHeat: 0,      // Starts cool
            lightsBrightness: 100,     // Starts at full brightness
            lightsGraceStart: null,    // null = fast dropping, starts as if fast dropping
            lightsFlickered: false,    // No flicker yet this cycle
            complicationCooldowns: {
                [TankSystem.LIGHTS]: 0,
                [TankSystem.CONTROLS]: 0,
                [TankSystem.LASER]: 0
            },

            // Active ability tracking
            activeCharges: {},     // Will be populated based on equipped actives
            crackGoopPopped: 0,    // Count of glowing goop popped (for charging actives)

            // GOOP_COLORIZER tracking
            colorizerColor: null,
            colorizerRemaining: 0,

            // CRACK_DOWN active ability tracking
            crackDownRemaining: 0
        };

        this.applyUpgrades();
        this.crackManager = new CrackManager();
    }

    public execute(command: Command) {
        command.execute(this);
    }

    private applyUpgrades() {
        // Base time from constants
        let baseTime = SESSION_DURATION;

        // PRESSURE_CONTROL: +5 seconds per level (max 8 levels = +40s)
        const pressureLevel = this.powerUps['PRESSURE_CONTROL'] || 0;
        if (pressureLevel > 0) {
            const bonusMs = pressureLevel * 5 * 1000; // 5 seconds per level
            baseTime += bonusMs;
        }

        this.maxTime = baseTime;

        // Reset time if we haven't started playing yet
        if (this.state.gameStats.startTime === 0) {
            this.state.sessionTime = this.maxTime;
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

        // At game start (elapsed time = 0), getPiecePoolByZone() returns Tetra pool
        // Generate next piece for preview using zone-based selection
        const nextColor = palette[Math.floor(Math.random() * palette.length)];
        const shouldSplit = startRank >= 20 && Math.random() < 0.25;

        // Use Tetra pool directly for start (elapsed time = 0)
        const startPool = Math.random() < CORRUPTION_CHANCE ? TETRA_CORRUPTED : TETRA_NORMAL;
        const startPieceIndex = Math.floor(Math.random() * startPool.length);
        const startBasePiece = this.maybeApplyMirror({ ...startPool[startPieceIndex] });

        let nextPieceDef: GoopTemplate;
        if (shouldSplit) {
            // Pick second color different from first
            const otherColors = palette.filter(c => c !== nextColor);
            const secondColor = otherColors[Math.floor(Math.random() * otherColors.length)];

            const basePiece = {
                ...startBasePiece,
                color: nextColor
            };
            nextPieceDef = splitPiece(basePiece, nextColor, secondColor);
        } else {
            nextPieceDef = {
                ...startBasePiece,
                color: nextColor
            };
        }

        // Stored piece also uses Tetra pool at game start
        const storedPool = Math.random() < CORRUPTION_CHANCE ? TETRA_CORRUPTED : TETRA_NORMAL;
        const storedPieceIndex = Math.floor(Math.random() * storedPool.length);
        const storedBasePiece = this.maybeApplyMirror({ ...storedPool[storedPieceIndex] });

        this.state = {
            ...this.state,
            grid: createInitialGrid(startRank, this.powerUps),
            tankRotation: 0,
            sessionXP: 0,
            gameOver: false,
            isPaused: false,
            activeGoop: null,
            storedPiece: {
                ...storedBasePiece,
                color: palette[Math.floor(Math.random() * palette.length)]
            },
            nextPiece: nextPieceDef,
            canSwap: true,
            popStreak: 0,
            cellsCleared: 0,
            fallingBlocks: [],
            dumpPieces: [],
            dumpQueue: [],
            sessionTime: this.maxTime,
            floatingTexts: [],
            goalMarks: [],
            crackCells: [],
            goalsCleared: 0,
            goalsTarget: newTarget,
            gameStats: { startTime: Date.now(), totalBonusTime: 0, maxGroupSize: 0 },
            scoreBreakdown: { base: 0, height: 0, offscreen: 0, adjacency: 0, speed: 0 },
            phase: ScreenType.TankScreen,
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
            prePoppedGoopGroups: new Set(),
            laserCharge: 100,  // Starts full
            controlsHeat: 0,      // Starts cool
            lightsBrightness: 100,     // Starts at full brightness
            lightsGraceStart: null,    // null = fast dropping, starts as if fast dropping
            lightsFlickered: false,    // No flicker yet this cycle
            complicationCooldowns: {
                [TankSystem.LIGHTS]: 0,
                [TankSystem.CONTROLS]: 0,
                [TankSystem.LASER]: 0
            },

            // GOOP_COLORIZER tracking - reset on new run
            colorizerColor: null,
            colorizerRemaining: 0,

            // CRACK_DOWN active ability - reset on new run
            crackDownRemaining: 0
        };

        this.lockStartTime = null;
        this.lastGoalSpawnTime = Date.now();
        this.lastComplicationCheckTime = Date.now();
        this.isFastDropping = false;
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
        this.state.phase = ScreenType.ConsoleScreen;
        this.state.sessionXP = 0; // Reset run score
        
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
        this.state.sessionXP = 0;
        this.state.goalsCleared = 0; 
        
        // 2. Trigger standard Game Over flow (monitor drops, penalties calc, etc)
        // Note: finalizeGame calculates penalty based on leftover blocks. 
        // It subtracts penalty from score. Math.max(0, 0 - penalty) results in 0 final score.
        this.finalizeGame();
    }

    public enterConsole() {
        this.state.phase = ScreenType.ConsoleScreen;
        this.emitChange();
    }

    public enterPeriscope() {
        if (this.state.gameOver) {
            this.startRun();
        } else {
            this.state.phase = ScreenType.TankScreen;
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
        this.state.phase = ScreenType.ConsoleScreen;
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
                const targetColor = this.state.activeGoop?.definition.color
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
                            x: Math.floor(Math.random() * TANK_WIDTH),
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
                const targetColor = this.state.activeGoop?.definition.color;
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
            case 'CRACK_DOWN': {
                // Make next N cracks spawn in bottom 4 rows
                // Level scaling: 3/5/7 cracks for level 1/2/3
                const crackDownLevel = this.powerUps[upgradeId] || 1;
                const crackCount = 1 + crackDownLevel * 2; // 3, 5, 7
                this.state.crackDownRemaining = crackCount;
                console.log(`CRACK_DOWN activated: next ${crackCount} cracks will spawn in bottom 4 rows`);
                break;
            }
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
        this.state.phase = ScreenType.ConsoleScreen;

        // 1. Calculate and Apply Win Bonus (Operator Rank * 5000)
        // This ensures the bonus is part of the final score sent to save system
        if (this.state.goalsCleared >= this.state.goalsTarget) {
            const startRank = calculateRankDetails(this.initialTotalScore).rank;
            const winBonus = startRank * 5000;
            this.state.sessionXP += winBonus;
        }

        // 2. Calculate Penalty for leftover blocks
        let remainingBlocks = 0;
        for (let y = 0; y < TANK_HEIGHT; y++) {
            for (let x = 0; x < TANK_WIDTH; x++) {
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
        this.state.sessionXP = Math.max(0, this.state.sessionXP - penalty);

        // 4. Apply XP floor: minimum XP = 100 * starting rank
        // Prevents high-rank players from getting zero-gain runs
        const startingRank = calculateRankDetails(this.initialTotalScore).rank;
        const xpFloor = 100 * startingRank;
        this.state.sessionXP = Math.max(xpFloor, this.state.sessionXP);

        // 5. Clear any active complications so they don't show on end screen
        this.state.complications = [];
        this.state.activeComplicationId = null;
        this.state.prePoppedGoopGroups.clear();

        gameEventBus.emit(GameEventType.GAME_OVER);
        this.emitChange();
    }

    /**
     * Get the appropriate piece pool based on elapsed game time.
     * Zone selection: Tetra (0-25s), Penta (25-50s), Hexa (50-75s)
     */
    private getPiecePoolByZone(): GoopTemplate[] {
        const elapsedMs = this.maxTime - this.state.sessionTime;
        const elapsedSec = elapsedMs / 1000;

        // Determine which size zone we're in
        // 75 sec game = 25 sec per zone (adjusts for PRESSURE_CONTROL bonus time)
        const zoneLength = this.maxTime / 3 / 1000; // seconds per zone

        // Use corruption chance to select normal vs corrupted
        const useCorrupted = Math.random() < CORRUPTION_CHANCE;

        if (elapsedSec < zoneLength) {
            // Tetra zone (0-25s for base time)
            return useCorrupted ? TETRA_CORRUPTED : TETRA_NORMAL;
        } else if (elapsedSec < zoneLength * 2) {
            // Penta zone (25-50s for base time)
            return useCorrupted ? PENTA_CORRUPTED : PENTA_NORMAL;
        } else {
            // Hexa zone (50-75s for base time)
            return useCorrupted ? HEXA_CORRUPTED : HEXA_NORMAL;
        }
    }

    /**
     * Mirror a piece's cells horizontally (flip around Y axis).
     * Only applies to asymmetric pieces based on MIRROR_CHANCE.
     */
    private maybeApplyMirror(definition: GoopTemplate): GoopTemplate {
        // 50% chance to mirror
        if (Math.random() >= MIRROR_CHANCE) {
            return definition;
        }

        // Check if piece is symmetric (mirroring would have no effect)
        // A piece is symmetric if for every cell (x, y), there exists (-x, y)
        const isSymmetric = definition.cells.every(cell =>
            definition.cells.some(other => other.x === -cell.x && other.y === cell.y)
        );

        if (isSymmetric) {
            return definition;
        }

        // Apply horizontal mirror: negate x coordinates
        return {
            ...definition,
            cells: definition.cells.map(cell => ({ x: -cell.x, y: cell.y }))
        };
    }

    public spawnNewPiece(pieceDef?: GoopTemplate, gridOverride?: TankCell[][], offsetOverride?: number) {
        const currentGrid = gridOverride || this.state.grid;
        const currentOffset = offsetOverride !== undefined ? offsetOverride : this.state.tankRotation;
        const currentTotalScore = this.initialTotalScore + this.state.sessionXP;
        const currentRank = calculateRankDetails(currentTotalScore).rank;
        const palette = getPaletteForRank(currentRank);

        // If no specific piece provided and we have a queued next piece, use it
        let pieceToSpawn = pieceDef;
        if (!pieceToSpawn && this.state.nextPiece) {
            pieceToSpawn = this.state.nextPiece;
            // Generate new next piece for the queue
            // Apply CRACK_MATCHER bias: +25% per level to match lowest crack's color
            let nextColor = palette[Math.floor(Math.random() * palette.length)];
            const crackMatcherLevel = this.powerUps['CRACK_MATCHER'] || 0;
            // Use crackCells for lowest crack detection (with goalMarks fallback)
            const cracksToCheck = this.state.crackCells.length > 0
                ? this.state.crackCells
                : this.state.goalMarks;
            if (crackMatcherLevel > 0 && cracksToCheck.length > 0) {
                // Find lowest crack (highest Y value = closest to bottom)
                const lowestCrack = cracksToCheck.reduce((lowest, mark) =>
                    mark.y > lowest.y ? mark : lowest
                );
                const biasChance = crackMatcherLevel * 0.25; // 25% per level
                if (Math.random() < biasChance) {
                    nextColor = lowestCrack.color;
                    console.log(`CRACK_MATCHER: Biased next piece to ${nextColor} (lowest crack at y=${lowestCrack.y})`);
                }
            }
            // Zone-based piece selection with corruption and mirroring
            const pool = this.getPiecePoolByZone();
            const pieceIndex = Math.floor(Math.random() * pool.length);
            const basePieceDef = this.maybeApplyMirror({ ...pool[pieceIndex] });

            // Multi-color split: 25% chance at rank 20+
            const shouldSplit = currentRank >= 20 && Math.random() < 0.25;

            let newNext: GoopTemplate;
            if (shouldSplit) {
                // Pick second color different from first
                const otherColors = palette.filter(c => c !== nextColor);
                const secondColor = otherColors[Math.floor(Math.random() * otherColors.length)];

                const basePiece = {
                    ...basePieceDef,
                    color: nextColor
                };
                newNext = splitPiece(basePiece, nextColor, secondColor);
            } else {
                newNext = {
                    ...basePieceDef,
                    color: nextColor
                };
            }

            // Wild piece chance: 15% at rank 40+ (overrides split/color if triggered)
            if (currentRank >= 40 && Math.random() < 0.15) {
                // Wild pieces use zone-based shape selection too
                const wildPool = this.getPiecePoolByZone();
                const wildPieceIndex = Math.floor(Math.random() * wildPool.length);
                newNext = {
                    ...this.maybeApplyMirror({ ...wildPool[wildPieceIndex] }),
                    color: COLORS.WILD,
                    isWild: true
                };
                console.log('Wild piece queued for next spawn');
            }

            this.state.nextPiece = newNext;
        }

        const piece = spawnPiece(pieceToSpawn, currentRank);

        // Apply GOOP_COLORIZER effect if active
        if (this.state.colorizerRemaining > 0 && this.state.colorizerColor) {
            // Override piece color AND cellColors to uniform
            piece.definition = {
                ...piece.definition,
                color: this.state.colorizerColor,
                cellColors: undefined  // Clear multi-color, use uniform color
            };
            this.state.colorizerRemaining--;

            // Also update nextPiece if it exists (so preview shows correct color)
            if (this.state.nextPiece && this.state.colorizerRemaining > 0) {
                this.state.nextPiece = {
                    ...this.state.nextPiece,
                    color: this.state.colorizerColor,
                    cellColors: undefined  // Clear multi-color on preview too
                };
            }

            console.log(`GOOP_COLORIZER: Spawned ${this.state.colorizerColor} piece (${this.state.colorizerRemaining} remaining)`);

            // Clear colorizer when done
            if (this.state.colorizerRemaining === 0) {
                this.state.colorizerColor = null;
            }
        }

        // LOGIC: Spawn at top center of visible tankViewport
        // Map visible center to grid coordinate based on board offset
        const spawnVisualX = Math.floor((TANK_VIEWPORT_WIDTH - 1) / 2);
        const spawnVisualY = 0;

        piece.screenX = spawnVisualX; // Screen Space Source of Truth
        piece.x = getGridX(spawnVisualX, currentOffset); // Grid Space Derived
        
        piece.y = spawnVisualY;
        piece.startSpawnY = spawnVisualY;
        piece.state = GoopState.FALLING;

        this.lockStartTime = null;
        this.lockResetCount = 0;  // Reset move counter for new piece

        // Check immediate collision on spawn (Game Over condition)
        if (checkCollision(currentGrid, piece, currentOffset)) {
             this.finalizeGame();
        }

        this.state.activeGoop = piece;
        this.state.canSwap = true;
        
        this.emitChange();
    }

    public updateScoreAndStats(pointsToAdd: number, breakdown?: Partial<ScoreBreakdown>) {
        // Score boost upgrade removed - points are now unmodified
        this.state.sessionXP += pointsToAdd;

        if (breakdown) {
            this.state.sessionXPBreakdown.base += (breakdown.base || 0);
            this.state.sessionXPBreakdown.height += (breakdown.height || 0);
            this.state.sessionXPBreakdown.offscreen += (breakdown.offscreen || 0);
            this.state.sessionXPBreakdown.adjacency += (breakdown.adjacency || 0);
            this.state.sessionXPBreakdown.speed += (breakdown.speed || 0);
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
        const isInMinigame = this.state.phase === ScreenType.COMPLICATION_MINIGAME;
        const timeMultiplier = (isInMinigame && focusLevel > 0)
            ? (1 - focusLevel * 0.10)  // At level 4: 0.60 (40% slower)
            : 1;

        this.state.sessionTime = Math.max(0, this.state.sessionTime - (dt * timeMultiplier));
        if (this.state.sessionTime <= 0) {
            this.finalizeGame();
            return false;
        }
        return true;
    }

    /**
     * Spawn crack cells at regular intervals.
     * Uses new CrackCell system for expanding cracks mechanic.
     */
    private tickGoals(): void {
        const { crack, newLastSpawnTime } = goalManager.trySpawnCrack(
            this.state,
            this.state.grid,
            this.initialTotalScore,
            this.state.sessionTime,
            this.maxTime,
            this.lastGoalSpawnTime
        );

        this.lastGoalSpawnTime = newLastSpawnTime;

        if (crack) {
            this.state.crackCells.push(crack);
            // Also add to goalMarks for backward compatibility (sealing detection uses goalMarks)
            this.state.goalMarks.push({
                id: crack.id,
                x: crack.x,
                y: crack.y,
                color: crack.color,
                spawnTime: crack.spawnTime
            });
            console.log('[CRACK DEBUG] Spawned crack:', crack.id, 'at', crack.x, crack.y, '- crackCells count:', this.state.crackCells.length);
        }
    }

    /**
     * Handle CONTROLS heat dissipation when not actively rotating.
     */
    private tickHeat(dt: number): void {
        const startingRank = calculateRankDetails(this.initialTotalScore).rank;
        const ctrlConfig = COMPLICATION_CONFIG[TankSystem.CONTROLS];

        if (isComplicationUnlocked(TankSystem.CONTROLS, startingRank) && this.state.controlsHeat > 0) {
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
     * Handle LIGHTS brightness system: dims when not fast dropping, recovers when fast dropping.
     * Player must "work faster" (fast drop) to keep the lights on.
     */
    private tickLightsBrightness(dt: number): void {
        const startingRank = calculateRankDetails(this.initialTotalScore).rank;
        const lightsConfig = COMPLICATION_CONFIG[TankSystem.LIGHTS];

        // Only run if LIGHTS is unlocked
        if (!isComplicationUnlocked(TankSystem.LIGHTS, startingRank)) return;

        // Pause grace timer when not in PERISCOPE phase (console/minigame)
        if (this.state.phase !== ScreenType.TankScreen) {
            // Record when we paused so we can resume later
            if (this.state.lightsGraceStart !== null && this.lightsGracePausedAt === null) {
                this.lightsGracePausedAt = Date.now();
            }
            return;
        }

        // Resume grace timer if we were paused (returning from console/minigame)
        if (this.lightsGracePausedAt !== null && this.state.lightsGraceStart !== null) {
            const pausedDuration = Date.now() - this.lightsGracePausedAt;
            this.state.lightsGraceStart += pausedDuration;
            this.lightsGracePausedAt = null;
        }

        // Skip if already in malfunction state
        const hasLightsActive = this.state.complications.some(c => c.type === TankSystem.LIGHTS);
        if (hasLightsActive) {
            // Keep at failed brightness during malfunction
            this.state.lightsBrightness = lightsConfig.failedBrightness;
            return;
        }

        const now = Date.now();

        // Edge detection: started fast dropping
        if (this.isFastDropping && !this.wasFastDropping) {
            // Start recovery - clear grace timer, begin lerping to 100
            this.state.lightsGraceStart = null;
            this.state.lightsFlickered = false;
            this.lightsOverflarePhase = 'none';
            this.lightsFlickerActive = false;
        }

        // Edge detection: stopped fast dropping
        if (!this.isFastDropping && this.wasFastDropping) {
            // Start grace period
            this.state.lightsGraceStart = now;
            this.state.lightsFlickered = false;
            this.lightsOverflarePhase = 'none';
            this.lightsFlickerActive = false;
        }

        // Update tracking
        this.wasFastDropping = this.isFastDropping;

        // Calculate grace period with upgrade bonus
        const stabilizerLevel = this.powerUps['CIRCUIT_STABILIZER'] || 0;
        const graceDuration = (lightsConfig.graceBaseSec + lightsConfig.gracePerLevel * stabilizerLevel) * 1000;

        if (this.isFastDropping) {
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
            // NOT FAST DROPPING: Grace period, then dim
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
                    complicationManager.spawnComplication(this.state, TankSystem.LIGHTS);
                }
            }
        }
    }

    /**
     * Update falling blocks (gravity after pop).
     */
    private tickFallingBlocks(dt: number): void {
        if (this.state.fallingBlocks.length === 0) return;

        const gameSpeed = ACTIVE_GOOP_SPEED;
        const { active, landed } = updateFallingBlocks(this.state.fallingBlocks, this.state.grid, dt, gameSpeed);

        if (landed.length > 0) {
            gameEventBus.emit(GameEventType.PIECE_DROPPED);
            const newGrid = this.state.grid.map(row => [...row]);
            let landUpdates = false;
            const consumedGoals: string[] = [];

            landed.forEach(b => {
                if (b.y >= 0 && b.y < TANK_HEIGHT) {
                    const landY = Math.floor(b.y);

                    // Check for goal at this position
                    const hitGoal = this.state.goalMarks.find(
                        g => g.x === b.x && g.y === landY
                    );

                    let isMatch = false;
                    if (hitGoal && hitGoal.color === b.data.color) {
                        consumedGoals.push(hitGoal.id);
                        isMatch = true;
                    }
                    // Non-matching: goal stays in array, visible through goop

                    newGrid[landY][b.x] = {
                        ...b.data,
                        timestamp: Date.now(),
                        isGlowing: isMatch
                    };
                    landUpdates = true;
                }
            });

            if (landUpdates) {
                this.state.grid = updateGroups(newGrid);
            }

            // Handle consumed goals (remove from array, emit events)
            if (consumedGoals.length > 0) {
                this.state.goalMarks = this.state.goalMarks.filter(
                    g => !consumedGoals.includes(g.id)
                );
                consumedGoals.forEach(() => {
                    gameEventBus.emit(GameEventType.GOAL_CAPTURED, { count: 1 });
                });
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

            if (gridY >= TANK_HEIGHT - 1) {
                // Hit floor
                landed = true;
            } else if (gridY >= 0 && newGrid[gridY + 1]?.[gridX]) {
                // Hit existing block below
                landed = true;
            }

            if (landed && gridY >= 0 && gridY < TANK_HEIGHT) {
                // Place in grid as a single-block goop
                newGrid[gridY][gridX] = {
                    id: piece.id,
                    goopGroupId: Math.random().toString(36).substr(2, 9),
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
        if (!this.state.activeGoop) return;

        // DENSE_GOOP: +12.5% fall speed per level (reduces interval between drops)
        const denseLevel = this.powerUps['DENSE_GOOP'] || 0;
        const speedMultiplier = 1 + (denseLevel * 0.125); // 1.0, 1.125, 1.25, 1.375, 1.5
        const adjustedSpeed = ACTIVE_GOOP_SPEED / speedMultiplier;

        const gravitySpeed = this.isFastDropping
            ? adjustedSpeed / FAST_DROP_FACTOR
            : adjustedSpeed;

        const moveAmount = dt / gravitySpeed;
        const nextY = this.state.activeGoop.y + moveAmount;

        // Maintain Grid X based on Screen X and Board Offset
        const currentGridX = getGridX(this.state.activeGoop.screenX, this.state.tankRotation);
        const nextPiece = { ...this.state.activeGoop, y: nextY, x: currentGridX };

        if (checkCollision(this.state.grid, nextPiece, this.state.tankRotation)) {
            if (this.lockStartTime === null) {
                this.lockStartTime = Date.now();
            }

            const lockedTime = Date.now() - this.lockStartTime;
            const effectiveLockDelay = this.isFastDropping ? 50 : LOCK_DELAY_MS;

            // Lock if: timer expired OR hit 10-reset limit (prevents infinite spin)
            if (lockedTime > effectiveLockDelay || this.lockResetCount >= 10) {
                this.lockActivePiece();
            }
        } else {
            this.state.activeGoop = nextPiece;
            this.lockStartTime = null;
        }
    }

    /**
     * Lock the active piece, handle goals, check LIGHTS trigger, spawn new piece.
     */
    private lockActivePiece(): void {
        if (!this.state.activeGoop) return;

        const y = getGhostY(this.state.grid, this.state.activeGoop, this.state.tankRotation);
        const finalPiece = { ...this.state.activeGoop, y };

        let { grid: newGrid, consumedGoals, destroyedGoals } = mergePiece(this.state.grid, finalPiece, this.state.goalMarks);

        // Process wild piece conversions (wild spreads to neighbors, or non-wild converts wild neighbors)
        if (finalPiece.definition.isWild || this.hasAdjacentWild(newGrid, finalPiece)) {
            newGrid = processWildConversions(newGrid, finalPiece);
        }

        if (consumedGoals.length > 0 || destroyedGoals.length > 0) {
            this.handleGoals(consumedGoals, destroyedGoals, finalPiece);
        }

        // LIGHTS complication is now triggered by brightness system (tickLightsBrightness)
        // No random trigger on piece lock anymore

        // Laser capacitor refill: +15% on piece lock (only when no active LASER complication)
        const hasActiveLaser = this.state.complications.some(c => c.type === TankSystem.LASER);
        if (!hasActiveLaser) {
            this.state.laserCharge = Math.min(100, this.state.laserCharge + 10);
        }

        gameEventBus.emit(GameEventType.PIECE_DROPPED);
        this.state.grid = newGrid;

        this.spawnNewPiece(undefined, newGrid);
        this.state.popStreak = 0;
        this.isFastDropping = false;
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

    // Debug: track tick calls to diagnose pressure bug
    private tickDebugCounter: number = 0;
    private lastTickDebugLog: number = 0;

    public tick(dt: number) {
        // DEBUG: Log every 2 seconds to track pressure bug
        this.tickDebugCounter++;
        const now = Date.now();
        if (now - this.lastTickDebugLog > 2000) {
            console.log(`[TICK DEBUG] #${this.tickDebugCounter} | active=${this.isSessionActive} | phase=${this.state.phase} | timeLeft=${this.state.sessionTime.toFixed(0)} | maxTime=${this.maxTime} | paused=${this.state.isPaused} | gameOver=${this.state.gameOver}`);
            this.lastTickDebugLog = now;
        }

        if (!this.isSessionActive || this.state.gameOver || this.state.isPaused) return;

        // Timer - stop if game ended
        if (!this.tickTimer(dt)) return;

        // Goals
        this.tickGoals();

        // Crack growth (rank 30+ expanding cracks mechanic)
        this.crackManager.tickGrowth(this.state, this.initialTotalScore, this.powerUps, this.maxTime);

        // Complications check
        this.checkComplications(dt);

        // Heat dissipation
        this.tickHeat(dt);

        // Lights brightness (player-controlled via fast drop)
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
