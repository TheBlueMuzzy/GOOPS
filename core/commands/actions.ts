
import { Command } from './Command';
import { GameEngine } from '../GameEngine';
import { GamePhase, PieceState, PieceType, ActivePiece, GameState, ComplicationType } from '../../types';
import { normalizeX, checkCollision, getRotatedCells, getGhostY, mergePiece, findContiguousGroup, getFloatingBlocks, spawnGoalBurst, calculateAdjacencyBonus, calculateHeightBonus, calculateOffScreenBonus, calculateMultiplier, updateGroups } from '../../utils/gameLogic';
import { getGridX, getScreenX } from '../../utils/coordinates';
import { gameEventBus } from '../events/EventBus';
import { GameEventType } from '../events/GameEvents';
import { VISIBLE_WIDTH, TOTAL_HEIGHT, VISIBLE_HEIGHT, PER_BLOCK_DURATION, PRESSURE_RECOVERY_BASE_MS, PRESSURE_RECOVERY_PER_UNIT_MS, PRESSURE_TIER_THRESHOLD, PRESSURE_TIER_STEP, PRESSURE_TIER_BONUS_MS, ROTATION_BUFFER_SIZE } from '../../constants';
import { COMPLICATION_CONFIG, isComplicationUnlocked } from '../../complicationConfig';
import { calculateRankDetails } from '../../utils/progression';
import { audio } from '../../utils/audio';
import { complicationManager } from '../ComplicationManager';

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

        // Move reset: successful board movement resets lock delay timer
        if (engine.lockStartTime !== null) {
            engine.lockStartTime = null;
            engine.lockResetCount++;
        }

        // Track rotation timestamps for CONTROLS heat detection (circular buffer)
        const now = Date.now();
        engine.state.rotationTimestamps.push(now);
        // Keep buffer size limited (avoids memory leak from unbounded array growth)
        if (engine.state.rotationTimestamps.length > ROTATION_BUFFER_SIZE) {
            engine.state.rotationTimestamps.shift();
        }

        // CONTROLS heat buildup: builds when rotating (but not during cooldown)
        const startingRank = calculateRankDetails(engine.initialTotalScore).rank;
        const ctrlConfig = COMPLICATION_CONFIG[ComplicationType.CONTROLS];
        const controlsOnCooldown = Date.now() < engine.state.complicationCooldowns[ComplicationType.CONTROLS];
        if (isComplicationUnlocked(ComplicationType.CONTROLS, startingRank) && !controlsOnCooldown) {
            engine.state.controlsHeat = Math.min(ctrlConfig.heatMax, engine.state.controlsHeat + ctrlConfig.heatPerRotation);
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

        // Wall kicks: test offset positions when rotation is blocked
        // y:-1 = up 1 row, y:-2 = up 2 rows (allows "tucking" under overhangs)
        const kicks = [
            {x:0, y:0},                          // no offset
            {x:1, y:0}, {x:-1, y:0},             // left/right
            {x:0, y:-1}, {x:1, y:-1}, {x:-1, y:-1}, // up 1 row (existing)
            {x:0, y:-2}, {x:1, y:-2}, {x:-1, y:-2}, // up 2 rows (NEW - enables climbing)
            {x:2, y:0}, {x:-2, y:0}              // far left/right
        ];
        for (const kick of kicks) {
            const kickedGridX = normalizeX(tempPiece.x + kick.x);
            // We must update screenX if we kick the piece!
            // Calculate what screenX would be for this new gridX
            const kickedScreenX = getScreenX(kickedGridX, engine.state.boardOffset);
            
            const kickedPiece = { ...tempPiece, x: kickedGridX, y: tempPiece.y + kick.y, screenX: kickedScreenX };
            
            if (!checkCollision(engine.state.grid, kickedPiece, engine.state.boardOffset)) {
                gameEventBus.emit(GameEventType.PIECE_ROTATED);
                engine.state.activePiece = kickedPiece;

                // Move reset: successful rotation resets lock delay timer
                if (engine.lockStartTime !== null) {
                    engine.lockStartTime = null;
                    engine.lockResetCount++;
                }

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

        // Increment units added counter for complication tracking (only when no complications active)
        if (engine.state.complications.length === 0) {
            engine.state.totalUnitsAdded += droppedPiece.cells.length;
        }

        const distance = Math.floor(y - engine.state.activePiece.y);
        engine.updateScoreAndStats(distance * 2, { speed: distance * 2 });

        // Laser capacitor refill: +15% on piece lock (only when no active LASER complication)
        const hasActiveLaser = engine.state.complications.some(c => c.type === ComplicationType.LASER);
        if (!hasActiveLaser) {
            engine.state.laserCapacitor = Math.min(100, engine.state.laserCapacitor + 10);
        }

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
        if (engine.state.gameOver || engine.state.isPaused || !engine.state.activePiece) return;

        const currentPiece = engine.state.activePiece;
        const currentDef = currentPiece.definition;
        const nextDef = engine.state.storedPiece;

        if (nextDef) {
            // Check if stored piece can fit at current position BEFORE committing
            const testPiece: ActivePiece = {
                definition: nextDef,
                cells: [...nextDef.cells],
                rotation: 0,
                spawnTimestamp: Date.now(),
                startSpawnY: currentPiece.y,
                screenX: currentPiece.screenX,
                x: currentPiece.x,
                y: currentPiece.y,
                state: PieceState.FALLING
            };

            if (checkCollision(engine.state.grid, testPiece, engine.state.boardOffset)) {
                // Stored piece won't fit at current position - reject swap
                gameEventBus.emit(GameEventType.ACTION_REJECTED);
                return;
            }

            // Swap succeeds - stored piece fits at current position
            gameEventBus.emit(GameEventType.PIECE_ROTATED);
            engine.state.storedPiece = currentDef;
            engine.lockStartTime = null;
            engine.state.activePiece = testPiece;
        } else {
            // No stored piece - store current and spawn new
            gameEventBus.emit(GameEventType.PIECE_ROTATED);
            engine.state.storedPiece = currentDef;
            engine.lockStartTime = null;
            engine.spawnNewPiece();
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
            // LASER complication: first tap resets fill animation, then can pop when full
            const laserComplication = engine.state.complications.find(c => c.type === ComplicationType.LASER);
            if (laserComplication) {
                const groupId = cell.groupId;
                if (!engine.state.primedGroups.has(groupId)) {
                    // First tap: prime the group and restart fill animation
                    engine.state.primedGroups.add(groupId);

                    // Reset timestamp on all cells in this group to restart fill animation
                    const resetTime = Date.now();
                    group.forEach(pt => {
                        const groupCell = engine.state.grid[pt.y][pt.x];
                        if (groupCell) {
                            groupCell.timestamp = resetTime;
                        }
                    });

                    gameEventBus.emit(GameEventType.ACTION_REJECTED); // Feedback sound
                    engine.emitChange();
                    return;
                }
                // Group is primed - remove from primed set and proceed with pop
                // (fill check already happened above, so it's ready to pop)
                engine.state.primedGroups.delete(groupId);
            }

            gameEventBus.emit(GameEventType.GOOP_POPPED, { combo: engine.state.combo, count: group.length });
            engine.state.cellsCleared++;

            // Increment popped counter for complication tracking
            // Always increment so multiple complications can trigger simultaneously
            engine.state.totalUnitsPopped += group.length;

            // LASER capacitor drain: drains when popping groups
            const startingRank = calculateRankDetails(engine.initialTotalScore).rank;
            const laserConfig = COMPLICATION_CONFIG[ComplicationType.LASER];
            if (isComplicationUnlocked(ComplicationType.LASER, startingRank)) {
                const laserLevel = engine.powerUps['CAPACITOR_EFFICIENCY'] || 0;
                const drainMultiplier = 1 - (laserConfig.drainUpgradeEffect * laserLevel);
                const drainAmount = group.length * laserConfig.drainPerUnit * drainMultiplier;
                engine.state.laserCapacitor = Math.max(0, engine.state.laserCapacitor - drainAmount);
            }

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

                 // Charge active abilities: 25% per sealed crack-goop
                 engine.chargeActiveAbilities(infusedCount * 25);

                 // SEALING_BONUS: Reduce complication cooldowns when sealing crack-goop
                 const sealingLevel = engine.powerUps['SEALING_BONUS'] || 0;
                 if (sealingLevel > 0) {
                     const baseReduction = 0.10; // 10% base
                     const bonusReduction = sealingLevel * 0.05; // +5% per level
                     const totalReduction = baseReduction + bonusReduction;

                     // Apply reduction for each infused unit sealed
                     for (let i = 0; i < infusedCount; i++) {
                         complicationManager.reduceAllCooldowns(engine.state, totalReduction);
                     }
                 }
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
                 floaters.push({ id: textId + '_bonus', text: 'SEALED!', x: this.x, y: this.y - 2, life: 1.5, color: '#fff' });
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

export class ActivateAbilityCommand implements Command {
    type = 'ACTIVATE_ABILITY';
    constructor(public upgradeId: string) {}

    execute(engine: GameEngine): void {
        if (engine.state.gameOver || engine.state.isPaused) return;

        // Check ability is ready (charge >= 100)
        const charge = engine.state.activeCharges[this.upgradeId] || 0;
        if (charge < 100) return;

        // Reset charge
        engine.state.activeCharges[this.upgradeId] = 0;

        // Execute ability effect
        engine.activateAbility(this.upgradeId);

        gameEventBus.emit(GameEventType.ABILITY_ACTIVATED, { upgradeId: this.upgradeId });
        engine.emitChange();
    }
}
