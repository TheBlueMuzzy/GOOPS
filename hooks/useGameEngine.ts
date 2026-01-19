
import { useEffect, useRef, useReducer } from 'react';
import { GameEngine } from '../core/GameEngine';
import { isMobile } from '../utils/device';

// Mobile renders at 40fps for smoother feel, desktop at 60fps
const TARGET_FRAME_TIME = isMobile ? 25 : 16; // ms per frame

export const useGameEngine = (
    initialTotalScore: number,
    powerUps: Record<string, number>,
    onRunComplete: (score: number) => void
) => {
    // Engine persistence
    const engineRef = useRef<GameEngine | null>(null);
    if (!engineRef.current) {
        engineRef.current = new GameEngine(initialTotalScore, powerUps);
    }
    const engine = engineRef.current;

    // Force re-render without creating new objects
    const [, forceUpdate] = useReducer(x => x + 1, 0);

    const lastTimeRef = useRef<number>(0);
    const lastRenderRef = useRef<number>(0);
    const requestRef = useRef<number>(0);

    // Sync initialTotalScore
    useEffect(() => {
        engine.syncTotalScore(initialTotalScore);
    }, [initialTotalScore, engine]);

    // Subscription - throttle re-renders on mobile
    // CRITICAL: Always render immediately for game over state to avoid soft-lock
    useEffect(() => {
        const unsubscribe = engine.subscribe(() => {
            // Always render immediately for critical state changes
            if (engine.state.gameOver) {
                forceUpdate();
                return;
            }

            // Throttle normal updates on mobile
            const now = performance.now();
            if (now - lastRenderRef.current >= TARGET_FRAME_TIME) {
                lastRenderRef.current = now;
                forceUpdate();
            }
        });
        return unsubscribe;
    }, [engine]);

    // Game Loop - throttle everything on mobile
    useEffect(() => {
        const loop = (time: number) => {
            if (!lastTimeRef.current) lastTimeRef.current = time;
            const dt = time - lastTimeRef.current;

            // On mobile, skip frames to reduce CPU load
            if (isMobile && dt < TARGET_FRAME_TIME) {
                requestRef.current = requestAnimationFrame(loop);
                return;
            }

            lastTimeRef.current = time;
            engine.tick(dt);
            requestRef.current = requestAnimationFrame(loop);
        };
        requestRef.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(requestRef.current);
    }, [engine]);

    // Return engine.state directly - no copy needed
    return { engine, gameState: engine.state };
};
