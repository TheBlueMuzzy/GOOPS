
import { useEffect, useRef, useReducer } from 'react';
import { GameEngine } from '../core/GameEngine';
import { isMobile } from '../utils/device';

// Mobile renders at 40fps for smoother feel, desktop at 60fps
const TARGET_FRAME_TIME = isMobile ? 25 : 16; // ms per frame

export const useGameEngine = (
    initialTotalScore: number,
    powerUps: Record<string, number>,
    onRunComplete: (score: number) => void,
    equippedActives: string[] = []
) => {
    // Engine persistence
    const engineRef = useRef<GameEngine | null>(null);
    if (!engineRef.current) {
        engineRef.current = new GameEngine(initialTotalScore, powerUps, equippedActives);
    }
    const engine = engineRef.current;

    // CRITICAL: Sync equippedActives immediately (synchronously during render)
    // This ensures startRun() has the correct equippedActives before useEffect runs
    // Compare by length and content to avoid unnecessary updates
    const needsSync = engine.equippedActives.length !== equippedActives.length ||
        !engine.equippedActives.every((id, i) => id === equippedActives[i]);

    if (needsSync) {
        engine.equippedActives = equippedActives;

        // Also update activeCharges to include any newly equipped abilities
        const currentCharges = engine.state.activeCharges || {};
        const updatedCharges: Record<string, number> = {};

        equippedActives.forEach(id => {
            // Preserve existing charge if already tracked, else start at 0
            updatedCharges[id] = currentCharges[id] ?? 0;
        });

        engine.state.activeCharges = updatedCharges;
    }

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
