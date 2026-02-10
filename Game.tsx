
import React, { useEffect, useRef, useCallback, useState } from 'react';
import { ScreenType, TankSystem, SaveData } from './types';
import { GameBoard } from './components/GameBoard';
import { Controls } from './components/Controls';
import { ConsoleView } from './components/ConsoleView';
import { useGameEngine } from './hooks/useGameEngine';
import { useSoftBodyPhysics, PhysicsStepContext } from './hooks/useSoftBodyPhysics';
import { GameEngine } from './core/GameEngine';
import { DEFAULT_PHYSICS, PhysicsParams } from './core/softBody/types';
import { isMobile } from './utils/device';
import { Play, Home } from 'lucide-react';
import { gameEventBus } from './core/events/EventBus';
import { GameEventType, RotatePayload, DragPayload, FastDropPayload, BlockTapPayload, SwapHoldPayload } from './core/events/GameEvents';
import { calculateRankDetails } from './utils/progression';
import { getPaletteForRank } from './utils/gameLogic';
import { TETRA_NORMAL, TETRA_CORRUPTED, PENTA_NORMAL, PENTA_CORRUPTED, HEXA_NORMAL, HEXA_CORRUPTED, COLORS } from './constants';
import { SpinTankCommand, RotateGoopCommand, SetFastDropCommand, SwapPieceCommand, StartRunCommand, SetPhaseCommand, TogglePauseCommand, ResolveComplicationCommand, PopGoopCommand, ActivateAbilityCommand } from './core/commands/actions';
import { IntercomMessageDisplay } from './components/IntercomMessage';
import { TutorialOverlay } from './components/TutorialOverlay';
import { useTutorial } from './hooks/useTutorial';
import { useTrainingFlow } from './hooks/useTrainingFlow';
import { TRAINING_PHASE_NAMES, TRAINING_SEQUENCE, getPhaseSteps } from './data/trainingScenarios';
import { TrainingPhase } from './types/training';
import { PhaseDotInfo } from './components/IntercomMessage';

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
  saveData: SaveData;
  setSaveData: (updater: (prev: SaveData) => SaveData) => void;
}

