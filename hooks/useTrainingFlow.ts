
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { SaveData, GoopTemplate, ScreenType } from '../types';
import { TrainingStep, PieceSpawn, CrackSpawn } from '../types/training';
import { IntercomMessage } from '../types/tutorial';
import { GameEngine } from '../core/GameEngine';
import { gameEventBus } from '../core/events/EventBus';
import { GameEventType } from '../core/events/GameEvents';
import { getNextTrainingStep, isTrainingComplete } from '../data/trainingScenarios';
import { TRAINING_MESSAGES, TRAINING_RETRY_MESSAGES, F1_ENDING_MESSAGES } from '../data/tutorialSteps';
import { COLORS, TANK_WIDTH, TANK_VIEWPORT_WIDTH, TANK_HEIGHT, TANK_VIEWPORT_HEIGHT, BUFFER_HEIGHT, TETRA_NORMAL, PENTA_NORMAL, HEXA_NORMAL } from '../constants';
import { getRotatedCells } from '../utils/gameLogic';
import { getScoreForRank } from '../utils/progression';
import { normalizeX } from '../utils/coordinates';
import { useStepStateMachine } from './tutorial/stateMachine';
import { useTimeoutPool } from './tutorial/timeoutPool';
import { getHandler, StepHandler } from './tutorial/handlers';

interface UseTrainingFlowOptions {
  saveData: SaveData;
  setSaveData: (updater: (prev: SaveData) => SaveData) => void;
  gameEngine: GameEngine | null;
  rank: number;
}

// Map training advance actions/events to game event types
const ADVANCE_EVENT_MAP: Record<string, GameEventType[]> = {
  // Actions
  'fast-fall': [GameEventType.INPUT_FAST_DROP],
  'rotate-piece': [GameEventType.PIECE_ROTATED],
  'pop-goop': [GameEventType.GOOP_POPPED],
  'rotate-tank': [GameEventType.INPUT_DRAG],
  'swipe-up': [GameEventType.INPUT_SWIPE_UP],
  // Events
  'piece-landed': [GameEventType.PIECE_DROPPED],
  'goop-merged': [GameEventType.PIECE_DROPPED],
  'crack-sealed': [GameEventType.GOAL_CAPTURED],
  'game-over': [GameEventType.GAME_OVER],
};

// Events without direct mappings get auto-advanced after this delay
const AUTO_ADVANCE_FALLBACK_MS = 4000;

// Default training palette
const TRAINING_PALETTE = [COLORS.BLUE, COLORS.YELLOW, COLORS.GREEN, COLORS.RED];

// ─── Helpers ───────────────────────────────────────────────────

/**
 * Add a crack to the engine's grid at a specific position.
 */
function addCrackToGrid(engine: GameEngine, x: number, y: number, color: string, source: string): void {
  const now = Date.now();
  const crackId = Math.random().toString(36).substr(2, 9);
  engine.state.crackCells.push({
    id: crackId,
    x, y, color,
    originCrackId: [],
    branchCrackIds: [],
    lastGrowthCheck: now,
    crackBranchInterval: 999999, // No growth in training
    spawnTime: now,
  });
  engine.state.goalMarks.push({
    id: crackId,
    x, y, color,
    spawnTime: now,
  });
}

/**
 * Find a valid position for a crack based on CrackSpawn config.
 * Returns {x, y} or null if no valid position found.
 */
function findCrackPosition(
  engine: GameEngine,
  config: CrackSpawn
): { x: number; y: number } | null {
  const grid = engine.state.grid;
  const rotation = engine.state.tankRotation;

  if (config.placement === 'near-stack') {
    // Right side of viewport, specific row or default row 22
    const rightScreenX = TANK_VIEWPORT_WIDTH - 3;
    const x = normalizeX(rotation + rightScreenX);
    const y = config.row ?? (TANK_HEIGHT - 2);
    return { x, y };
  }

  if (config.placement === 'high' || config.placement === 'at-pressure-line') {
    // Same pressure-line formula as spawnGoalMark() in utils/gameLogic.ts
    const maxTime = engine.maxTime ?? 1;
    const tankPressure = Math.max(0, 1 - (engine.state.shiftTime / maxTime));
    const waterHeightBlocks = 1 + (tankPressure * (TANK_VIEWPORT_HEIGHT - 1));
    const pressureLineY = Math.floor(TANK_HEIGHT - waterHeightBlocks);
    // Spawn 1-3 rows BELOW pressure line (higher Y = lower on screen = under the water)
    const offset = 1 + Math.floor(Math.random() * 3);
    const targetRow = Math.max(BUFFER_HEIGHT, Math.min(TANK_HEIGHT - 1, pressureLineY + offset));

    for (let attempt = 0; attempt < 30; attempt++) {
      const screenX = 2 + Math.floor(Math.random() * (TANK_VIEWPORT_WIDTH - 4));
      const gx = normalizeX(rotation + screenX);
      if (grid[targetRow]?.[gx] === null) {
        return { x: gx, y: targetRow };
      }
    }
    return null;
  }

  if (config.placement === 'offscreen' || config.placement === 'high-offscreen') {
    const offscreenCols: number[] = [];
    for (let gx = 0; gx < TANK_WIDTH; gx++) {
      const screenX = ((gx - rotation) % TANK_WIDTH + TANK_WIDTH) % TANK_WIDTH;
      if (screenX >= TANK_VIEWPORT_WIDTH) offscreenCols.push(gx);
    }
    if (offscreenCols.length > 0) {
      const yRange = config.placement === 'high-offscreen'
        ? { min: BUFFER_HEIGHT, max: BUFFER_HEIGHT + 4 }
        : { min: TANK_HEIGHT - 6, max: TANK_HEIGHT - 1 };
      for (let attempt = 0; attempt < 30; attempt++) {
        const gx = offscreenCols[Math.floor(Math.random() * offscreenCols.length)];
        const gy = yRange.min + Math.floor(Math.random() * (yRange.max - yRange.min + 1));
        if (grid[gy]?.[gx] === null) return { x: gx, y: gy };
      }
    }
    return null;
  }

  // 'away-from-stack': random visible empty cell in lower area
  for (let attempt = 0; attempt < 30; attempt++) {
    const screenX = Math.floor(Math.random() * TANK_VIEWPORT_WIDTH);
    const gx = normalizeX(rotation + screenX);
    const gy = TANK_HEIGHT - 5 + Math.floor(Math.random() * 3);
    if (gy >= BUFFER_HEIGHT && gy < TANK_HEIGHT && grid[gy]?.[gx] === null) {
      return { x: gx, y: gy };
    }
  }
  return null;
}

