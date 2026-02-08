
import React, { useState, useEffect, useRef } from 'react';
import { TutorialStep } from '../types/tutorial';
import { IntercomMessageDisplay } from './IntercomMessage';

interface TutorialOverlayProps {
  activeStep: TutorialStep | null;
  onComplete: () => void;    // Mark step completed
  onDismiss: () => void;     // Dismiss without completing
}

/**
 * TutorialOverlay — sits at z-[90] in Game.tsx, above TransitionOverlay.
 *
 * Displays intercom messages when tutorial steps trigger.
 * Non-blocking: pointer-events-none on the overlay itself,
 * pointer-events-auto on the IntercomMessage only.
 *
 * Supports a highlight area infrastructure (clip-path cutout)
 * for future use in Phase 33 training scenarios.
 */
export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  activeStep,
  onComplete,
  onDismiss,
}) => {
  // Track the step being displayed (for fade-out: keep rendering while fading)
  const [displayedStep, setDisplayedStep] = useState<TutorialStep | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // When activeStep changes, handle fade in/out
  useEffect(() => {
    // Clear any pending fade timeout
    if (fadeTimeoutRef.current) {
      clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = null;
    }

    if (activeStep) {
      // New step: show it immediately
      setDisplayedStep(activeStep);
      // Small delay to ensure the DOM renders before triggering opacity transition
      requestAnimationFrame(() => setIsVisible(true));
    } else if (displayedStep) {
      // Step removed: fade out, then clear
      setIsVisible(false);
      fadeTimeoutRef.current = setTimeout(() => {
        setDisplayedStep(null);
      }, 150); // Match fade-out duration
    }

    return () => {
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
      }
    };
  }, [activeStep]);

  // Nothing to show
  if (!displayedStep) return null;

  return (
    <div
      className="absolute inset-0 z-[90] pointer-events-none"
      style={{
        transition: 'opacity 150ms ease-out',
        opacity: isVisible ? 1 : 0,
      }}
    >
      {/* Highlight area infrastructure — future Phase 33 will provide coordinates */}
      {/* When highlightArea is defined on a step, render a semi-transparent overlay
          with a clip-path cutout. For now, no steps define highlightArea. */}

      {/* Intercom message — pointer-events-auto so player can interact */}
      <div className="pointer-events-auto">
        <IntercomMessageDisplay
          message={displayedStep.message}
          onDismiss={onDismiss}
          onComplete={onComplete}
          position="top"
        />
      </div>
    </div>
  );
};
