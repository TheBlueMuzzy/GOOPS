
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { IntercomMessage as IntercomMessageType } from '../types/tutorial';
import { IntercomText } from './IntercomText';
import './IntercomMessage.css';

// Phase dot status for training progress display
export interface PhaseDotInfo {
  phase: string;
  status: 'complete' | 'current' | 'upcoming';
}

interface IntercomMessageProps {
  message: IntercomMessageType;
  onDismiss: () => void;
  onComplete: () => void;
  position?: 'top' | 'center' | 'bottom';
  className?: string;
  // Training progress (optional — only shown during rank 0 training)
  trainingProgress?: {
    phaseName: string;       // e.g. "Phase B: Goop Basics"
    stepProgress: string;    // e.g. "Step 4 of 17"
    phaseDots: PhaseDotInfo[];
  };
}

/** Characters revealed per tick during typewriter effect */
const CHARS_PER_TICK = 1;
/** Milliseconds between each typewriter tick */
const TICK_MS = 35;

export const IntercomMessageDisplay: React.FC<IntercomMessageProps> = ({
  message,
  onDismiss,
  onComplete,
  position = 'top',
  className = '',
  trainingProgress,
}) => {
  const [visibleChars, setVisibleChars] = useState(0);
  const [isFullyRevealed, setIsFullyRevealed] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const totalChars = message.fullText.length;

  // Start typewriter on mount
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setVisibleChars(prev => {
        const next = prev + CHARS_PER_TICK;
        if (next >= totalChars) {
          // Done typing
          if (intervalRef.current) clearInterval(intervalRef.current);
          return totalChars;
        }
        return next;
      });
    }, TICK_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [totalChars]);

  // Detect fully revealed
  useEffect(() => {
    if (visibleChars >= totalChars) {
      setIsFullyRevealed(true);
    }
  }, [visibleChars, totalChars]);

  // Skip typewriter on tap/click
  const handleSkip = useCallback(() => {
    if (!isFullyRevealed) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setVisibleChars(totalChars);
      setIsFullyRevealed(true);
    }
  }, [isFullyRevealed, totalChars]);

  // Position classes
  const positionClasses = {
    top: 'top-8 left-1/2 -translate-x-1/2',
    center: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
    bottom: 'bottom-8 left-1/2 -translate-x-1/2',
  };

  return (
    <div
      className={`absolute ${positionClasses[position]} z-[90] intercom-enter ${className}`}
      style={{ maxWidth: 420, width: '90%' }}
      onClick={handleSkip}
      onTouchStart={handleSkip}
    >
      {/* Main container — maintenance order style */}
      <div className="bg-slate-900/95 border border-slate-700 rounded-sm shadow-lg shadow-black/50 overflow-hidden">

        {/* Header bar */}
        <div className="px-3 py-1.5 border-b border-slate-800 bg-slate-950/60">
          {trainingProgress ? (
            <>
              {/* Training mode header: phase name + step count */}
              <div className="flex items-center justify-between">
                <span className="t-caption text-slate-400 leading-tight truncate">
                  {trainingProgress.phaseName}
                </span>
                <span className="t-caption text-slate-500 leading-tight flex-shrink-0 ml-2">
                  {trainingProgress.stepProgress}
                </span>
              </div>
              {/* Phase dots row */}
              <div className="flex items-center justify-center gap-1.5 mt-1">
                {trainingProgress.phaseDots.map(dot => (
                  <span
                    key={dot.phase}
                    className={`intercom-phase-dot intercom-phase-dot--${dot.status}`}
                    title={`Phase ${dot.phase}`}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between">
              <span className="t-body text-slate-500 uppercase tracking-widest font-mono">
                Intercom
              </span>
              {/* Blinking transmission indicator */}
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 intercom-blink" />
            </div>
          )}
        </div>

        {/* Message body */}
        <div className="px-3 py-2.5 t-display text-slate-300">
          <IntercomText
            fullText={message.fullText}
            keywords={message.keywords}
            visibleChars={visibleChars}
          />
        </div>

        {/* Action buttons — only show when fully revealed */}
        {isFullyRevealed && (
          <div className="flex justify-end gap-3 px-3 py-3 border-t border-slate-800">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              className="w-12 h-12 flex items-center justify-center t-heading font-mono text-slate-500 hover:text-slate-300 border border-slate-700 rounded-sm transition-colors"
            >
              ✗
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onComplete();
              }}
              className="w-12 h-12 flex items-center justify-center t-heading font-mono text-green-400 hover:text-green-300 border border-green-900 hover:border-green-700 rounded-sm transition-colors"
            >
              ✓
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
