/**
 * GameEngine.ts - Main game loop orchestrator
 *
 * The engine is the single point of control for game state.
 * It processes commands, runs systems, and emits events.
 *
 * IMPORTANT: This matches the original Game.tsx flow exactly:
 * - Piece spawns immediately on game start (before countdown ends)
 * - Countdown ticks down 2->1->null
 * - Game loop only processes movement/gravity when countdown === null
 * - Timer only ticks when countdown === null
 *
 * C# Note: Maps to a MonoBehaviour or GameManager class.
 */

import {
  CoreGameState, GameConfig, createInitialState, updateState
} from './GameState';
import {
  AnyCommand, CommandType, MoveBoardCommand, RotatePieceCommand,
  TapBlockCommand
} from './commands';
import { EventBus } from './events/EventBus';
import {
  GameEventType, createEvent, AnyGameEvent,
  GroupClearedEvent, GameOverEvent, GoalConsumedEvent, TimeAddedEvent
} from './events/GameEvents';

// Systems
import {
  normalizeX, findContiguousGroup, updateGroups, mergePiece,
  getFloatingBlocks, clearCells
} from './systems/GridSystem';
import {
  spawnPiece, getCenteredSpawnX, checkCollision, getGhostY,
  getRotatedCells, applyWallKicks, movePieceAndBoard, placeSwappedPiece
} from './systems/PieceSystem';
import { updateFallingBlocks } from './systems/PhysicsSystem';
import {
  calculateGroupClearScore, calculateHardDropScore, applyScoreBoost,
  addBreakdownWithBoost
} from './systems/ScoreSystem';
import {
  isGroupSubmerged, isGroupReady, calculateTimeRecovery, addTime
} from './systems/PressureSystem';
import {
  spawnGoalMark, removeConsumedGoals, isWinConditionMet, calculateWinBonus,
  GOAL_SPAWN_INTERVAL_MS
} from './systems/GoalSystem';

import { GridCell, PieceType } from '../types';
import { PER_BLOCK_DURATION, TOTAL_HEIGHT, VISIBLE_HEIGHT } from '../constants';
import { calculateRankDetails } from '../utils/progression';

const MIN_SPEED = 100;
const SOFT_DROP_FACTOR = 20;
const LOCK_DELAY_MS = 500;

export type StateChangeCallback = (state: CoreGameState) => void;

export class GameEngine {
  private state: CoreGameState;
  private eventBus: EventBus;
  private config: GameConfig;
  private commandQueue: AnyCommand[] = [];
  private stateListeners: StateChangeCallback[] = [];

  // Timing
  private lastGoalSpawnTime: number = 0;
  private lockStartTime: number | null = null;
  private countdownTimer: NodeJS.Timeout | null = null;

  constructor(config: GameConfig, eventBus?: EventBus) {
    this.config = config;
    this.eventBus = eventBus || new EventBus();
    this.state = createInitialState(config);
    this.lastGoalSpawnTime = Date.now();
  }

  /**
   * Get current state (read-only)
   */
  getState(): CoreGameState {
    return this.state;
  }

  /**
   * Get event bus for subscribing
   */
  getEventBus(): EventBus {
    return this.eventBus;
  }

  /**
   * Subscribe to state changes
   */
  onStateChange(callback: StateChangeCallback): () => void {
    this.stateListeners.push(callback);
    return () => {
      this.stateListeners = this.stateListeners.filter(l => l !== callback);
    };
  }

  /**
   * Queue a command for processing
   */
  queueCommand(command: AnyCommand): void {
    this.commandQueue.push(command);
  }

