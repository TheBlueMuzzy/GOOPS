
import { useState, useEffect, useCallback, useRef } from 'react';
import { SaveData, GoopTemplate, GoopShape } from '../types';
import { TrainingStep, PieceSpawn } from '../types/training';
import { IntercomMessage } from '../types/tutorial';
import { GameEngine } from '../core/GameEngine';
import { gameEventBus } from '../core/events/EventBus';
import { GameEventType } from '../core/events/GameEvents';
import { getNextTrainingStep, isTrainingComplete } from '../data/trainingScenarios';
import { TRAINING_MESSAGES } from '../data/tutorialSteps';
import { COLORS, TANK_HEIGHT, TANK_VIEWPORT_HEIGHT, TETRA_NORMAL, PENTA_NORMAL, HEXA_NORMAL } from '../constants';
import { getRotatedCells } from '../utils/gameLogic';

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
  // Events
  'piece-landed': [GameEventType.PIECE_DROPPED],
  'goop-merged': [GameEventType.PIECE_DROPPED],  // Merge happens on landing
  'crack-sealed': [GameEventType.GOAL_CAPTURED],
  'game-over': [GameEventType.GAME_OVER],
};

// Events without direct mappings get auto-advanced after this delay
const AUTO_ADVANCE_FALLBACK_MS = 4000;