/**
 * Spawn a piece from a PieceSpawn config.
 */
function spawnPieceFromConfig(engine: GameEngine, spawn: PieceSpawn): void {
  const allPieces = [...TETRA_NORMAL, ...PENTA_NORMAL, ...HEXA_NORMAL];
  const shapeTemplate = allPieces.find(p => p.type === spawn.shape);
  if (!shapeTemplate) return;

  let cells = shapeTemplate.cells.map(c => ({ ...c }));
  if (spawn.rotation && spawn.rotation > 0) {
    for (let r = 0; r < spawn.rotation; r++) {
      cells = getRotatedCells(cells, true);
    }
  }
  const template: GoopTemplate = { type: spawn.shape, cells, color: spawn.color };
  engine.spawnNewPiece(template);
}

/**
 * Spawn a random crack at the pressure line — same formula as the real game's
 * spawnGoalMark() in utils/gameLogic.ts (lines 661-668).
 */
function spawnRandomCrack(engine: GameEngine): void {
  const rotation = engine.state.tankRotation;
  const color = TRAINING_PALETTE[Math.floor(Math.random() * TRAINING_PALETTE.length)];

  // Same pressure-line formula as spawnGoalMark() in utils/gameLogic.ts:
  const maxTime = engine.maxTime ?? 1;
  const tankPressure = Math.max(0, 1 - (engine.state.shiftTime / maxTime));
  const waterHeightBlocks = 1 + (tankPressure * (TANK_VIEWPORT_HEIGHT - 1));
  const pressureLineY = Math.floor(TANK_HEIGHT - waterHeightBlocks);
  // Spawn 1-3 rows BELOW pressure line (higher Y = under the water)
  const offset = 1 + Math.floor(Math.random() * 3);
  const spawnY = Math.max(BUFFER_HEIGHT, Math.min(TANK_HEIGHT - 1, pressureLineY + offset));

  // Spawn in visible viewport only (not across full 30-col cylinder)
  for (let attempt = 0; attempt < 20; attempt++) {
    const screenX = Math.floor(Math.random() * TANK_VIEWPORT_WIDTH);
    const gx = normalizeX(rotation + screenX);
    const cell = engine.state.grid[spawnY]?.[gx];
    const overlaps = engine.state.crackCells.some(c => c.x === gx && c.y === spawnY);
    if (cell === null && !overlaps) {
      addCrackToGrid(engine, gx, spawnY, color, 'periodic-F1');
      engine.emitChange();
      return;
    }
  }
}

/**
 * Check if any crack is offscreen from the current viewport.
 */
function isAnyCrackOffscreen(engine: GameEngine): boolean {
  const cracks = engine.state.crackCells;
  if (cracks.length === 0) return false;

  const rot = engine.state.tankRotation;
  return cracks.some(c => {
    let visX = c.x - rot;
    if (visX > TANK_WIDTH / 2) visX -= TANK_WIDTH;
    if (visX < -TANK_WIDTH / 2) visX += TANK_WIDTH;
    return visX < 0 || visX >= TANK_VIEWPORT_WIDTH;
  });
}

// ─── Hook ──────────────────────────────────────────────────────

/**
 * Tutorial v3 — Training Flow Orchestrator
 *
 * Thin orchestrator that wires together:
 * - State machine (step lifecycle)
 * - Timeout pool (centralized timer management)
 * - Handler registry (standard + custom handlers)
 * - Step configs (from trainingScenarios.ts)
 *
 * Keeps the same external interface as v2 for Game.tsx compatibility.
 */