  /**
   * Start the game - matches original startNewGame:
   * 1. Spawn piece immediately
   * 2. Start countdown timer
   * 3. Piece is visible during countdown but game loop ignores inputs
   */
  start(): void {
    // Spawn first piece immediately (like original)
    const piece = spawnPiece(undefined, this.state.currentRank);
    piece.x = getCenteredSpawnX(this.state.boardOffset);
    piece.y = 1;
    piece.startSpawnY = 1;

    this.state = updateState(this.state, {
      activePiece: piece,
      countdown: 2,
    });

    this.notifyStateChange();
    this.startCountdown();
  }

  private startCountdown(): void {
    // Countdown: 2 -> 1 -> null (then game starts)
    this.countdownTimer = setInterval(() => {
      const current = this.state.countdown;

      if (current !== null && current > 1) {
        this.state = updateState(this.state, { countdown: current - 1 });
        this.notifyStateChange();
      } else {
        // Countdown finished
        if (this.countdownTimer) clearInterval(this.countdownTimer);
        this.countdownTimer = null;

        this.state = updateState(this.state, {
          countdown: null,
          gameStats: { ...this.state.gameStats, startTime: Date.now() }
        });

        this.eventBus.emit(createEvent(GameEventType.GAME_STARTED, {
          rank: this.state.currentRank,
          goalsTarget: this.state.goalsTarget
        }));

        this.notifyStateChange();
      }
    }, 1000);
  }

  /**
   * Main tick - call this every frame with delta time in ms
   * Matches original gameLoop logic exactly
   */
  tick(dt: number): void {
    // Don't process if game over, paused, or in countdown
    if (this.state.gameOver || this.state.isPaused || this.state.countdown !== null) {
      return;
    }

    // Process commands
    this.processCommands();

    // 0.5 Goal Mark Spawning
    const now = Date.now();
    if (now - this.lastGoalSpawnTime > GOAL_SPAWN_INTERVAL_MS) {
      this.trySpawnGoal();
      this.lastGoalSpawnTime = now;
    }

    // 1. Update Timer
    const newTimeLeft = Math.max(0, this.state.timeLeft - dt);
    this.state = updateState(this.state, { timeLeft: newTimeLeft });

    if (newTimeLeft <= 0) {
      this.endGame(false);
      return;
    }

    // 2. Falling blocks physics
    if (this.state.fallingBlocks.length > 0) {
      this.updateFallingBlocks(dt);
    }

    // 3. Active piece gravity
    if (this.state.activePiece) {
      this.updateActivePieceGravity(dt);
    }

    this.notifyStateChange();
  }

  private processCommands(): void {
    const commands = [...this.commandQueue];
    this.commandQueue = [];

    for (const cmd of commands) {
      this.executeCommand(cmd);
    }
  }

  private executeCommand(cmd: AnyCommand): void {
    // Don't process game commands during countdown, pause, or game over
    if (this.state.countdown !== null || this.state.isPaused || this.state.gameOver) {
      // But still allow pause toggle and restart
      if (cmd.type === CommandType.PAUSE) {
        this.state = updateState(this.state, { isPaused: true });
        this.eventBus.emit(createEvent(GameEventType.GAME_PAUSED, {}));
        this.notifyStateChange();
      } else if (cmd.type === CommandType.RESUME) {
        this.state = updateState(this.state, { isPaused: false });
        this.eventBus.emit(createEvent(GameEventType.GAME_RESUMED, {}));
        this.notifyStateChange();
      } else if (cmd.type === CommandType.RESTART) {
        this.restart();
      }
      return;
    }

    switch (cmd.type) {
      case CommandType.MOVE_BOARD:
        this.handleMoveBoard(cmd as MoveBoardCommand);
        break;
      case CommandType.ROTATE_PIECE:
        this.handleRotate(cmd as RotatePieceCommand);
        break;
      case CommandType.HARD_DROP:
        this.handleHardDrop();
        break;
      case CommandType.SOFT_DROP_START:
        this.state = updateState(this.state, { isSoftDropping: true });
        break;
      case CommandType.SOFT_DROP_END:
        this.state = updateState(this.state, { isSoftDropping: false });
        break;
      case CommandType.SWAP_PIECE:
        this.handleSwap();
        break;
      case CommandType.TAP_BLOCK:
        this.handleTapBlock(cmd as TapBlockCommand);
        break;
      case CommandType.PAUSE:
        this.state = updateState(this.state, { isPaused: true });
        this.eventBus.emit(createEvent(GameEventType.GAME_PAUSED, {}));
        break;
      case CommandType.RESUME:
        this.state = updateState(this.state, { isPaused: false });
        this.eventBus.emit(createEvent(GameEventType.GAME_RESUMED, {}));
        break;
      case CommandType.RESTART:
        this.restart();
        break;
    }
  }