/**
 * Manages the rank 0 training sequence.
 *
 * Sequences the player through 15 scripted training steps (phases A-F).
 * Sets up the GameEngine for training mode when the player is at rank 0
 * and hasn't completed all training steps.
 *
 * Provides:
 * - trainingDisplayStep: A message object for TutorialOverlay to display
 * - advanceStep: Advance to next training step (for tap-type advances)
 * - dismissMessage: Hide current message without advancing (for action/event advances)
 * - Event listeners that auto-advance on action/event conditions
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

  // Message visibility — separate from step advancement
  // For tap steps: dismiss = advance. For action/event: dismiss just hides message.
  const [messageVisible, setMessageVisible] = useState(true);

  // Advance arming — prevents event listeners from firing before message is dismissed.
  // For pauseGame: true steps, the listener is "disarmed" until dismissMessage() is called.
  // For pauseGame: false steps, the listener is armed immediately (game already running).
  const advanceArmedRef = useRef(true);
  const armTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Transition delay timer ref — cleaned up on unmount
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Position-polling interval ref for showWhenPieceBelow
  const positionPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Show message when step changes, with a brief delay for reading rhythm
  useEffect(() => {
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    if (positionPollRef.current) {
      clearInterval(positionPollRef.current);
      positionPollRef.current = null;
    }

    // Clear any pending arm timer from previous step
    if (armTimerRef.current) {
      clearTimeout(armTimerRef.current);
      armTimerRef.current = null;
    }

    if (currentStep) {
      // Delayed-pause steps start unpaused (piece falls), then pause when message appears
      const isDelayedPause = currentStep.pauseGame !== false && currentStep.setup?.pauseDelay != null;

      // Arm advance listeners: disarmed for pausing steps (wait for dismiss),
      // armed immediately for non-pausing steps (game already running)
      // Delayed-pause steps are treated like pausing steps (disarmed until dismiss)
      advanceArmedRef.current = currentStep.pauseGame === false && !isDelayedPause;

      if (gameEngine && gameEngine.isSessionActive) {
        if (isDelayedPause) {
          // Delayed pause: start unpaused so piece can begin falling
          gameEngine.state.isPaused = false;
          gameEngine.freezeFalling = false;
          gameEngine.emitChange();
        } else if (currentStep.pauseGame !== false) {
          // Pause/freeze for steps that need the player to read before acting
          gameEngine.state.isPaused = true;
          gameEngine.freezeFalling = true;
          gameEngine.emitChange();
        } else {
          // Non-pausing step (e.g. B1) — ensure game is running
          // (advanceStep may have paused momentarily during transition)
          gameEngine.state.isPaused = false;
          gameEngine.freezeFalling = false;
          gameEngine.emitChange();
        }

        // Spawn a piece if this step defines one (training mode gates auto-spawn,
        // so each piece must be explicitly spawned by the step that needs it)
        if (currentStep.setup?.spawnPiece) {
          const spawn = currentStep.setup.spawnPiece;
          // Find the matching shape template from piece constants
          const allPieces = [...TETRA_NORMAL, ...PENTA_NORMAL, ...HEXA_NORMAL];
          const shapeTemplate = allPieces.find(p => p.type === spawn.shape);
          if (shapeTemplate) {
            let cells = shapeTemplate.cells.map(c => ({ ...c }));
            // Apply initial rotation if specified
            if (spawn.rotation && spawn.rotation > 0) {
              for (let r = 0; r < spawn.rotation; r++) {
                cells = getRotatedCells(cells, true);
              }
            }
            const template: GoopTemplate = { type: spawn.shape, cells, color: spawn.color };
            gameEngine.spawnNewPiece(template);
          }
        }
      }

      const pieceThreshold = currentStep.setup?.showWhenPieceBelow;

      if (isDelayedPause) {
        // Delayed pause: hide message, then after delay pause game + show message
        setMessageVisible(false);
        transitionTimerRef.current = setTimeout(() => {
          if (gameEngine && gameEngine.isSessionActive) {
            gameEngine.state.isPaused = true;
            gameEngine.freezeFalling = true;
            gameEngine.emitChange();
          }
          setMessageVisible(true);
          transitionTimerRef.current = null;
        }, currentStep.setup!.pauseDelay!);
      } else if (pieceThreshold != null && gameEngine) {
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
          }
        }, 200);  // Check every 200ms
      } else if (currentStep.pauseGame === false) {
        // Non-pausing step without position gate — show immediately
        setMessageVisible(true);
      } else {
        // Pausing step — brief delay before showing message
        setMessageVisible(false);
        transitionTimerRef.current = setTimeout(() => {
          setMessageVisible(true);
          transitionTimerRef.current = null;
        }, 400);
      }
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
    };
  }, [currentStep?.id]);

  // Track completion ref for event handler (avoid stale closure)
  const completedRef = useRef(completedSteps);
  completedRef.current = completedSteps;

  // Default training palette (4 colors for training)
  const trainingPalette = [COLORS.BLUE, COLORS.YELLOW, COLORS.GREEN, COLORS.RED];

  // Set up engine for training mode when applicable
  useEffect(() => {
    if (!gameEngine) return;

    if (isInTraining) {
      // Tell engine to start training on next periscope enter
      gameEngine.pendingTrainingPalette = trainingPalette;
    } else {
      // Clear training flag — engine will use normal startRun()
      gameEngine.pendingTrainingPalette = null;
    }
  }, [gameEngine, isInTraining]);

  /**
   * Mark a training step as complete in save data.
   */
  const completeCurrentStep = useCallback(() => {
    if (!currentStep) return;

    const stepId = currentStep.id;

    setSaveData(sd => {
      const existing = sd.tutorialProgress?.completedSteps ?? [];
      if (existing.includes(stepId)) return sd; // Already completed

      const newCompleted = [...existing, stepId];

      // Also mark the tutorial step if this training step unlocks one
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
   * Advance to the next training step.
   * Called after the current step's advance condition is met.
   */
  const advanceStep = useCallback(() => {
    if (!currentStep) return;

    // Disarm to prevent double-advance from rapid events
    advanceArmedRef.current = false;

    completeCurrentStep();

    // Pause immediately — the next step's useEffect will handle the transition delay
    // (Don't unpause here; the step-change effect will manage pause state)
    if (gameEngine && gameEngine.isSessionActive) {
      gameEngine.state.isPaused = true;
      gameEngine.freezeFalling = true;  // Actually stop piece physics too
      gameEngine.emitChange();
    }

    // Check if training is now complete
    const updatedCompleted = [...completedRef.current, currentStep.id];
    if (currentStep.markComplete) updatedCompleted.push(currentStep.markComplete);
    if (isTrainingComplete(updatedCompleted)) {
      // Training complete — emit event and clear engine training flag
      gameEventBus.emit(GameEventType.TRAINING_SCENARIO_COMPLETE);
      if (gameEngine) {
        gameEngine.pendingTrainingPalette = null;
      }
    }
  }, [completeCurrentStep, currentStep, gameEngine]);

  // Ref for advanceStep so event listeners always call the latest version
  const advanceStepRef = useRef(advanceStep);
  advanceStepRef.current = advanceStep;

  /**
   * Dismiss the current message without advancing.
   * Used for action/event steps — hides message, unpauses game, player performs action.
   */
  const dismissMessage = useCallback(() => {
    setMessageVisible(false);

    // Unpause so the player can perform the required action
    if (gameEngine && gameEngine.isSessionActive) {
      gameEngine.state.isPaused = false;
      gameEngine.freezeFalling = false;  // Resume piece physics
      gameEngine.emitChange();
    }

    // Arm the advance listener after a brief delay — prevents the dismiss
    // tap from also triggering the advance event (e.g. fast-drop) on the same frame
    if (armTimerRef.current) clearTimeout(armTimerRef.current);
    armTimerRef.current = setTimeout(() => {
      advanceArmedRef.current = true;
      armTimerRef.current = null;
    }, 150);
  }, [gameEngine]);

  // --- Pause management during training ---
  // ALL steps start paused on transition (handled by step-change effect above).
  // The game stays paused until the player dismisses the message.
  // dismissMessage() handles unpausing for action/event steps.
  // For tap steps, advanceStep() moves to next step (which pauses again).

  // --- Event/action advance listeners ---
  useEffect(() => {
    if (!currentStep || !isInTraining) return;

    const { advance } = currentStep;
    const cleanups: (() => void)[] = [];

    // Position-based advance: poll piece Y and advance when it reaches the threshold.
    // Runs alongside normal event listeners — whichever fires first wins
    // (advanceStep disarms to prevent double-fire).
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

    // Re-show message if player hasn't performed the expected action by a certain row.
    // One-shot: fires once, then the poll stops. If they still don't act, piece lands and we advance.
    if (currentStep.setup?.reshowAtRow != null && gameEngine) {
      const threshold = currentStep.setup.reshowAtRow;
      const actionPerformed = { current: false };

      // Track if the expected action was performed (cancels the re-show)
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
        // Cancel if action was performed OR piece is currently fast-dropping
        // (isFastDropping check catches keyboard S which doesn't emit INPUT_FAST_DROP on event bus)
        if (actionPerformed.current || gameEngine.isFastDropping) {
          clearInterval(reshowPoll);
          return;
        }
        // Cancel if piece already landed (no active goop)
        if (!gameEngine.state.activeGoop) {
          clearInterval(reshowPoll);
          return;
        }
        const pieceY = gameEngine.state.activeGoop.y ?? 0;
        if (pieceY >= threshold) {
          clearInterval(reshowPoll);
          // Re-pause game and re-show message
          gameEngine.state.isPaused = true;
          gameEngine.freezeFalling = true;
          gameEngine.emitChange();
          setMessageVisible(true);
          // Disarm advance — will re-arm on next dismiss
          advanceArmedRef.current = false;
        }
      }, 150);
      cleanups.push(() => clearInterval(reshowPoll));
    }

    // Pressure-threshold advance: poll PSI and advance when it reaches the target percentage.
    // Used for C1/C1B where pressure must rise to specific levels before next teaching step.
    if (currentStep.setup?.advanceAtPressure != null && gameEngine) {
      const targetPsi = currentStep.setup.advanceAtPressure / 100; // Convert percentage to 0-1
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

    // Pressure-above-pieces advance: poll until pressure line rises above the highest locked goop.
    // Dynamic — works regardless of what pieces are on the board.
    if (currentStep.setup?.advanceWhenPressureAbovePieces && gameEngine) {
      const piecePressurePoll = setInterval(() => {
        if (!advanceArmedRef.current) return;

        const maxTime = gameEngine.maxTime ?? 1;
        const psi = maxTime > 0 ? Math.max(0, 1 - (gameEngine.state.shiftTime / maxTime)) : 0;

        // Pressure line grid row — matches GameBoard.tsx rendering exactly:
        // waterHeightBlocks = 1 + (psi * (VIEWPORT_HEIGHT - 1))
        // In grid coords: pressureLineRow = BUFFER_HEIGHT + (VIEWPORT_HEIGHT - 1) - psi * (VIEWPORT_HEIGHT - 1)
        const pressureLineRow = (TANK_HEIGHT - 1) - (psi * (TANK_VIEWPORT_HEIGHT - 1));

        // Find highest occupied row (lowest Y = highest visually)
        // If advancePressureAboveColor is set, only check cells of that color
        const colorFilter = currentStep.setup?.advancePressureAboveColor ?? null;
        let highestOccupiedRow = TANK_HEIGHT; // Default: nothing on grid
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

        // Advance when pressure line is above the highest piece
        if (pressureLineRow < highestOccupiedRow) {
          clearInterval(piecePressurePoll);
          advanceStepRef.current();
        }
      }, 250);
      cleanups.push(() => clearInterval(piecePressurePoll));
    }

    // Tap advances are handled by overlay buttons, not event listeners
    if (advance.type === 'tap') {
      return cleanups.length > 0 ? () => cleanups.forEach(fn => fn()) : undefined;
    }

    // Auto-advance after a fixed delay
    if (advance.type === 'auto') {
      const timer = setTimeout(() => {
        advanceStepRef.current();
      }, advance.delayMs);
      cleanups.push(() => clearTimeout(timer));
      return () => cleanups.forEach(fn => fn());
    }

    // Determine which game events to listen for
    let eventKey: string | undefined;
    if (advance.type === 'action') {
      // Special case: drag-periscope is handled by GAME_START event
      if (advance.action === 'drag-periscope') {
        const unsub = gameEventBus.on(GameEventType.GAME_START, () => {
          if (advanceArmedRef.current) {
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
      // Listen for mapped game events (only advance when armed)
      const unsubs = gameEvents.map(event =>
        gameEventBus.on(event, () => {
          if (advanceArmedRef.current) {
            advanceStepRef.current();
          }
        })
      );
      cleanups.push(() => unsubs.forEach(unsub => unsub()));
    } else if (!currentStep.setup?.advanceAtRow) {
      // Unmapped event/action with no position advance — auto-advance after timeout as fallback
      const timer = setTimeout(() => {
        advanceStepRef.current();
      }, AUTO_ADVANCE_FALLBACK_MS);
      cleanups.push(() => clearTimeout(timer));
    }

    return () => cleanups.forEach(fn => fn());
  }, [currentStep?.id, isInTraining]);

  // --- Sync allowed controls to engine on step change ---
  useEffect(() => {
    if (!gameEngine) return;

    if (isInTraining && currentStep?.setup?.allowedControls) {
      gameEngine.trainingAllowedControls = currentStep.setup.allowedControls;
    } else {
      gameEngine.trainingAllowedControls = null; // All controls allowed
    }
  }, [gameEngine, currentStep?.id, isInTraining]);

  // --- Sync pressure rate to engine on step change ---
  useEffect(() => {
    if (!gameEngine) return;

    if (isInTraining && currentStep?.setup?.pressureRate != null) {
      gameEngine.trainingPressureRate = currentStep.setup.pressureRate;
    } else {
      gameEngine.trainingPressureRate = 0; // Default: pressure frozen
    }
  }, [gameEngine, currentStep?.id, isInTraining]);

  // --- Sync highlight color to engine on step change ---
  useEffect(() => {
    if (!gameEngine) return;

    if (isInTraining && currentStep?.setup?.highlightGoopColor) {
      gameEngine.trainingHighlightColor = currentStep.setup.highlightGoopColor;
    } else {
      gameEngine.trainingHighlightColor = null;
    }
  }, [gameEngine, currentStep?.id, isInTraining]);

  // Subscribe to TRAINING_SCENARIO_COMPLETE event for cleanup
  useEffect(() => {
    const unsub = gameEventBus.on(GameEventType.TRAINING_SCENARIO_COMPLETE, () => {
      if (gameEngine) {
        gameEngine.isTrainingMode = false;
        gameEngine.pendingTrainingPalette = null;
        gameEngine.trainingAllowedControls = null;
        gameEngine.trainingPressureRate = 0;
        gameEngine.trainingHighlightColor = null;
        gameEngine.freezeFalling = false;
      }
    });
    return unsub;
  }, [gameEngine]);

  // --- Build display step for TutorialOverlay ---
  // Returns a message-compatible object when there's a training message to show
  const trainingDisplayStep: { message: IntercomMessage } | null =
    currentStep && messageVisible
      ? { message: TRAINING_MESSAGES[currentStep.id] ?? { keywords: [], fullText: currentStep.name } }
      : null;

  // Message position for the current training step (default: 'center')
  const messagePosition = currentStep?.setup?.messagePosition ?? 'center';

  // Highlight color for the current step (null = no highlight)
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
  };
};
