
import React, { useEffect, useRef, useCallback, useState } from 'react';
import { ScreenType, TankSystem, SaveData } from './types';
import { GameBoard } from './components/GameBoard';
import { Controls } from './components/Controls';
import { ConsoleView } from './components/ConsoleView';
import { useGameEngine } from './hooks/useGameEngine';
import { useSoftBodyPhysics } from './hooks/useSoftBodyPhysics';
import { DEFAULT_PHYSICS, PhysicsParams } from './core/softBody/types';
import { isMobile } from './utils/device';
import { Play, Home } from 'lucide-react';
import { gameEventBus } from './core/events/EventBus';
import { GameEventType, RotatePayload, DragPayload, FastDropPayload, BlockTapPayload, SwapHoldPayload } from './core/events/GameEvents';
import { calculateRankDetails } from './utils/progression';
import { SpinTankCommand, RotateGoopCommand, SetFastDropCommand, SwapPieceCommand, StartRunCommand, SetPhaseCommand, TogglePauseCommand, ResolveComplicationCommand, PopGoopCommand, ActivateAbilityCommand } from './core/commands/actions';

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
  onRunComplete: (result: { score: number; won: boolean }) => void;
  initialTotalScore: number;
  powerUps?: Record<string, number>;
  scraps: number;
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

