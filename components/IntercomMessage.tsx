
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { IntercomMessage as IntercomMessageType } from '../types/tutorial';
import { IntercomText } from './IntercomText';
import './IntercomMessage.css';

interface IntercomMessageProps {
  message: IntercomMessageType;
  onDismiss: () => void;
  onComplete: () => void;
  position?: 'top' | 'center' | 'bottom';
  className?: string;
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
      style={{ maxWidth: 280, width: '85%' }}
      onClick={handleSkip}
      onTouchStart={handleSkip}
    >
      {/* Main container — maintenance order style */}
      <div className="bg-slate-900/95 border border-slate-700 rounded-sm shadow-lg shadow-black/50 overflow-hidden">

        {/* Header bar */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-800 bg-slate-950/60">
          <span className="text-xs text-slate-500 uppercase tracking-widest font-mono">
            Intercom
          </span>
          {/* Blinking transmission indicator */}
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 intercom-blink" />
        </div>

        {/* Message body */}
        <div className="px-3 py-2.5 text-sm text-slate-300">
          <IntercomText
            fullText={message.fullText}
            keywords={message.keywords}
            visibleChars={visibleChars}
          />
        </div>

        {/* Action buttons — only show when fully revealed */}
        {isFullyRevealed && (
          <div className="flex justify-end gap-2 px-3 py-2 border-t border-slate-800">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              className="px-2 py-0.5 text-xs font-mono text-slate-500 hover:text-slate-300 border border-slate-700 rounded-sm transition-colors"
            >
              ✗
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onComplete();
              }}
              className="px-2 py-0.5 text-xs font-mono text-green-400 hover:text-green-300 border border-green-900 hover:border-green-700 rounded-sm transition-colors"
            >
              ✓
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
