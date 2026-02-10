
import React, { useState, useEffect, useRef } from 'react';
import { IntercomMessage } from '../types/tutorial';
import { IntercomMessageDisplay, PhaseDotInfo } from './IntercomMessage';

// --- Highlight Region Definitions ---
// Maps highlightElement strings (from TrainingStep.setup.highlightElement)
// to viewport-relative percentage regions: { left, top, right, bottom }
// Values are percentages of the viewport (0-100).
// Add new entries here when new training steps need highlights.
interface HighlightRegion {
  left: number;   // % from left edge
  top: number;    // % from top edge
  right: number;  // % from right edge (not width — actual right edge position)
  bottom: number; // % from top edge (not height — actual bottom edge position)
}

const HIGHLIGHT_REGIONS: Record<string, HighlightRegion> = {
  // Periscope now uses CSS pulse animation on the SVG element instead of overlay cutout.
  // Add future highlight regions here if needed for other training steps.
};

// Accepts any object with a message — compatible with both TutorialStep and training display steps
interface DisplayableStep {
  message: IntercomMessage;
}

interface TutorialOverlayProps {
  activeStep: DisplayableStep | null;
  onComplete: () => void;    // Mark step completed
  onDismiss: () => void;     // Dismiss without completing
  highlightElement?: string; // Element key to highlight (from training step setup)
  messagePosition?: 'top' | 'center' | 'bottom'; // Contextual position for intercom window
  advanceType?: 'tap' | 'dismiss'; // Button mode: tap=✓ only, dismiss=✗ only
  blockInteraction?: boolean; // When true, overlay captures all touches (blocks game interaction)
  trainingProgress?: {
    phaseName: string;
    stepProgress: string;
    phaseDots: PhaseDotInfo[];
  };
}

/**
 * TutorialOverlay — sits at z-[90] in Game.tsx, above TransitionOverlay.
 *
 * Displays intercom messages when tutorial steps trigger.
 * Non-blocking: pointer-events-none on the overlay itself,
 * pointer-events-auto on the IntercomMessage only.
 *
 * When highlightElement is defined, renders a semi-transparent dark overlay
 * with a rectangular clip-path cutout so the highlighted area stays visible.
 * When no highlight, overlay remains transparent (current behavior).
 */
export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  activeStep,
  onComplete,
  onDismiss,
  highlightElement,
  messagePosition = 'center',
  advanceType,
  blockInteraction = false,
  trainingProgress,
}) => {
  // Track the step being displayed (for fade-out: keep rendering while fading)
  const [displayedStep, setDisplayedStep] = useState<DisplayableStep | null>(null);
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

  // Look up the highlight region for the current element (if any)
  const highlightRegion = highlightElement
    ? HIGHLIGHT_REGIONS[highlightElement] ?? null
    : null;

  // Build CSS clip-path polygon that creates a rectangular cutout.
  // The polygon traces the outer edge of the overlay, then cuts inward to
  // create a "hole" where the highlighted element is.
  // Winding: outer clockwise, inner counter-clockwise.
  const clipPathStyle = highlightRegion
    ? {
        clipPath: `polygon(
          0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
          ${highlightRegion.left}% ${highlightRegion.top}%,
          ${highlightRegion.left}% ${highlightRegion.bottom}%,
          ${highlightRegion.right}% ${highlightRegion.bottom}%,
          ${highlightRegion.right}% ${highlightRegion.top}%,
          ${highlightRegion.left}% ${highlightRegion.top}%
        )`,
      }
    : undefined;

  return (
    <div
      className={`absolute inset-0 z-[90] ${blockInteraction ? 'pointer-events-auto' : 'pointer-events-none'}`}
      style={{
        transition: 'opacity 150ms ease-out, background-color 150ms ease-out',
        opacity: isVisible ? 1 : 0,
        backgroundColor: blockInteraction ? 'rgba(0, 0, 0, 0.35)' : 'transparent',
      }}
    >
      {/* Highlight overlay — semi-transparent with clip-path cutout */}
      {highlightRegion && (
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            ...clipPathStyle,
            transition: 'clip-path 300ms ease-out',
          }}
        />
      )}

      {/* Intercom message — pointer-events-auto so player can interact */}
      <div className="pointer-events-auto">
        <IntercomMessageDisplay
          message={displayedStep.message}
          onDismiss={onDismiss}
          onComplete={onComplete}
          position={messagePosition}
          advanceType={advanceType}
          trainingProgress={trainingProgress}
        />
      </div>
    </div>
  );
};
