/**
 * Input handling types for GameBoard pointer/touch interactions.
 */

import { GridCell } from '../types';

/**
 * Pointer event handlers returned by useInputHandlers hook.
 * Touch handlers are included for iOS WebKit fallback (Pointer Events unreliable on iOS).
 */
export interface InputHandlers {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    // Touch event fallbacks for iOS WebKit (Chrome/Safari on iPhone/iPad)
    onTouchStart?: (e: React.TouchEvent) => void;
    onTouchMove?: (e: React.TouchEvent) => void;
    onTouchEnd?: (e: React.TouchEvent) => void;
    onTouchCancel?: (e: React.TouchEvent) => void;
}

/**
 * Callbacks for input actions (passed to useInputHandlers).
 * All callbacks are optional - events are emitted via EventBus regardless.
 */
export interface InputCallbacks {
    onBlockTap?: (x: number, y: number) => void;
    onRotate?: (dir: number) => void;
    onDragInput?: (dir: number) => void;
    onSwipeUp?: () => void;
    onFastDrop?: (active: boolean) => void;
    onSwap?: () => void;
}

/**
 * Hold-to-swap visual state.
 */
export interface HoldState {
    progress: number;
    position: { x: number; y: number } | null;
}

/**
 * Result of hit testing - what was tapped/clicked.
 */
export type HitData =
    | { type: 'BLOCK'; x: number; y: number; cell: GridCell }
    | { type: 'EMPTY' };

/**
 * Internal pointer tracking state.
 */
export interface PointerState {
    startX: number;
    startY: number;
    startTime: number;
    isDragLocked: boolean;
    lockedAxis: 'H' | 'V' | null;
    activePointerId: number;
    actionConsumed: boolean;
}