  private handleMoveBoard(cmd: MoveBoardCommand): void {
    if (!this.state.activePiece) return;

    const result = movePieceAndBoard(
      this.state.grid,
      this.state.activePiece,
      this.state.boardOffset,
      cmd.direction
    );

    if (result) {
      this.state = updateState(this.state, {
        activePiece: result.piece,
        boardOffset: result.boardOffset
      });

      this.eventBus.emit(createEvent(GameEventType.PIECE_MOVED, {
        direction: cmd.direction === 1 ? 'left' : 'right'
      }));
    }
  }

  private handleRotate(cmd: RotatePieceCommand): void {
    if (!this.state.activePiece) return;
    if (this.state.activePiece.definition.type === PieceType.O) return;

    const currentRot = this.state.activePiece.rotation;
    const nextRot = (currentRot + (cmd.clockwise ? 1 : -1) + 4) % 4;
    const nextCells = getRotatedCells(this.state.activePiece.cells, cmd.clockwise);

    const result = applyWallKicks(
      this.state.grid,
      this.state.activePiece,
      nextCells,
      nextRot,
      this.state.boardOffset
    );

    if (result) {
      this.state = updateState(this.state, { activePiece: result });
      this.eventBus.emit(createEvent(GameEventType.PIECE_ROTATED, {
        clockwise: cmd.clockwise
      }));
    }
  }

  private handleHardDrop(): void {
    if (!this.state.activePiece) return;

    const ghostY = getGhostY(this.state.grid, this.state.activePiece, this.state.boardOffset);
    const droppedPiece = { ...this.state.activePiece, y: ghostY };
    const distance = Math.floor(ghostY - this.state.activePiece.y);

    // Merge and check goals
    const { grid: newGrid, consumedGoals } = mergePiece(
      this.state.grid,
      droppedPiece,
      this.state.goalMarks
    );

    // Handle consumed goals
    let goalsCleared = this.state.goalsCleared;
    let goalMarks = this.state.goalMarks;

    if (consumedGoals.length > 0) {
      goalMarks = removeConsumedGoals(goalMarks, consumedGoals);
      goalsCleared += consumedGoals.length;

      consumedGoals.forEach(() => {
        this.addFloatingText(normalizeX(droppedPiece.x), Math.floor(droppedPiece.y), 'GOAL!', '#facc15');
        this.eventBus.emit(createEvent<GoalConsumedEvent>(GameEventType.GOAL_CONSUMED, {
          position: { x: droppedPiece.x, y: droppedPiece.y },
          goalsCleared,
          goalsTarget: this.state.goalsTarget
        }));
      });

      // Check win
      if (isWinConditionMet(goalsCleared, this.state.goalsTarget)) {
        this.state = updateState(this.state, {
          grid: newGrid,
          goalMarks,
          goalsCleared,
          combo: 0,
          isSoftDropping: false
        });
        this.endGame(true);
        return;
      }
    }

    // Score for drop distance
    const dropScore = calculateHardDropScore(distance);
    const boostedScore = applyScoreBoost(dropScore, this.config.scoreBoostLevel);

    this.state = updateState(this.state, {
      grid: newGrid,
      goalMarks,
      goalsCleared,
      score: this.state.score + boostedScore,
      scoreBreakdown: addBreakdownWithBoost(
        this.state.scoreBreakdown,
        { speed: dropScore },
        1 + this.config.scoreBoostLevel * 0.1
      ),
      combo: 0,
      isSoftDropping: false
    });

    this.eventBus.emit(createEvent(GameEventType.PIECE_DROPPED, {
      distance,
      isHardDrop: true
    }));

    this.lockStartTime = null;
    this.spawnNewPiece(newGrid, this.state.boardOffset);
  }

