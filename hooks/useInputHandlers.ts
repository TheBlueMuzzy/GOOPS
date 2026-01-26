/**
 * Unified input handling hook for GameBoard.
 * Handles pointer/touch events including:
 * - Hold-to-swap (250ms delay, 1000ms fill)
 * - Horizontal drag for cylinder rotation
 * - Vertical drag for soft drop
 * - Tap on blocks to pop, tap on empty to rotate
 * - Swipe up for console
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { GridCell } from '../types';
import { InputHandlers, InputCallbacks, HoldState, HitData, PointerState } from '../types/input';
import { VIEWBOX, BLOCK_SIZE, screenXToVisX } from '../utils/coordinateTransform';
import { VISIBLE_WIDTH, VISIBLE_HEIGHT, TOTAL_HEIGHT, TOTAL_WIDTH, BUFFER_HEIGHT, PER_BLOCK_DURATION } from '../constants';
import { normalizeX } from '../utils/gameLogic';
import { gameEventBus } from '../core/events/EventBus';
import { GameEventType, RotatePayload, DragPayload, SoftDropPayload, BlockTapPayload } from '../core/events/GameEvents';

// Input timing constants
const BASE_HOLD_DURATION = 1500; // 1.5s base for hold-to-swap (PRD spec)
const HOLD_DELAY = 250;     // 0.25s delay before hold starts
const DRAG_LOCK_THRESHOLD = 10;
const HORIZONTAL_DRAG_THRESHOLD = 20;

interface UseInputHandlersParams {
    callbacks: InputCallbacks;
    boardOffset: number;
    grid: (GridCell | null)[][];
    pressureRatio: number;
    powerUps?: Record<string, number>; // For GOOP_SWAP upgrade effect
}

interface UseInputHandlersReturn {
    handlers: InputHandlers;
    holdState: HoldState;
    highlightedGroupId: string | null;
    shakingGroupId: string | null;
    setHighlightedGroupId: React.Dispatch<React.SetStateAction<string | null>>;
    setShakingGroupId: React.Dispatch<React.SetStateAction<string | null>>;
}

export function useInputHandlers({
    callbacks,
    boardOffset,
    grid,
    pressureRatio,
    powerUps
}: UseInputHandlersParams): UseInputHandlersReturn {
    // Destructure optional callbacks
    const { onBlockTap, onRotate, onDragInput, onSwipeUp, onSoftDrop, onSwap } = callbacks;

    // Calculate dynamic hold duration based on GOOP_SWAP upgrade level
    // Base: 1.5s, Per level: -0.25s (1.5, 1.25, 1.0, 0.75, 0.5 at max)
    const goopSwapLevel = powerUps?.['GOOP_SWAP'] || 0;
    const holdDuration = BASE_HOLD_DURATION - (goopSwapLevel * 250); // Min 500ms at level 4

    // Visual state
    const [highlightedGroupId, setHighlightedGroupId] = useState<string | null>(null);
    const [shakingGroupId, setShakingGroupId] = useState<string | null>(null);
    const [holdProgress, setHoldProgress] = useState(0);
    const [holdPosition, setHoldPosition] = useState<{ x: number; y: number } | null>(null);

    // Refs for pointer tracking
    const pointerRef = useRef<PointerState | null>(null);
    const holdIntervalRef = useRef<number | null>(null);

    // Touch-specific refs (for iOS window listener pattern)
    const touchTargetRef = useRef<HTMLElement | null>(null);
    const touchListenersRef = useRef<{ move: (e: TouchEvent) => void; end: (e: TouchEvent) => void } | null>(null);

    // ViewBox constants
    const { x: vbX, y: vbY, w: vbW, h: vbH } = VIEWBOX;

    /**
     * Convert client coordinates to viewport coordinates for block picking.
     */
    const getViewportCoords = useCallback((clientX: number, clientY: number, target: Element) => {
        const container = target as HTMLElement;
        const rect = container.getBoundingClientRect();
        const borderLeft = container.clientLeft || 0;
        const borderTop = container.clientTop || 0;

        const relX = clientX - rect.left - borderLeft;
        const relY = clientY - rect.top - borderTop;

        const contentW = container.clientWidth;
        const contentH = container.clientHeight;

        const scaleX = contentW / vbW;
        const scaleY = contentH / vbH;
        const scale = Math.min(scaleX, scaleY);
        const renderedW = vbW * scale;
        const offsetX = (contentW - renderedW) / 2;

        const svgX = vbX + (relX - offsetX) / scale;
        const svgY = vbY + relY / scale;

        const rawVisX = screenXToVisX(svgX);
        const rawVisY = svgY / BLOCK_SIZE + BUFFER_HEIGHT;

        return { vx: rawVisX, vy: rawVisY, svgX, svgY, relX, contentW, relY };
    }, [vbX, vbY, vbW, vbH]);

    /**
     * Determine what was hit at the given visual coordinates.
     */
    const getHitData = useCallback((vx: number, vy: number): HitData => {
        if (vx >= 0 && vx < VISIBLE_WIDTH) {
            const visX = Math.floor(vx);
            const gridX = normalizeX(visX + boardOffset);
            const gridY = Math.floor(vy);
            if (gridY >= 0 && gridY < TOTAL_HEIGHT) {
                const cell = grid[gridY][gridX];
                if (cell) {
                    return { type: 'BLOCK', x: gridX, y: gridY, cell };
                }
            }
        }
        return { type: 'EMPTY' };
    }, [boardOffset, grid]);

    /**
     * Clear hold-to-swap state and timer.
     */
    const clearHold = useCallback(() => {
        if (holdIntervalRef.current) {
            clearInterval(holdIntervalRef.current);
            holdIntervalRef.current = null;
        }
        setHoldProgress(0);
        setHoldPosition(null);
    }, []);

    // Cleanup hold interval on unmount to prevent memory leak
    useEffect(() => {
        return () => {
            if (holdIntervalRef.current) {
                clearInterval(holdIntervalRef.current);
            }
        };
    }, []);

    /**
     * Handle pointer down - start hold timer and visual feedback.
     */
    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        if (pointerRef.current) return; // Ignore multitouch for gameplay controls
        e.currentTarget.setPointerCapture(e.pointerId);

        const { relX, relY, vx, vy } = getViewportCoords(e.clientX, e.clientY, e.currentTarget);

        pointerRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startTime: Date.now(),
            isDragLocked: false,
            lockedAxis: null,
            activePointerId: e.pointerId,
            actionConsumed: false
        };

        // Start Hold Timer
        setHoldPosition({ x: relX, y: relY });
        setHoldProgress(0);

        const startHoldTime = Date.now();
        holdIntervalRef.current = window.setInterval(() => {
            const now = Date.now();
            const totalElapsed = now - startHoldTime;

            // Don't start filling/logic until delay has passed
            if (totalElapsed < HOLD_DELAY) return;

            const effectiveElapsed = totalElapsed - HOLD_DELAY;
            const progress = Math.min(100, (effectiveElapsed / holdDuration) * 100);
            setHoldProgress(progress);

            if (progress >= 100) {
                // Trigger Swap
                if (pointerRef.current) pointerRef.current.actionConsumed = true;
                gameEventBus.emit(GameEventType.INPUT_SWAP);
                onSwap?.();
                clearHold();
                // Haptic feedback if available
                if (navigator.vibrate) navigator.vibrate(50);
            }
        }, 16);

        // Visual feedback for tapping blocks
        const hit = getHitData(vx, vy);

        if (hit.type === 'BLOCK' && hit.cell) {
            const totalDuration = hit.cell.groupSize * PER_BLOCK_DURATION;
            const elapsed = Date.now() - hit.cell.timestamp;
            const thresholdY = (TOTAL_HEIGHT - 1) - (pressureRatio * (VISIBLE_HEIGHT - 1));

            if (hit.cell.groupMinY < thresholdY) {
                setShakingGroupId(hit.cell.groupId);
                gameEventBus.emit(GameEventType.ACTION_REJECTED);
                setTimeout(() => setShakingGroupId(prev => prev === hit.cell!.groupId ? null : prev), 300);
            } else if (elapsed < totalDuration) {
                setShakingGroupId(hit.cell.groupId);
                gameEventBus.emit(GameEventType.ACTION_REJECTED);
                setTimeout(() => setShakingGroupId(prev => prev === hit.cell!.groupId ? null : prev), 300);
            } else {
                setHighlightedGroupId(hit.cell.groupId);
            }
        }
    }, [getViewportCoords, getHitData, pressureRatio, clearHold, holdDuration]);

    /**
     * Handle pointer move - detect drag direction and apply input.
     */
    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!pointerRef.current || pointerRef.current.activePointerId !== e.pointerId) return;

        const { startX, startY, isDragLocked } = pointerRef.current;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        if (!isDragLocked) {
            if (absDx > DRAG_LOCK_THRESHOLD || absDy > DRAG_LOCK_THRESHOLD) {
                // Movement detected: Cancel Hold-to-Swap
                clearHold();
                pointerRef.current.isDragLocked = true;
                setHighlightedGroupId(null); // Cancel click highlight

                if (absDx > absDy) {
                    pointerRef.current.lockedAxis = 'H';
                } else {
                    pointerRef.current.lockedAxis = 'V';
                    // Vertical Drag Start
                    if (dy > 0) {
                        gameEventBus.emit(GameEventType.INPUT_SOFT_DROP, { active: true } as SoftDropPayload);
                        onSoftDrop?.(true); // Drag Down = Continuous Drop
                    }
                }
            }
        }

        if (pointerRef.current.isDragLocked) {
            const axis = pointerRef.current.lockedAxis;

            if (axis === 'H') {
                // Horizontal Drag (Joystick)
                if (dx < -HORIZONTAL_DRAG_THRESHOLD) {
                    gameEventBus.emit(GameEventType.INPUT_DRAG, { direction: 1 } as DragPayload);
                    onDragInput?.(1);
                } else if (dx > HORIZONTAL_DRAG_THRESHOLD) {
                    gameEventBus.emit(GameEventType.INPUT_DRAG, { direction: -1 } as DragPayload);
                    onDragInput?.(-1);
                } else {
                    gameEventBus.emit(GameEventType.INPUT_DRAG, { direction: 0 } as DragPayload);
                    onDragInput?.(0); // Deadzone
                }
            } else if (axis === 'V') {
                // Vertical Drag - soft drop when dragging down (dy > 0)
                const shouldSoftDrop = dy > 0;
                gameEventBus.emit(GameEventType.INPUT_SOFT_DROP, { active: shouldSoftDrop } as SoftDropPayload);
                onSoftDrop?.(shouldSoftDrop);
            }
        }
    }, [clearHold]);

    /**
     * Handle pointer up - resolve gesture (tap, swipe, or release).
     */
    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        if (!pointerRef.current || pointerRef.current.activePointerId !== e.pointerId) return;

        const { startTime, isDragLocked, actionConsumed, startX, startY } = pointerRef.current;
        const dt = Date.now() - startTime;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        // Cleanup
        clearHold();
        gameEventBus.emit(GameEventType.INPUT_SOFT_DROP, { active: false } as SoftDropPayload);
        onSoftDrop?.(false);
        gameEventBus.emit(GameEventType.INPUT_DRAG, { direction: 0 } as DragPayload);
        onDragInput?.(0);
        setHighlightedGroupId(null);
        pointerRef.current = null;
        e.currentTarget.releasePointerCapture(e.pointerId);

        // If hold action triggered swap, ignore tap logic
        if (actionConsumed) return;

        // If hold was engaged (past HOLD_DELAY), don't trigger tap on release
        // This prevents early swap-release from triggering rotate
        if (dt >= HOLD_DELAY) return;

        // Gesture Resolution
        if (!isDragLocked) {
            // TAP (Hit nothing or movement < threshold)
            const { vx, vy, relX, contentW } = getViewportCoords(e.clientX, e.clientY, e.currentTarget);
            const hit = getHitData(vx, vy);

            if (hit.type === 'BLOCK' && hit.cell) {
                gameEventBus.emit(GameEventType.INPUT_BLOCK_TAP, { x: hit.x, y: hit.y } as BlockTapPayload);
                onBlockTap?.(hit.x, hit.y);
            } else {
                // Empty Space Logic
                // Left half = Rotate CCW (same as Q)
                // Right half = Rotate CW (same as E)
                if (relX < contentW / 2) {
                    gameEventBus.emit(GameEventType.INPUT_ROTATE, { clockwise: false } as RotatePayload);
                    onRotate?.(-1);
                } else {
                    gameEventBus.emit(GameEventType.INPUT_ROTATE, { clockwise: true } as RotatePayload);
                    onRotate?.(1);
                }
            }
        } else {
            // SWIPE (Quick movement)
            if (dt < 300) {
                if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 50) {
                    if (dy < 0) {
                        // Swipe Up -> Console
                        gameEventBus.emit(GameEventType.INPUT_SWIPE_UP);
                        onSwipeUp?.();
                    } else {
                        // Swipe Down -> Fast Drop Pulse
                        gameEventBus.emit(GameEventType.INPUT_SOFT_DROP, { active: true } as SoftDropPayload);
                        onSoftDrop?.(true);
                        setTimeout(() => {
                            gameEventBus.emit(GameEventType.INPUT_SOFT_DROP, { active: false } as SoftDropPayload);
                            onSoftDrop?.(false);
                        }, 150);
                    }
                }
            }
        }
    }, [clearHold, getViewportCoords, getHitData]);

    // === iOS Touch Event Handling ===
    // iOS browsers have unreliable Pointer Events. Window listeners must be added
    // SYNCHRONOUSLY in touchstart (not via useEffect) to catch fast swipes.

    /**
     * Remove window touch listeners.
     */
    const removeTouchListeners = useCallback(() => {
        if (touchListenersRef.current) {
            window.removeEventListener('touchmove', touchListenersRef.current.move);
            window.removeEventListener('touchend', touchListenersRef.current.end);
            window.removeEventListener('touchcancel', touchListenersRef.current.end);
            touchListenersRef.current = null;
        }
    }, []);

    /**
     * Handle touch start - adds window listeners SYNCHRONOUSLY.
     */
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (e.touches.length !== 1) return;
        if (pointerRef.current) return;
        e.preventDefault();

        const touch = e.touches[0];
        const target = e.currentTarget as HTMLElement;
        touchTargetRef.current = target;

        const { relX, relY, vx, vy } = getViewportCoords(touch.clientX, touch.clientY, target);

        pointerRef.current = {
            startX: touch.clientX,
            startY: touch.clientY,
            startTime: Date.now(),
            isDragLocked: false,
            lockedAxis: null,
            activePointerId: touch.identifier,
            actionConsumed: false
        };

        // Start Hold Timer
        setHoldPosition({ x: relX, y: relY });
        setHoldProgress(0);

        const startHoldTime = Date.now();
        holdIntervalRef.current = window.setInterval(() => {
            const now = Date.now();
            const totalElapsed = now - startHoldTime;
            if (totalElapsed < HOLD_DELAY) return;

            const effectiveElapsed = totalElapsed - HOLD_DELAY;
            const progress = Math.min(100, (effectiveElapsed / holdDuration) * 100);
            setHoldProgress(progress);

            if (progress >= 100) {
                if (pointerRef.current) pointerRef.current.actionConsumed = true;
                gameEventBus.emit(GameEventType.INPUT_SWAP);
                onSwap?.();
                clearHold();
                if (navigator.vibrate) navigator.vibrate(50);
            }
        }, 16);

        // Visual feedback for tapping blocks
        const hit = getHitData(vx, vy);
        if (hit.type === 'BLOCK' && hit.cell) {
            const totalDuration = hit.cell.groupSize * PER_BLOCK_DURATION;
            const elapsed = Date.now() - hit.cell.timestamp;
            const thresholdY = (TOTAL_HEIGHT - 1) - (pressureRatio * (VISIBLE_HEIGHT - 1));

            if (hit.cell.groupMinY < thresholdY) {
                setShakingGroupId(hit.cell.groupId);
                gameEventBus.emit(GameEventType.ACTION_REJECTED);
                setTimeout(() => setShakingGroupId(prev => prev === hit.cell!.groupId ? null : prev), 300);
            } else if (elapsed < totalDuration) {
                setShakingGroupId(hit.cell.groupId);
                gameEventBus.emit(GameEventType.ACTION_REJECTED);
                setTimeout(() => setShakingGroupId(prev => prev === hit.cell!.groupId ? null : prev), 300);
            } else {
                setHighlightedGroupId(hit.cell.groupId);
            }
        }

        // === ADD WINDOW LISTENERS SYNCHRONOUSLY ===
        // This is critical - useEffect is too slow for fast swipes on iOS

        const handleMove = (ev: TouchEvent) => {
            if (!pointerRef.current || ev.touches.length !== 1) return;
            ev.preventDefault();

            const t = ev.touches[0];
            if (t.identifier !== pointerRef.current.activePointerId) return;

            const { startX, startY, isDragLocked } = pointerRef.current;
            const dx = t.clientX - startX;
            const dy = t.clientY - startY;
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);

            if (!isDragLocked) {
                if (absDx > DRAG_LOCK_THRESHOLD || absDy > DRAG_LOCK_THRESHOLD) {
                    clearHold();
                    pointerRef.current.isDragLocked = true;
                    setHighlightedGroupId(null);

                    if (absDx > absDy) {
                        pointerRef.current.lockedAxis = 'H';
                    } else {
                        pointerRef.current.lockedAxis = 'V';
                        if (dy > 0) {
                            gameEventBus.emit(GameEventType.INPUT_SOFT_DROP, { active: true } as SoftDropPayload);
                            onSoftDrop?.(true);
                        }
                    }
                }
            }

            if (pointerRef.current.isDragLocked) {
                const axis = pointerRef.current.lockedAxis;
                if (axis === 'H') {
                    if (dx < -HORIZONTAL_DRAG_THRESHOLD) {
                        gameEventBus.emit(GameEventType.INPUT_DRAG, { direction: 1 } as DragPayload);
                        onDragInput?.(1);
                    } else if (dx > HORIZONTAL_DRAG_THRESHOLD) {
                        gameEventBus.emit(GameEventType.INPUT_DRAG, { direction: -1 } as DragPayload);
                        onDragInput?.(-1);
                    } else {
                        gameEventBus.emit(GameEventType.INPUT_DRAG, { direction: 0 } as DragPayload);
                        onDragInput?.(0);
                    }
                } else if (axis === 'V') {
                    if (dy > HORIZONTAL_DRAG_THRESHOLD) {
                        gameEventBus.emit(GameEventType.INPUT_SOFT_DROP, { active: true } as SoftDropPayload);
                        onSoftDrop?.(true);
                    } else {
                        gameEventBus.emit(GameEventType.INPUT_SOFT_DROP, { active: false } as SoftDropPayload);
                        onSoftDrop?.(false);
                    }
                }
            }
        };

        const handleEnd = (ev: TouchEvent) => {
            const t = ev.changedTouches[0];
            if (!pointerRef.current || !t) return;
            if (t.identifier !== pointerRef.current.activePointerId) return;

            const { startTime, isDragLocked, actionConsumed, startX, startY } = pointerRef.current;
            const dt = Date.now() - startTime;
            const dx = t.clientX - startX;
            const dy = t.clientY - startY;

            // Cleanup
            clearHold();
            gameEventBus.emit(GameEventType.INPUT_SOFT_DROP, { active: false } as SoftDropPayload);
            onSoftDrop?.(false);
            gameEventBus.emit(GameEventType.INPUT_DRAG, { direction: 0 } as DragPayload);
            onDragInput?.(0);
            setHighlightedGroupId(null);

            const savedTarget = touchTargetRef.current;
            pointerRef.current = null;
            touchTargetRef.current = null;
            removeTouchListeners();

            if (actionConsumed) return;
            if (dt >= HOLD_DELAY) return;

            // Gesture Resolution
            if (!isDragLocked && savedTarget) {
                const { vx, vy, relX, contentW } = getViewportCoords(t.clientX, t.clientY, savedTarget);
                const hit = getHitData(vx, vy);

                if (hit.type === 'BLOCK' && hit.cell) {
                    gameEventBus.emit(GameEventType.INPUT_BLOCK_TAP, { x: hit.x, y: hit.y } as BlockTapPayload);
                    onBlockTap?.(hit.x, hit.y);
                } else {
                    if (relX < contentW / 2) {
                        gameEventBus.emit(GameEventType.INPUT_ROTATE, { clockwise: false } as RotatePayload);
                        onRotate?.(-1);
                    } else {
                        gameEventBus.emit(GameEventType.INPUT_ROTATE, { clockwise: true } as RotatePayload);
                        onRotate?.(1);
                    }
                }
            } else if (isDragLocked && dt < 300) {
                if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 50) {
                    if (dy < 0) {
                        gameEventBus.emit(GameEventType.INPUT_SWIPE_UP);
                        onSwipeUp?.();
                    } else {
                        gameEventBus.emit(GameEventType.INPUT_SOFT_DROP, { active: true } as SoftDropPayload);
                        onSoftDrop?.(true);
                        setTimeout(() => {
                            gameEventBus.emit(GameEventType.INPUT_SOFT_DROP, { active: false } as SoftDropPayload);
                            onSoftDrop?.(false);
                        }, 150);
                    }
                }
            }
        };

        // Store refs and add listeners
        touchListenersRef.current = { move: handleMove, end: handleEnd };
        window.addEventListener('touchmove', handleMove, { passive: false });
        window.addEventListener('touchend', handleEnd);
        window.addEventListener('touchcancel', handleEnd);

    }, [getViewportCoords, getHitData, pressureRatio, clearHold, holdDuration, onSwap, onSoftDrop, onDragInput, onBlockTap, onRotate, onSwipeUp, removeTouchListeners]);

    // Cleanup listeners on unmount
    useEffect(() => {
        return () => removeTouchListeners();
    }, [removeTouchListeners]);

    // Element-level handlers just prevent default
    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        e.preventDefault();
    }, []);

    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
        e.preventDefault();
    }, []);

    return {
        handlers: {
            onPointerDown: handlePointerDown,
            onPointerMove: handlePointerMove,
            onPointerUp: handlePointerUp,
            // Touch handlers always included as fallback for browsers with
            // incomplete Pointer Events support (iOS Chrome/Safari/DuckDuckGo, etc.)
            onTouchStart: handleTouchStart,
            onTouchMove: handleTouchMove,
            onTouchEnd: handleTouchEnd,
            onTouchCancel: handleTouchEnd
        },
        holdState: {
            progress: holdProgress,
            position: holdPosition
        },
        highlightedGroupId,
        shakingGroupId,
        setHighlightedGroupId,
        setShakingGroupId
    };
}
