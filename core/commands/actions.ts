
import { Command } from './Command';
import { GameEngine } from '../GameEngine';
import { GamePhase, PieceState, PieceType, ActivePiece, GameState } from '../../types';
import { normalizeX, checkCollision, getRotatedCells, getGhostY, mergePiece, findContiguousGroup, getFloatingBlocks, spawnGoalBurst, calculateAdjacencyBonus, calculateHeightBonus, calculateOffScreenBonus, calculateMultiplier, updateGroups } from '../../utils/gameLogic';
import { getGridX, getScreenX } from '../../utils/coordinates';
import { gameEventBus } from '../events/EventBus';
import { GameEventType } from '../events/GameEvents';
import { VISIBLE_WIDTH, TOTAL_HEIGHT, VISIBLE_HEIGHT, PER_BLOCK_DURATION, PRESSURE_RECOVERY_BASE_MS, PRESSURE_RECOVERY_PER_UNIT_MS, PRESSURE_TIER_THRESHOLD, PRESSURE_TIER_STEP, PRESSURE_TIER_BONUS_MS } from '../../constants';
import { calculateRankDetails } from '../../utils/progression';
import { audio } from '../../utils/audio';

export class MoveBoardCommand implements Command {
    type = 'MOVE_BOARD';
    constructor(public dir: number) {}

    execute(engine: GameEngine): void {
        if (engine.state.gameOver || engine.state.isPaused) return;

        const newOffset = normalizeX(engine.state.boardOffset + this.dir);
        
        let newPiece = engine.state.activePiece;

        // Decoupled Movement:
        // Board moves, but piece stays at same SCREEN coordinate.
        // Therefore, its GRID coordinate must change relative to the new board offset.
        if (engine.state.activePiece) {
             // Calculate new Grid X based on existing Screen X and new Board Offset
             const newGridX = getGridX(engine.state.activePiece.screenX, newOffset);
             newPiece = { ...engine.state.activePiece, x: newGridX };

             if (checkCollision(engine.state.grid, newPiece, newOffset)) {
                 gameEventBus.emit(GameEventType.ACTION_REJECTED);
                 return;
             }
        }

        engine.state.boardOffset = newOffset;
        if (newPiece) {
            engine.state.activePiece = newPiece;
        }

        gameEventBus.emit(GameEventType.PIECE_MOVED);
        engine.emitChange();
    }
}

export class RotatePieceCommand implements Command {
    type = 'ROTATE_PIECE';
    constructor(public clockwise: boolean) {}

    execute(engine: GameEngine): void {
        if (engine.state.gameOver || engine.state.isPaused || !engine.state.activePiece) return;
        if (engine.state.activePiece.definition.type === PieceType.O) return;

        const p = engine.state.activePiece;
        const nextRot = (p.rotation + (this.clockwise ? 1 : -1) + 4) % 4;
        const nextCells = getRotatedCells(p.cells, this.clockwise);
        
        const tempPiece = { ...p, cells: nextCells, rotation: nextRot };

        const kicks = [{x:0, y:0}, {x:1, y:0}, {x:-1, y:0}, {x:0, y:-1}, {x:1, y:-1}, {x:-1, y:-1}, {x:2, y:0}, {x:-2, y:0}];
        for (const kick of kicks) {
            const kickedGridX = normalizeX(tempPiece.x + kick.x);
            // We must update screenX if we kick the piece!
            // Calculate what screenX would be for this new gridX
            const kickedScreenX = getScreenX(kickedGridX, engine.state.boardOffset);
            
            const kickedPiece = { ...tempPiece, x: kickedGridX, y: tempPiece.y + kick.y, screenX: kickedScreenX };
            
            if (!checkCollision(engine.state.grid, kickedPiece, engine.state.boardOffset)) {
                gameEventBus.emit(GameEventType.PIECE_ROTATED);
                engine.state.activePiece = kickedPiece;
                engine.emitChange();
                return;
            }
        }
    }
}

export class SetSoftDropCommand implements Command {
    type = 'SET_SOFT_DROP';
    constructor(public active: boolean) {}

    execute(engine: GameEngine): void {
        engine.isSoftDropping = this.active;
    }
}

export class HardDropCommand implements Command {
    type = 'HARD_DROP';
    constructor() {}