  private handleSwap(): void {
    if (!this.state.activePiece || !this.state.canSwap) return;

    const currentDef = this.state.activePiece.definition;
    const nextDef = this.state.storedPiece;

    if (nextDef) {
      const newPiece = placeSwappedPiece(
        this.state.grid,
        this.state.activePiece,
        nextDef,
        this.state.boardOffset
      );

      if (newPiece) {
        this.state = updateState(this.state, {
          activePiece: newPiece,
          storedPiece: currentDef,
          canSwap: false
        });
        this.lockStartTime = null;
      }
    } else {
      this.state = updateState(this.state, {
        storedPiece: currentDef,
        canSwap: false
      });
      this.spawnNewPiece(this.state.grid, this.state.boardOffset);
    }

    this.eventBus.emit(createEvent(GameEventType.PIECE_SWAPPED, {
      hadStoredPiece: !!nextDef
    }));
  }

  private handleTapBlock(cmd: TapBlockCommand): void {
    const cell = this.state.grid[cmd.y]?.[cmd.x];
    if (!cell) return;

    // Pressure check - matches original exactly
    const pressureRatio = Math.max(0, 1 - (this.state.timeLeft / this.state.maxTime));
    const thresholdY = (TOTAL_HEIGHT - 1) - (pressureRatio * (VISIBLE_HEIGHT - 1));

    // Check if the group's HIGHEST point (smallest Y) is below the threshold
    if (cell.groupMinY < thresholdY) {
      this.eventBus.emit(createEvent(GameEventType.INPUT_REJECTED, {
        reason: 'not_submerged'
      }));
      return;
    }

    // Check if ready (fill animation complete)
    const totalDuration = cell.groupSize * PER_BLOCK_DURATION;
    const elapsed = Date.now() - cell.timestamp;
    if (elapsed < totalDuration) {
      this.eventBus.emit(createEvent(GameEventType.INPUT_REJECTED, {
        reason: 'not_ready'
      }));
      return;
    }

    // Find and clear group
    const group = findContiguousGroup(this.state.grid, cmd.x, cmd.y);
    if (group.length === 0) return;

    const newCombo = this.state.combo + 1;

    // Calculate score
    const { total, breakdown } = calculateGroupClearScore(
      this.state.grid,
      group,
      this.state.boardOffset,
      newCombo
    );

    const boostedScore = applyScoreBoost(total, this.config.scoreBoostLevel);
    const boostMult = 1 + this.config.scoreBoostLevel * 0.1;

    // Calculate time recovery
    const timeRecovery = calculateTimeRecovery(group.length);
    const newTimeLeft = addTime(this.state.timeLeft, timeRecovery, this.state.maxTime);

    // Clear cells and get floating blocks
    const clearedGrid = clearCells(this.state.grid, group);
    const uniqueCols = [...new Set(group.map(g => g.x))];
    const { grid: newGrid, falling } = getFloatingBlocks(clearedGrid, uniqueCols);

    // Update stats
    const newStats = {
      ...this.state.gameStats,
      maxGroupSize: Math.max(this.state.gameStats.maxGroupSize, group.length),
      totalBonusTime: this.state.gameStats.totalBonusTime + timeRecovery
    };

    // Add floating texts
    this.addFloatingText(cmd.x, cmd.y, `+${boostedScore}`, '#fbbf24');
    this.addFloatingText(cmd.x, cmd.y - 1, `-${(timeRecovery / 1000).toFixed(1)}s`, '#4ade80');

    this.state = updateState(this.state, {
      grid: newGrid,
      fallingBlocks: [...this.state.fallingBlocks, ...falling],
      score: this.state.score + boostedScore,
      scoreBreakdown: addBreakdownWithBoost(this.state.scoreBreakdown, breakdown, boostMult),
      combo: newCombo,
      cellsCleared: this.state.cellsCleared + 1,
      timeLeft: newTimeLeft,
      gameStats: newStats,
      gameSpeed: Math.max(MIN_SPEED, this.state.gameSpeed * 0.995)
    });

    this.eventBus.emit(createEvent<GroupClearedEvent>(GameEventType.GROUP_CLEARED, {
      groupSize: group.length,
      position: { x: cmd.x, y: cmd.y },
      color: cell.color,
      combo: newCombo,
      scoreAwarded: boostedScore,
      timeAwarded: timeRecovery
    }));

    this.eventBus.emit(createEvent<TimeAddedEvent>(GameEventType.TIME_ADDED, {
      amount: timeRecovery,
      reason: 'group_clear'
    }));
  }