const Game: React.FC<GameProps> = ({ onExit, onRunComplete, initialTotalScore, powerUps = {}, scraps, settings, onOpenSettings, onOpenHelp, onOpenUpgrades, onSetRank, onPurchaseUpgrade, onRefundUpgrade, equippedActives = [], onToggleEquip }) => {
  // Soft-body physics debug panel (toggle with backtick key)
  const [showPhysicsDebug, setShowPhysicsDebug] = useState(false);
  const [physicsParams, setPhysicsParams] = useState<PhysicsParams>({ ...DEFAULT_PHYSICS });
  const [normalGoopOpacity, setNormalGoopOpacity] = useState(0.25); // 0-1, for debugging SBGs (default 25%)
  const [showVertexDebug, setShowVertexDebug] = useState(false); // Show numbered vertices on SBGs

  // Soft-body physics for goop rendering (Phase 26)
  // Desktop only for now - mobile uses simplified rendering
  const softBodyPhysics = useSoftBodyPhysics({
    enabled: !isMobile,
    params: physicsParams,
  });

  // Physics step - just runs soft-body simulation for visual wobble
  // GameEngine owns falling logic, physics just visualizes
  const handlePhysicsStep = useCallback((dt: number) => {
    softBodyPhysics.step(dt);
  }, [softBodyPhysics]);

  const { engine, gameState } = useGameEngine(
    initialTotalScore,
    powerUps,
    onRunComplete,
    equippedActives,
    handlePhysicsStep
  );

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
      if (gameState.gameOver && gameState.phase === ScreenType.ConsoleScreen) {
          const won = gameState.goalsCleared >= gameState.goalsTarget;
          onRunComplete({ score: gameState.shiftScore, won });
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
                          engine.execute(new SpinTankCommand(dir));
                          controlsInputCountRef.current = 0;
                      }
                  } else {
                      engine.execute(new SpinTankCommand(dir));
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

          if (hasActiveInput && gameState.phase === ScreenType.TankScreen && !engine.state.isPaused && engine.isSessionActive) {
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

          // Toggle physics debug panel with backtick
          if (e.key === '`') {
              e.preventDefault();
              setShowPhysicsDebug(prev => !prev);
              return;
          }

          if (e.key === 'Backspace') {
               if (gameState.phase === ScreenType.TankScreen) engine.execute(new SetPhaseCommand(ScreenType.ConsoleScreen));
          }
          
          if (gameState.gameOver) {
              if (e.key === 'Enter') engine.resetSession(); // Dismiss with Enter
              return;
          }

          // Controls only active in Periscope Mode
          if (gameState.phase === ScreenType.TankScreen && !engine.state.isPaused && engine.isSessionActive) {
              switch(e.code) {
                  case 'ArrowLeft': case 'KeyA': 
                      engine.execute(new SpinTankCommand(1 * directionMultiplier)); 
                      lastMoveTimeRef.current = Date.now() + 250; 
                      startMovementLoop();
                      break;
                  case 'ArrowRight': case 'KeyD': 
                      engine.execute(new SpinTankCommand(-1 * directionMultiplier)); 
                      lastMoveTimeRef.current = Date.now() + 250; 
                      startMovementLoop();
                      break;
                  case 'KeyQ': engine.execute(new RotateGoopCommand(false)); break;
                  case 'KeyE': engine.execute(new RotateGoopCommand(true)); break;
                  case 'KeyS': engine.execute(new SetFastDropCommand(true)); break;
                  case 'Space': engine.execute(new SetPhaseCommand(ScreenType.ConsoleScreen)); break;
                  case 'KeyW': engine.execute(new SetPhaseCommand(ScreenType.ConsoleScreen)); break;
                  case 'KeyR': startSwapHold(); break;
              }
          }
      };

      const handleKeyUp = (e: KeyboardEvent) => {
          heldKeys.current.delete(e.code);
          if (gameState.phase === ScreenType.TankScreen) {
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
          if (gameState.phase === ScreenType.TankScreen && !engine.state.isPaused && !gameState.gameOver && engine.isSessionActive) {
              if (e.deltaY > 0) engine.execute(new RotateGoopCommand(true));
              else engine.execute(new RotateGoopCommand(false));
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
          engine.execute(new RotateGoopCommand(p?.clockwise ?? true));
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
          engine.execute(new SetPhaseCommand(ScreenType.ConsoleScreen));
      });
      const unsubFastDrop = gameEventBus.on<FastDropPayload>(GameEventType.INPUT_FAST_DROP, (p) => {
          engine.execute(new SetFastDropCommand(p?.active ?? false));
      });
      const unsubSwap = gameEventBus.on(GameEventType.INPUT_SWAP, () => {
          engine.execute(new SwapPieceCommand());
      });
      const unsubBlockTap = gameEventBus.on<BlockTapPayload>(GameEventType.INPUT_BLOCK_TAP, (p) => {
          if (p) engine.execute(new PopGoopCommand(p.x, p.y));
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
            lightsBrightness={gameState.phase === ScreenType.TankScreen ? gameState.lightsBrightness : 100}
            laserCharge={gameState.laserCharge}
            controlsHeat={gameState.controlsHeat}
            complicationCooldowns={gameState.complicationCooldowns}
            equippedActives={equippedActives}
            activeCharges={gameState.activeCharges}
            onActivateAbility={handleActivateAbility}
            powerUps={powerUps}
            storedGoop={engine.state.storedGoop}
            nextGoop={engine.state.nextGoop}
            softBodyPhysics={softBodyPhysics}
            normalGoopOpacity={normalGoopOpacity}
            showVertexDebug={showVertexDebug}
         />
         {/* Lights brightness is now controlled by state.lightsBrightness (player-controlled via fast drop) */}
      </div>

      {/* LAYER 2: CONSOLE VIEW (Visible in Console Phase) */}
      <div 
        className={`absolute inset-0 z-50 transition-opacity duration-500 ${
            gameState.phase === ScreenType.ConsoleScreen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
          <ConsoleView
            engine={engine}
            state={gameState}
            careerScore={initialTotalScore}
            scraps={scraps}
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
            gameState.phase === ScreenType.TankScreen ? 'opacity-100' : 'opacity-0'
        }`}
      >
          <Controls
            state={gameState}
            onRestart={() => engine.execute(new StartRunCommand())}
            onExit={() => {
                gameEventBus.emit(GameEventType.GAME_EXITED);
                engine.execute(new SetPhaseCommand(ScreenType.ConsoleScreen));
            }}
            initialTotalScore={engine.initialTotalScore}
            maxTime={engine.maxTime}
          />
      </div>

      {/* LAYER 4: PHYSICS DEBUG PANEL (Toggle with backtick key) */}
      {showPhysicsDebug && !isMobile && (
        <div
          className="absolute top-2 right-2 z-[100] bg-black/90 text-white p-3 rounded-lg text-xs font-mono pointer-events-auto"
          style={{ minWidth: 220 }}
        >
          <div className="flex justify-between items-center mb-2">
            <span className="font-bold">Physics Debug</span>
            <button onClick={() => setShowPhysicsDebug(false)} className="text-gray-400 hover:text-white">✕</button>
          </div>

          <div className="space-y-2">
            <label className="block">
              <span>Damping: {physicsParams.damping.toFixed(2)}</span>
              <input type="range" min="0.8" max="0.99" step="0.01" value={physicsParams.damping}
                onChange={e => setPhysicsParams(p => ({ ...p, damping: Number(e.target.value) }))}
                className="w-full" />
            </label>

            <label className="block">
              <span>Stiffness: {physicsParams.stiffness}</span>
              <input type="range" min="1" max="30" step="1" value={physicsParams.stiffness}
                onChange={e => setPhysicsParams(p => ({ ...p, stiffness: Number(e.target.value) }))}
                className="w-full" />
            </label>

            <label className="block">
              <span>Pressure: {physicsParams.pressure}</span>
              <input type="range" min="0" max="20" step="1" value={physicsParams.pressure}
                onChange={e => setPhysicsParams(p => ({ ...p, pressure: Number(e.target.value) }))}
                className="w-full" />
            </label>

            <label className="block">
              <span>Home Stiffness: {physicsParams.homeStiffness.toFixed(2)}</span>
              <input type="range" min="0" max="1" step="0.05" value={physicsParams.homeStiffness}
                onChange={e => setPhysicsParams(p => ({ ...p, homeStiffness: Number(e.target.value) }))}
                className="w-full" />
            </label>

            <label className="block">
              <span>Return Speed: {physicsParams.returnSpeed.toFixed(2)}</span>
              <input type="range" min="0" max="1" step="0.05" value={physicsParams.returnSpeed}
                onChange={e => setPhysicsParams(p => ({ ...p, returnSpeed: Number(e.target.value) }))}
                className="w-full" />
            </label>

            <label className="block">
              <span>Viscosity: {physicsParams.viscosity.toFixed(1)}</span>
              <input type="range" min="0" max="5" step="0.1" value={physicsParams.viscosity}
                onChange={e => setPhysicsParams(p => ({ ...p, viscosity: Number(e.target.value) }))}
                className="w-full" />
            </label>

            <label className="block">
              <span>Gravity: {physicsParams.gravity}</span>
              <input type="range" min="0" max="50" step="1" value={physicsParams.gravity}
                onChange={e => setPhysicsParams(p => ({ ...p, gravity: Number(e.target.value) }))}
                className="w-full" />
            </label>

            <label className="block">
              <span>Inner Home Stiffness: {physicsParams.innerHomeStiffness.toFixed(2)}</span>
              <input type="range" min="0" max="1" step="0.01" value={physicsParams.innerHomeStiffness}
                onChange={e => setPhysicsParams(p => ({ ...p, innerHomeStiffness: Number(e.target.value) }))}
                className="w-full" />
            </label>

            <label className="block">
              <span>Iterations: {physicsParams.iterations}</span>
              <input type="range" min="1" max="10" step="1" value={physicsParams.iterations}
                onChange={e => setPhysicsParams(p => ({ ...p, iterations: Number(e.target.value) }))}
                className="w-full" />
            </label>

            <div className="pt-2 border-t border-gray-600">
              <div className="text-gray-400 mb-1">Attraction</div>
              <label className="block">
                <span>Radius: {physicsParams.attractionRadius}</span>
                <input type="range" min="0" max="100" step="5" value={physicsParams.attractionRadius}
                  onChange={e => setPhysicsParams(p => ({ ...p, attractionRadius: Number(e.target.value) }))}
                  className="w-full" />
              </label>
              <label className="block">
                <span>Rest Length: {physicsParams.attractionRestLength}</span>
                <input type="range" min="0" max="50" step="1" value={physicsParams.attractionRestLength}
                  onChange={e => setPhysicsParams(p => ({ ...p, attractionRestLength: Number(e.target.value) }))}
                  className="w-full" />
              </label>
              <label className="block">
                <span>Stiffness: {physicsParams.attractionStiffness.toFixed(3)}</span>
                <input type="range" min="0" max="0.1" step="0.001" value={physicsParams.attractionStiffness}
                  onChange={e => setPhysicsParams(p => ({ ...p, attractionStiffness: Number(e.target.value) }))}
                  className="w-full" />
              </label>
            </div>

            <div className="pt-2 border-t border-gray-600">
              <div className="text-gray-400 mb-1">Rendering</div>
              <label className="block">
                <span>Goopiness: {physicsParams.goopiness}</span>
                <input type="range" min="0" max="50" step="1" value={physicsParams.goopiness}
                  onChange={e => setPhysicsParams(p => ({ ...p, goopiness: Number(e.target.value) }))}
                  className="w-full" />
              </label>
              <label className="block">
                <span>Tendril End Radius: {physicsParams.tendrilEndRadius}</span>
                <input type="range" min="0" max="30" step="1" value={physicsParams.tendrilEndRadius}
                  onChange={e => setPhysicsParams(p => ({ ...p, tendrilEndRadius: Number(e.target.value) }))}
                  className="w-full" />
              </label>
              <label className="block">
                <span>Tendril Skinniness: {physicsParams.tendrilSkinniness.toFixed(2)}</span>
                <input type="range" min="0" max="1" step="0.05" value={physicsParams.tendrilSkinniness}
                  onChange={e => setPhysicsParams(p => ({ ...p, tendrilSkinniness: Number(e.target.value) }))}
                  className="w-full" />
              </label>
              <label className="block">
                <span>Wall Thickness: {physicsParams.wallThickness}</span>
                <input type="range" min="1" max="20" step="1" value={physicsParams.wallThickness}
                  onChange={e => setPhysicsParams(p => ({ ...p, wallThickness: Number(e.target.value) }))}
                  className="w-full" />
              </label>
            </div>

            <div className="pt-2 border-t border-gray-600">
              <div className="text-gray-400 mb-1">Droplets (Pop Effect)</div>
              <label className="block">
                <span>Count: {physicsParams.dropletCount}</span>
                <input type="range" min="0" max="100" step="5" value={physicsParams.dropletCount}
                  onChange={e => setPhysicsParams(p => ({ ...p, dropletCount: Number(e.target.value) }))}
                  className="w-full" />
              </label>
              <label className="block">
                <span>Speed: {physicsParams.dropletSpeed}</span>
                <input type="range" min="10" max="300" step="10" value={physicsParams.dropletSpeed}
                  onChange={e => setPhysicsParams(p => ({ ...p, dropletSpeed: Number(e.target.value) }))}
                  className="w-full" />
              </label>
              <label className="block">
                <span>Lifetime: {physicsParams.dropletLifetime}s</span>
                <input type="range" min="0.5" max="5" step="0.5" value={physicsParams.dropletLifetime}
                  onChange={e => setPhysicsParams(p => ({ ...p, dropletLifetime: Number(e.target.value) }))}
                  className="w-full" />
              </label>
              <label className="block">
                <span>Size: {physicsParams.dropletSize}</span>
                <input type="range" min="2" max="30" step="1" value={physicsParams.dropletSize}
                  onChange={e => setPhysicsParams(p => ({ ...p, dropletSize: Number(e.target.value) }))}
                  className="w-full" />
              </label>
            </div>

            <div className="pt-2 border-t border-gray-600">
              <label className="block">
                <span>Normal Goop Opacity: {normalGoopOpacity.toFixed(2)}</span>
                <input type="range" min="0" max="1" step="0.05" value={normalGoopOpacity}
                  onChange={e => setNormalGoopOpacity(Number(e.target.value))}
                  className="w-full" />
              </label>
            </div>

            <div className="pt-2 border-t border-gray-600 text-gray-400">
              <div>Blobs: {softBodyPhysics.blobs.length}</div>
              <label className="flex items-center gap-2 mt-1">
                <input
                  type="checkbox"
                  checked={showVertexDebug}
                  onChange={e => setShowVertexDebug(e.target.checked)}
                />
                <span>Show Vertices</span>
              </label>
              <button
                onClick={() => { setPhysicsParams({ ...DEFAULT_PHYSICS }); setNormalGoopOpacity(0.25); setShowVertexDebug(false); }}
                className="mt-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
              >
                Reset to Defaults
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Game;