    execute(engine: GameEngine): void {
        if (engine.state.gameOver || engine.state.isPaused || !engine.state.activePiece) return;

        const y = getGhostY(engine.state.grid, engine.state.activePiece, engine.state.boardOffset);
        const droppedPiece = { ...engine.state.activePiece, y };
        
        const { grid: newGrid, consumedGoals, destroyedGoals } = mergePiece(engine.state.grid, droppedPiece, engine.state.goalMarks);
        
        if (consumedGoals.length > 0 || destroyedGoals.length > 0) {
            engine.handleGoals(consumedGoals, destroyedGoals, droppedPiece);
        }

        const distance = Math.floor(y - engine.state.activePiece.y);
        engine.updateScoreAndStats(distance * 2, { speed: distance * 2 });

        gameEventBus.emit(GameEventType.PIECE_DROPPED);
        engine.state.grid = newGrid;
        
        engine.spawnNewPiece(undefined, newGrid);
        engine.state.combo = 0;
        engine.isSoftDropping = false;
        engine.emitChange();
    }
}

export class SwapPieceCommand implements Command {
    type = 'SWAP_PIECE';
    constructor() {}

    execute(engine: GameEngine): void {
        if (engine.state.gameOver || engine.state.isPaused || !engine.state.activePiece || !engine.state.canSwap) return;
        
        gameEventBus.emit(GameEventType.PIECE_ROTATED); 

        const currentDef = engine.state.activePiece.definition;
        const nextDef = engine.state.storedPiece;
        
        engine.state.storedPiece = currentDef;
        engine.lockStartTime = null; 
        
        const spawnVisualX = Math.floor((VISIBLE_WIDTH - 1) / 2);
        const spawnVisualY = 0;
        const spawnX = getGridX(spawnVisualX, engine.state.boardOffset);

        if (nextDef) {
            const newPiece: ActivePiece = { 
                definition: nextDef, 
                cells: [...nextDef.cells], 
                rotation: 0,
                spawnTimestamp: Date.now(),
                startSpawnY: spawnVisualY,
                screenX: spawnVisualX,
                x: spawnX,
                y: spawnVisualY,
                state: PieceState.FALLING
            };
            
            engine.state.activePiece = newPiece;
            engine.state.canSwap = false;
        } else {
            engine.spawnNewPiece(); 
            engine.state.canSwap = false;
        }
        engine.emitChange();
    }
}

export class BlockTapCommand implements Command {
    type = 'BLOCK_TAP';
    constructor(public x: number, public y: number) {}

