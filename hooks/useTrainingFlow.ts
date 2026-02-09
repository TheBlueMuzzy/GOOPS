
import { useState, useEffect, useCallback, useRef } from 'react';
import { SaveData } from '../types';
import { TrainingStep } from '../types/training';
import { IntercomMessage } from '../types/tutorial';
import { GameEngine } from '../core/GameEngine';
import { gameEventBus } from '../core/events/EventBus';
import { GameEventType } from '../core/events/GameEvents';
import { getNextTrainingStep, isTrainingComplete } from '../data/trainingScenarios';
import { TRAINING_MESSAGES } from '../data/tutorialSteps';
import { COLORS } from '../constants';

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

  // Transition delay timer ref — cleaned up on unmount
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show message when step changes, with a brief delay for reading rhythm
  useEffect(() => {
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }

    if (currentStep) {
      if (gameEngine && gameEngine.isSessionActive) {
        if (currentStep.pauseGame !== false) {
          // Pause/freeze for steps that need the player to read before acting
          gameEngine.state.isPaused = true;
          gameEngine.freezeFalling = true;
          gameEngine.emitChange();
        } else {
          // Non-pausing step (e.g. B1B) — ensure game is running
          // (advanceStep may have paused momentarily during transition)
          gameEngine.state.isPaused = false;
          gameEngine.freezeFalling = false;
          gameEngine.emitChange();
        }
      }

      // Brief delay before showing the message (let player see result of previous action)
      // Skip delay for non-pausing steps — show immediately since gameplay is live
      if (currentStep.pauseGame === false) {
        setMessageVisible(true);
      } else {
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

    // Tap advances are handled by overlay buttons, not event listeners
    if (advance.type === 'tap') return;

    // Auto-advance after a fixed delay
    if (advance.type === 'auto') {
      const timer = setTimeout(() => {
        advanceStepRef.current();
      }, advance.delayMs);
      return () => clearTimeout(timer);
    }

    // Determine which game events to listen for
    let eventKey: string | undefined;
    if (advance.type === 'action') {
      // Special case: drag-periscope is handled by GAME_START event
      if (advance.action === 'drag-periscope') {
        const unsub = gameEventBus.on(GameEventType.GAME_START, () => {
          advanceStepRef.current();
        });
        return unsub;
      }
      eventKey = advance.action;
    } else if (advance.type === 'event') {
      eventKey = advance.event;
    }

    const gameEvents = eventKey ? ADVANCE_EVENT_MAP[eventKey] : undefined;

    if (gameEvents && gameEvents.length > 0) {
      // Listen for mapped game events
      const unsubs = gameEvents.map(event =>
        gameEventBus.on(event, () => {
          advanceStepRef.current();
        })
      );
      return () => unsubs.forEach(unsub => unsub());
    } else {
      // Unmapped event/action — auto-advance after timeout as fallback
      const timer = setTimeout(() => {
        advanceStepRef.current();
      }, AUTO_ADVANCE_FALLBACK_MS);
      return () => clearTimeout(timer);
    }
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

  // Subscribe to TRAINING_SCENARIO_COMPLETE event for cleanup
  useEffect(() => {
    const unsub = gameEventBus.on(GameEventType.TRAINING_SCENARIO_COMPLETE, () => {
      if (gameEngine) {
        gameEngine.isTrainingMode = false;
        gameEngine.pendingTrainingPalette = null;
        gameEngine.trainingAllowedControls = null;
        gameEngine.trainingPressureRate = 0;
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

  return {
    currentStep,
    isInTraining,
    isTrainingDone: trainingDone,
    completedStepIds: completedSteps,
    advanceStep,
    dismissMessage,
    trainingDisplayStep,
    messagePosition,
  };
};
