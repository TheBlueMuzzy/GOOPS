/**
 * Game.tsx - Main game component
 *
 * Refactored to use the new GameEngine architecture.
 * This component is now ~100 lines instead of 850+.
 */

import React, { useMemo } from 'react';
import { useGameEngine } from './react/useGameEngine';
import { GameConfig } from './core/GameState';
import { GameBoard } from './components/GameBoard';
import { Controls } from './components/Controls';
import { Play, RotateCcw, Home } from 'lucide-react';
import { audio } from './utils/audio';
import { UPGRADE_CONFIG } from './constants';
import { calculateRankDetails } from './utils/progression';

interface GameProps {
  onExit: () => void;
  onRunComplete: (score: number) => void;
  initialTotalScore: number;
  powerUps?: Record<string, number>;
}

const Game: React.FC<GameProps> = ({
  onExit,
  onRunComplete,
  initialTotalScore,
  powerUps = {}
}) => {
  // Build config from props
  const config: GameConfig = useMemo(() => ({
    initialTotalScore,
    timeBonusLevel: powerUps[UPGRADE_CONFIG.TIME_BONUS.id] || 0,
    stabilityLevel: powerUps[UPGRADE_CONFIG.STABILITY.id] || 0,
    scoreBoostLevel: powerUps[UPGRADE_CONFIG.SCORE_BOOST.id] || 0,
  }), [initialTotalScore, powerUps]);

  // Use the game engine hook
  const {
    gameState,
    isCountdown,
    moveBoard,
    rotate,
    hardDrop,
    swap,
    pause,
    resume,
    restart,
    tapBlock,
    maxTime,
  } = useGameEngine({
    config,
    onRunComplete,
  });

  const { gameOver, isPaused } = gameState;

  const handleExit = () => {
    audio.stopMusic();
    onExit();
  };

  const handleResume = () => {
    resume();
    audio.resume();
  };

  const animStyle = useMemo(() => `
    @keyframes popSequence {
      0% { transform: scale(0); opacity: 0; }
      15% { transform: scale(1.1); opacity: 1; }
      20% { transform: scale(1.0); opacity: 1; }
      90% { transform: scale(1.0); opacity: 1; filter: blur(0px); }
      100% { transform: scale(1.5); opacity: 0; filter: blur(4px); }
    }
    .animate-pop-sequence {
      animation: popSequence 2s linear forwards;
    }
  `, []);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative touch-none">
      <Controls
        state={gameState}
        onRestart={restart}
        onExit={handleExit}
        initialTotalScore={initialTotalScore}
        maxTime={maxTime}
      />

      {/* Countdown Overlay */}
      {isCountdown && !gameOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in pointer-events-none">
          <style>{animStyle}</style>
          <div
            className="text-6xl md:text-8xl font-black text-white drop-shadow-[0_0_30px_rgba(34,211,238,0.8)] text-center px-4 leading-tight animate-pop-sequence"
            style={{ fontFamily: '"Chewy", cursive' }}
          >
            CLEAR OUT<br /><span className="text-cyan-400 text-7xl md:text-9xl">THE GOOP!</span>
          </div>
        </div>
      )}

      {/* Pause Overlay */}
      {isPaused && !gameOver && (
        <div className="absolute inset-0 bg-slate-950/80 z-40 flex flex-col items-center justify-center backdrop-blur-sm gap-6">
          <h2 className="text-4xl text-cyan-400 font-bold tracking-widest animate-pulse mb-4">PAUSED</h2>
          <button
            onClick={handleResume}
            className="flex items-center gap-3 px-8 py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg shadow-lg shadow-cyan-900/50 transition-all active:scale-95 text-xl"
          >
            <Play className="w-6 h-6 fill-current" /> RESUME
          </button>
          <button
            onClick={restart}
            className="flex items-center gap-3 px-8 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg border border-slate-600 transition-all active:scale-95 text-lg"
          >
            <RotateCcw className="w-5 h-5" /> RESTART
          </button>
          <button
            onClick={handleExit}
            className="flex items-center gap-3 px-8 py-4 bg-red-900/50 hover:bg-red-900/80 text-red-200 font-bold rounded-lg border border-red-800 transition-all active:scale-95 text-lg"
          >
            <Home className="w-5 h-5" /> EXIT
          </button>
        </div>
      )}

      <GameBoard
        state={gameState}
        maxTime={maxTime}
        onBlockTap={tapBlock}
        onTapLeft={() => rotate(false)}
        onTapRight={() => rotate(true)}
        onSwipeLeft={() => moveBoard(1)}
        onSwipeRight={() => moveBoard(-1)}
        onSwipeUp={() => swap()}
        onSwipeDown={() => hardDrop()}
      />
    </div>
  );
};

export default Game;
