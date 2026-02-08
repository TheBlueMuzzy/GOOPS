
import { useState, useEffect, useCallback, useRef } from 'react';
import { TutorialStepId, TutorialStep, TutorialState } from '../types/tutorial';
import { SaveData } from '../types';
import { gameEventBus } from '../core/events/EventBus';
import { GameEventType } from '../core/events/GameEvents';
import { TUTORIAL_STEPS } from '../data/tutorialSteps';

interface UseTutorialOptions {
  rank: number;
  isSessionActive: boolean;
  saveData: SaveData;
  setSaveData: (updater: (prev: SaveData) => SaveData) => void;
}

export const useTutorial = ({
  rank,
  isSessionActive,
  saveData,
  setSaveData,
}: UseTutorialOptions) => {
  const [tutorialState, setTutorialState] = useState<TutorialState>(() => ({
    activeStep: null,
    completedSteps: (saveData.tutorialProgress?.completedSteps ?? []) as TutorialStepId[],
    dismissed: false,
  }));

  // Keep a ref to completedSteps for use in event handlers (avoid stale closure)
  const completedRef = useRef(tutorialState.completedSteps);
  completedRef.current = tutorialState.completedSteps;

  // Find the full TutorialStep definition for the active step
  const activeStep: TutorialStep | null = tutorialState.activeStep
    ? TUTORIAL_STEPS.find(s => s.id === tutorialState.activeStep) ?? null
    : null;

  /**
   * Check if a step has already been completed
   */
  const isStepCompleted = useCallback(
    (id: TutorialStepId): boolean => tutorialState.completedSteps.includes(id),
    [tutorialState.completedSteps]
  );

  /**
   * Try to activate a step (only if not already completed and no step is active)
   */
  const tryActivateStep = useCallback(
    (step: TutorialStep) => {
      if (completedRef.current.includes(step.id)) return;

      setTutorialState(prev => {
        // Don't activate if already showing a step
        if (prev.activeStep !== null) return prev;
        if (prev.completedSteps.includes(step.id)) return prev;

        gameEventBus.emit(GameEventType.TUTORIAL_STEP_TRIGGERED, {
          stepId: step.id,
          message: step.message,
        });

        return { ...prev, activeStep: step.id, dismissed: false };
      });
    },
    []
  );

  /**
   * Mark the current step as complete — persists to SaveData immediately
   */
  const completeStep = useCallback(() => {
    setTutorialState(prev => {
      if (!prev.activeStep) return prev;

      const stepId = prev.activeStep;
      const newCompleted = [...prev.completedSteps, stepId];

      gameEventBus.emit(GameEventType.TUTORIAL_STEP_COMPLETED, { stepId });

      // Persist to SaveData
      setSaveData(sd => ({
        ...sd,
        tutorialProgress: { completedSteps: newCompleted as string[] },
      }));

      return {
        activeStep: null,
        completedSteps: newCompleted,
        dismissed: false,
      };
    });
  }, [setSaveData]);

  /**
   * Dismiss the current step (does NOT mark complete — will re-trigger)
   */
  const dismissStep = useCallback(() => {
    setTutorialState(prev => {
      if (!prev.activeStep) return prev;

      gameEventBus.emit(GameEventType.TUTORIAL_STEP_DISMISSED, {
        stepId: prev.activeStep,
      });

      return { ...prev, activeStep: null, dismissed: true };
    });
  }, []);

  // --- Trigger: rank-based steps when rank changes ---
  useEffect(() => {
    const rankSteps = TUTORIAL_STEPS.filter(
      s => s.trigger.type === 'ON_RANK_REACH' && s.trigger.rank === rank
    );
    for (const step of rankSteps) {
      tryActivateStep(step);
    }
  }, [rank, tryActivateStep]);

  // --- Trigger: ON_GAME_START steps when a session starts ---
  useEffect(() => {
    if (!isSessionActive) return;

    const gameStartSteps = TUTORIAL_STEPS.filter(
      s => s.trigger.type === 'ON_GAME_START' && s.trigger.rank === rank
    );
    for (const step of gameStartSteps) {
      tryActivateStep(step);
    }
  }, [isSessionActive, rank, tryActivateStep]);

  // --- Trigger: ON_EVENT steps via EventBus subscription ---
  useEffect(() => {
    const eventSteps = TUTORIAL_STEPS.filter(
      s => s.trigger.type === 'ON_EVENT'
    );

    const unsubs = eventSteps.map(step => {
      const eventType = (step.trigger as { type: 'ON_EVENT'; event: GameEventType }).event;
      return gameEventBus.on(eventType, () => {
        tryActivateStep(step);
      });
    });

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [tryActivateStep]);

  return {
    activeStep,
    completeStep,
    dismissStep,
    isStepCompleted,
    tutorialState,
  };
};
