
import React, { useEffect, useRef, useCallback } from 'react';
import { GamePhase, ComplicationType, SaveData } from './types';
import { GameBoard } from './components/GameBoard';
import { Controls } from './components/Controls';
import { ConsoleView } from './components/ConsoleView';
import { useGameEngine } from './hooks/useGameEngine';
import { Play, Home } from 'lucide-react';
import { gameEventBus } from './core/events/EventBus';
import { GameEventType } from './core/events/GameEvents';
import { calculateRankDetails } from './utils/progression';
import { MoveBoardCommand, RotatePieceCommand, SetSoftDropCommand, SwapPieceCommand, StartRunCommand, SetPhaseCommand, TogglePauseCommand, ResolveComplicationCommand, BlockTapCommand } from './core/commands/actions';

interface GameProps {
  onExit: () => void;
  onRunComplete: (score: number) => void;
  initialTotalScore: number;
  powerUps?: Record<string, number>;
  powerUpPoints: number;
  settings: SaveData['settings'];
  onOpenSettings?: () => void;
  onOpenHelp?: () => void;
  onOpenUpgrades?: () => void;
  onSetRank?: (rank: number) => void;
  onPurchaseUpgrade?: (upgradeId: string) => void;
}

const Game: React.FC<GameProps> = ({ onExit, onRunComplete, initialTotalScore, powerUps = {}, powerUpPoints, settings, onOpenSettings, onOpenHelp, onOpenUpgrades, onSetRank, onPurchaseUpgrade }) => {
  const { engine, gameState } = useGameEngine(initialTotalScore, powerUps, onRunComplete);
  const heldKeys = useRef<Set<string>>(new Set());
  const dragDirectionRef = useRef<number>(0);
  const lastMoveTimeRef = useRef(0);
  
  // Animation Frame Loop for Smooth Input
  const animationFrameRef = useRef<number | null>(null);
  const isLoopRunningRef = useRef(false);

  // CONTROLS complication: requires 2 inputs per move, halves hold speed
  const controlsComplication = gameState.complications.find(c => c.type === ComplicationType.CONTROLS);
  const controlsInputCountRef = useRef(0); // Track pending inputs for double-tap requirement

  // Reset input count when CONTROLS complication is resolved
  useEffect(() => {
    if (!controlsComplication) {
      controlsInputCountRef.current = 0;
    }
  }, [controlsComplication?.id]);

  // Direction Multiplier based on Settings only (flip effect removed)
  const directionMultiplier = settings.invertRotation ? -1 : 1;

  // Sync Score on Game Over
  useEffect(() => {
      if (gameState.gameOver && gameState.phase === GamePhase.CONSOLE) {
          onRunComplete(gameState.score);
      }
  }, [gameState.gameOver]);

  const stopMovementLoop = useCallback(() => {
      isLoopRunningRef.current = false;
      if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
      }
  }, []);

  const startMovementLoop = useCallback(() => {
      if (isLoopRunningRef.current) return;
      isLoopRunningRef.current = true;

      const loop = () => {
          if (!isLoopRunningRef.current) return;

          const now = Date.now();

          // CONTROLS complication: use 200ms repeat rate instead of 100ms (half speed)
          const repeatRate = controlsComplication ? 200 : 100;

          // Use the shared ref for timing to respect keydown delays
          if (now >= lastMoveTimeRef.current) {
              let dir = 0;
              if (heldKeys.current.has('ArrowLeft') || heldKeys.current.has('KeyA')) dir = 1 * directionMultiplier;
              if (heldKeys.current.has('ArrowRight') || heldKeys.current.has('KeyD')) dir = -1 * directionMultiplier;
              if (dragDirectionRef.current !== 0) dir = dragDirectionRef.current * directionMultiplier;

              if (dir !== 0) {
                  // CONTROLS complication: require 2 inputs per move
                  if (controlsComplication) {
                      controlsInputCountRef.current++;
                      if (controlsInputCountRef.current >= 2) {
                          engine.execute(new MoveBoardCommand(dir));
                          controlsInputCountRef.current = 0;
                      }
                  } else {
                      engine.execute(new MoveBoardCommand(dir));
                  }
                  lastMoveTimeRef.current = now + repeatRate;
              }
          }

          // Check if we should keep looping
          const hasActiveInput =
              heldKeys.current.has('ArrowLeft') ||
              heldKeys.current.has('ArrowRight') ||
              heldKeys.current.has('KeyA') ||
              heldKeys.current.has('KeyD') ||
              dragDirectionRef.current !== 0;

          if (hasActiveInput && gameState.phase === GamePhase.PERISCOPE && !engine.state.isPaused && engine.isSessionActive) {
              animationFrameRef.current = requestAnimationFrame(loop);
          } else {
              stopMovementLoop();
          }
      };

      animationFrameRef.current = requestAnimationFrame(loop);
  }, [engine, gameState.phase, stopMovementLoop, directionMultiplier, controlsComplication]);

  // Input Handling
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.repeat) return;
          heldKeys.current.add(e.code);

          if (e.key === 'Backspace') {
               if (gameState.phase === GamePhase.PERISCOPE) engine.execute(new SetPhaseCommand(GamePhase.CONSOLE));
          }
          
          if (gameState.gameOver) {
              if (e.key === 'Enter') engine.resetSession(); // Dismiss with Enter
              return;
          }

          // Controls only active in Periscope Mode
          if (gameState.phase === GamePhase.PERISCOPE && !engine.state.isPaused && engine.isSessionActive) {
              switch(e.code) {
                  case 'ArrowLeft': case 'KeyA': 
                      engine.execute(new MoveBoardCommand(1 * directionMultiplier)); 
                      lastMoveTimeRef.current = Date.now() + 250; 
                      startMovementLoop();
                      break;
                  case 'ArrowRight': case 'KeyD': 
                      engine.execute(new MoveBoardCommand(-1 * directionMultiplier)); 
                      lastMoveTimeRef.current = Date.now() + 250; 
                      startMovementLoop();
                      break;
                  case 'KeyQ': engine.execute(new RotatePieceCommand(false)); break;
                  case 'KeyE': engine.execute(new RotatePieceCommand(true)); break;
                  case 'KeyS': engine.execute(new SetSoftDropCommand(true)); break;
                  case 'Space': engine.execute(new SetPhaseCommand(GamePhase.CONSOLE)); break;
                  case 'KeyW': engine.execute(new SetPhaseCommand(GamePhase.CONSOLE)); break;
                  case 'KeyR': engine.execute(new SwapPieceCommand()); break;
              }
          }
      };

      const handleKeyUp = (e: KeyboardEvent) => {
          heldKeys.current.delete(e.code);
          if (gameState.phase === GamePhase.PERISCOPE) {
              switch(e.code) {
                  case 'KeyS': 
                      engine.execute(new SetSoftDropCommand(false));
                      break;
                  case 'ArrowLeft': case 'KeyA': case 'ArrowRight': case 'KeyD':
                      const stillHolding = 
                          heldKeys.current.has('ArrowLeft') || 
                          heldKeys.current.has('ArrowRight') || 
                          heldKeys.current.has('KeyA') || 
                          heldKeys.current.has('KeyD');
                      if (!stillHolding && dragDirectionRef.current === 0) {
                          stopMovementLoop();
                      }
                      break;
              }
          }
      };

      const handleWheel = (e: WheelEvent) => {
          if (gameState.phase === GamePhase.PERISCOPE && !engine.state.isPaused && !gameState.gameOver && engine.isSessionActive) {
              if (e.deltaY > 0) engine.execute(new RotatePieceCommand(true));
              else engine.execute(new RotatePieceCommand(false));
          }
      };

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      window.addEventListener('wheel', handleWheel);
      return () => {
          window.removeEventListener('keydown', handleKeyDown);
          window.removeEventListener('keyup', handleKeyUp);
          window.removeEventListener('wheel', handleWheel);
          stopMovementLoop();
      };
  }, [engine, gameState.phase, gameState.gameOver, startMovementLoop, stopMovementLoop, directionMultiplier]);

  const currentRank = calculateRankDetails(initialTotalScore + gameState.score).rank;

  // Determine active effects based on complications
  const lightsComplication = gameState.complications.find(c => c.type === ComplicationType.LIGHTS);
  const activeEffects = {
      dimmed: !!lightsComplication,
  };

  return (
    <div className="w-full h-full relative touch-none bg-slate-950 overflow-hidden">
      
      {/* 
        LAYER 1: GAME BOARD 
        Always mounted at Z-0. 
        In Console Phase, it is revealed via the Periscope Mask in ConsoleView.
      */}
      <div className="absolute inset-0 z-0">
         <GameBoard
            state={gameState}
            rank={currentRank}
            maxTime={60000}
            onBlockTap={(x, y) => engine.execute(new BlockTapCommand(x, y))}
            onRotate={(dir) => engine.execute(new RotatePieceCommand(dir === 1))}
            onDragInput={(dir) => {
                dragDirectionRef.current = dir;
                if (dir !== 0) {
                    startMovementLoop();
                } else {
                    const stillHolding =
                        heldKeys.current.has('ArrowLeft') ||
                        heldKeys.current.has('ArrowRight') ||
                        heldKeys.current.has('KeyA') ||
                        heldKeys.current.has('KeyD');
                    if (!stillHolding) {
                        stopMovementLoop();
                    }
                }
            }}
            onSwipeUp={() => engine.execute(new SetPhaseCommand(GamePhase.CONSOLE))}
            onSoftDrop={(active) => engine.execute(new SetSoftDropCommand(active))}
            onSwap={() => engine.execute(new SwapPieceCommand())}
            lightsDimmed={activeEffects.dimmed && gameState.phase === GamePhase.PERISCOPE}
            laserCapacitor={gameState.laserCapacitor}
            controlsHeat={gameState.controlsHeat}
            complicationCooldowns={gameState.complicationCooldowns}
         />
         {/* LIGHTS complication effect is now handled via lightsDimmed prop on GameBoard */}
      </div>

      {/* LAYER 2: CONSOLE VIEW (Visible in Console Phase) */}
      <div 
        className={`absolute inset-0 z-50 transition-opacity duration-500 ${
            gameState.phase === GamePhase.CONSOLE ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
          <ConsoleView
            engine={engine}
            state={gameState}
            totalScore={initialTotalScore}
            powerUpPoints={powerUpPoints}
            powerUps={powerUps}
            onOpenSettings={onOpenSettings}
            onOpenHelp={onOpenHelp}
            onOpenUpgrades={onOpenUpgrades}
            onSetRank={onSetRank}
            onPurchaseUpgrade={onPurchaseUpgrade}
            onDismissGameOver={() => engine.resetSession()}
          />
      </div>

      {/* LAYER 3: PERISCOPE HUD (Visible in Periscope Phase) */}
      <div 
        className={`absolute inset-0 z-20 pointer-events-none transition-opacity duration-500 ${
            gameState.phase === GamePhase.PERISCOPE ? 'opacity-100' : 'opacity-0'
        }`}
      >
          <Controls 
            state={gameState} 
            onRestart={() => engine.execute(new StartRunCommand())}
            onExit={() => { 
                gameEventBus.emit(GameEventType.GAME_EXITED); 
                engine.execute(new SetPhaseCommand(GamePhase.CONSOLE));
            }}
            initialTotalScore={engine.initialTotalScore}
            maxTime={60000} 
          />
      </div>

    </div>
  );
};

export default Game;
