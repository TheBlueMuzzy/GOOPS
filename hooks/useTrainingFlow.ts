
import { useState, useEffect, useCallback, useRef } from 'react';
import { SaveData } from '../types';
import { TrainingStep } from '../types/training';
import { GameEngine } from '../core/GameEngine';
import { gameEventBus } from '../core/events/EventBus';
import { GameEventType } from '../core/events/GameEvents';
import { getNextTrainingStep, isTrainingComplete } from '../data/trainingScenarios';
import { COLORS } from '../constants';

interface UseTrainingFlowOptions {
  saveData: SaveData;
  setSaveData: (updater: (prev: SaveData) => SaveData) => void;
  gameEngine: GameEngine | null;
  rank: number;
}

/**
 * Manages the rank 0 training sequence.
 *
 * Sequences the player through 17 scripted training steps (phases A-G).
 * Sets up the GameEngine for training mode when the player is at rank 0
 * and hasn't completed all training steps.
 *
 * Works alongside useTutorial — this hook handles scenario sequencing,
 * useTutorial handles intercom messages and journal unlocks.
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

  // Track completion ref for event handler (avoid stale closure)
  const completedRef = useRef(completedSteps);
  completedRef.current = completedSteps;

  // Default training palette (2 colors for early training)
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
    completeCurrentStep();

    // Check if training is now complete
    const updatedCompleted = [...completedRef.current, currentStep?.id ?? ''];
    if (isTrainingComplete(updatedCompleted)) {
      // Training complete — emit event and clear engine training flag
      gameEventBus.emit(GameEventType.TRAINING_SCENARIO_COMPLETE);
      if (gameEngine) {
        gameEngine.pendingTrainingPalette = null;
      }
    }
  }, [completeCurrentStep, currentStep, gameEngine]);

  // Subscribe to TRAINING_SCENARIO_COMPLETE event for cleanup
  useEffect(() => {
    const unsub = gameEventBus.on(GameEventType.TRAINING_SCENARIO_COMPLETE, () => {
      if (gameEngine) {
        gameEngine.isTrainingMode = false;
        gameEngine.pendingTrainingPalette = null;
      }
    });
    return unsub;
  }, [gameEngine]);

  return {
    currentStep,
    isInTraining,
    isTrainingDone: trainingDone,
    completedStepIds: completedSteps,
    advanceStep,
    completeCurrentStep,
  };
};
