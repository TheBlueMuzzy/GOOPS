
import React, { useState, useRef, useEffect } from 'react';
import { GameState, GamePhase } from '../types';
import { GameEngine } from '../core/GameEngine';
import { calculateRankDetails } from '../utils/progression';
import { SetPhaseCommand, StartRunCommand, ResolveComplicationCommand } from '../core/commands/actions';
import { ConsoleLayoutSVG } from './Art';
import { UpgradePanel } from './UpgradePanel';
import { ArrowUp } from 'lucide-react';

interface ConsoleViewProps {
    engine: GameEngine;
    state: GameState;
    totalScore: number;
    powerUpPoints: number;
    powerUps?: Record<string, number>;
    onOpenSettings?: () => void;
    onOpenHelp?: () => void;
    onOpenUpgrades?: () => void;
    onSetRank?: (rank: number) => void;
    onPurchaseUpgrade?: (upgradeId: string) => void;
    onDismissGameOver?: () => void;
}

export const ConsoleView: React.FC<ConsoleViewProps> = ({ engine, state, totalScore, powerUpPoints, powerUps = {}, onOpenSettings, onOpenHelp, onOpenUpgrades, onSetRank, onPurchaseUpgrade, onDismissGameOver }) => {
    // Calculate Rank based on:
    // Engine's start-of-run total (which hasn't been updated with the run score yet if Game Over)
    // + Current run score.
    // This prevents double counting because totalScore prop from parent might already include state.score after Game Over update.
    const rankInfo = calculateRankDetails(engine.initialTotalScore + state.score);

    // System upgrade panel state
    const [showSystemUpgrades, setShowSystemUpgrades] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    
    // Periscope Drag Logic
    const [dragY, setDragY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [isSnapping, setIsSnapping] = useState(false);
    const startY = useRef(0);
    const DRAG_THRESHOLD = 200; 
    const MAX_DRAG = 300;

    // Monitor Drag Logic (Game Over Dismissal)
    const [monitorDragY, setMonitorDragY] = useState(0);
    const [isMonitorDragging, setIsMonitorDragging] = useState(false);
    const monitorStartY = useRef(0);
    const MONITOR_CLOSE_THRESHOLD = 150;

    // Monitor Toggle State
    const [monitorMsgIndex, setMonitorMsgIndex] = useState(0);
    
    // Toggle monitor message every 3s
    useEffect(() => {
        if (!state.gameOver) {
            const interval = setInterval(() => {
                setMonitorMsgIndex(prev => (prev + 1) % 2);
            }, 3000);
            return () => clearInterval(interval);
        }
    }, [state.gameOver]);

    // Handle Periscope Rise Animation when returning to console
    useEffect(() => {
        // If we just entered CONSOLE phase and are NOT game over, snap periscope to bottom
        if (state.phase === GamePhase.CONSOLE && !state.gameOver) {
            setDragY(MAX_DRAG);
            setIsSnapping(true);
            
            // Double rAF to ensure the DOM updates with snap position before animating
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setIsSnapping(false);
                    setDragY(0);
                });
            });
        }
    }, [state.phase, state.gameOver]);

    // Periscope Handlers
    const handleStart = (y: number) => {
        if (state.gameOver) return;
        setIsDragging(true);
        startY.current = y - dragY;
    };

    const handleMove = (y: number) => {
        if (!isDragging) return;
        const rawY = y - startY.current;
        const constrainedY = Math.max(0, Math.min(MAX_DRAG, rawY));
        setDragY(constrainedY);
    };

    const handleEnd = () => {
        if (!isDragging) return;
        setIsDragging(false);
        
        if (dragY > DRAG_THRESHOLD) {
            engine.execute(new SetPhaseCommand(GamePhase.PERISCOPE));
            setTimeout(() => setDragY(0), 1000);
        } else {
            setDragY(0);
        }
    };

    // Monitor Handlers
    const handleMonitorStart = (y: number) => {
        if (!state.gameOver) return;
        setIsMonitorDragging(true);
        // We want to track displacement relative to current position.
        // Initially monitorDragY is 0.
        monitorStartY.current = y - monitorDragY;
    };

    const handleMonitorMove = (y: number) => {
        if (!isMonitorDragging) return;
        // Dragging UP results in negative Y relative to start
        const rawY = y - monitorStartY.current;
        // Allow dragging up (negative), clamp dragging down to 0
        const constrainedY = Math.min(0, rawY);
        setMonitorDragY(constrainedY);
    };

    const handleMonitorEnd = () => {
        if (!isMonitorDragging) return;
        setIsMonitorDragging(false);

        if (monitorDragY < -MONITOR_CLOSE_THRESHOLD) {
            if (onDismissGameOver) onDismissGameOver();
            setMonitorDragY(0);
        } else {
            setMonitorDragY(0);
        }
    };

    // Global events for drag
    useEffect(() => {
        const move = (e: MouseEvent) => {
            if (isDragging) handleMove(e.clientY);
            if (isMonitorDragging) handleMonitorMove(e.clientY);
        };
        const up = () => {
            if (isDragging) handleEnd();
            if (isMonitorDragging) handleMonitorEnd();
        };
        const tMove = (e: TouchEvent) => {
            if (isDragging) handleMove(e.touches[0].clientY);
            if (isMonitorDragging) handleMonitorMove(e.touches[0].clientY);
        };
        const tEnd = () => {
            if (isDragging) handleEnd();
            if (isMonitorDragging) handleMonitorEnd();
        };

        if (isDragging || isMonitorDragging) {
            window.addEventListener('mousemove', move);
            window.addEventListener('mouseup', up);
            window.addEventListener('touchmove', tMove);
            window.addEventListener('touchend', tEnd);
        }
        return () => {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
            window.removeEventListener('touchmove', tMove);
            window.removeEventListener('touchend', tEnd);
        };
    }, [isDragging, dragY, isMonitorDragging, monitorDragY]);

    const handleAbort = () => {
        engine.abortRun();
    };

    // Derived Visual States
    const isGameRunning = engine.isSessionActive && !state.gameOver;
    
    // Calculate Monitor Offset:
    // If Game Over: 520 (Down/Visible)
    // If Idle/Running: -400 (Up/Hidden) - Note: This hides 'System Ready' text, but matches PRD behavior for EndGame Monitor
    const targetMonitorOffset = state.gameOver ? 520 : -400;
    const monitorOffset = targetMonitorOffset + monitorDragY;

    // Screen Content Component
    const MonitorScreen = () => (
        <div 
            className="w-full h-full flex flex-col items-center pt-24 font-mono overflow-hidden text-center select-none"
        >
            <div className="mt-auto mb-4 flex flex-col items-center">
                {isGameRunning ? (
                    monitorMsgIndex === 0 ? (
                        <div className="text-[#5bbc70] text-3xl font-black tracking-widest font-['From_Where_You_Are'] animate-pulse">
                            CLEANING...
                        </div>
                    ) : (
                        <div className="text-[#f1a941] text-3xl font-black tracking-widest font-['From_Where_You_Are']">
                            {Math.floor((1 - (state.timeLeft/engine.maxTime)) * 100)}% PSI
                        </div>
                    )
                ) : (
                    <div className="text-[#f1a941] text-3xl font-black tracking-widest font-['From_Where_You_Are'] animate-pulse leading-none">
                        PULL DOWN PERISCOPE
                    </div>
                )}
            </div>
        </div>
    );

    return (
        // Outer Wrapper: Fills viewport, handles background color & gradient
        <div className="fixed inset-0 w-screen h-[100dvh] bg-slate-950 flex items-center justify-center overflow-hidden">
            {/* Background Texture/Gradient */}
            <div className="absolute inset-0 z-0 opacity-20 bg-[radial-gradient(circle_at_50%_50%,#059669_0%,transparent_50%)] pointer-events-none" />
            
            {/* Inner Content Container: 
                Calculated to ensure 9:16 aspect ratio fits inside viewport.
                9/16 = 0.5625 | 16/9 = 1.7778
            */}
            <div 
                ref={containerRef} 
                className="relative z-10 select-none flex items-center justify-center"
                style={{
                    // Logic: Smallest of (Available Width) OR (Available Height * Ratio)
                    width: 'min(100vw, 100dvh * 0.5625)',
                    height: 'min(100dvh, 100vw * 1.7778)',
                }}
            >
                <div className="w-full h-full shadow-2xl relative">
                    <ConsoleLayoutSVG 
                        dialRotation={0}
                        monitorOffset={monitorOffset} 
                        periscopeY={dragY}
                        dragHandlers={{
                            onMouseDown: (e: any) => handleStart(e.clientY),
                            onTouchStart: (e: any) => handleStart(e.touches[0].clientY)
                        }}
                        monitorDragHandlers={{
                            onMouseDown: (e: any) => handleMonitorStart(e.clientY),
                            onTouchStart: (e: any) => handleMonitorStart(e.touches[0].clientY)
                        }}
                        isMonitorDragging={isMonitorDragging}
                        isPeriscopeDragging={isDragging}
                        isSnapping={isSnapping}
                        
                        // Button Handlers
                        onSettingsClick={onOpenSettings}
                        onHelpClick={onOpenHelp}
                        onUpgradesClick={() => setShowSystemUpgrades(true)}
                        onSetRank={onSetRank}
                        onAbortClick={handleAbort}
                        onBlueClick={() => console.log('Blue Click')}
                        onGreenClick={() => console.log('Green Click')}
                        onPurpleClick={() => console.log('Purple Click')}
                        
                        // State
                        upgradeCount={powerUpPoints}
                        screenContent={!state.gameOver ? <MonitorScreen /> : null}
                        isGameOver={state.gameOver}
                        isSessionActive={engine.isSessionActive}
                        
                        // Rank & Score Props
                        rank={rankInfo.rank}
                        currentXP={rankInfo.progress}
                        nextRankXP={rankInfo.toNextRank}
                        totalScore={state.score}
                        gameStats={state.gameStats}
                        goalsCleared={state.goalsCleared}
                        goalsTarget={state.goalsTarget}
                        unspentPower={powerUpPoints}

                        // Complications
                        complications={state.complications}
                        onResolveComplication={(id) => engine.execute(new ResolveComplicationCommand(id))}

                        // Upgrade levels for max-level minigame effects
                        upgradeLevels={powerUps}
                    />
                </div>
            </div>

            {/* System Upgrades Panel */}
            {showSystemUpgrades && (
                <UpgradePanel
                    powerUpPoints={powerUpPoints}
                    upgrades={powerUps}
                    rank={rankInfo.rank}
                    onPurchase={(id) => onPurchaseUpgrade?.(id)}
                    onClose={() => setShowSystemUpgrades(false)}
                />
            )}
        </div>
    );
};
