/**
 * useGameEngine.ts - React hook for game engine integration
 *
 * Provides React components with access to the game engine,
 * handles lifecycle, and bridges commands/events.
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { GameEngine } from '../core/GameEngine';
import { CoreGameState, GameConfig } from '../core/GameState';
import { Commands } from '../core/commands';
import { EventBus } from '../core/events/EventBus';
import { GameEventType } from '../core/events/GameEvents';
import { audio } from '../utils/audio';
import { GameState } from '../types';

export interface UseGameEngineOptions {
  config: GameConfig;
  onRunComplete?: (score: number) => void;
}

export interface UseGameEngineResult {
  // State (in GameState format for component compatibility)
  gameState: GameState;

  // Countdown state (for overlay)
  isCountdown: boolean;

  // Commands
  moveBoard: (direction: 1 | -1) => void;
  rotate: (clockwise: boolean) => void;
  hardDrop: () => void;
  softDropStart: () => void;
  softDropEnd: () => void;
  swap: () => void;
  tapBlock: (x: number, y: number) => void;
  pause: () => void;
  resume: () => void;
  restart: () => void;

  // Meta
  maxTime: number;
}

export function useGameEngine(options: UseGameEngineOptions): UseGameEngineResult {
  const { config, onRunComplete } = options;

  const engineRef = useRef<GameEngine | null>(null);
  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const heldKeysRef = useRef<Set<string>>(new Set());
  const lastMoveTimeRef = useRef<number>(0);
  const configRef = useRef(config);

  const [coreState, setCoreState] = useState<CoreGameState | null>(null);

  // Initialize engine once on mount
  useEffect(() => {
    const eventBus = new EventBus();
    const engine = new GameEngine(configRef.current, eventBus);
    engineRef.current = engine;

    // Subscribe to state changes
    engine.onStateChange((state) => {
      setCoreState(state);
    });

    // Audio subscriptions
    setupAudioSubscriptions(eventBus);

    // Game over handling
    eventBus.on(GameEventType.GAME_OVER, (e) => {
      audio.playGameOver();
      audio.stopMusic();
      if (onRunComplete) {
        onRunComplete(e.finalScore);
      }
    });

    // Game started (countdown finished)
    eventBus.on(GameEventType.GAME_STARTED, () => {
      audio.startMusic();
    });

    // Start the game
    engine.start();
    setCoreState(engine.getState());

    return () => {
      engine.destroy();
      cancelAnimationFrame(animationRef.current);
    };
  }, []); // Only run once

  // Game loop
  useEffect(() => {
    const gameLoop = (time: number) => {
      const engine = engineRef.current;
      const state = coreState;

      if (!engine || !state) {
        animationRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      if (!lastTimeRef.current) {
        lastTimeRef.current = time;
      }

      const dt = time - lastTimeRef.current;
      lastTimeRef.current = time;

      // Continuous input handling (DAS) - only when playing
      const now = Date.now();
      const DAS_DELAY = 100;

      if (!state.gameOver && !state.isPaused && state.countdown === null) {
        if (now > lastMoveTimeRef.current) {
          if (heldKeysRef.current.has('ArrowLeft') || heldKeysRef.current.has('KeyA')) {
            engine.queueCommand(Commands.moveBoard(1));
            lastMoveTimeRef.current = now + DAS_DELAY;
          } else if (heldKeysRef.current.has('ArrowRight') || heldKeysRef.current.has('KeyD')) {
            engine.queueCommand(Commands.moveBoard(-1));
            lastMoveTimeRef.current = now + DAS_DELAY;
          }
        }
      }

      // Update audio pressure
      if (state.maxTime > 0) {
        const pressure = Math.max(0, 1 - (state.timeLeft / state.maxTime));
        audio.setPressure(pressure);
      }

      engine.tick(dt);
      animationRef.current = requestAnimationFrame(gameLoop);
    };

    animationRef.current = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [coreState?.gameOver, coreState?.isPaused, coreState?.countdown]);

  // Keyboard handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      heldKeysRef.current.add(e.code);
      const engine = engineRef.current;
      if (!engine) return;

      const state = engine.getState();

      // Escape to toggle pause
      if (e.key === 'Escape') {
        if (!state.gameOver && state.countdown === null) {
          if (state.isPaused) {
            engine.queueCommand(Commands.resume());
            audio.startMusic();
          } else {
            engine.queueCommand(Commands.pause());
            audio.stopMusic();
          }
        }
        return;
      }

      // Enter to restart after game over
      if (state.gameOver) {
        if (e.key === 'Enter') {
          engine.queueCommand(Commands.restart());
        }
        return;
      }

      // Don't process game inputs during countdown or pause
      if (state.countdown !== null || state.isPaused) return;

      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          engine.queueCommand(Commands.moveBoard(1));
          lastMoveTimeRef.current = Date.now() + 250;
          break;
        case 'ArrowRight':
        case 'KeyD':
          engine.queueCommand(Commands.moveBoard(-1));
          lastMoveTimeRef.current = Date.now() + 250;
          break;
        case 'KeyQ':
          engine.queueCommand(Commands.rotate(false));
          break;
        case 'KeyE':
        case 'ArrowUp':
          engine.queueCommand(Commands.rotate(true));
          break;
        case 'ArrowDown':
        case 'KeyS':
          engine.queueCommand(Commands.softDropStart());
          break;
        case 'Space':
          engine.queueCommand(Commands.hardDrop());
          break;
        case 'KeyW':
          engine.queueCommand(Commands.swap());
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      heldKeysRef.current.delete(e.code);
      const engine = engineRef.current;
      if (!engine) return;

      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        if (!heldKeysRef.current.has('ArrowDown') && !heldKeysRef.current.has('KeyS')) {
          engine.queueCommand(Commands.softDropEnd());
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Command callbacks
  const moveBoard = useCallback((direction: 1 | -1) => {
    engineRef.current?.queueCommand(Commands.moveBoard(direction));
  }, []);

  const rotate = useCallback((clockwise: boolean) => {
    engineRef.current?.queueCommand(Commands.rotate(clockwise));
  }, []);

  const hardDrop = useCallback(() => {
    engineRef.current?.queueCommand(Commands.hardDrop());
  }, []);

  const softDropStart = useCallback(() => {
    engineRef.current?.queueCommand(Commands.softDropStart());
  }, []);

  const softDropEnd = useCallback(() => {
    engineRef.current?.queueCommand(Commands.softDropEnd());
  }, []);

  const swap = useCallback(() => {
    engineRef.current?.queueCommand(Commands.swap());
  }, []);

  const tapBlock = useCallback((x: number, y: number) => {
    engineRef.current?.queueCommand(Commands.tapBlock(x, y));
  }, []);

  const pause = useCallback(() => {
    engineRef.current?.queueCommand(Commands.pause());
    audio.stopMusic();
  }, []);

  const resume = useCallback(() => {
    engineRef.current?.queueCommand(Commands.resume());
    audio.startMusic();
  }, []);

  const restart = useCallback(() => {
    audio.resume();
    engineRef.current?.queueCommand(Commands.restart());
  }, []);

  // Convert core state to GameState format for components
  const gameState: GameState = useMemo(() => {
    if (!coreState) {
      return {
        grid: [],
        boardOffset: 0,
        activePiece: null,
        storedPiece: null,
        score: 0,
        gameOver: false,
        isPaused: false,
        canSwap: true,
        level: 1,
        cellsCleared: 0,
        combo: 0,
        fallingBlocks: [],
        timeLeft: config.timeBonusLevel * 5000 + 60000,
        scoreBreakdown: { base: 0, height: 0, offscreen: 0, adjacency: 0, speed: 0 },
        gameStats: { startTime: 0, totalBonusTime: 0, maxGroupSize: 0 },
        floatingTexts: [],
        goalMarks: [],
        goalsCleared: 0,
        goalsTarget: 5,
      };
    }

    return {
      grid: coreState.grid,
      boardOffset: coreState.boardOffset,
      activePiece: coreState.activePiece,
      storedPiece: coreState.storedPiece,
      score: coreState.score,
      gameOver: coreState.gameOver,
      isPaused: coreState.isPaused,
      canSwap: coreState.canSwap,
      level: 1,
      cellsCleared: coreState.cellsCleared,
      combo: coreState.combo,
      fallingBlocks: coreState.fallingBlocks,
      timeLeft: coreState.timeLeft,
      scoreBreakdown: coreState.scoreBreakdown,
      gameStats: coreState.gameStats,
      floatingTexts: coreState.floatingTexts,
      goalMarks: coreState.goalMarks,
      goalsCleared: coreState.goalsCleared,
      goalsTarget: coreState.goalsTarget,
    };
  }, [coreState, config.timeBonusLevel]);

  const maxTime = coreState?.maxTime ?? (config.timeBonusLevel * 5000 + 60000);
  const isCountdown = coreState?.countdown !== null && coreState?.countdown !== undefined;

  return {
    gameState,
    isCountdown,
    moveBoard,
    rotate,
    hardDrop,
    softDropStart,
    softDropEnd,
    swap,
    tapBlock,
    pause,
    resume,
    restart,
    maxTime,
  };
}

// Audio event subscriptions
function setupAudioSubscriptions(eventBus: EventBus): void {
  eventBus.on(GameEventType.PIECE_MOVED, () => {
    audio.playMove();
  });

  eventBus.on(GameEventType.PIECE_ROTATED, () => {
    audio.playRotate();
  });

  eventBus.on(GameEventType.PIECE_DROPPED, () => {
    audio.playDrop();
  });

  eventBus.on(GameEventType.PIECE_LOCKED, () => {
    audio.playDrop();
  });

  eventBus.on(GameEventType.PIECE_SWAPPED, () => {
    audio.playRotate();
  });

  eventBus.on(GameEventType.GROUP_CLEARED, (e) => {
    audio.playPop(e.combo);
  });

  eventBus.on(GameEventType.BLOCKS_LANDED, () => {
    audio.playDrop();
  });

  eventBus.on(GameEventType.GOAL_CONSUMED, () => {
    audio.playPop(5);
  });

  eventBus.on(GameEventType.GOAL_SPAWNED, () => {
    audio.playPop(1);
  });

  eventBus.on(GameEventType.INPUT_REJECTED, () => {
    audio.playReject();
  });
}
