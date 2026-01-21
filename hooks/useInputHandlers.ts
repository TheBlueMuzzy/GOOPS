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
import { VISIBLE_WIDTH, TOTAL_HEIGHT, TOTAL_WIDTH, BUFFER_HEIGHT, PER_BLOCK_DURATION } from '../constants';
import { normalizeX } from '../utils/gameLogic';
import { gameEventBus } from '../core/events/EventBus';
import { GameEventType } from '../core/events/GameEvents';

// Input timing constants
const HOLD_DURATION = 1000; // 1.0s for hold-to-swap
const HOLD_DELAY = 250;     // 0.25s delay before hold starts
const DRAG_LOCK_THRESHOLD = 10;
const HORIZONTAL_DRAG_THRESHOLD = 20;

interface UseInputHandlersParams {
    callbacks: InputCallbacks;
    boardOffset: number;
    grid: (GridCell | null)[][];
    pressureRatio: number;
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
    pressureRatio
}: UseInputHandlersParams): UseInputHandlersReturn {
    const { onBlockTap, onRotate, onDragInput, onSwipeUp, onSoftDrop, onSwap } = callbacks;

    // Visual state
    const [highlightedGroupId, setHighlightedGroupId] = useState<string | null>(null);
    const [shakingGroupId, setShakingGroupId] = useState<string | null>(null);
    const [holdProgress, setHoldProgress] = useState(0);
    const [holdPosition, setHoldPosition] = useState<{ x: number; y: number } | null>(null);

    // Refs for pointer tracking
    const pointerRef = useRef<PointerState | null>(null);
    const holdIntervalRef = useRef<number | null>(null);

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
            const progress = Math.min(100, (effectiveElapsed / HOLD_DURATION) * 100);
            setHoldProgress(progress);

            if (progress >= 100) {
                // Trigger Swap
                if (pointerRef.current) pointerRef.current.actionConsumed = true;
                onSwap();
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
    }, [getViewportCoords, getHitData, pressureRatio, onSwap, clearHold]);

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
                        onSoftDrop(true); // Drag Down = Continuous Drop
                    }
                }
            }
        }

        if (pointerRef.current.isDragLocked) {
            const axis = pointerRef.current.lockedAxis;

            if (axis === 'H') {
                // Horizontal Drag (Joystick)
                if (dx < -HORIZONTAL_DRAG_THRESHOLD) {
                    onDragInput(1);
                } else if (dx > HORIZONTAL_DRAG_THRESHOLD) {
                    onDragInput(-1);
                } else {
                    onDragInput(0); // Deadzone
                }
            } else if (axis === 'V') {
                // Vertical Drag
                if (dy > HORIZONTAL_DRAG_THRESHOLD) {
                    onSoftDrop(true);
                } else {
                    onSoftDrop(false);
                }
            }
        }
    }, [clearHold, onDragInput, onSoftDrop]);

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
        onSoftDrop(false);
        onDragInput(0);
        setHighlightedGroupId(null);
        pointerRef.current = null;
        e.currentTarget.releasePointerCapture(e.pointerId);

        // If hold action triggered swap, ignore tap logic
        if (actionConsumed) return;

        // Gesture Resolution
        if (!isDragLocked) {
            // TAP (Hit nothing or movement < threshold)
            const { vx, vy, relX, contentW } = getViewportCoords(e.clientX, e.clientY, e.currentTarget);
            const hit = getHitData(vx, vy);

            if (hit.type === 'BLOCK' && hit.cell) {
                onBlockTap(hit.x, hit.y);
            } else {
                // Empty Space Logic
                // Left half = Rotate CCW (same as Q)
                // Right half = Rotate CW (same as E)
                if (relX < contentW / 2) {
                    onRotate(-1);
                } else {
                    onRotate(1);
                }
            }
        } else {
            // SWIPE (Quick movement)
            if (dt < 300) {
                if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 50) {
                    if (dy < 0) {
                        // Swipe Up -> Console
                        onSwipeUp();
                    } else {
                        // Swipe Down -> Fast Drop Pulse
                        onSoftDrop(true);
                        setTimeout(() => onSoftDrop(false), 150);
                    }
                }
            }
        }
    }, [clearHold, onSoftDrop, onDragInput, getViewportCoords, getHitData, onBlockTap, onRotate, onSwipeUp]);

    return {
        handlers: {
            onPointerDown: handlePointerDown,
            onPointerMove: handlePointerMove,
            onPointerUp: handlePointerUp
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