    execute(engine: GameEngine): void {
        if (engine.state.gameOver || engine.state.isPaused) return;

         const cell = engine.state.grid[this.y][this.x];
         if (!cell) return;
         
         const pressureRatio = Math.max(0, 1 - (engine.state.timeLeft / engine.maxTime));
         const thresholdY = (TOTAL_HEIGHT - 1) - (pressureRatio * (VISIBLE_HEIGHT - 1));
         
         if (cell.groupMinY < thresholdY) {
             gameEventBus.emit(GameEventType.ACTION_REJECTED);
             return;
         }

         const now = Date.now();
         const totalDuration = cell.groupSize * PER_BLOCK_DURATION;
         const elapsed = now - (cell.timestamp || 0); 
         
         if (elapsed < totalDuration) {
             gameEventBus.emit(GameEventType.ACTION_REJECTED); 
             return;
         }

         const group = findContiguousGroup(engine.state.grid, this.x, this.y);
         
         if (group.length > 0) {
            gameEventBus.emit(GameEventType.GOOP_POPPED, { combo: engine.state.combo, count: group.length });
            engine.state.cellsCleared++;
            
            const groupSize = group.length;
            engine.state.gameStats.maxGroupSize = Math.max(engine.state.gameStats.maxGroupSize, groupSize);

            // Pressure Reduction
            const basePressureReduc = PRESSURE_RECOVERY_BASE_MS;
            const unitPressureReduc = groupSize * PRESSURE_RECOVERY_PER_UNIT_MS;
            let tierPressureReduc = 0;
            if (groupSize >= PRESSURE_TIER_THRESHOLD) {
                const tier = Math.floor((groupSize - PRESSURE_TIER_THRESHOLD) / PRESSURE_TIER_STEP) + 1;
                tierPressureReduc = tier * PRESSURE_TIER_BONUS_MS;
            }

            // GOAL CLEAR LOGIC
            let infusedCount = 0;
            group.forEach(pt => {
                if (engine.state.grid[pt.y][pt.x]?.isGlowing) infusedCount++;
            });
            const infusedBonus = infusedCount * 3000;

            if (infusedCount > 0) {
                 engine.state.goalsCleared += infusedCount;
                 gameEventBus.emit(GameEventType.GOAL_CAPTURED, { count: infusedCount });
            }

            const totalTimeAdded = basePressureReduc + unitPressureReduc + tierPressureReduc + infusedBonus;

            engine.state.timeLeft = Math.min(engine.maxTime, engine.state.timeLeft + totalTimeAdded);
            engine.state.gameStats.totalBonusTime += totalTimeAdded;

            // Score Calculation
            let totalScoreForTap = 0;
            let currentComboCount = engine.state.combo + 1;

            let tapBreakdown = { base: 0, height: 0, offscreen: 0, adjacency: 0, speed: 0 };
            const adjacencyScore = calculateAdjacencyBonus(engine.state.grid, group);
            totalScoreForTap += adjacencyScore;
            tapBreakdown.adjacency += adjacencyScore;

            group.forEach((pt) => {
                 let bScore = 10;
                 let hScore = calculateHeightBonus(pt.y);
                 let oScore = calculateOffScreenBonus(pt.x, engine.state.boardOffset);
                 const multiplier = calculateMultiplier(currentComboCount);
                 const finalBlockScore = (bScore + hScore + oScore) * multiplier;
                 totalScoreForTap += finalBlockScore;
                 tapBreakdown.base += (bScore * multiplier);
                 tapBreakdown.height += (hScore * multiplier);
                 tapBreakdown.offscreen += (oScore * multiplier);
            });
            
            const roundedScore = Math.floor(totalScoreForTap);
            engine.updateScoreAndStats(roundedScore, tapBreakdown);
            engine.state.combo = currentComboCount;

            const textId = Math.random().toString(36).substr(2, 9);
            const floaters = [
                { id: textId, text: `+${roundedScore}`, x: this.x, y: this.y, life: 1, color: '#fbbf24' },
                { id: textId + '_time', text: `-${(totalTimeAdded/1000).toFixed(1)}s`, x: this.x, y: this.y - 1, life: 1, color: '#4ade80' }
            ];
            
            if (infusedCount > 0) {
                 floaters.push({ id: textId + '_bonus', text: 'GOAL CLEARED!', x: this.x, y: this.y - 2, life: 1.5, color: '#fff' });
            }

            engine.state.floatingTexts.push(...floaters);
            setTimeout(() => {
                engine.state.floatingTexts = engine.state.floatingTexts.filter(ft => !ft.id.startsWith(textId));
                engine.emitChange();
            }, 1000);

            // Modify Grid
            let tempGrid = engine.state.grid.map(row => [...row]);
            const uniqueCols = new Set<number>();
            group.forEach(pt => {
                tempGrid[pt.y][pt.x] = null;
                uniqueCols.add(pt.x);
            });
            
            const colsToCheck = Array.from(uniqueCols);
            const { grid: cleanGrid, falling: newFalling } = getFloatingBlocks(tempGrid, colsToCheck);

            // Burst Logic
            if (infusedCount > 0) {
                if (engine.state.goalsCleared >= engine.state.goalsTarget) {
                     const pressureRatio = Math.max(0, 1 - (engine.state.timeLeft / engine.maxTime));
                     const currentRank = calculateRankDetails(engine.initialTotalScore + engine.state.score).rank;

                     if (pressureRatio < 0.9) {
                         const burst = spawnGoalBurst(cleanGrid, engine.state.goalMarks, currentRank, engine.state.timeLeft, engine.maxTime);
                         engine.state.goalMarks.push(...burst);
                         gameEventBus.emit(GameEventType.GOAL_CAPTURED, { count: 1 });
                     } else {
                         engine.state.goalMarks = [];
                     }
                } 
            }

            engine.state.grid = cleanGrid;
            engine.state.fallingBlocks.push(...newFalling);
            engine.emitChange();
         }
    }
}

export class StartRunCommand implements Command {
    type = 'START_RUN';
    constructor() {}

    execute(engine: GameEngine): void {
        engine.startRun();
    }
}

export class SetPhaseCommand implements Command {
    type = 'SET_PHASE';
    constructor(public phase: GamePhase) {}

    execute(engine: GameEngine): void {
        if (this.phase === GamePhase.PERISCOPE) {
            engine.enterPeriscope();
        } else if (this.phase === GamePhase.CONSOLE) {
            engine.enterConsole();
        } else {
            engine.state.phase = this.phase;
            engine.emitChange();
        }
    }
}

export class ResolveComplicationCommand implements Command {
    type = 'RESOLVE_COMPLICATION';
    constructor(public id: string) {}

    execute(engine: GameEngine): void {
        engine.resolveComplication(this.id);
    }
}

export class TogglePauseCommand implements Command {
    type = 'TOGGLE_PAUSE';
    constructor() {}

    execute(engine: GameEngine): void {
        engine.state.isPaused = !engine.state.isPaused;
        if (engine.state.isPaused) {
            gameEventBus.emit(GameEventType.GAME_PAUSED);
            gameEventBus.emit(GameEventType.MUSIC_STOP);
        } else {
            gameEventBus.emit(GameEventType.GAME_RESUMED);
        }
        engine.emitChange();
    }
}
