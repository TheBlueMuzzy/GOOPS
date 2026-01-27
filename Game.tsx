
import React, { useEffect, useRef, useCallback } from 'react';
import { GamePhase, TankSystem, SaveData } from './types';
import { GameBoard } from './components/GameBoard';
import { Controls } from './components/Controls';
import { ConsoleView } from './components/ConsoleView';
import { useGameEngine } from './hooks/useGameEngine';
import { Play, Home } from 'lucide-react';
import { gameEventBus } from './core/events/EventBus';
import { GameEventType, RotatePayload, DragPayload, FastDropPayload, BlockTapPayload, SwapHoldPayload } from './core/events/GameEvents';
import { calculateRankDetails } from './utils/progression';
import { MoveBoardCommand, RotatePieceCommand, SetFastDropCommand, SwapPieceCommand, StartRunCommand, SetPhaseCommand, TogglePauseCommand, ResolveComplicationCommand, BlockTapCommand, ActivateAbilityCommand } from './core/commands/actions';

// STATE ARCHITECTURE:
// - Game state flows down: useGameEngine → state prop → child components
// - Input events flow up: useInputHandlers → EventBus → Game.tsx → Commands
// - UI callbacks go to App.tsx: onOpenSettings, onSetRank, etc. (parent control)
//
// Prop patterns:
// - GameBoard: receives state only, no callbacks (events via EventBus)
// - ConsoleView: receives state + engine + App.tsx callbacks (appropriate)
// - Controls: receives minimal state for HUD display

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
  onRefundUpgrade?: (upgradeId: string) => void;
  equippedActives?: string[];
  onToggleEquip?: (upgradeId: string) => void;
}

