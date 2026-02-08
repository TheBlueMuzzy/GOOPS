
import React from 'react';
import { TrainingStep, TrainingPhase } from '../types/training';
import { TRAINING_PHASE_NAMES, TRAINING_SEQUENCE, getPhaseSteps } from '../data/trainingScenarios';

interface TrainingHUDProps {
  currentStep: TrainingStep;
  completedStepIds: string[];
}

// All phases in order
const ALL_PHASES: TrainingPhase[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

/**
 * TrainingHUD — persistent top-of-screen HUD during rank 0 training.
 *
 * Shows: phase name (left), phase dots (center), step count (right).
 * Sits at z-[85] — below TutorialOverlay (z-90), above game layers.
 * Non-blocking: pointer-events-none so player can still interact.
 */
export const TrainingHUD: React.FC<TrainingHUDProps> = ({
  currentStep,
  completedStepIds,
}) => {
  // Calculate step index (1-based) within the full sequence
  const stepIndex = TRAINING_SEQUENCE.findIndex(s => s.id === currentStep.id);
  const stepNumber = stepIndex + 1;
  const totalSteps = TRAINING_SEQUENCE.length;

  // Phase label: "Phase B: Goop Basics"
  const phaseLabel = `Phase ${currentStep.phase}: ${TRAINING_PHASE_NAMES[currentStep.phase]}`;

  return (
    <div
      className="absolute top-0 left-0 right-0 z-[85] pointer-events-none"
      style={{
        background: 'rgba(0, 0, 0, 0.6)',
        height: '54px',
      }}
    >
      <div className="flex items-center justify-between h-full px-3">
        {/* Left: Phase name */}
        <div className="flex-shrink-0 min-w-0">
          <div className="t-caption text-slate-400 leading-tight truncate">
            {phaseLabel}
          </div>
        </div>

        {/* Center: Phase dots */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {ALL_PHASES.map(phase => {
            const phaseSteps = getPhaseSteps(phase);
            const allComplete = phaseSteps.every(s => completedStepIds.includes(s.id));
            const isCurrent = currentStep.phase === phase;

            let dotClass = 'training-dot';
            if (allComplete) {
              dotClass += ' training-dot--complete';
            } else if (isCurrent) {
              dotClass += ' training-dot--current';
            } else {
              dotClass += ' training-dot--upcoming';
            }

            return (
              <div
                key={phase}
                className={dotClass}
                title={`Phase ${phase}: ${TRAINING_PHASE_NAMES[phase]}`}
              />
            );
          })}
        </div>

        {/* Right: Step count */}
        <div className="flex-shrink-0">
          <div className="t-caption text-slate-400 leading-tight">
            Step {stepNumber} of {totalSteps}
          </div>
        </div>
      </div>

      {/* CSS for phase dots — CSS-only animations, no React state */}
      <style>{`
        .training-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .training-dot--complete {
          background: #94a3b8; /* slate-400 */
        }
        .training-dot--current {
          background: #38bdf8; /* sky-400 */
          animation: training-pulse 1.5s ease-in-out infinite;
        }
        .training-dot--upcoming {
          background: transparent;
          border: 1px solid #475569; /* slate-600 */
        }
        @keyframes training-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
};