const Game: React.FC<GameProps> = ({ onExit, onRunComplete, initialTotalScore, powerUps = {}, scraps, settings, onOpenSettings, onOpenHelp, onOpenUpgrades, onSetRank, onPurchaseUpgrade, onRefundUpgrade, equippedActives = [], onToggleEquip, saveData, setSaveData }) => {
  // Soft-body physics debug panel (toggle with backtick key)
  const [showPhysicsDebug, setShowPhysicsDebug] = useState(false);
  // Dev piece picker panel (toggle with ~ key)
  const [showPiecePicker, setShowPiecePicker] = useState(false);
  // Dev intercom test
  const [showTestIntercom, setShowTestIntercom] = useState(false);
  const [selectedPieceColor, setSelectedPieceColor] = useState(COLORS.RED);
  const [randomPieces, setRandomPieces] = useState(true);
  const [physicsParams, setPhysicsParams] = useState<PhysicsParams>({ ...DEFAULT_PHYSICS });
  const [normalGoopOpacity, setNormalGoopOpacity] = useState(0.2); // 0-1, for debugging SBGs
  const [showVertexDebug, setShowVertexDebug] = useState(false); // Show numbered vertices on SBGs
  // Goo filter params (SVG blur/threshold that creates blobby merge effect)
  const [gooStdDev, setGooStdDev] = useState(5);
  const [gooAlphaMul, setGooAlphaMul] = useState(40);
  const [gooAlphaOff, setGooAlphaOff] = useState(-11);
  // Falling blob goo filter (independent from locked)
  const [fallingGooStdDev, setFallingGooStdDev] = useState(5);
  const [fallingGooAlphaMul, setFallingGooAlphaMul] = useState(40);
  const [fallingGooAlphaOff, setFallingGooAlphaOff] = useState(-11);

  // Soft-body physics for goop rendering (Phase 26)
  // Desktop only for now - mobile uses simplified rendering
  const softBodyPhysics = useSoftBodyPhysics({
    enabled: true,
    params: physicsParams,
  });

  // Physics step callback: builds context, runs physics, syncs state back to engine
  const handlePhysicsStep = useCallback((dt: number, engine: GameEngine) => {
    if (engine.state.gameOver || !engine.isSessionActive) return;

    // Build context for falling piece physics
    const context: PhysicsStepContext = {
      grid: engine.state.grid,
      tankRotation: engine.state.tankRotation,
      fallSpeed: engine.freezeFalling ? 0 : engine.getFallSpeed()
    };

    // Run physics with context (steps falling blobs + core physics)
    softBodyPhysics.step(dt, context);

    // Get physics output and sync back to engine
    // IMPORTANT: Only sync if the blob matches the current piece's timestamp
    // This prevents the OLD blob's position from being synced to a NEW piece
    const activeGoop = engine.state.activeGoop;
    if (activeGoop) {
      const expectedBlobId = `active-${activeGoop.spawnTimestamp}`;
      const matchingBlob = softBodyPhysics.getBlob(expectedBlobId);
      if (matchingBlob && matchingBlob.isFalling && !matchingBlob.isLocked) {
        const physicsState = softBodyPhysics.getActivePieceState();
        if (physicsState) {
          engine.syncActivePieceFromPhysics(physicsState.isColliding, physicsState.gridY);
        }
      }
    }
  }, [softBodyPhysics]);

  const { engine, gameState } = useGameEngine(
    initialTotalScore,
    powerUps,
    onRunComplete,
    equippedActives,
    handlePhysicsStep
  );

  // Tell engine that physics controls falling on desktop
  // This prevents double-movement from the old tickActivePiece(dt)
  useEffect(() => {
    engine.usePhysicsForFalling = !isMobile;
  }, [engine]);

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

          // Toggle piece picker panel with tilde
          if (e.key === '~') {
              e.preventDefault();
              setShowPiecePicker(prev => !prev);
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

  // Tutorial system — triggers intercom messages during gameplay
  const { activeStep, completeStep, dismissStep } = useTutorial({
    rank: startingRank,
    isSessionActive: engine.isSessionActive,
    saveData,
    setSaveData,
  });

  // Training flow — manages rank 0 scripted training sequence
  // Sets engine.pendingTrainingPalette so enterPeriscope() uses startTraining()
  const {
    isInTraining,
    currentStep: trainingStep,
    completedStepIds,
    advanceStep: trainingAdvance,
    dismissMessage: trainingDismiss,
    trainingDisplayStep,
    messagePosition: trainingMessagePosition,
  } = useTrainingFlow({
    saveData,
    setSaveData,
    gameEngine: engine,
    rank: startingRank,
  });

  // Compute training progress for the intercom header (replaces TrainingHUD)
  const ALL_PHASES: TrainingPhase[] = ['A', 'B', 'C', 'D', 'E', 'F'];
  const trainingProgress = isInTraining && trainingStep ? (() => {
    const stepIndex = TRAINING_SEQUENCE.findIndex(s => s.id === trainingStep.id);
    const phaseDots: PhaseDotInfo[] = ALL_PHASES.map(phase => {
      const phaseSteps = getPhaseSteps(phase);
      const allComplete = phaseSteps.every(s => completedStepIds.includes(s.id));
      const isCurrent = trainingStep.phase === phase;
      return {
        phase,
        status: allComplete ? 'complete' as const : isCurrent ? 'current' as const : 'upcoming' as const,
      };
    });
    return {
      phaseName: `Phase ${trainingStep.phase}: ${TRAINING_PHASE_NAMES[trainingStep.phase]}`,
      stepProgress: `Step ${stepIndex + 1} of ${TRAINING_SEQUENCE.length}`,
      phaseDots,
    };
  })() : undefined;

  // During training: show training messages via overlay, with appropriate callbacks
  // Tap steps: dismiss = advance. Action/event steps: dismiss just hides message.
  const isTapAdvance = trainingStep?.advance.type === 'tap';
  const overlayActiveStep = isInTraining ? trainingDisplayStep : activeStep;
  const overlayOnComplete = isInTraining
    ? (isTapAdvance ? trainingAdvance : trainingDismiss)
    : completeStep;
  const overlayOnDismiss = isInTraining
    ? (isTapAdvance ? trainingAdvance : trainingDismiss)
    : dismissStep;

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
            gooStdDev={gooStdDev}
            gooAlphaMul={gooAlphaMul}
            gooAlphaOff={gooAlphaOff}
            fallingGooStdDev={fallingGooStdDev}
            fallingGooAlphaMul={fallingGooAlphaMul}
            fallingGooAlphaOff={fallingGooAlphaOff}
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
            pulsePeriscope={trainingStep?.setup?.highlightElement === 'periscope'}
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
          className="absolute top-2 right-2 z-[100] bg-black/90 text-white p-3 rounded-lg t-meta font-mono pointer-events-auto overflow-y-auto"
          style={{ minWidth: 460, maxHeight: '95vh' }}
        >
          <div className="flex justify-between items-center mb-2">
            <span className="font-bold">Physics Debug</span>
            <button onClick={() => setShowPhysicsDebug(false)} className="text-gray-400 hover:text-white">✕</button>
          </div>

          {/* === SHARED PARAMS (full width) === */}
          <div className="space-y-2 mb-2">
            <div className="text-gray-400 t-meta uppercase tracking-wider">Shared</div>
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
          </div>

          {/* === TWO-COLUMN: LOCKED vs FALLING === */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-600">
            {/* LEFT COLUMN: Locked Blobs */}
            <div className="space-y-2">
              <div className="text-yellow-400 t-meta uppercase tracking-wider">Locked</div>
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
              <div className="pt-1 border-t border-gray-700">
                <div className="text-gray-500 t-meta">Goo Filter</div>
                <label className="block">
                  <span>Blur: {gooStdDev}</span>
                  <input type="range" min="1" max="25" step="1" value={gooStdDev}
                    onChange={e => setGooStdDev(Number(e.target.value))}
                    className="w-full" />
                </label>
                <label className="block">
                  <span>Alpha Mul: {gooAlphaMul}</span>
                  <input type="range" min="1" max="50" step="1" value={gooAlphaMul}
                    onChange={e => setGooAlphaMul(Number(e.target.value))}
                    className="w-full" />
                </label>
                <label className="block">
                  <span>Alpha Off: {gooAlphaOff}</span>
                  <input type="range" min="-30" max="0" step="1" value={gooAlphaOff}
                    onChange={e => setGooAlphaOff(Number(e.target.value))}
                    className="w-full" />
                </label>
              </div>
            </div>

            {/* RIGHT COLUMN: Falling Blobs */}
            <div className="space-y-2">
              <div className="text-cyan-400 t-meta uppercase tracking-wider">Falling</div>
              <label className="block">
                <span>Home Stiffness: {physicsParams.fallingHomeStiffness.toFixed(2)}</span>
                <input type="range" min="0" max="1" step="0.05" value={physicsParams.fallingHomeStiffness}
                  onChange={e => setPhysicsParams(p => ({ ...p, fallingHomeStiffness: Number(e.target.value) }))}
                  className="w-full" />
              </label>
              <label className="block">
                <span>Return Speed: {physicsParams.fallingReturnSpeed.toFixed(2)}</span>
                <input type="range" min="0" max="1" step="0.05" value={physicsParams.fallingReturnSpeed}
                  onChange={e => setPhysicsParams(p => ({ ...p, fallingReturnSpeed: Number(e.target.value) }))}
                  className="w-full" />
              </label>
              <label className="block">
                <span>Viscosity: {physicsParams.fallingViscosity.toFixed(1)}</span>
                <input type="range" min="0" max="5" step="0.1" value={physicsParams.fallingViscosity}
                  onChange={e => setPhysicsParams(p => ({ ...p, fallingViscosity: Number(e.target.value) }))}
                  className="w-full" />
              </label>
              <label className="block">
                <span>Gravity: {physicsParams.fallingGravity}</span>
                <input type="range" min="0" max="50" step="1" value={physicsParams.fallingGravity}
                  onChange={e => setPhysicsParams(p => ({ ...p, fallingGravity: Number(e.target.value) }))}
                  className="w-full" />
              </label>
              <div className="pt-1 border-t border-gray-700">
                <div className="text-gray-500 t-meta">Tendrils</div>
                <label className="block">
                  <span>Goopiness: {physicsParams.fallingGoopiness}</span>
                  <input type="range" min="1" max="50" step="1" value={physicsParams.fallingGoopiness}
                    onChange={e => setPhysicsParams(p => ({ ...p, fallingGoopiness: Number(e.target.value) }))}
                    className="w-full" />
                </label>
                <label className="block">
                  <span>End Radius: {physicsParams.fallingTendrilEndRadius}</span>
                  <input type="range" min="1" max="20" step="1" value={physicsParams.fallingTendrilEndRadius}
                    onChange={e => setPhysicsParams(p => ({ ...p, fallingTendrilEndRadius: Number(e.target.value) }))}
                    className="w-full" />
                </label>
                <label className="block">
                  <span>Skinniness: {physicsParams.fallingTendrilSkinniness.toFixed(2)}</span>
                  <input type="range" min="0" max="1" step="0.05" value={physicsParams.fallingTendrilSkinniness}
                    onChange={e => setPhysicsParams(p => ({ ...p, fallingTendrilSkinniness: Number(e.target.value) }))}
                    className="w-full" />
                </label>
              </div>
              <div className="pt-1 border-t border-gray-700">
                <div className="text-gray-500 t-meta">Goo Filter</div>
                <label className="block">
                  <span>Blur: {fallingGooStdDev}</span>
                  <input type="range" min="1" max="25" step="1" value={fallingGooStdDev}
                    onChange={e => setFallingGooStdDev(Number(e.target.value))}
                    className="w-full" />
                </label>
                <label className="block">
                  <span>Alpha Mul: {fallingGooAlphaMul}</span>
                  <input type="range" min="1" max="50" step="1" value={fallingGooAlphaMul}
                    onChange={e => setFallingGooAlphaMul(Number(e.target.value))}
                    className="w-full" />
                </label>
                <label className="block">
                  <span>Alpha Off: {fallingGooAlphaOff}</span>
                  <input type="range" min="-30" max="0" step="1" value={fallingGooAlphaOff}
                    onChange={e => setFallingGooAlphaOff(Number(e.target.value))}
                    className="w-full" />
                </label>
              </div>
            </div>
          </div>

          {/* === SHARED SECTIONS (full width below columns) === */}
          <div className="space-y-2 pt-2 border-t border-gray-600 mt-2">
            <div className="pt-0">
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
              <div className="flex gap-1 mt-1">
                <button
                  onClick={() => { setPhysicsParams({ ...DEFAULT_PHYSICS }); setNormalGoopOpacity(0.25); setShowVertexDebug(false); setGooStdDev(8); setGooAlphaMul(24); setGooAlphaOff(-13); setFallingGooStdDev(8); setFallingGooAlphaMul(24); setFallingGooAlphaOff(-13); }}
                  className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded t-meta"
                >
                  Reset to Defaults
                </button>
                <button
                  onClick={() => {
                    const snapshot = {
                      ...physicsParams,
                      gooStdDev,
                      gooAlphaMul,
                      gooAlphaOff,
                      fallingGooStdDev,
                      fallingGooAlphaMul,
                      fallingGooAlphaOff,
                      normalGoopOpacity,
                    };
                    console.log('=== DEBUG PARAMS SNAPSHOT ===');
                    console.log(JSON.stringify(snapshot, null, 2));
                    console.log('============================');
                  }}
                  className="px-2 py-1 bg-blue-700 hover:bg-blue-600 rounded t-meta"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LAYER 5b: DEV INTERCOM TEST */}
      {import.meta.env.DEV && (
        <button
          onClick={() => setShowTestIntercom(true)}
          className="absolute bottom-2 left-2 z-[100] px-2 py-1 bg-slate-800 text-slate-400 t-meta font-mono rounded border border-slate-700 hover:text-slate-200 pointer-events-auto"
        >
          Test Intercom
        </button>
      )}
      {showTestIntercom && (
        <IntercomMessageDisplay
          message={{
            fullText: "Attention operator. Begin rotation training immediately. Failure will result in demotion.",
            keywords: ["rotation", "training"],
          }}
          onDismiss={() => setShowTestIntercom(false)}
          onComplete={() => setShowTestIntercom(false)}
          position="top"
        />
      )}

      {/* LAYER 5: PIECE PICKER DEV PANEL (Toggle with ~ key) */}
      {showPiecePicker && !isMobile && (() => {
        const rank = calculateRankDetails(initialTotalScore).rank;
        const activePalette = getPaletteForRank(rank);
        const allColors = [
          { key: 'RED', hex: COLORS.RED },
          { key: 'BLUE', hex: COLORS.BLUE },
          { key: 'GREEN', hex: COLORS.GREEN },
          { key: 'YELLOW', hex: COLORS.YELLOW },
          { key: 'PURPLE', hex: COLORS.PURPLE },
          { key: 'WHITE', hex: COLORS.WHITE },
          { key: 'BLACK', hex: COLORS.BLACK },
        ];

        const MINI_BOX = 36;
        const MINI_CELL = 7;

        const renderMiniPiece = (piece: typeof TETRA_NORMAL[number], idx: number) => {
          const minX = Math.min(...piece.cells.map(c => c.x));
          const maxX = Math.max(...piece.cells.map(c => c.x));
          const minY = Math.min(...piece.cells.map(c => c.y));
          const maxY = Math.max(...piece.cells.map(c => c.y));
          const pw = maxX - minX + 1;
          const ph = maxY - minY + 1;
          const offX = (MINI_BOX - pw * MINI_CELL) / 2;
          const offY = (MINI_BOX - ph * MINI_CELL) / 2;

          return (
            <div
              key={idx}
              onClick={() => {
                const override = {
                  ...piece,
                  color: selectedPieceColor,
                };
                engine.state.nextGoop = override;
                if (!randomPieces) {
                  engine.devOverrideNextGoop = override;
                }
                engine.emitChange();
              }}
              style={{
                cursor: 'pointer',
                borderRadius: 4,
                border: '1px solid #334155',
                background: 'rgba(30, 41, 59, 0.5)',
              }}
              title={piece.type}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(51, 65, 85, 0.8)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(30, 41, 59, 0.5)')}
            >
              <svg width={MINI_BOX} height={MINI_BOX}>
                {piece.cells.map((cell, i) => (
                  <rect
                    key={i}
                    x={offX + (cell.x - minX) * MINI_CELL}
                    y={offY + (cell.y - minY) * MINI_CELL}
                    width={MINI_CELL - 1}
                    height={MINI_CELL - 1}
                    fill={selectedPieceColor}
                    rx={1}
                  />
                ))}
              </svg>
            </div>
          );
        };

        const pieceGroups = [
          { label: 'TETRA', normal: TETRA_NORMAL, corrupted: TETRA_CORRUPTED },
          { label: 'PENTA', normal: PENTA_NORMAL, corrupted: PENTA_CORRUPTED },
          { label: 'HEXA', normal: HEXA_NORMAL, corrupted: HEXA_CORRUPTED },
        ];

        return (
          <div
            className="absolute top-2 left-2 z-[100] bg-black/90 text-white p-3 rounded-lg t-meta font-mono pointer-events-auto overflow-y-auto"
            style={{ minWidth: 280, maxHeight: '95vh' }}
          >
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold">Piece Picker</span>
              <button onClick={() => setShowPiecePicker(false)} className="text-gray-400 hover:text-white px-1">✕</button>
            </div>

            {/* Current Next / Hold preview */}
            <div className="flex gap-3 mb-2 pb-2 border-b border-gray-700">
              <div className="text-gray-400">
                <span className="t-meta uppercase tracking-wider">Next:</span>{' '}
                <span className="text-gray-200">{gameState.nextGoop?.type ?? '—'}</span>
              </div>
              <div className="text-gray-400">
                <span className="t-meta uppercase tracking-wider">Hold:</span>{' '}
                <span className="text-gray-200">{gameState.storedGoop?.type ?? '—'}</span>
              </div>
            </div>

            {/* Color selector */}
            <div className="mb-2 pb-2 border-b border-gray-700">
              <div className="t-meta uppercase tracking-wider text-gray-400 mb-1">Color</div>
              <div className="flex gap-1.5">
                {allColors.map(c => {
                  const unlocked = activePalette.includes(c.hex);
                  const selected = selectedPieceColor === c.hex;
                  return (
                    <div
                      key={c.key}
                      onClick={() => unlocked && setSelectedPieceColor(c.hex)}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: c.hex,
                        opacity: unlocked ? 1 : 0.3,
                        cursor: unlocked ? 'pointer' : 'not-allowed',
                        border: selected ? '3px solid #facc15' : unlocked ? '2px solid #475569' : '2px dashed #334155',
                        boxSizing: 'border-box',
                      }}
                      title={`${c.key}${unlocked ? '' : ' (locked)'}`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Dev toggles (moved from physics panel) */}
            <div className="mb-2 pb-2 border-b border-gray-700 space-y-1">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={randomPieces}
                  onChange={e => {
                    setRandomPieces(e.target.checked);
                    if (e.target.checked) {
                      engine.devOverrideNextGoop = null;
                    }
                  }}
                />
                <span>Random Pieces</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showVertexDebug}
                  onChange={e => setShowVertexDebug(e.target.checked)}
                />
                <span>Show Vertices</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={engine.freezeTimer}
                  onChange={e => { engine.freezeTimer = e.target.checked; }}
                />
                <span>Freeze Timer</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={engine.freezeFalling}
                  onChange={e => { engine.freezeFalling = e.target.checked; }}
                />
                <span>Freeze Falling</span>
              </label>
            </div>

            {/* Piece grids by category */}
            {pieceGroups.map(group => (
              <div key={group.label} className="mb-2">
                <div className="t-meta uppercase tracking-wider text-cyan-400 mb-1">{group.label} — Normal</div>
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {group.normal.map((p, i) => renderMiniPiece(p, i))}
                </div>
                <div className="t-meta uppercase tracking-wider text-orange-400 mb-1">{group.label} — Corrupted</div>
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {group.corrupted.map((p, i) => renderMiniPiece(p, i))}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* LAYER 6: TUTORIAL OVERLAY (z-[90] — above TransitionOverlay, non-blocking) */}
      <TutorialOverlay
        activeStep={overlayActiveStep}
        onComplete={overlayOnComplete}
        onDismiss={overlayOnDismiss}
        highlightElement={trainingStep?.setup?.highlightElement}
        messagePosition={isInTraining ? trainingMessagePosition : undefined}
        advanceType={isInTraining ? (isTapAdvance ? 'tap' : 'dismiss') : undefined}
        blockInteraction={isInTraining && trainingStep?.pauseGame !== false && !!trainingDisplayStep}
        trainingProgress={trainingProgress}
      />

    </div>
  );
};

export default Game;