const Game: React.FC<GameProps> = ({ onExit, onRunComplete, initialTotalScore, powerUps = {}, powerUpPoints, settings, onOpenSettings, onOpenHelp, onOpenUpgrades, onSetRank, onPurchaseUpgrade, onRefundUpgrade, equippedActives = [], onToggleEquip }) => {
  const { engine, gameState } = useGameEngine(initialTotalScore, powerUps, onRunComplete, equippedActives);

  // Handle active ability activation
  const handleActivateAbility = useCallback((upgradeId: string) => {
    engine.execute(new ActivateAbilityCommand(upgradeId));
  }, [engine]);
  const heldKeys = useRef<Set<string>>(new Set());
  const dragDirectionRef = useRef<number>(0);
  const lastMoveTimeRef = useRef(0);
  
  // Animation Frame Loop for Smooth Input
  const animationFrameRef = useRef<number | null>(null);
  const isLoopRunningRef = useRef(false);

  // Keyboard hold-to-swap (R key) - matches touch behavior
  const swapHoldStartRef = useRef<number | null>(null);
  const swapHoldIntervalRef = useRef<number | null>(null);
  const SWAP_HOLD_DELAY = 250;    // 0.25s before timer starts
  // GOOP_SWAP upgrade: base 1.5s, -0.25s per level (min 0.5s at level 4)
  const goopSwapLevel = powerUps?.['GOOP_SWAP'] || 0;
  const SWAP_HOLD_DURATION = 1500 - (goopSwapLevel * 250); // Dynamic based on upgrade

  // CONTROLS complication: requires 2 inputs per move, halves hold speed
  const controlsComplication = gameState.complications.find(c => c.type === TankSystem.CONTROLS);
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

  // Keyboard hold-to-swap functions
  const clearSwapHold = useCallback(() => {
      if (swapHoldIntervalRef.current) {
          clearInterval(swapHoldIntervalRef.current);
          swapHoldIntervalRef.current = null;
      }
      swapHoldStartRef.current = null;
      gameEventBus.emit(GameEventType.INPUT_SWAP_HOLD, { progress: -1 } as SwapHoldPayload);
  }, []);

  const startSwapHold = useCallback(() => {
      if (swapHoldIntervalRef.current) return; // Already holding
      swapHoldStartRef.current = Date.now();
      gameEventBus.emit(GameEventType.INPUT_SWAP_HOLD, { progress: 0 } as SwapHoldPayload);

      swapHoldIntervalRef.current = window.setInterval(() => {
          if (!swapHoldStartRef.current) return;
          const elapsed = Date.now() - swapHoldStartRef.current;

          // Don't progress until delay has passed
          if (elapsed < SWAP_HOLD_DELAY) return;

          const effectiveElapsed = elapsed - SWAP_HOLD_DELAY;
          const progress = Math.min(100, (effectiveElapsed / SWAP_HOLD_DURATION) * 100);
          gameEventBus.emit(GameEventType.INPUT_SWAP_HOLD, { progress } as SwapHoldPayload);

          if (progress >= 100) {
              // Trigger swap
              gameEventBus.emit(GameEventType.INPUT_SWAP);
              clearSwapHold();
          }
      }, 16);
  }, [clearSwapHold]);

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
                  case 'KeyS': engine.execute(new SetFastDropCommand(true)); break;
                  case 'Space': engine.execute(new SetPhaseCommand(GamePhase.CONSOLE)); break;
                  case 'KeyW': engine.execute(new SetPhaseCommand(GamePhase.CONSOLE)); break;
                  case 'KeyR': startSwapHold(); break;
              }
          }
      };

      const handleKeyUp = (e: KeyboardEvent) => {
          heldKeys.current.delete(e.code);
          if (gameState.phase === GamePhase.PERISCOPE) {
              switch(e.code) {
                  case 'KeyS':
                      engine.execute(new SetFastDropCommand(false));
                      break;
                  case 'KeyR':
                      clearSwapHold();
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
          clearSwapHold();
      };
  }, [engine, gameState.phase, gameState.gameOver, startMovementLoop, stopMovementLoop, startSwapHold, clearSwapHold, directionMultiplier]);

  // Subscribe to input events from EventBus (replaces callback prop drilling)
  useEffect(() => {
      const unsubRotate = gameEventBus.on<RotatePayload>(GameEventType.INPUT_ROTATE, (p) => {
          engine.execute(new RotatePieceCommand(p?.clockwise ?? true));
      });
      const unsubDrag = gameEventBus.on<DragPayload>(GameEventType.INPUT_DRAG, (p) => {
          dragDirectionRef.current = p?.direction ?? 0;
          if (p?.direction !== 0) {
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
      });
      const unsubSwipeUp = gameEventBus.on(GameEventType.INPUT_SWIPE_UP, () => {
          engine.execute(new SetPhaseCommand(GamePhase.CONSOLE));
      });
      const unsubFastDrop = gameEventBus.on<FastDropPayload>(GameEventType.INPUT_FAST_DROP, (p) => {
          engine.execute(new SetFastDropCommand(p?.active ?? false));
      });
      const unsubSwap = gameEventBus.on(GameEventType.INPUT_SWAP, () => {
          engine.execute(new SwapPieceCommand());
      });
      const unsubBlockTap = gameEventBus.on<BlockTapPayload>(GameEventType.INPUT_BLOCK_TAP, (p) => {
          if (p) engine.execute(new BlockTapCommand(p.x, p.y));
      });

      return () => {
          unsubRotate();
          unsubDrag();
          unsubSwipeUp();
          unsubFastDrop();
          unsubSwap();
          unsubBlockTap();
      };
  }, [engine, startMovementLoop, stopMovementLoop]);

  // Use starting rank for HUD meter visibility - complications unlock based on starting rank, not mid-run
  const startingRank = calculateRankDetails(initialTotalScore).rank;

  // Lights brightness is now continuous (player-controlled via fast drop)
  // Only apply dimming effect in PERISCOPE phase

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
            rank={startingRank}
            maxTime={engine.maxTime}
            lightsBrightness={gameState.phase === GamePhase.PERISCOPE ? gameState.lightsBrightness : 100}
            laserCapacitor={gameState.laserCapacitor}
            controlsHeat={gameState.controlsHeat}
            complicationCooldowns={gameState.complicationCooldowns}
            equippedActives={equippedActives}
            activeCharges={gameState.activeCharges}
            onActivateAbility={handleActivateAbility}
            powerUps={powerUps}
            storedPiece={engine.state.storedPiece}
            nextPiece={engine.state.nextPiece}
         />
         {/* Lights brightness is now controlled by state.lightsBrightness (player-controlled via fast drop) */}
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
            onRefundUpgrade={onRefundUpgrade}
            onDismissGameOver={() => engine.resetSession()}
            equippedActives={equippedActives}
            onToggleEquip={onToggleEquip}
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
            maxTime={engine.maxTime}
          />
      </div>

    </div>
  );
};

export default Game;
