import { useState, useEffect, useCallback, useRef } from 'react';
import { Complication, ComplicationType } from '../types';
import {
  SliderPosition,
  LightsPhase,
  LightsButtonIndex,
  LightsComplicationState,
  MinigameTextState,
  SliderLightColors,
  LIGHTS_BUTTON_COLORS,
} from '../types/minigames';

// Color constants for text state
const TEAL = "#14b8a6";  // Idle
const RED = "#ef4444";   // Active
const GREEN = "#22c55e"; // Recently fixed

// Color constants for lights
const LIGHT_OFF = "#231f20";
const LIGHT_ON = "#d8672b";

interface UseLightsMinigameParams {
  complications: Complication[];
  isLightsMaxed: boolean;
  pressedBtn: string | null;
  onResolveComplication?: (id: string) => void;
}

interface UseLightsMinigameReturn {
  lightsComplication: LightsComplicationState;
  lightSlider: SliderPosition;
  handleLightsButton: (buttonIndex: LightsButtonIndex) => void;
  handleLightsSliderChange: (newValue: SliderPosition) => void;
  lightsSliderShaking: boolean;
  getLightsButtonLightColor: (lightIndex: LightsButtonIndex) => string;
  getLightsSliderLightColors: () => { top: string; bottom: string };
  getLightsTextState: () => MinigameTextState;
  recentlyFixed: boolean;
}

/**
 * Custom hook for LIGHTS minigame state management.
 *
 * Encapsulates the sequence memory puzzle where player must:
 * 1. Move slider to match lit indicator
 * 2. Watch a 3-4 button sequence flash
 * 3. Repeat the sequence by pressing buttons
 * 4. Move slider to opposite position
 *
 * Best practices applied:
 * - Functional setState (prev =>) for stable callbacks
 * - useCallback for handlers
 * - useRef for timeout cleanup
 */
