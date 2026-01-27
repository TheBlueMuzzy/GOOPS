import { useState, useEffect, useCallback, useRef } from 'react';
import { Complication, TankSystem } from '../types';
import {
  SliderPosition,
  LaserComplicationState,
  MinigameTextState,
  SliderLightColors,
} from '../types/minigames';

// Color constants for text state
const TEAL = "#14b8a6";  // Idle
const WHITE = "#ffffff"; // Active (white to contrast with red pulse)
const GREEN = "#22c55e"; // Recently fixed

// Color constants for lights
const LIGHT_OFF = "#231f20";
const LIGHT_ON = "#d8672b";

interface UseLaserMinigameParams {
  complications: Complication[];
  isLaserMaxed: boolean;
  onResolveComplication?: (id: string) => void;
}

interface UseLaserMinigameReturn {
  laserSliders: SliderPosition[];
  updateLaserSlider: (index: number, val: SliderPosition) => void;
  shakingSlider: number | null;
  getLaserLightColors: (sliderIndex: number) => SliderLightColors;
  getLaserTextState: () => MinigameTextState;
  recentlyFixed: boolean;
  isComplicationActive: boolean;
}

/**
 * Custom hook for LASER minigame state management.
 *
 * Encapsulates the slider puzzle where player must move 4 sliders
 * to match target positions indicated by lights.
 *
 * Best practices applied:
 * - Functional setState (prev =>) for stable callbacks
 * - useCallback for handlers
 * - useRef for timeout cleanup
 */
