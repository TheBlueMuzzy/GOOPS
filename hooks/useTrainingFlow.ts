
import { useState, useEffect, useCallback, useRef } from 'react';
import { SaveData, GoopTemplate, GoopShape, Crack, ScreenType } from '../types';
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
  console.log(`[CRACK] SPAWN id=${crackId} at (${x}, ${y}) color=${color} source="${source}" time=${new Date(now).toLocaleTimeString()} totalCracks=${engine.state.crackCells.length + 1}`);
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

  console.log(`[CRACK] PRESSURE DEBUG: psi=${(tankPressure * 100).toFixed(1)}% shiftTime=${engine.state.shiftTime.toFixed(1)} maxTime=${maxTime} waterHeight=${waterHeightBlocks.toFixed(1)} pressureLine=row${pressureLineY} offset=${offset} spawnY=row${spawnY}`);

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
 * Manages the rank 0 training sequence (Tutorial v2).
 *
 * Sequences the player through 14 scripted training steps (phases A-F).
 * Sets up the GameEngine for training mode when the player is at rank 0
 * and hasn't completed all training steps.
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

  // ─── State ─────────────────────────────────────────────────

  // Message visibility — separate from step advancement
  const [messageVisible, setMessageVisible] = useState(true);
  // Whether dismiss button is shown (false = non-dismissible, e.g. reshow or F1 ending)
  const [canDismiss, setCanDismiss] = useState(true);
  // Override message (retries, F1 endings, D3 interrupt)
  const [retryMessage, setRetryMessage] = useState<IntercomMessage | null>(null);

  // ─── Refs ──────────────────────────────────────────────────

  // Advance arming — prevents event listeners from firing before message is dismissed
  const advanceArmedRef = useRef(true);
  const armTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Transition delay timer
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track when game paused for training message — adjusts fill timestamps on unpause
  const pauseStartTimeRef = useRef<number | null>(null);
  // showOnInput: any user input triggers message visibility
  const readyToShowOnInputRef = useRef(false);
  // Position-polling interval for showWhenPieceBelow
  const positionPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Re-show timer for reshowAfterMs
  const reshowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Cleanup for inactivity DOM listeners
  const reshowInputCleanupRef = useRef<(() => void) | null>(null);
  // Cracks-offscreen polling interval
  const cracksOffscreenPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Was a crack sealed this piece-lock cycle? (retry detection)
  const crackSealedThisCycleRef = useRef(false);

  // --- v2 new refs ---
  // Persistent D3 discovery trigger: if D3 auto-skipped, stays armed through E/F
  const pendingD3DiscoveryRef = useRef(false);
  // Whether the D3 offscreen message was shown (prevents autoSkip from arming persistent flag)
  const d3MessageShownRef = useRef(false);
  // Whether the D3 discovery interrupt is currently showing
  const discoveryInterruptRef = useRef(false);
  // F1 ending sub-state: 'none' during free play, 'pressure-cap' or 'overflow' when ending
  const f1EndingRef = useRef<'none' | 'pressure-cap' | 'overflow'>('none');
  // Periodic crack spawning interval (started after F1 dismiss)
  const periodicCrackRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track completion ref for event handler (avoid stale closure)
  const completedRef = useRef(completedSteps);
  completedRef.current = completedSteps;

  // ─── Step-Change Effect ────────────────────────────────────
  // Runs when currentStep changes. Sets up game state, spawns, message visibility.

  useEffect(() => {
    console.log(`[STEP] === STEP CHANGE === ${currentStep?.id ?? 'null'} (${currentStep?.name ?? ''}) at ${new Date().toLocaleTimeString()}`);
    // Cleanup timers/intervals from previous step
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    if (positionPollRef.current) {
      clearInterval(positionPollRef.current);
      positionPollRef.current = null;
    }
    if (armTimerRef.current) {
      clearTimeout(armTimerRef.current);
      armTimerRef.current = null;
    }
    if (reshowTimerRef.current) {
      clearTimeout(reshowTimerRef.current);
      reshowTimerRef.current = null;
    }
    if (reshowInputCleanupRef.current) {
      reshowInputCleanupRef.current();
      reshowInputCleanupRef.current = null;
    }
    if (cracksOffscreenPollRef.current) {
      clearInterval(cracksOffscreenPollRef.current);
      cracksOffscreenPollRef.current = null;
    }
    if (periodicCrackRef.current) {
      clearInterval(periodicCrackRef.current);
      periodicCrackRef.current = null;
    }
    readyToShowOnInputRef.current = false;
    setCanDismiss(true);
    setRetryMessage(null);
    crackSealedThisCycleRef.current = false;
    discoveryInterruptRef.current = false;
    d3MessageShownRef.current = false;
    f1EndingRef.current = 'none';

    if (!currentStep) return;

    // Delayed-pause steps: start unpaused, pause when condition is met
    const isDelayedPause = currentStep.pauseGame !== false && (
      currentStep.setup?.pauseDelay != null ||
      currentStep.setup?.showWhenPieceBelow != null ||
      currentStep.setup?.showWhenCracksOffscreen
    );

    // Arm advance: disarmed for pausing steps, armed for non-pausing
    advanceArmedRef.current = currentStep.pauseGame === false && !isDelayedPause;

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
        if (gameEngine.state.crackCells.length > 0) {
          console.log(`[CRACK] CLEAR ALL — ${gameEngine.state.crackCells.length} cracks removed before spawning for ${currentStep.id}`);
        }
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
      positionPollRef.current = setInterval(() => {
        const pieceY = gameEngine.state.activeGoop?.y ?? 0;
        if (pieceY >= pieceThreshold) {
          setMessageVisible(true);
          if (positionPollRef.current) {
            clearInterval(positionPollRef.current);
            positionPollRef.current = null;
          }
          if (currentStep.pauseGame !== false) {
            gameEngine.state.isPaused = true;
            gameEngine.freezeFalling = true;
            pauseStartTimeRef.current = Date.now();
            gameEngine.emitChange();
          }
        }
      }, 200);

    } else if (currentStep.setup?.showWhenCracksOffscreen && gameEngine) {
      // Discovery-gated: show when any crack rotated offscreen
      setMessageVisible(false);
      cracksOffscreenPollRef.current = setInterval(() => {
        if (isAnyCrackOffscreen(gameEngine)) {
          if (cracksOffscreenPollRef.current) {
            clearInterval(cracksOffscreenPollRef.current);
            cracksOffscreenPollRef.current = null;
          }
          d3MessageShownRef.current = true;  // Track that message was shown
          setMessageVisible(true);
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
      transitionTimerRef.current = setTimeout(() => {
        if (gameEngine && gameEngine.isSessionActive) {
          gameEngine.state.isPaused = true;
          gameEngine.freezeFalling = true;
          pauseStartTimeRef.current = Date.now();
          gameEngine.emitChange();
        }
        setMessageVisible(true);
        transitionTimerRef.current = null;
      }, currentStep.setup!.pauseDelay!);

    } else if (currentStep.pauseGame === false) {
      // Non-pausing step — show immediately, after delay, or on input
      if (currentStep.setup?.messageDelay && currentStep.setup?.showOnInput) {
        setMessageVisible(false);
        readyToShowOnInputRef.current = true;
        transitionTimerRef.current = setTimeout(() => {
          if (readyToShowOnInputRef.current) {
            setMessageVisible(true);
            readyToShowOnInputRef.current = false;
          }
          transitionTimerRef.current = null;
        }, currentStep.setup.messageDelay);
      } else if (currentStep.setup?.messageDelay) {
        setMessageVisible(false);
        transitionTimerRef.current = setTimeout(() => {
          setMessageVisible(true);
          transitionTimerRef.current = null;
        }, currentStep.setup.messageDelay);
      } else {
        setMessageVisible(true);
      }
    } else {
      // Pausing step — brief delay before showing message
      setMessageVisible(false);
      transitionTimerRef.current = setTimeout(() => {
        setMessageVisible(true);
        transitionTimerRef.current = null;
      }, 400);
    }

    return () => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }
      if (positionPollRef.current) {
        clearInterval(positionPollRef.current);
        positionPollRef.current = null;
      }
      if (armTimerRef.current) {
        clearTimeout(armTimerRef.current);
        armTimerRef.current = null;
      }
      if (reshowTimerRef.current) {
        clearTimeout(reshowTimerRef.current);
        reshowTimerRef.current = null;
      }
      if (reshowInputCleanupRef.current) {
        reshowInputCleanupRef.current();
        reshowInputCleanupRef.current = null;
      }
      if (cracksOffscreenPollRef.current) {
        clearInterval(cracksOffscreenPollRef.current);
        cracksOffscreenPollRef.current = null;
      }
      if (periodicCrackRef.current) {
        clearInterval(periodicCrackRef.current);
        periodicCrackRef.current = null;
      }
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
  }, [adjustFillTimestampsForPause, completeCurrentStep, currentStep, gameEngine]);

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
        // Resume pressure — it will rise again until re-capped at 95%
        if (currentStep?.setup?.pressureRate != null) {
          gameEngine.trainingPressureRate = currentStep.setup.pressureRate;
        }
        gameEngine.emitChange();

        // Spawn piece if none active
        if (!gameEngine.state.activeGoop) {
          setTimeout(() => {
            if (gameEngine.isSessionActive && f1EndingRef.current === 'none') {
              gameEngine.spawnNewPiece();
              gameEngine.emitChange();
            }
          }, 300);
        }

        // Re-watch for pressure cap — will freeze again at 95%
        const capValue = currentStep?.setup?.pressureCap ?? 0.95;
        const reCap = setInterval(() => {
          if (f1EndingRef.current !== 'none') { clearInterval(reCap); return; }
          const maxTime = gameEngine.maxTime ?? 1;
          const psi = maxTime > 0 ? Math.max(0, 1 - (gameEngine.state.shiftTime / maxTime)) : 0;
          if (psi >= capValue) {
            clearInterval(reCap);
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

    // --- D3 discovery interrupt: dismiss and resume, don't affect step ---
    if (discoveryInterruptRef.current) {
      discoveryInterruptRef.current = false;
      setRetryMessage(null);
      setMessageVisible(false);
      adjustFillTimestampsForPause();
      if (gameEngine && gameEngine.isSessionActive) {
        gameEngine.state.isPaused = false;
        gameEngine.freezeFalling = false;
        gameEngine.emitChange();

        // If in a continuous-spawn step (E1/F1), spawn a piece so game doesn't stall
        if (currentStep?.setup?.continuousSpawn && !gameEngine.state.activeGoop) {
          setTimeout(() => {
            if (gameEngine.isSessionActive && !gameEngine.state.isPaused) {
              gameEngine.spawnNewPiece();
              gameEngine.emitChange();
            }
          }, 300);
        }
      }
      return;
    }

    setMessageVisible(false);
    adjustFillTimestampsForPause();

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
    if (armTimerRef.current) clearTimeout(armTimerRef.current);
    armTimerRef.current = setTimeout(() => {
      advanceArmedRef.current = true;
      armTimerRef.current = null;
    }, 150);

    // --- Start free-play features for continuous-spawn steps ---
    if (currentStep?.setup?.continuousSpawn && gameEngine) {
      // Spawn first piece after dismiss (training mode doesn't auto-spawn)
      setTimeout(() => {
        if (gameEngine.isSessionActive && f1EndingRef.current === 'none') {
          gameEngine.spawnNewPiece();
          gameEngine.emitChange();
        }
      }, 300);

      // Start periodic crack spawning if configured
      if (currentStep.setup.periodicCrackIntervalMs) {
        console.log(`[CRACK] PERIODIC TIMER STARTED — interval=${currentStep.setup.periodicCrackIntervalMs}ms step=${currentStep.id}`);
        if (periodicCrackRef.current) clearInterval(periodicCrackRef.current);
        periodicCrackRef.current = setInterval(() => {
          if (f1EndingRef.current !== 'none') {
            console.log(`[CRACK] PERIODIC SKIPPED — f1Ending=${f1EndingRef.current}`);
            return;
          }
          if (gameEngine.isSessionActive) {
            console.log(`[CRACK] PERIODIC TICK — spawning random crack`);
            spawnRandomCrack(gameEngine);
          }
        }, currentStep.setup.periodicCrackIntervalMs);
      }
    }

    // --- Re-show reminder after delay if step has reshowAfterMs ---
    if (reshowTimerRef.current) clearTimeout(reshowTimerRef.current);
    if (currentStep?.setup?.reshowAfterMs) {
      const isNonDismissible = !!currentStep.setup.reshowNonDismissible;
      const delay = currentStep.setup.reshowAfterMs;

      reshowTimerRef.current = setTimeout(() => {
        if (advanceArmedRef.current && gameEngine && gameEngine.isSessionActive) {
          if (isNonDismissible) {
            // Non-dismissible: freeze pressure but keep game running so player can still act
            gameEngine.trainingPressureRate = 0;
            gameEngine.emitChange();
            setMessageVisible(true);
            setCanDismiss(false);
          } else {
            // Dismissible: full pause
            gameEngine.state.isPaused = true;
            gameEngine.freezeFalling = true;
            pauseStartTimeRef.current = Date.now();
            gameEngine.emitChange();
            setMessageVisible(true);
            advanceArmedRef.current = false;
          }
        }
        reshowTimerRef.current = null;
      }, delay);
    }
  }, [adjustFillTimestampsForPause, gameEngine, currentStep]);

  // ─── Event/Action Listener Effect ──────────────────────────
  // Sets up all event-based features: advance conditions, continuous spawn,
  // pressure monitoring, retry logic, and persistent discovery.

  useEffect(() => {
    if (!currentStep || !isInTraining) return;

    const { advance } = currentStep;
    const cleanups: (() => void)[] = [];

    // --- showOnInput: show message on any input ---
    if (currentStep.setup?.showOnInput) {
      const showOnInputHandler = () => {
        if (readyToShowOnInputRef.current) {
          setMessageVisible(true);
          readyToShowOnInputRef.current = false;
        }
      };
      document.addEventListener('pointerdown', showOnInputHandler, true);
      document.addEventListener('touchstart', showOnInputHandler, true);
      document.addEventListener('keydown', showOnInputHandler, true);
      cleanups.push(() => {
        document.removeEventListener('pointerdown', showOnInputHandler, true);
        document.removeEventListener('touchstart', showOnInputHandler, true);
        document.removeEventListener('keydown', showOnInputHandler, true);
      });
    }

    // --- Position-based advance: poll piece Y ---
    if (currentStep.setup?.advanceAtRow != null && gameEngine) {
      const threshold = currentStep.setup.advanceAtRow;
      const pollInterval = setInterval(() => {
        const pieceY = gameEngine.state.activeGoop?.y ?? 0;
        if (pieceY >= threshold && advanceArmedRef.current) {
          clearInterval(pollInterval);
          advanceStepRef.current();
        }
      }, 150);
      cleanups.push(() => clearInterval(pollInterval));
    }

    // --- Re-show message if player hasn't acted by a certain row ---
    if (currentStep.setup?.reshowAtRow != null && gameEngine) {
      const threshold = currentStep.setup.reshowAtRow;
      const actionPerformed = { current: false };

      if (currentStep.setup.reshowUntilAction) {
        const events = ADVANCE_EVENT_MAP[currentStep.setup.reshowUntilAction];
        if (events) {
          const unsubs = events.map(event =>
            gameEventBus.on(event, () => { actionPerformed.current = true; })
          );
          cleanups.push(() => unsubs.forEach(unsub => unsub()));
        }
      }

      const reshowPoll = setInterval(() => {
        if (actionPerformed.current || gameEngine.isFastDropping) {
          clearInterval(reshowPoll);
          return;
        }
        if (!gameEngine.state.activeGoop) {
          clearInterval(reshowPoll);
          return;
        }
        const pieceY = gameEngine.state.activeGoop.y ?? 0;
        if (pieceY >= threshold) {
          clearInterval(reshowPoll);
          gameEngine.state.isPaused = true;
          gameEngine.freezeFalling = true;
          gameEngine.emitChange();
          setMessageVisible(true);
          advanceArmedRef.current = false;
        }
      }, 150);
      cleanups.push(() => clearInterval(reshowPoll));
    }

    // --- Pressure-threshold advance ---
    if (currentStep.setup?.advanceAtPressure != null && gameEngine) {
      const targetPsi = currentStep.setup.advanceAtPressure / 100;
      const pressurePoll = setInterval(() => {
        if (!advanceArmedRef.current) return;
        const maxTime = gameEngine.maxTime ?? 1;
        const psi = maxTime > 0 ? Math.max(0, 1 - (gameEngine.state.shiftTime / maxTime)) : 0;
        if (psi >= targetPsi) {
          clearInterval(pressurePoll);
          advanceStepRef.current();
        }
      }, 250);
      cleanups.push(() => clearInterval(pressurePoll));
    }

    // --- Pressure-above-pieces advance ---
    if (currentStep.setup?.advanceWhenPressureAbovePieces && gameEngine) {
      const piecePressurePoll = setInterval(() => {
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
          clearInterval(piecePressurePoll);
          advanceStepRef.current();
        }
      }, 250);
      cleanups.push(() => clearInterval(piecePressurePoll));
    }

    // --- Retry on piece land (D2: piece lands without sealing → retry) ---
    if (currentStep.setup?.retryOnPieceLand && gameEngine) {
      const retryConfig = currentStep.setup.retryOnPieceLand;

      const goalUnsub = gameEventBus.on(GameEventType.GOAL_CAPTURED, () => {
        crackSealedThisCycleRef.current = true;
      });
      cleanups.push(goalUnsub);

      const dropUnsub = gameEventBus.on(GameEventType.PIECE_DROPPED, () => {
        if (crackSealedThisCycleRef.current) {
          crackSealedThisCycleRef.current = false;
          return;
        }

        // PIECE_DROPPED fires from BOTH lockActivePiece() and tickLooseGoop().
        // Defer to next tick, then check: if activeGoop still exists, this was
        // loose goop landing (not a real piece lock) — ignore.
        setTimeout(() => {
          if (gameEngine.state.activeGoop) return;
          // Phase 1: Unpause so the fill animation renders, but freeze pressure
          gameEngine.state.isPaused = false;
          gameEngine.freezeFalling = false;
          gameEngine.trainingPressureRate = 0;
          gameEngine.emitChange();

          // Phase 2: Wait for fill to complete + 0.5s buffer, then pop all goop
          // A 4-block T_O piece takes ~1500ms to fill (BASE_FILL + 4 × PER_BLOCK)
          setTimeout(() => {
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
            setTimeout(() => {
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
              crackSealedThisCycleRef.current = false;
            }, 2000);
          }, 2000);
        }, 0);
      });
      cleanups.push(dropUnsub);
    }

    // --- autoSkipMs: safety timer to auto-advance if condition not met ---
    if (currentStep.setup?.autoSkipMs) {
      const skipTimer = setTimeout(() => {
        // D3 special: only set persistent discovery flag if message was NEVER shown
        // (if the player saw the message and dismissed it, they learned the concept)
        if (currentStep.id === 'D3_OFFSCREEN' && !d3MessageShownRef.current) {
          pendingD3DiscoveryRef.current = true;
        }
        advanceStepRef.current();
      }, currentStep.setup.autoSkipMs);
      cleanups.push(() => clearTimeout(skipTimer));
    }

    // --- Continuous spawn: auto-spawn next piece after each landing ---
    // PIECE_DROPPED fires from BOTH lockActivePiece() (real piece lock) AND
    // tickLooseGoop() (loose goop settling after pop). We must only spawn a new
    // piece when the REAL active piece locked — not when loose goop lands.
    // Check: lockActivePiece sets activeGoop=null, so if activeGoop is already
    // null after the deferred tick, it was a real lock. If activeGoop still exists,
    // it was loose goop landing while a piece is in play.
    if (currentStep.setup?.continuousSpawn && gameEngine) {
      const spawnUnsub = gameEventBus.on(GameEventType.PIECE_DROPPED, () => {
        if (f1EndingRef.current !== 'none') return; // Stop during any F1 ending

        // Defer to next tick — lockActivePiece() hasn't finished yet
        setTimeout(() => {
          // If there's still an active piece, this was loose goop — ignore
          if (gameEngine.state.activeGoop) return;

          // Undo the engine's auto-pause from lockActivePiece()
          gameEngine.state.isPaused = false;
          gameEngine.freezeFalling = false;
          gameEngine.emitChange();

          // Spawn next piece after brief delay
          setTimeout(() => {
            if (gameEngine.isSessionActive && !gameEngine.state.isPaused && !gameEngine.state.activeGoop) {
              gameEngine.spawnNewPiece();
              gameEngine.emitChange();
            }
          }, 300);
        }, 0);
      });
      cleanups.push(spawnUnsub);
    }

    // --- Pressure cap watcher ---
    if (currentStep.setup?.pressureCap != null && gameEngine) {
      const capValue = currentStep.setup.pressureCap;
      const capPoll = setInterval(() => {
        const maxTime = gameEngine.maxTime ?? 1;
        const psi = maxTime > 0 ? Math.max(0, 1 - (gameEngine.state.shiftTime / maxTime)) : 0;
        if (psi >= capValue) {
          clearInterval(capPoll);
          // Freeze pressure
          gameEngine.trainingPressureRate = 0;
          gameEngine.emitChange();

          // F1: show pressure cap ending message (dismissible — reshows every 30s)
          if (currentStep.id === 'F1_GRADUATION' && f1EndingRef.current === 'none') {
            console.log(`[F1] PRESSURE CAP reached (${(psi * 100).toFixed(1)}%) — showing ending message`);
            f1EndingRef.current = 'pressure-cap';
            setRetryMessage(F1_ENDING_MESSAGES.PRESSURE_CAP);
            setMessageVisible(true);
            setCanDismiss(true);
            advanceArmedRef.current = true;
          }
        }
      }, 250);
      cleanups.push(() => clearInterval(capPoll));
    }

    // --- F1 overflow detection ---
    // GAME_OVER can fire in training when spawnNewPiece detects collision on spawn.
    // Also poll for stack reaching buffer zone as a safety net.
    if (currentStep.id === 'F1_GRADUATION' && gameEngine) {
      const handleOverflow = () => {
        if (f1EndingRef.current !== 'none') return; // Already in ending
        console.log(`[F1] OVERFLOW detected — showing ending message`);
        f1EndingRef.current = 'overflow';

        // Freeze everything
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

    // --- Discoverable D3 offscreen message ---
    // If the D3 message hasn't been shown yet, watch for offscreen cracks during
    // any step with cracks and tank rotation (D2, E1, F1). Shows as interrupt.
    const stepsWithCracksAndRotation = ['D2_TANK_ROTATION', 'E1_SCAFFOLDING', 'F1_GRADUATION'];
    if (!d3MessageShownRef.current && gameEngine &&
        currentStep.id !== 'D3_OFFSCREEN' &&
        stepsWithCracksAndRotation.includes(currentStep.id) &&
        gameEngine.state.crackCells.length > 0) {
      const discoveryPoll = setInterval(() => {
        if (discoveryInterruptRef.current) return; // Already showing
        if (f1EndingRef.current !== 'none') return; // F1 ending active
        if (gameEngine.state.isPaused) return; // Game paused

        if (isAnyCrackOffscreen(gameEngine)) {
          clearInterval(discoveryPoll);
          d3MessageShownRef.current = true;
          pendingD3DiscoveryRef.current = false;
          discoveryInterruptRef.current = true;

          // Show D3 message as interrupt
          setRetryMessage(TRAINING_MESSAGES.D3_OFFSCREEN);
          setMessageVisible(true);

          // Pause so player can read
          gameEngine.state.isPaused = true;
          gameEngine.freezeFalling = true;
          pauseStartTimeRef.current = Date.now();
          gameEngine.emitChange();

          // Mark D3 as learned so it auto-skips when we reach it
          setSaveData(sd => {
            const existing = sd.tutorialProgress?.completedSteps ?? [];
            if (existing.includes('D3_OFFSCREEN')) return sd;
            const updated = [...existing, 'D3_OFFSCREEN'];
            if (!existing.includes('WRAP_INTRO')) updated.push('WRAP_INTRO');
            return { ...sd, tutorialProgress: { completedSteps: updated } };
          });
        }
      }, 200);
      cleanups.push(() => clearInterval(discoveryPoll));
    }

    // ─── Advance type handling ───────────────────────────────

    // Tap advances: handled by overlay buttons, not event listeners
    if (advance.type === 'tap') {
      return cleanups.length > 0 ? () => cleanups.forEach(fn => fn()) : undefined;
    }

    // Auto-advance after fixed delay
    if (advance.type === 'auto') {
      const timer = setTimeout(() => {
        advanceStepRef.current();
      }, advance.delayMs);
      cleanups.push(() => clearTimeout(timer));
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
      const timer = setTimeout(() => {
        advanceStepRef.current();
      }, AUTO_ADVANCE_FALLBACK_MS);
      cleanups.push(() => clearTimeout(timer));
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

  // Sync highlight color to engine
  useEffect(() => {
    if (!gameEngine) return;
    if (isInTraining && currentStep?.setup?.highlightGoopColor) {
      gameEngine.trainingHighlightColor = currentStep.setup.highlightGoopColor;
    } else {
      gameEngine.trainingHighlightColor = null;
    }
  }, [gameEngine, currentStep?.id, isInTraining]);

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

  const trainingDisplayStep: { message: IntercomMessage } | null =
    currentStep && messageVisible
      ? { message: retryMessage ?? TRAINING_MESSAGES[currentStep.id] ?? { keywords: [], fullText: currentStep.name } }
      : null;

  const messagePosition = currentStep?.setup?.messagePosition ?? 'center';
  const highlightColor = (isInTraining && currentStep?.setup?.highlightGoopColor) || null;

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
