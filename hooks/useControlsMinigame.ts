import { useState, useEffect, useCallback, useRef } from 'react';
import { Complication, TankSystem } from '../types';
import {
  CornerIndex,
  ControlsComplicationState,
  MinigameTextState,
  CORNER_ANGLES,
  DIAL_SNAP_POSITIONS,
} from '../types/minigames';

// Color constants for text state
const TEAL = "#14b8a6";  // Idle
const WHITE = "#ffffff"; // Active (white to contrast with red pulse)
const GREEN = "#22c55e"; // Recently fixed

// Color constants for lights
const LIGHT_OFF = "#231f20";
const LIGHT_ON = "#d8672b";

// Dial coordinate constants (in SVG space)
const DIAL_CENTER_X = 194.32;
const DIAL_CENTER_Y = 1586.66;
const DIAL_RADIUS = 86.84;
// Touch zone: allow touches from 40% of radius out to 130% (extra padding for finger imprecision)
const DIAL_TOUCH_OUTER = DIAL_RADIUS * 1.3; // ~113 - padding beyond visual edge

interface UseControlsMinigameParams {
  complications: Complication[];
  isControlsMaxed: boolean;
  onResolveComplication?: (id: string) => void;
}

interface UseControlsMinigameReturn {
  localDialRotation: number;
  isDialDragging: boolean;
  dialShaking: boolean;
  dialPressed: boolean;
  handleDialStart: (clientX: number, clientY: number) => void;
  handleDialMove: (clientX: number, clientY: number) => void;
  handleDialEnd: () => void;
  handleDialPress: () => void;
  getControlsCornerLightColor: (cornerIndex: CornerIndex) => string;
  getControlsTextState: () => MinigameTextState;
  recentlyFixed: boolean;
  isDialAligned: () => boolean;
  isComplicationActive: boolean;
}

/**
 * Custom hook for CONTROLS minigame state management.
 *
 * Encapsulates the dial alignment puzzle where player must:
 * 1. Drag dial to rotate it to the lit corner
 * 2. Tap/click dial when aligned
 * 3. Repeat 3-4 times to solve
 *
 * Best practices applied:
 * - Functional setState (prev =>) for stable callbacks
 * - useCallback for handlers
 * - useRef for drag state (avoids stale closure issues)
 * - useRef for timeout cleanup
 */