export function useLaserMinigame({
  complications,
  isLaserMaxed,
  onResolveComplication,
}: UseLaserMinigameParams): UseLaserMinigameReturn {
  // State
  const [laserComplication, setLaserComplication] = useState<LaserComplicationState>({
    active: false,
    solved: false,
    targets: [0, 0, 0, 0] as SliderPosition[],
  });
  const [laserSliders, setLaserSliders] = useState<SliderPosition[]>([0, 0, 0, 0]);
  const [shakingSlider, setShakingSlider] = useState<number | null>(null);
  const [recentlyFixed, setRecentlyFixed] = useState(false);

  // Track previous complications to detect when LASER is removed
  const prevComplicationsRef = useRef<Complication[]>([]);

  // Timeout refs for cleanup
  const shakeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fixedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper to check if LASER complication is active
  const hasActiveLaser = useCallback(() => {
    return complications.some(c => c.type === TankSystem.LASER);
  }, [complications]);

  // Detect when LASER is removed and mark as "recently fixed"
  useEffect(() => {
    const prevHadLaser = prevComplicationsRef.current.some(
      c => c.type === TankSystem.LASER
    );
    const currentHasLaser = hasActiveLaser();

    if (prevHadLaser && !currentHasLaser) {
      // LASER was just fixed
      setRecentlyFixed(true);
      // Clear after 2.5 seconds
      fixedTimeoutRef.current = setTimeout(() => {
        setRecentlyFixed(false);
      }, 2500);
    }

    prevComplicationsRef.current = complications;
  }, [complications, hasActiveLaser]);

  // Initialize/reset minigame based on complication state
  useEffect(() => {
    // Reset if no complication but minigame was active/solved
    if (!hasActiveLaser() && (laserComplication.active || laserComplication.solved)) {
      setLaserComplication({ active: false, solved: false, targets: [0, 0, 0, 0] });
      setLaserSliders([0, 0, 0, 0]);
    }

    // Initialize if complication exists but minigame not active
    if (hasActiveLaser() && !laserComplication.active && !laserComplication.solved) {
      // Generate random targets
      // Max-level effect: no center targets (only -1 or 1)
      const allPositions: SliderPosition[] = isLaserMaxed ? [-1, 1] : [-1, 0, 1];
      const targets = [0, 1, 2, 3].map(() => {
        return allPositions[Math.floor(Math.random() * allPositions.length)];
      }) as SliderPosition[];

      // Set sliders to wrong positions (one of the two that ISN'T the target)
      const wrongPositions = targets.map(target => {
        const options = allPositions.filter(v => v !== target);
        return options[Math.floor(Math.random() * options.length)];
      }) as SliderPosition[];

      setLaserSliders(wrongPositions);
      setLaserComplication({
        active: true,
        solved: false,
        targets: targets,
      });
    }
  }, [complications, laserComplication.active, laserComplication.solved, isLaserMaxed, hasActiveLaser]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (shakeTimeoutRef.current) clearTimeout(shakeTimeoutRef.current);
      if (fixedTimeoutRef.current) clearTimeout(fixedTimeoutRef.current);
    };
  }, []);

  /**
   * Update a slider position and check for solve condition.
   * Uses functional setState for stable callback reference.
   */
  const updateLaserSlider = useCallback((index: number, val: SliderPosition) => {
    setLaserSliders(prev => {
      const next = [...prev];
      next[index] = val;

      // Check if this slider matches its target
      const laserComp = complications.find(c => c.type === TankSystem.LASER);

      if (laserComp) {
        // We need to check against current laserComplication state
        // Since we can't access state directly in functional update, we use a ref pattern
        // But for simplicity, we'll handle solve check in a separate effect or closure
        return next;
      }

      return next;
    });

    // Handle solve check and shake in a separate closure
    // This is safe because we're reading complications prop, not state
    const laserComp = complications.find(c => c.type === TankSystem.LASER);
    if (laserComp && !laserComplication.solved) {
      const target = laserComplication.targets[index];
      if (val !== target) {
        // Wrong position - trigger shake
        setShakingSlider(index);
        if (shakeTimeoutRef.current) clearTimeout(shakeTimeoutRef.current);
        shakeTimeoutRef.current = setTimeout(() => setShakingSlider(null), 300);
      } else {
        // Check if all sliders now match their targets
        // We need to compute what the new array would be
        const newSliders = [...laserSliders];
        newSliders[index] = val;
        const allMatch = newSliders.every((sliderVal, i) => sliderVal === laserComplication.targets[i]);

        if (allMatch) {
          // Mark minigame as solved
          setLaserComplication(prev => ({ ...prev, solved: true }));
          // Reset sliders to center
          setLaserSliders([0, 0, 0, 0]);
          // Resolve the complication in GameState
          if (onResolveComplication) {
            onResolveComplication(laserComp.id);
          }
        }
      }
    }
  }, [complications, laserComplication.solved, laserComplication.targets, laserSliders, onResolveComplication]);

  /**
   * Get indicator light colors for a slider.
   * Returns which lights should be on based on the target position.
   */
  const getLaserLightColors = useCallback((sliderIndex: number): SliderLightColors => {
    // Only show lights if there's a real LASER complication
    if (!hasActiveLaser()) {
      return { left: LIGHT_OFF, right: LIGHT_OFF };
    }

    const target = laserComplication.targets[sliderIndex];
    if (target === -1) {
      return { left: LIGHT_ON, right: LIGHT_OFF }; // Target is left
    } else if (target === 1) {
      return { left: LIGHT_OFF, right: LIGHT_ON }; // Target is right
    } else {
      return { left: LIGHT_ON, right: LIGHT_ON }; // Target is center (both lights on)
    }
  }, [hasActiveLaser, laserComplication.targets]);

  /**
   * Get text state for "RESET LASER" display.
   * Shows different colors based on complication state.
   */
  const getLaserTextState = useCallback((): MinigameTextState => {
    if (hasActiveLaser()) {
      return { text: "RESET LASER", color: WHITE };
    }
    if (recentlyFixed) {
      return { text: "LASER FIXED", color: GREEN };
    }
    return { text: "RESET LASER", color: TEAL };
  }, [hasActiveLaser, recentlyFixed]);

  return {
    laserSliders,
    updateLaserSlider,
    shakingSlider,
    getLaserLightColors,
    getLaserTextState,
    recentlyFixed,
    isComplicationActive: hasActiveLaser(),
  };
}
