
import React from 'react';
import { GameState } from '../types';
import { Activity } from 'lucide-react';

interface ControlsProps {
  state: GameState;
  onRestart: () => void;
  onExit: () => void;
  initialTotalScore: number;
  maxTime: number; 
}

export const Controls: React.FC<ControlsProps> = ({ 
  state, maxTime 
}) => {
  const { sessionXP, gameOver, popStreak, sessionTime } = state;
  
  // Timer Formatting (Pressure)
  const tankPressure = Math.max(0, Math.min(1, 1 - (sessionTime / maxTime)));
  const isHighPressure = tankPressure > 0.8;
  const isCriticalPressure = tankPressure > 0.9;
  
  return (
    <>
      {/* Vignette Layer for Critical States */}
      {isCriticalPressure && !gameOver && (
          <div className="absolute inset-0 z-30 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_40%,rgba(100,0,0,0.4)_100%)] animate-pulse" />
      )}

      {/* HUD Layer */}
      <div className="absolute top-0 left-0 right-0 p-4 pointer-events-none z-50 flex justify-between items-start">
          
          {/* LEFT: Pressure */}
          <div className="flex flex-col items-start drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)]">
              <span className="text-[10px] uppercase font-bold tracking-widest mb-0.5 text-slate-400/90">Pressure</span>
              <div className={`flex items-baseline gap-1 ${isHighPressure ? 'text-red-500 animate-pulse' : 'text-slate-200'}`}>
                  <Activity className="w-5 h-5 opacity-90" />
                  <span className="text-4xl font-mono font-black leading-none tracking-tighter">{(tankPressure * 100).toFixed(0)}%</span>
              </div>
          </div>

          {/* CENTER: Combo Only */}
          <div className="absolute left-1/2 -translate-x-1/2 top-16 flex flex-col items-center">
              {popStreak > 1 && (
                  <div className="text-2xl text-yellow-400 animate-bounce font-black tracking-wider whitespace-nowrap drop-shadow-[0_4px_4px_rgba(0,0,0,0.9)] stroke-black">
                      x{popStreak} SURGE
                  </div>
              )}
          </div>

          {/* RIGHT: Score */}
          <div className="flex flex-col items-end drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)]">
              <span className="text-[10px] text-green-500/90 uppercase font-bold tracking-widest mb-0.5">Score</span>
              <span className="text-4xl font-mono text-green-400 font-black leading-none tracking-tighter shadow-green-500/10">{sessionXP.toLocaleString()}</span>
          </div>
      </div>
      
      {/* Desktop Hints */}
      <div className="absolute bottom-4 left-0 right-0 text-center text-slate-500 text-xs pointer-events-none hidden md:block opacity-30 z-50 font-mono">
        ARROWS / WASD to Rotate Cylinder &bull; SPACE to Drop &bull; CLICK Masses to Purge
      </div>
    </>
  );
};