export function useLightsMinigame({
  complications,
  isLightsMaxed,
  pressedBtn,
  onResolveComplication,
}: UseLightsMinigameParams): UseLightsMinigameReturn {
  // State
  const [lightsComplication, setLightsComplication] = useState<LightsComplicationState>({
    phase: 'inactive',
    slider1Target: 1,
    sequence: [],
    inputIndex: 0,
    showingIndex: -1,
  });
  const [lightSlider, setLightSlider] = useState<SliderPosition>(0);
  const [lightsSliderShaking, setLightsSliderShaking] = useState(false);
  const [recentlyFixed, setRecentlyFixed] = useState(false);

  // Track previous complications to detect when LIGHTS is removed
  const prevComplicationsRef = useRef<Complication[]>([]);

  // Timeout refs for cleanup
  const shakeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fixedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sequenceTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Helper to check if LIGHTS complication is active
  const hasActiveLights = useCallback(() => {
    return complications.some(c => c.type === ComplicationType.LIGHTS);
  }, [complications]);

  // Generate button sequence with max 2 of any single button
  // Max-level effect: 3-button sequence instead of 4
  const generateLightsSequence = useCallback((): LightsButtonIndex[] => {
    const sequence: LightsButtonIndex[] = [];
    const counts = [0, 0, 0]; // Track how many times each button is used
    const sequenceLength = isLightsMaxed ? 3 : 4;

    for (let i = 0; i < sequenceLength; i++) {
      // Get available buttons (those used less than 2 times)
      const available: LightsButtonIndex[] = [];
      if (counts[0] < 2) available.push(0);
      if (counts[1] < 2) available.push(1);
      if (counts[2] < 2) available.push(2);

      const choice = available[Math.floor(Math.random() * available.length)];
      sequence.push(choice);
      counts[choice]++;
    }

    return sequence;
  }, [isLightsMaxed]);

  // Start showing the sequence with timed light flashes
  const startShowingSequence = useCallback((sequence: LightsButtonIndex[]) => {
    const FLASH_DURATION = 400; // ms each light stays on
    const GAP_DURATION = 200;   // ms between flashes
    const BEAT_DURATION = 500;  // ms pause after sequence before input

    // Clear any existing sequence timeouts
    sequenceTimeoutsRef.current.forEach(t => clearTimeout(t));
    sequenceTimeoutsRef.current = [];

    let delay = 300; // Initial delay before starting

    sequence.forEach((buttonIndex) => {
      // Turn on this light
      const onTimeout = setTimeout(() => {
        setLightsComplication(prev => ({ ...prev, showingIndex: buttonIndex }));
      }, delay);
      sequenceTimeoutsRef.current.push(onTimeout);

      // Turn off this light
      const offTimeout = setTimeout(() => {
        setLightsComplication(prev => ({ ...prev, showingIndex: -1 }));
      }, delay + FLASH_DURATION);
      sequenceTimeoutsRef.current.push(offTimeout);

      delay += FLASH_DURATION + GAP_DURATION;
    });

    // After sequence complete + 1 beat, transition to input phase
    const inputTimeout = setTimeout(() => {
      setLightsComplication(prev => ({
        ...prev,
        phase: 'input',
        showingIndex: -1,
        inputIndex: 0
      }));
    }, delay + BEAT_DURATION);
    sequenceTimeoutsRef.current.push(inputTimeout);
  }, []);

  // Detect when LIGHTS is removed and mark as "recently fixed"
  useEffect(() => {
    const prevHadLights = prevComplicationsRef.current.some(
      c => c.type === ComplicationType.LIGHTS
    );
    const currentHasLights = hasActiveLights();

    if (prevHadLights && !currentHasLights) {
      // LIGHTS was just fixed
      setRecentlyFixed(true);
      // Clear after 2.5 seconds
      fixedTimeoutRef.current = setTimeout(() => {
        setRecentlyFixed(false);
      }, 2500);
    }

    prevComplicationsRef.current = complications;
  }, [complications, hasActiveLights]);

  // Initialize/reset minigame based on complication state
  useEffect(() => {
    // Reset if no complication but minigame was active
    if (!hasActiveLights() && lightsComplication.phase !== 'inactive') {
      setLightsComplication({
        phase: 'inactive',
        slider1Target: 1,
        sequence: [],
        inputIndex: 0,
        showingIndex: -1,
      });
      setLightSlider(0);
    }

    // Initialize if complication exists but minigame inactive
    if (hasActiveLights() && lightsComplication.phase === 'inactive') {
      const newSequence = generateLightsSequence();
      setLightsComplication({
        phase: 'slider1',
        slider1Target: Math.random() > 0.5 ? 1 : -1,
        sequence: newSequence,
        inputIndex: 0,
        showingIndex: -1,
      });
      setLightSlider(0);
    }
  }, [complications, lightsComplication.phase, hasActiveLights, generateLightsSequence]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (shakeTimeoutRef.current) clearTimeout(shakeTimeoutRef.current);
      if (fixedTimeoutRef.current) clearTimeout(fixedTimeoutRef.current);
      sequenceTimeoutsRef.current.forEach(t => clearTimeout(t));
    };
  }, []);

  /**
   * Handle button press during input phase.
   * Checks if pressed button matches expected sequence button.
   */
  const handleLightsButton = useCallback((buttonIndex: LightsButtonIndex) => {
    if (lightsComplication.phase !== 'input') return;

    const expectedButton = lightsComplication.sequence[lightsComplication.inputIndex];

    if (buttonIndex === expectedButton) {
      // Correct!
      const newInputIndex = lightsComplication.inputIndex + 1;

      if (newInputIndex >= lightsComplication.sequence.length) {
        // Sequence complete - move to slider2
        setLightsComplication(prev => ({
          ...prev,
          phase: 'slider2',
          inputIndex: 0
        }));
      } else {
        // Continue sequence
        setLightsComplication(prev => ({
          ...prev,
          inputIndex: newInputIndex
        }));
      }
    } else {
      // Wrong! Replay sequence
      setLightsComplication(prev => ({
        ...prev,
        phase: 'showing',
        inputIndex: 0,
        showingIndex: -1
      }));
      // Start showing after a brief pause
      const replayTimeout = setTimeout(() => {
        startShowingSequence(lightsComplication.sequence);
      }, 300);
      sequenceTimeoutsRef.current.push(replayTimeout);
    }
  }, [lightsComplication.phase, lightsComplication.sequence, lightsComplication.inputIndex, startShowingSequence]);

  /**
   * Handle light slider changes.
   * Different behavior based on phase:
   * - slider1: must match target to proceed
   * - slider2: must match opposite of slider1 target to solve
   */
  const handleLightsSliderChange = useCallback((newValue: SliderPosition) => {
    const { phase, slider1Target, sequence } = lightsComplication;

    if (phase === 'slider1') {
      if (newValue === slider1Target) {
        // Correct! Move to showing phase
        setLightSlider(newValue);
        setLightsComplication(prev => ({ ...prev, phase: 'showing' }));
        startShowingSequence(sequence);
      } else if (newValue !== 0) {
        // Wrong direction - shake and return to center
        setLightsSliderShaking(true);
        if (shakeTimeoutRef.current) clearTimeout(shakeTimeoutRef.current);
        shakeTimeoutRef.current = setTimeout(() => {
          setLightsSliderShaking(false);
          setLightSlider(0);
        }, 400);
      } else {
        setLightSlider(newValue);
      }
    } else if (phase === 'slider2') {
      const slider2Target = slider1Target === 1 ? -1 : 1; // Opposite of first
      setLightSlider(newValue);
      if (newValue === slider2Target) {
        // Solved!
        setLightsComplication(prev => ({ ...prev, phase: 'solved' }));
        // Reset slider to center
        setLightSlider(0);
        // Resolve the complication in GameState
        const lightsComp = complications.find(c => c.type === ComplicationType.LIGHTS);
        if (lightsComp && onResolveComplication) {
          onResolveComplication(lightsComp.id);
        }
      }
      // No shake for slider2 - just need to reach the target
    } else {
      // Other phases - just update slider visually
      setLightSlider(newValue);
    }
  }, [complications, lightsComplication, onResolveComplication, startShowingSequence]);

  /**
   * Get button indicator light color.
   * During 'showing' phase: flash in button color when it's that button's turn
   * During 'input' phase: light up when player is pressing that button
   */
  const getLightsButtonLightColor = useCallback((lightIndex: LightsButtonIndex): string => {
    // Only show lights if there's a real LIGHTS complication
    if (!hasActiveLights()) return LIGHT_OFF;
    if (lightsComplication.phase === 'inactive') return LIGHT_OFF;

    // During showing phase, light up when this button is being shown
    if (lightsComplication.phase === 'showing' && lightsComplication.showingIndex === lightIndex) {
      return LIGHTS_BUTTON_COLORS[lightIndex];
    }

    // During input phase, light up when player is pressing this button
    if (lightsComplication.phase === 'input') {
      const buttonNames = ['blue', 'green', 'purple'];
      if (pressedBtn === buttonNames[lightIndex]) {
        return LIGHTS_BUTTON_COLORS[lightIndex];
      }
    }

    return LIGHT_OFF;
  }, [hasActiveLights, lightsComplication.phase, lightsComplication.showingIndex, pressedBtn]);

  /**
   * Get slider indicator light colors.
   * Shows which direction the slider needs to be moved.
   */
  const getLightsSliderLightColors = useCallback((): { top: string; bottom: string } => {
    const { phase, slider1Target } = lightsComplication;

    // Only show lights if there's a real LIGHTS complication
    if (!hasActiveLights()) {
      return { top: LIGHT_OFF, bottom: LIGHT_OFF };
    }

    if (phase === 'inactive') {
      return { top: LIGHT_OFF, bottom: LIGHT_OFF };
    }

    if (phase === 'slider1') {
      // Show first target (slider rotated 90°: value 1 = bottom, value -1 = top)
      return slider1Target === 1 ? { top: LIGHT_OFF, bottom: LIGHT_ON } : { top: LIGHT_ON, bottom: LIGHT_OFF };
    }

    if (phase === 'slider2') {
      // Show opposite of first target
      return slider1Target === 1 ? { top: LIGHT_ON, bottom: LIGHT_OFF } : { top: LIGHT_OFF, bottom: LIGHT_ON };
    }

    // During showing/input phases, no slider lights
    return { top: LIGHT_OFF, bottom: LIGHT_OFF };
  }, [hasActiveLights, lightsComplication]);

  /**
   * Get text state for "RESET LIGHTS" display.
   * Shows different colors based on complication state.
   */
  const getLightsTextState = useCallback((): MinigameTextState => {
    if (hasActiveLights()) {
      return { text: "RESET LIGHTS", color: RED };
    }
    if (recentlyFixed) {
      return { text: "LIGHTS FIXED", color: GREEN };
    }
    return { text: "RESET LIGHTS", color: TEAL };
  }, [hasActiveLights, recentlyFixed]);

  return {
    lightsComplication,
    lightSlider,
    handleLightsButton,
    handleLightsSliderChange,
    lightsSliderShaking,
    getLightsButtonLightColor,
    getLightsSliderLightColors,
    getLightsTextState,
    recentlyFixed,
  };
}