export const useTrainingFlow = ({
  saveData,
  setSaveData,
  gameEngine,
  rank,
}: UseTrainingFlowOptions) => {
  const completedSteps = saveData.tutorialProgress?.completedSteps ?? [];

  // Derive current state from save data
  const trainingDone = isTrainingComplete(completedSteps);
  const isInTraining = rank === 0 && !trainingDone;
  const currentStep = isInTraining ? getNextTrainingStep(completedSteps) : null;

  // ─── State Machine + Timeout Pool ────────────────────────────

  const stateMachine = useStepStateMachine();
  const pool = useTimeoutPool();

  // ─── State ─────────────────────────────────────────────────

  // Message visibility — separate from step advancement
  const [messageVisible, setMessageVisible] = useState(true);
  // Whether dismiss button is shown (false = non-dismissible, e.g. reshow or F1 ending)
  const [canDismiss, setCanDismiss] = useState(true);
  // Override message (retries, F1 endings, D3 interrupt)
  const [retryMessage, setRetryMessage] = useState<IntercomMessage | null>(null);
  // Dynamic highlight color override (e.g. D2 post-plug pulse)
  const [dynamicHighlight, setDynamicHighlight] = useState<string | null>(null);

  // ─── Refs ──────────────────────────────────────────────────

  // Advance arming — prevents event listeners from firing before message is dismissed
  const advanceArmedRef = useRef(true);
  // Track when game paused for training message — adjusts fill timestamps on unpause
  const pauseStartTimeRef = useRef<number | null>(null);
  // Step generation counter — incremented in advanceStep() to invalidate leaked timeouts
  const stepGenerationRef = useRef(0);
  // Suppress continuous spawn within a step (E1: after crack sealed, stop spawning new pieces)
  const suppressContinuousSpawnRef = useRef(false);
  // Was a crack sealed this piece-lock cycle? (retry detection)
  const crackPluggedThisCycleRef = useRef(false);

  // --- v2/v3 persistent refs ---
  // Persistent D3 discovery trigger: if D3 auto-skipped, stays armed through E/F
  const pendingD3DiscoveryRef = useRef(false);
  // Whether the D3 offscreen message was shown (prevents autoSkip from arming persistent flag)
  const d3MessageShownRef = useRef(false);
  // Whether the D3 discovery interrupt is currently showing
  const discoveryInterruptRef = useRef(false);
  // F1 ending sub-state: 'none' during free play, 'pressure-cap' or 'overflow' when ending
  const f1EndingRef = useRef<'none' | 'pressure-cap' | 'overflow'>('none');

  // Track completion ref for event handler (avoid stale closure)
  const completedRef = useRef(completedSteps);
  completedRef.current = completedSteps;

  // Current handler ref
  const handlerRef = useRef<StepHandler | null>(null);

  // ─── Step-Change Effect ────────────────────────────────────
  // Runs when currentStep changes. Clears pool, sets up game state, spawns, message visibility.

  useEffect(() => {
    // Cleanup: clear ALL timers from previous step
    pool.clearAll();

    // Cleanup previous handler
    if (handlerRef.current) {
      handlerRef.current.cleanup();
      handlerRef.current = null;
    }

    // Reset state machine
    stateMachine.reset();

    // Reset per-step state
    setCanDismiss(true);
    setRetryMessage(null);
    setDynamicHighlight(null);
    crackPluggedThisCycleRef.current = false;
    discoveryInterruptRef.current = false;
    d3MessageShownRef.current = false;
    suppressContinuousSpawnRef.current = false;
    f1EndingRef.current = 'none';

    if (!currentStep) return;

    // Get handler for this step
    const handler = getHandler(currentStep.handlerType);
    handlerRef.current = handler;

    // Delayed-pause steps: start unpaused, pause when condition is met
    const isDelayedPause = currentStep.pauseGame !== false && (
      currentStep.setup?.pauseDelay != null ||
      currentStep.setup?.showWhenPieceBelow != null
    );

    // Arm advance: disarmed for pausing steps, armed for non-pausing
    // Steps with messageDelay stay disarmed until the message is visible
    advanceArmedRef.current = currentStep.pauseGame === false && !isDelayedPause && !currentStep.setup?.messageDelay;

    if (gameEngine && gameEngine.isSessionActive) {
      // --- Pause management ---
      if (isDelayedPause) {
        gameEngine.state.isPaused = false;
        gameEngine.freezeFalling = false;
        gameEngine.emitChange();
      } else if (currentStep.pauseGame !== false) {
        gameEngine.state.isPaused = true;
        gameEngine.freezeFalling = true;
        pauseStartTimeRef.current = Date.now();
        gameEngine.emitChange();
      } else {
        gameEngine.state.isPaused = false;
        gameEngine.freezeFalling = false;
        gameEngine.emitChange();
      }

      // --- Spawn piece if configured ---
      if (currentStep.setup?.spawnPiece) {
        spawnPieceFromConfig(gameEngine, currentStep.setup.spawnPiece);
      }

      // --- Spawn crack if configured ---
      if (currentStep.setup?.spawnCrack) {
        // Clear leftover cracks only when spawning a new one (gives this step a clean slate)
        gameEngine.state.crackCells = [];
        gameEngine.state.goalMarks = [];

        const pos = findCrackPosition(gameEngine, currentStep.setup.spawnCrack);
        if (pos) {
          addCrackToGrid(gameEngine, pos.x, pos.y, currentStep.setup.spawnCrack.color, `step-setup[${currentStep.id}]`);
          gameEngine.emitChange();
        }
      }
    }

    // --- Message visibility based on step config ---

    const pieceThreshold = currentStep.setup?.showWhenPieceBelow;

    if (pieceThreshold != null && gameEngine) {
      // Position-gated message: poll piece Y until it reaches threshold
      setMessageVisible(false);
      stateMachine.waitForTrigger();
      pool.setInterval('position-poll', () => {
        const pieceY = gameEngine.state.activeGoop?.y ?? 0;
        if (pieceY >= pieceThreshold) {
          pool.clear('position-poll');
          setMessageVisible(true);
          stateMachine.showMessage();
          if (currentStep.pauseGame !== false) {
            gameEngine.state.isPaused = true;
            gameEngine.freezeFalling = true;
            pauseStartTimeRef.current = Date.now();
            gameEngine.emitChange();
          }
        }
      }, 200);

    } else if (currentStep.setup?.pauseDelay != null) {
      // Timer-based delayed pause: hide message, start unpaused, then pause + show
      setMessageVisible(false);
      stateMachine.waitForTrigger();
      pool.set('pause-delay', () => {
        if (gameEngine && gameEngine.isSessionActive) {
          gameEngine.state.isPaused = true;
          gameEngine.freezeFalling = true;
          pauseStartTimeRef.current = Date.now();
          gameEngine.emitChange();
        }
        setMessageVisible(true);
        stateMachine.showMessage();
      }, currentStep.setup!.pauseDelay!);

    } else if (currentStep.pauseGame === false) {
      // Non-pausing step
      if (currentStep.setup?.messageDelay) {
        setMessageVisible(false);
        stateMachine.waitForTrigger();
        pool.set('message-delay', () => {
          setMessageVisible(true);
          stateMachine.showMessage();
          if (currentStep.setup?.nonDismissible) {
            setCanDismiss(false);
          }
          // Arm advance now that the user can see the instruction
          advanceArmedRef.current = true;
        }, currentStep.setup.messageDelay);
      } else {
        // Brief delay so TutorialOverlay can fade out the previous message first
        setMessageVisible(false);
        pool.set('show-message', () => {
          setMessageVisible(true);
          stateMachine.showMessage();
          if (currentStep.setup?.nonDismissible) {
            setCanDismiss(false);
          }
        }, 200);
      }
    } else {
      // Pausing step — brief delay before showing message
      setMessageVisible(false);
      pool.set('show-message', () => {
        setMessageVisible(true);
        stateMachine.showMessage();
      }, 400);
    }

    return () => {
      pool.clearAll();
    };
  }, [currentStep?.id]);

  // ─── Training Palette Setup ────────────────────────────────

  useEffect(() => {
    if (!gameEngine) return;

    if (isInTraining) {
      gameEngine.pendingTrainingPalette = TRAINING_PALETTE;
    } else {
      gameEngine.pendingTrainingPalette = null;
    }
  }, [gameEngine, isInTraining]);

  // ─── Callbacks ─────────────────────────────────────────────

  /**
   * Mark a training step as complete in save data.
   */
  const completeCurrentStep = useCallback(() => {
    if (!currentStep) return;

    const stepId = currentStep.id;

    setSaveData(sd => {
      const existing = sd.tutorialProgress?.completedSteps ?? [];
      if (existing.includes(stepId)) return sd;

      const newCompleted = [...existing, stepId];

      if (currentStep.markComplete && !existing.includes(currentStep.markComplete)) {
        newCompleted.push(currentStep.markComplete);
      }

      return {
        ...sd,
        tutorialProgress: { completedSteps: newCompleted },
      };
    });
  }, [currentStep, setSaveData]);

  /**
   * Adjust goop fill timestamps for pause duration.
   * Prevents fill from appearing "instant" after reading a long message.
   */
  const adjustFillTimestampsForPause = useCallback(() => {
    if (gameEngine && pauseStartTimeRef.current) {
      const pauseDuration = Date.now() - pauseStartTimeRef.current;
      const grid = gameEngine.state.grid;
      for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
          const cell = grid[y][x];
          if (cell && cell.timestamp) {
            cell.timestamp += pauseDuration;
          }
        }
      }
      pauseStartTimeRef.current = null;
    }
  }, [gameEngine]);

  /**
   * Advance to the next training step.
   */
  const advanceStep = useCallback(() => {
    if (!currentStep) return;

    // Disarm to prevent double-advance
    advanceArmedRef.current = false;
    stateMachine.advance();

    // Increment generation to invalidate any leaked timeouts from this step
    stepGenerationRef.current++;
    suppressContinuousSpawnRef.current = false;

    // Hide message immediately — prevents flash of next step's message
    setMessageVisible(false);

    // Clear pool (catches any timers that weren't cleared yet)
    pool.clearAll();

    adjustFillTimestampsForPause();
    completeCurrentStep();

    // Pause immediately — next step's effect will handle transition
    if (gameEngine && gameEngine.isSessionActive) {
      gameEngine.state.isPaused = true;
      gameEngine.freezeFalling = true;
      gameEngine.emitChange();
    }

    // Check if training is now complete
    const updatedCompleted = [...completedRef.current, currentStep.id];
    if (currentStep.markComplete) updatedCompleted.push(currentStep.markComplete);
    if (isTrainingComplete(updatedCompleted)) {
      gameEventBus.emit(GameEventType.TRAINING_SCENARIO_COMPLETE);
      if (gameEngine) {
        gameEngine.pendingTrainingPalette = null;
      }
    }
  }, [adjustFillTimestampsForPause, completeCurrentStep, currentStep, gameEngine, stateMachine, pool]);

  // Ref for advanceStep so event listeners always call the latest version
  const advanceStepRef = useRef(advanceStep);
  advanceStepRef.current = advanceStep;

  /**
   * Dismiss the current message without advancing.
   * Hides message, unpauses game, arms advance listener.
   * Also starts free-play features (continuous spawn, periodic cracks) if applicable.
   */
  const dismissMessage = useCallback(() => {
    // --- F1 pressure-cap dismiss: resume play, pressure rises again, re-caps at 95% ---
    if (f1EndingRef.current === 'pressure-cap' && !discoveryInterruptRef.current) {
      setMessageVisible(false);
      setRetryMessage(null);
      f1EndingRef.current = 'none'; // Allow pieces/cracks to continue
      adjustFillTimestampsForPause();

      if (gameEngine && gameEngine.isSessionActive) {
        gameEngine.state.isPaused = false;
        gameEngine.freezeFalling = false;
        gameEngine.emitChange();

        // Spawn piece if none active
        if (!gameEngine.state.activeGoop) {
          pool.set('f1-respawn', () => {
            if (gameEngine.isSessionActive && f1EndingRef.current === 'none') {
              gameEngine.spawnNewPiece();
              gameEngine.emitChange();
            }
          }, 300);
        }

        // Re-watch for pressure cap
        const capValue = currentStep?.setup?.pressureCap ?? 0.95;
        const stepPressureRate = currentStep?.setup?.pressureRate ?? 0.5;
        let pressureResumed = false;
        pool.setInterval('pressure-recap', () => {
          if (f1EndingRef.current !== 'none') { pool.clear('pressure-recap'); return; }
          const maxTime = gameEngine.maxTime ?? 1;
          const psi = maxTime > 0 ? Math.max(0, 1 - (gameEngine.state.shiftTime / maxTime)) : 0;

          if (!pressureResumed) {
            if (psi < capValue) {
              pressureResumed = true;
              gameEngine.trainingPressureRate = stepPressureRate;
              gameEngine.emitChange();
            }
          } else if (psi >= capValue) {
            pool.clear('pressure-recap');
            gameEngine.trainingPressureRate = 0;
            gameEngine.emitChange();

            f1EndingRef.current = 'pressure-cap';
            setRetryMessage(F1_ENDING_MESSAGES.PRESSURE_CAP);
            setMessageVisible(true);
            setCanDismiss(true);
            advanceArmedRef.current = true;
            gameEngine.state.isPaused = true;
            gameEngine.freezeFalling = true;
            pauseStartTimeRef.current = Date.now();
            gameEngine.emitChange();
          }
        }, 250);
      }
      return;
    }

    // D3 discovery interrupt disabled — will be re-integrated later
    // if (discoveryInterruptRef.current) { ... }

    setMessageVisible(false);
    adjustFillTimestampsForPause();
    stateMachine.armAdvance();

    // Unpause so the player can perform the required action
    if (gameEngine && gameEngine.isSessionActive) {
      gameEngine.state.isPaused = false;
      gameEngine.freezeFalling = false;
      // Restore pressure rate (may have been zeroed during retry)
      if (currentStep?.setup?.pressureRate != null) {
        gameEngine.trainingPressureRate = currentStep.setup.pressureRate;
      }
      gameEngine.emitChange();
    }

    // Arm advance after brief delay (prevents dismiss tap from also triggering advance)
    pool.set('arm-advance', () => {
      advanceArmedRef.current = true;
    }, 150);

    // --- Start free-play features for continuous-spawn steps ---
    if (currentStep?.setup?.continuousSpawn && gameEngine) {
      // Spawn first piece after dismiss (training mode doesn't auto-spawn)
      pool.set('continuous-first-spawn', () => {
        if (gameEngine.isSessionActive && f1EndingRef.current === 'none') {
          gameEngine.spawnNewPiece();
          gameEngine.emitChange();
        }
      }, 300);

      // Start periodic crack spawning if configured
      if (currentStep.setup.periodicCrackIntervalMs) {
        pool.setInterval('periodic-cracks', () => {
          if (f1EndingRef.current !== 'none') return;
          if (gameEngine.isSessionActive) {
            spawnRandomCrack(gameEngine);
          }
        }, currentStep.setup.periodicCrackIntervalMs);
      }
    }

    // --- Hint safety net: reshow after delay if step has hintDelay ---
    if (currentStep?.setup?.hintDelay) {
      const delay = currentStep.setup.hintDelay;
      pool.set('hint-reshow', () => {
        if (gameEngine && gameEngine.isSessionActive) {
          // Non-dismissible: freeze pressure but keep game running so player can still act
          gameEngine.trainingPressureRate = 0;
          gameEngine.emitChange();
          setMessageVisible(true);
          setCanDismiss(false);
        }
      }, delay);
    }
  }, [adjustFillTimestampsForPause, gameEngine, currentStep, pool, stateMachine]);

  // ─── Event/Action Listener Effect ──────────────────────────
  // Sets up all event-based features: advance conditions, continuous spawn,
  // pressure monitoring, retry logic, and persistent discovery.

  useEffect(() => {
    if (!currentStep || !isInTraining) return;

    const { advance } = currentStep;
    const cleanups: (() => void)[] = [];

    // --- Position-based advance: poll piece Y ---
    if (currentStep.setup?.advanceAtRow != null && gameEngine) {
      const threshold = currentStep.setup.advanceAtRow;
      pool.setInterval('advance-at-row', () => {
        const pieceY = gameEngine.state.activeGoop?.y ?? 0;
        if (pieceY >= threshold && advanceArmedRef.current) {
          pool.clear('advance-at-row');
          advanceStepRef.current();
        }
      }, 150);
    }

    // --- Pressure-threshold advance ---
    if (currentStep.setup?.advanceAtPressure != null && gameEngine) {
      const targetPsi = currentStep.setup.advanceAtPressure / 100;
      pool.setInterval('advance-at-pressure', () => {
        if (!advanceArmedRef.current) return;
        const maxTime = gameEngine.maxTime ?? 1;
        const psi = maxTime > 0 ? Math.max(0, 1 - (gameEngine.state.shiftTime / maxTime)) : 0;
        if (psi >= targetPsi) {
          pool.clear('advance-at-pressure');
          advanceStepRef.current();
        }
      }, 250);
    }

    // --- Pressure-above-pieces advance ---
    if (currentStep.setup?.advanceWhenPressureAbovePieces && gameEngine) {
      pool.setInterval('pressure-above-pieces', () => {
        if (!advanceArmedRef.current) return;
        const maxTime = gameEngine.maxTime ?? 1;
        const psi = maxTime > 0 ? Math.max(0, 1 - (gameEngine.state.shiftTime / maxTime)) : 0;
        const pressureLineRow = (TANK_HEIGHT - 1) - (psi * (TANK_VIEWPORT_HEIGHT - 1));

        const colorFilter = currentStep.setup?.advancePressureAboveColor ?? null;
        let highestOccupiedRow = TANK_HEIGHT;
        for (let y = 0; y < TANK_HEIGHT; y++) {
          for (let x = 0; x < gameEngine.state.grid[y].length; x++) {
            const cell = gameEngine.state.grid[y][x];
            if (cell !== null && (colorFilter === null || cell.color === colorFilter)) {
              highestOccupiedRow = y;
              break;
            }
          }
          if (highestOccupiedRow < TANK_HEIGHT) break;
        }

        if (pressureLineRow < highestOccupiedRow) {
          pool.clear('pressure-above-pieces');
          advanceStepRef.current();
        }
      }, 250);
    }

    // --- Retry on piece land (D2: piece lands without sealing → retry) ---
    if (currentStep.setup?.retryOnPieceLand && gameEngine) {
      const retryConfig = currentStep.setup.retryOnPieceLand;

      const goalUnsub = gameEventBus.on(GameEventType.GOAL_PLUGGED, () => {
        crackPluggedThisCycleRef.current = true;
      });
      cleanups.push(goalUnsub);

      const dropUnsub = gameEventBus.on(GameEventType.PIECE_DROPPED, () => {
        const gen = stepGenerationRef.current;

        // Defer check so GOAL_PLUGGED has time to fire (it fires just before PIECE_DROPPED
        // in lockActivePiece, but deferring is safer)
        pool.set('retry-check', () => {
          if (stepGenerationRef.current !== gen) return;
          if (gameEngine.state.activeGoop) return;

          if (crackPluggedThisCycleRef.current) {
            crackPluggedThisCycleRef.current = false;

            // Crack was plugged! Unpause so player can pop to seal
            gameEngine.state.isPaused = false;
            gameEngine.freezeFalling = false;
            gameEngine.emitChange();
            setDynamicHighlight(currentStep.setup?.spawnCrack?.color ?? COLORS.GREEN);

            // Hint timer: if no pop within 3s, show "Pop to seal" hint
            pool.set('plugged-hint', () => {
              if (stepGenerationRef.current !== gen) return;
              if (!gameEngine.isSessionActive) return;
              setRetryMessage(TRAINING_MESSAGES['E1_SEAL_CRACK']);
              setMessageVisible(true);
              setCanDismiss(false);
            }, 3000);
            return;
          }

          // Not plugged — retry sequence
          // Phase 1: Unpause so the fill animation renders, but freeze pressure
          gameEngine.state.isPaused = false;
          gameEngine.freezeFalling = false;
          gameEngine.trainingPressureRate = 0;
          gameEngine.emitChange();

          // Phase 2: Wait for fill to complete + 0.5s buffer, then pop all goop
          pool.set('retry-phase2', () => {
            if (stepGenerationRef.current !== gen) return;
            gameEngine.freezeFalling = true;
            const grid = gameEngine.state.grid;
            for (let y = 0; y < grid.length; y++) {
              for (let x = 0; x < grid[y].length; x++) {
                const cell = grid[y][x];
                if (cell) {
                  gameEngine.state.poppedGoopGroupIds.add(cell.goopGroupId);
                  grid[y][x] = null;
                }
              }
            }
            gameEngine.emitChange();

            // Phase 3: Wait for pop droplets to fade (~2s), then show retry message
            pool.set('retry-phase3', () => {
              if (stepGenerationRef.current !== gen) return;

              if (retryConfig.spawnExtraCrack) {
                const crackColor = retryConfig.spawnExtraCrack.color;
                const rotation = gameEngine.state.tankRotation;
                for (let attempt = 0; attempt < 30; attempt++) {
                  const screenX = Math.floor(Math.random() * TANK_VIEWPORT_WIDTH);
                  const gx = normalizeX(rotation + screenX);
                  const gy = TANK_HEIGHT - 1 - Math.floor(Math.random() * 2);
                  const overlaps = gameEngine.state.crackCells.some(c => c.x === gx && c.y === gy);
                  if (!overlaps) {
                    addCrackToGrid(gameEngine, gx, gy, crackColor, 'retry-extra-crack');
                    break;
                  }
                }
              }

              gameEngine.state.isPaused = true;
              pauseStartTimeRef.current = Date.now();

              const retryMsg = TRAINING_RETRY_MESSAGES[retryConfig.retryMessageId];
              if (retryMsg) setRetryMessage(retryMsg);
              setMessageVisible(true);
              advanceArmedRef.current = false;

              if (currentStep.setup?.spawnPiece) {
                spawnPieceFromConfig(gameEngine, currentStep.setup.spawnPiece);
              }

              gameEngine.emitChange();
              crackPluggedThisCycleRef.current = false;
            }, 2000);
          }, 2000);
        }, 50);  // Small delay so GOAL_PLUGGED fires before check
      });
      cleanups.push(dropUnsub);
    }

    // D3 as current step disabled — will be re-integrated later
    // if (currentStep.id === 'D3_OFFSCREEN' && gameEngine) { ... }

    // --- autoSkipMs: safety timer to auto-advance if condition not met ---
    if (currentStep.setup?.autoSkipMs) {
      pool.set('auto-skip', () => {
        // D3 special disabled — will be re-integrated later
        // if (currentStep.id === 'D3_OFFSCREEN' && !d3MessageShownRef.current) {
        //   pendingD3DiscoveryRef.current = true;
        // }
        advanceStepRef.current();
      }, currentStep.setup.autoSkipMs);
    }

    // --- Continuous spawn: auto-spawn next piece after each landing ---
    if (currentStep.setup?.continuousSpawn && gameEngine) {
      const spawnUnsub = gameEventBus.on(GameEventType.PIECE_DROPPED, () => {
        if (f1EndingRef.current !== 'none') return;
        if (suppressContinuousSpawnRef.current) return;

        const gen = stepGenerationRef.current;

        pool.set('continuous-deferred', () => {
          if (gameEngine.state.activeGoop) return;
          if (stepGenerationRef.current !== gen) return;
          if (suppressContinuousSpawnRef.current) return;

          gameEngine.state.isPaused = false;
          gameEngine.freezeFalling = false;
          gameEngine.emitChange();

          pool.set('continuous-spawn', () => {
            if (stepGenerationRef.current !== gen) return;
            if (suppressContinuousSpawnRef.current) return;
            if (gameEngine.isSessionActive && !gameEngine.state.isPaused && !gameEngine.state.activeGoop) {
              gameEngine.spawnNewPiece();
              gameEngine.emitChange();
            }
          }, 300);
        }, 0);
      });

      // Kick-start: spawn first piece for non-pausing continuous-spawn steps
      if (!gameEngine.state.activeGoop && currentStep.pauseGame === false) {
        const initGen = stepGenerationRef.current;
        pool.set('continuous-init', () => {
          if (stepGenerationRef.current !== initGen) return;
          if (suppressContinuousSpawnRef.current) return;
          if (gameEngine.isSessionActive && !gameEngine.state.isPaused && !gameEngine.state.activeGoop) {
            gameEngine.spawnNewPiece();
            gameEngine.emitChange();
          }
        }, 300);
      }

      cleanups.push(spawnUnsub);
    }

    // --- Pressure cap watcher ---
    if (currentStep.setup?.pressureCap != null && gameEngine) {
      const capValue = currentStep.setup.pressureCap;
      pool.setInterval('pressure-cap', () => {
        const maxTime = gameEngine.maxTime ?? 1;
        const psi = maxTime > 0 ? Math.max(0, 1 - (gameEngine.state.shiftTime / maxTime)) : 0;
        if (psi >= capValue) {
          pool.clear('pressure-cap');
          // Freeze pressure
          gameEngine.trainingPressureRate = 0;
          gameEngine.emitChange();

          // F1: show pressure cap ending message
          if (currentStep.id === 'F1_GRADUATION' && f1EndingRef.current === 'none') {
            f1EndingRef.current = 'pressure-cap';
            setRetryMessage(F1_ENDING_MESSAGES.PRESSURE_CAP);
            setMessageVisible(true);
            setCanDismiss(true);
            advanceArmedRef.current = true;
          }
        }
      }, 250);
    }

    // --- F1 overflow detection ---
    if (currentStep.id === 'F1_GRADUATION' && gameEngine) {
      const handleOverflow = () => {
        if (f1EndingRef.current !== 'none') return;
        f1EndingRef.current = 'overflow';

        gameEngine.state.isPaused = true;
        gameEngine.freezeFalling = true;
        gameEngine.trainingPressureRate = 0;
        gameEngine.emitChange();

        setRetryMessage(F1_ENDING_MESSAGES.OVERFLOW);
        setMessageVisible(true);
        setCanDismiss(false);
        advanceArmedRef.current = true;
      };

      const overflowUnsub = gameEventBus.on(GameEventType.GAME_OVER, handleOverflow);
      cleanups.push(overflowUnsub);
    }

    // D3 discoverable offscreen message disabled — will be re-integrated later as parallel listener
    // const stepsWithCracksAndRotation = ['D2_TANK_ROTATION', 'E1_SEAL_CRACK', 'F1_GRADUATION'];
    // if (...) { pool.setInterval('d3-discovery', ...) }

    // --- E1 special: GOAL_PLUGGED → suppress spawn → 3s → message + pulse → pop → advance to E2 ---
    if (currentStep.id === 'E1_SEAL_CRACK' && gameEngine) {
      const e1GoalUnsub = gameEventBus.on(GameEventType.GOAL_PLUGGED, () => {
        suppressContinuousSpawnRef.current = true;
        gameEngine.freezeFalling = true;
        gameEngine.emitChange();

        pool.set('e1-unpause', () => {
          gameEngine.state.isPaused = false;
          gameEngine.freezeFalling = true;
          gameEngine.emitChange();
        }, 0);

        // Clear placeholder messageDelay timer
        pool.clear('message-delay');

        advanceArmedRef.current = true;

        pool.set('e1-hint', () => {
          setMessageVisible(true);
          setCanDismiss(false);
          gameEngine.trainingHighlightColor = COLORS.GREEN;
          gameEngine.trainingPressureRate = 0;
          gameEngine.emitChange();

          pool.set('e1-auto-advance', () => {
            if (advanceArmedRef.current) {
              advanceStepRef.current();
            }
          }, 3000);
        }, 3000);
      });
      cleanups.push(e1GoalUnsub);

      const e1PopUnsub = gameEventBus.on(GameEventType.GOOP_POPPED, () => {
        if (!advanceArmedRef.current) return;
        // Mark E2 as complete so getNextTrainingStep skips it
        setSaveData(sd => {
          const existing = sd.tutorialProgress?.completedSteps ?? [];
          if (existing.includes('E2_SCAFFOLDING')) return sd;
          return { ...sd, tutorialProgress: { completedSteps: [...existing, 'E2_SCAFFOLDING'] } };
        });
        advanceStepRef.current();
      });
      cleanups.push(e1PopUnsub);

      // Skip standard advance type handling — E1 has custom pop handler above
      return () => cleanups.forEach(fn => fn());
    }

    // ─── Advance type handling ───────────────────────────────

    // Tap advances: handled by overlay buttons, not event listeners
    if (advance.type === 'tap') {
      return cleanups.length > 0 ? () => cleanups.forEach(fn => fn()) : undefined;
    }

    // Auto-advance after fixed delay
    if (advance.type === 'auto') {
      pool.set('auto-advance', () => {
        advanceStepRef.current();
      }, advance.delayMs);
      return () => cleanups.forEach(fn => fn());
    }

    // --- Action/event-based advance ---
    let eventKey: string | undefined;
    if (advance.type === 'action') {
      // Special case: drag-periscope → GAME_START
      if (advance.action === 'drag-periscope') {
        const unsub = gameEventBus.on(GameEventType.GAME_START, () => {
          if (advanceArmedRef.current) {
            advanceStepRef.current();
          }
        });
        cleanups.push(unsub);
        return () => cleanups.forEach(fn => fn());
      }

      // Special case: swipe-up with F1 ending gate
      if (advance.action === 'swipe-up') {
        const unsub = gameEventBus.on(GameEventType.INPUT_SWIPE_UP, () => {
          if (advanceArmedRef.current && f1EndingRef.current !== 'none') {
            advanceStepRef.current();
          }
        });
        cleanups.push(unsub);
        return () => cleanups.forEach(fn => fn());
      }

      eventKey = advance.action;
    } else if (advance.type === 'event') {
      eventKey = advance.event;
    }

    const gameEvents = eventKey ? ADVANCE_EVENT_MAP[eventKey] : undefined;

    if (gameEvents && gameEvents.length > 0) {
      const unsubs = gameEvents.map(event =>
        gameEventBus.on(event, () => {
          if (advanceArmedRef.current) {
            advanceStepRef.current();
          }
        })
      );
      cleanups.push(() => unsubs.forEach(unsub => unsub()));
    } else if (!currentStep.setup?.advanceAtRow) {
      // Unmapped event/action with no position advance — fallback timer
      pool.set('advance-fallback', () => {
        advanceStepRef.current();
      }, AUTO_ADVANCE_FALLBACK_MS);
    }

    return () => cleanups.forEach(fn => fn());
  }, [currentStep?.id, isInTraining]);

  // ─── Sync Effects ──────────────────────────────────────────

  // Sync allowed controls to engine
  useEffect(() => {
    if (!gameEngine) return;
    if (isInTraining && currentStep?.setup?.allowedControls) {
      gameEngine.trainingAllowedControls = currentStep.setup.allowedControls;
    } else {
      gameEngine.trainingAllowedControls = null;
    }
  }, [gameEngine, currentStep?.id, isInTraining]);

  // Sync pressure rate to engine
  useEffect(() => {
    if (!gameEngine) return;
    if (isInTraining && currentStep?.setup?.pressureRate != null) {
      gameEngine.trainingPressureRate = currentStep.setup.pressureRate;
    } else {
      gameEngine.trainingPressureRate = 0;
    }
  }, [gameEngine, currentStep?.id, isInTraining]);

  // Sync highlight color to engine (static config + dynamic override)
  useEffect(() => {
    if (!gameEngine) return;
    const color = dynamicHighlight ?? ((isInTraining && currentStep?.setup?.highlightGoopColor) || null);
    gameEngine.trainingHighlightColor = color;
  }, [gameEngine, currentStep?.id, isInTraining, dynamicHighlight]);

  // Sync pop-lowers-pressure to engine
  useEffect(() => {
    if (!gameEngine) return;
    if (isInTraining && currentStep?.setup?.popLowersPressure) {
      gameEngine.trainingPopLowersPressure = true;
    } else {
      gameEngine.trainingPopLowersPressure = false;
    }
  }, [gameEngine, currentStep?.id, isInTraining]);

  // ─── Training Complete Cleanup ─────────────────────────────

  useEffect(() => {
    const unsub = gameEventBus.on(GameEventType.TRAINING_SCENARIO_COMPLETE, () => {
      if (gameEngine) {
        // Clean up training flags
        gameEngine.isTrainingMode = false;
        gameEngine.pendingTrainingPalette = null;
        gameEngine.trainingAllowedControls = null;
        gameEngine.trainingPressureRate = 0;
        gameEngine.trainingHighlightColor = null;
        gameEngine.freezeFalling = false;
        gameEngine.trainingPopLowersPressure = false;

        // Clear training cracks/marks
        gameEngine.state.crackCells = [];
        gameEngine.state.goalMarks = [];

        // Reset game session state so ConsoleView doesn't treat training as a game
        gameEngine.state.shiftScore = 0;
        gameEngine.state.goalsCleared = 0;

        // Go straight to console — no end game screen, no scoring
        gameEngine.state.isPaused = false;
        gameEngine.isSessionActive = false;
        gameEngine.state.phase = ScreenType.ConsoleScreen;
        gameEngine.emitChange();

        // Set operator rank to 1 directly
        setSaveData(sd => ({
          ...sd,
          careerRank: 1,
          careerScore: getScoreForRank(1),
        }));
      }
    });
    return unsub;
  }, [gameEngine, setSaveData]);

  // ─── Display Step ──────────────────────────────────────────

  const trainingDisplayStep = useMemo<{ message: IntercomMessage } | null>(() => {
    if (!currentStep || !messageVisible) return null;
    return { message: retryMessage ?? TRAINING_MESSAGES[currentStep.id] ?? { keywords: [], fullText: currentStep.name } };
  }, [currentStep?.id, messageVisible, retryMessage]);

  const messagePosition = currentStep?.setup?.messagePosition ?? 'center';
  const highlightColor = dynamicHighlight ?? ((isInTraining && currentStep?.setup?.highlightGoopColor) || null);

  return {
    currentStep,
    isInTraining,
    isTrainingDone: trainingDone,
    completedStepIds: completedSteps,
    advanceStep,
    dismissMessage,
    trainingDisplayStep,
    messagePosition,
    highlightColor,
    canDismiss,
  };
};