  private updateFallingBlocks(dt: number): void {
    const { active, landed } = updateFallingBlocks(
      this.state.fallingBlocks,
      this.state.grid,
      dt,
      this.state.gameSpeed
    );

    if (landed.length > 0) {
      const newGrid = this.state.grid.map(row => [...row]);

      landed.forEach(b => {
        const y = Math.floor(b.y);
        if (y >= 0 && y < newGrid.length) {
          newGrid[y][b.x] = { ...b.data, timestamp: Date.now() };
        }
      });

      const groupedGrid = updateGroups(newGrid);

      this.state = updateState(this.state, {
        grid: groupedGrid,
        fallingBlocks: active
      });

      this.eventBus.emit(createEvent(GameEventType.BLOCKS_LANDED, {
        count: landed.length
      }));
    } else {
      this.state = updateState(this.state, { fallingBlocks: active });
    }
  }

  private updateActivePieceGravity(dt: number): void {
    if (!this.state.activePiece) return;

    const gravitySpeed = this.state.isSoftDropping
      ? this.state.gameSpeed / SOFT_DROP_FACTOR
      : this.state.gameSpeed;

    const moveAmount = dt / gravitySpeed;
    const nextY = this.state.activePiece.y + moveAmount;
    const nextPiece = { ...this.state.activePiece, y: nextY };

    if (checkCollision(this.state.grid, nextPiece, this.state.boardOffset)) {
      // Start or continue lock timer
      if (this.lockStartTime === null) {
        this.lockStartTime = Date.now();
      }

      const lockedTime = Date.now() - this.lockStartTime;
      const effectiveLockDelay = this.state.isSoftDropping ? 50 : LOCK_DELAY_MS;

      if (lockedTime > effectiveLockDelay) {
        this.lockPiece();
      }
    } else {
      this.state = updateState(this.state, { activePiece: nextPiece });
      this.lockStartTime = null;
    }
  }