export function useControlsMinigame({
  complications,
  isControlsMaxed,
  onResolveComplication,
}: UseControlsMinigameParams): UseControlsMinigameReturn {
  // State
  const [controlsComplication, setControlsComplication] = useState<ControlsComplicationState>({
    active: false,
    solved: false,
    targetCorner: null,
    completedCorners: 0,
  });
  const [localDialRotation, setLocalDialRotation] = useState(0);
  const [isDialDragging, setIsDialDragging] = useState(false);
  const [dialShaking, setDialShaking] = useState(false);
  const [dialPressed, setDialPressed] = useState(false);
  const [recentlyFixed, setRecentlyFixed] = useState(false);

  // Track previous complications to detect when CONTROLS is removed
  const prevComplicationsRef = useRef<Complication[]>([]);

  // Timeout refs for cleanup
  const shakeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fixedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragBlockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drag refs - avoid stale closure issues in event handlers
  const isDraggingRef = useRef(false);
  const grabAngleRef = useRef(0);      // Angle of initial grab point from center
  const rotationAtGrabRef = useRef(0); // Dial rotation when grab started
  const currentRotationRef = useRef(0); // Current rotation (ref version for snap calculation)
  const hasMovedRef = useRef(false);    // Track if dial actually moved during drag
  const justFinishedDraggingRef = useRef(false); // Block click after drag ends

  // Helper to check if CONTROLS complication is active
  const hasActiveControls = useCallback(() => {
    return complications.some(c => c.type === TankSystem.CONTROLS);
  }, [complications]);

  /**
   * Convert screen coordinates to SVG coordinates.
   * Uses a NON-ROTATING reference element for clean CTM.
   */
  const screenToSvg = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    try {
      // Use the hidden reference point that doesn't rotate
      const refPoint = document.getElementById('coord-reference') as SVGCircleElement | null;
      if (!refPoint) return null;

      const svg = refPoint.ownerSVGElement;
      if (!svg) return null;

      const point = svg.createSVGPoint();
      point.x = clientX;
      point.y = clientY;

      const ctm = refPoint.getScreenCTM();
      if (!ctm) return null;

      const svgPoint = point.matrixTransform(ctm.inverse());
      return { x: svgPoint.x, y: svgPoint.y };
    } catch {
      return null;
    }
  }, []);

  // Detect when CONTROLS is removed and mark as "recently fixed"
  useEffect(() => {
    const prevHadControls = prevComplicationsRef.current.some(
      c => c.type === TankSystem.CONTROLS
    );
    const currentHasControls = hasActiveControls();

    if (prevHadControls && !currentHasControls) {
      // CONTROLS was just fixed
      setRecentlyFixed(true);
      // Clear after 2.5 seconds
      fixedTimeoutRef.current = setTimeout(() => {
        setRecentlyFixed(false);
      }, 2500);
    }

    prevComplicationsRef.current = complications;
  }, [complications, hasActiveControls]);

  // Initialize/reset minigame based on complication state
  useEffect(() => {
    // Reset if no complication but minigame was active/solved
    if (!hasActiveControls() && (controlsComplication.active || controlsComplication.solved)) {
      setControlsComplication({
        active: false,
        solved: false,
        targetCorner: null,
        completedCorners: 0,
      });
    }

    // Initialize if complication exists but minigame not active
    if (hasActiveControls() && !controlsComplication.active && !controlsComplication.solved) {
      // Pick a random starting corner INDEX (0-3), not the angle value
      const randomCornerIndex = Math.floor(Math.random() * 4) as CornerIndex;
      setControlsComplication({
        active: true,
        solved: false,
        targetCorner: randomCornerIndex,
        completedCorners: 0,
      });
    }
  }, [complications, controlsComplication.active, controlsComplication.solved, hasActiveControls]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (shakeTimeoutRef.current) clearTimeout(shakeTimeoutRef.current);
      if (fixedTimeoutRef.current) clearTimeout(fixedTimeoutRef.current);
      if (pressedTimeoutRef.current) clearTimeout(pressedTimeoutRef.current);
      if (dragBlockTimeoutRef.current) clearTimeout(dragBlockTimeoutRef.current);
    };
  }, []);

  /**
   * Handle dial drag start.
   * Converts touch/mouse coordinates to SVG space and validates touch zone.
   */
  const handleDialStart = useCallback((clientX: number, clientY: number) => {
    // Convert touch to SVG coordinates (fixes aspect ratio distortion!)
    const touchSvg = screenToSvg(clientX, clientY);
    if (!touchSvg) return;

    // Calculate distance and angle in SVG space
    const dx = touchSvg.x - DIAL_CENTER_X;
    const dy = touchSvg.y - DIAL_CENTER_Y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Check touch zone in SVG space
    if (distance > DIAL_TOUCH_OUTER) return;

    // Store grab angle (in SVG coordinates) and current rotation
    grabAngleRef.current = Math.atan2(dy, dx) * (180 / Math.PI);
    rotationAtGrabRef.current = localDialRotation;
    isDraggingRef.current = true;
    hasMovedRef.current = false; // Reset movement tracking
    setIsDialDragging(true);
  }, [localDialRotation, screenToSvg]);

  /**
   * Handle dial drag move.
   * Vector approach: rotate dial so line from center through grab point aims at cursor.
   */
  const handleDialMove = useCallback((clientX: number, clientY: number) => {
    if (!isDraggingRef.current) return;

    // Convert to SVG coordinates (fixes aspect ratio!)
    const cursorSvg = screenToSvg(clientX, clientY);
    if (!cursorSvg) return;

    const dx = cursorSvg.x - DIAL_CENTER_X;
    const dy = cursorSvg.y - DIAL_CENTER_Y;

    // Current cursor angle from center (in SVG space)
    const cursorAngle = Math.atan2(dy, dx) * (180 / Math.PI);

    // Vector approach: rotate dial so grab point aims at cursor
    // newRotation = cursorAngle - grabAngle + rotationAtGrab
    const newRotation = cursorAngle - grabAngleRef.current + rotationAtGrabRef.current;
    currentRotationRef.current = newRotation; // Keep ref in sync for snap calculation
    hasMovedRef.current = true; // Mark that we actually dragged
    setLocalDialRotation(newRotation);
  }, [screenToSvg]);

  /**
   * Handle dial drag end.
   * Snaps to nearest corner position (45°, 135°, 225°, 315°).
   */
  const handleDialEnd = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDialDragging(false);

    // If there was actual movement, block the subsequent click event
    if (hasMovedRef.current) {
      justFinishedDraggingRef.current = true;
      if (dragBlockTimeoutRef.current) clearTimeout(dragBlockTimeoutRef.current);
      dragBlockTimeoutRef.current = setTimeout(() => {
        justFinishedDraggingRef.current = false;
      }, 100);
    }

    // Only snap if there was actual movement (not a simple tap)
    if (!hasMovedRef.current) return;

    // Use ref value (not state) to avoid stale closure issues
    const currentRotation = currentRotationRef.current;

    // Snap to nearest corner position (45°, 135°, 225°, 315°)
    // Must find the snap angle that's closest to current rotation to avoid
    // the CSS transition animating the "long way around"

    // Normalize to find which base snap position we're closest to
    let normalized = currentRotation % 360;
    if (normalized < 0) normalized += 360;

    // Find closest snap position in 0-360 space
    let closestBaseSnap = DIAL_SNAP_POSITIONS[0];
    let minDiff = Infinity;

    for (const snap of DIAL_SNAP_POSITIONS) {
      const diff = Math.min(
        Math.abs(normalized - snap),
        Math.abs(normalized - snap + 360),
        Math.abs(normalized - snap - 360)
      );
      if (diff < minDiff) {
        minDiff = diff;
        closestBaseSnap = snap;
      }
    }

    // Now find the equivalent of closestBaseSnap that's actually closest
    // to the current rotation (handles multi-revolution rotations)
    const base = Math.floor(currentRotation / 360) * 360;
    const candidates = [
      base + closestBaseSnap - 360,
      base + closestBaseSnap,
      base + closestBaseSnap + 360
    ];

    let finalSnap = candidates[0];
    let minFinalDiff = Math.abs(currentRotation - candidates[0]);
    for (const c of candidates) {
      const diff = Math.abs(currentRotation - c);
      if (diff < minFinalDiff) {
        minFinalDiff = diff;
        finalSnap = c;
      }
    }

    currentRotationRef.current = finalSnap; // Keep ref in sync
    setLocalDialRotation(finalSnap);
  }, []);

  // Global event listeners for dial drag
  useEffect(() => {
    if (!isDialDragging) return;

    const onMouseMove = (e: MouseEvent) => {
      handleDialMove(e.clientX, e.clientY);
    };
    const onMouseUp = () => {
      handleDialEnd();
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleDialMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const onTouchEnd = () => {
      handleDialEnd();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [isDialDragging, handleDialMove, handleDialEnd]);

  /**
   * Check if dial is aligned with target corner.
   * Uses 15° tolerance for alignment.
   */
  const isDialAligned = useCallback((): boolean => {
    if (controlsComplication.targetCorner === null) return false;

    const targetAngle = CORNER_ANGLES[controlsComplication.targetCorner];
    const currentAngle = ((localDialRotation % 360) + 360) % 360;
    const diff = Math.abs(currentAngle - targetAngle);
    const normalizedDiff = Math.min(diff, 360 - diff);

    return normalizedDiff < 15; // 15° tolerance
  }, [controlsComplication.targetCorner, localDialRotation]);

  /**
   * Trigger dial shake animation.
   */
  const triggerDialShake = useCallback(() => {
    setDialShaking(true);
    if (shakeTimeoutRef.current) clearTimeout(shakeTimeoutRef.current);
    shakeTimeoutRef.current = setTimeout(() => setDialShaking(false), 300);
  }, []);

  /**
   * Handle dial press during controls complication.
   * Checks alignment and advances to next corner or solves.
   */
  const handleDialPress = useCallback(() => {
    if (!hasActiveControls() || controlsComplication.solved) return;
    if (isDialDragging) return; // Don't trigger on drag end
    if (justFinishedDraggingRef.current) return; // Block click after drag

    // Visual feedback
    setDialPressed(true);
    if (pressedTimeoutRef.current) clearTimeout(pressedTimeoutRef.current);
    pressedTimeoutRef.current = setTimeout(() => setDialPressed(false), 150);

    if (isDialAligned()) {
      // Success - advance to next corner
      const newCompleted = controlsComplication.completedCorners + 1;

      // Max-level effect: 3 alignments instead of 4
      const requiredAlignments = isControlsMaxed ? 3 : 4;
      if (newCompleted >= requiredAlignments) {
        // Solved!
        setControlsComplication(prev => ({
          ...prev,
          solved: true,
          targetCorner: null,
          completedCorners: 4
        }));
        // Resolve the complication in GameState
        const controlsComp = complications.find(c => c.type === TankSystem.CONTROLS);
        if (controlsComp && onResolveComplication) {
          onResolveComplication(controlsComp.id);
        }
      } else {
        // Pick next random corner (not same as current)
        const availableCorners = ([0, 1, 2, 3] as const).filter(
          c => c !== controlsComplication.targetCorner
        );
        const nextCorner = availableCorners[
          Math.floor(Math.random() * availableCorners.length)
        ] as CornerIndex;

        setControlsComplication(prev => ({
          ...prev,
          targetCorner: nextCorner,
          completedCorners: newCompleted
        }));
      }
    } else {
      // Wrong - shake the dial
      triggerDialShake();
    }
  }, [
    hasActiveControls,
    controlsComplication.solved,
    controlsComplication.completedCorners,
    controlsComplication.targetCorner,
    isDialDragging,
    isDialAligned,
    isControlsMaxed,
    complications,
    onResolveComplication,
    triggerDialShake
  ]);

  /**
   * Get corner light color.
   * Shows which corner the dial should be aligned to.
   */
  const getControlsCornerLightColor = useCallback((cornerIndex: CornerIndex): string => {
    // Only show lights if there's a real CONTROLS complication
    if (!hasActiveControls()) return LIGHT_OFF;
    if (controlsComplication.solved) return LIGHT_OFF;

    return controlsComplication.targetCorner === cornerIndex ? LIGHT_ON : LIGHT_OFF;
  }, [hasActiveControls, controlsComplication.solved, controlsComplication.targetCorner]);

  /**
   * Get text state for "RESET CONTROLS" display.
   * Shows different colors based on complication state.
   */
  const getControlsTextState = useCallback((): MinigameTextState => {
    if (hasActiveControls()) {
      return { text: "RESET CONTROLS", color: WHITE };
    }
    if (recentlyFixed) {
      return { text: "CONTROLS FIXED", color: GREEN };
    }
    return { text: "RESET CONTROLS", color: TEAL };
  }, [hasActiveControls, recentlyFixed]);

  return {
    localDialRotation,
    isDialDragging,
    dialShaking,
    dialPressed,
    handleDialStart,
    handleDialMove,
    handleDialEnd,
    handleDialPress,
    getControlsCornerLightColor,
    getControlsTextState,
    recentlyFixed,
    isDialAligned,
    isComplicationActive: hasActiveControls() && !controlsComplication.solved,
  };
}