  private lockPiece(): void {
    if (!this.state.activePiece) return;

    const ghostY = getGhostY(this.state.grid, this.state.activePiece, this.state.boardOffset);
    const finalPiece = { ...this.state.activePiece, y: ghostY };

    const { grid: newGrid, consumedGoals } = mergePiece(
      this.state.grid,
      finalPiece,
      this.state.goalMarks
    );

    let goalsCleared = this.state.goalsCleared;
    let goalMarks = this.state.goalMarks;

    if (consumedGoals.length > 0) {
      goalMarks = removeConsumedGoals(goalMarks, consumedGoals);
      goalsCleared += consumedGoals.length;

      consumedGoals.forEach(() => {
        this.addFloatingText(normalizeX(finalPiece.x), Math.floor(finalPiece.y), 'GOAL!', '#facc15');
        this.eventBus.emit(createEvent<GoalConsumedEvent>(GameEventType.GOAL_CONSUMED, {
          position: { x: finalPiece.x, y: finalPiece.y },
          goalsCleared,
          goalsTarget: this.state.goalsTarget
        }));
      });

      if (isWinConditionMet(goalsCleared, this.state.goalsTarget)) {
        this.state = updateState(this.state, {
          grid: newGrid,
          goalMarks,
          goalsCleared,
          combo: 0,
          isSoftDropping: false
        });
        this.endGame(true);
        return;
      }
    }

    this.state = updateState(this.state, {
      grid: newGrid,
      goalMarks,
      goalsCleared,
      combo: 0,
      isSoftDropping: false
    });

    this.eventBus.emit(createEvent(GameEventType.PIECE_LOCKED, {
      position: { x: finalPiece.x, y: finalPiece.y }
    }));

    this.lockStartTime = null;
    this.spawnNewPiece(newGrid, this.state.boardOffset);
  }

  private spawnNewPiece(grid: GridCell[][], boardOffset: number): void {
    const currentTotalScore = this.config.initialTotalScore + this.state.score;
    const currentRank = calculateRankDetails(currentTotalScore).rank;

    const piece = spawnPiece(undefined, currentRank);
    piece.x = getCenteredSpawnX(boardOffset);
    piece.y = 1;
    piece.startSpawnY = 1;

    if (checkCollision(grid, piece, boardOffset)) {
      this.endGame(false);
      return;
    }

    this.state = updateState(this.state, {
      activePiece: piece,
      canSwap: true,
      currentRank
    });

    this.eventBus.emit(createEvent(GameEventType.PIECE_SPAWNED, {
      pieceType: piece.definition.type,
      color: piece.definition.color
    }));
  }

  private trySpawnGoal(): void {
    const goal = spawnGoalMark(
      this.state.grid,
      this.state.goalMarks,
      this.state.currentRank,
      this.state.timeLeft,
      this.state.maxTime
    );

    if (goal) {
      this.state = updateState(this.state, {
        goalMarks: [...this.state.goalMarks, goal]
      });

      this.eventBus.emit(createEvent(GameEventType.GOAL_SPAWNED, {
        position: { x: goal.x, y: goal.y },
        color: goal.color
      }));
    }
  }

  private addFloatingText(x: number, y: number, text: string, color: string): void {
    const id = Math.random().toString(36).substr(2, 9);
    const newText = { id, text, x, y, life: 1, color };

    this.state = updateState(this.state, {
      floatingTexts: [...this.state.floatingTexts, newText]
    });

    // Auto-remove after 1 second
    setTimeout(() => {
      this.state = updateState(this.state, {
        floatingTexts: this.state.floatingTexts.filter(t => t.id !== id && !t.id.startsWith(id))
      });
      this.notifyStateChange();
    }, 1000);
  }

  private endGame(isWin: boolean): void {
    const finalScore = isWin
      ? this.state.score + calculateWinBonus(this.state.currentRank)
      : this.state.score;

    this.state = updateState(this.state, {
      gameOver: true,
      score: finalScore
    });

    this.eventBus.emit(createEvent<GameOverEvent>(GameEventType.GAME_OVER, {
      isWin,
      finalScore,
      goalsCleared: this.state.goalsCleared,
      goalsTarget: this.state.goalsTarget
    }));

    this.notifyStateChange();
  }

  private restart(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }

    this.state = createInitialState(this.config);
    this.lockStartTime = null;
    this.lastGoalSpawnTime = Date.now();
    this.commandQueue = [];

    this.notifyStateChange();
    this.start();
  }

  private notifyStateChange(): void {
    for (const listener of this.stateListeners) {
      listener(this.state);
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
    }
    this.eventBus.clear();
    this.stateListeners = [];
  }
}
