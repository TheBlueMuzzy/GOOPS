
import React from 'react';
import { ArrowLeft, Lock, ChevronLeft } from 'lucide-react';

interface UpgradesProps {
  onBack: () => void;
}

export const Upgrades: React.FC<UpgradesProps> = ({ onBack }) => {
  return (
    <div className="fixed inset-0 w-screen h-[100dvh] bg-slate-950 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-20 bg-[radial-gradient(circle_at_50%_50%,#059669_0%,transparent_50%)] pointer-events-none" />
        
        {/* Constrained Aspect Ratio Container */}
        <div 
            className="relative z-10 w-full h-full shadow-2xl"
            style={{
                width: 'min(100vw, 100dvh * 0.5625)',
                height: 'min(100dvh, 100vw * 1.7778)',
            }}
        >
            <div className="w-full h-full flex flex-col items-center relative bg-slate-950 overflow-hidden border-x-4 border-slate-900">
              
              {/* Content */}
              <div className="w-full h-full flex flex-col items-center overflow-y-auto px-6 pt-6 pb-32 animate-in slide-in-from-right duration-300 scrollbar-hide">
                  <div className="w-full max-w-md flex items-center justify-center mb-4">
                      <h2 className="text-2xl font-bold text-yellow-400 tracking-wider">POWER UPS</h2>
                  </div>

                  <div className="w-full max-w-md space-y-4 opacity-50 pointer-events-none">
                      {[1, 2, 3].map((i) => (
                          <div key={i} className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center">
                                      <Lock className="w-6 h-6 text-slate-600" />
                                  </div>
                                  <div>
                                      <div className="font-bold text-slate-300">Locked Power Up {i}</div>
                                      <div className="text-xs text-slate-500">Requires Level {i * 5}</div>
                                  </div>
                              </div>
                              <div className="px-3 py-1 bg-slate-800 rounded text-slate-500 text-xs font-bold">LOCKED</div>
                          </div>
                      ))}
                  </div>
                  
                  <div className="mt-8 text-center text-slate-500 text-sm">
                      Play more to unlock system upgrades.
                  </div>
              </div>

              {/* Floating Bottom Button */}
              <div className="absolute bottom-8 left-0 right-0 flex justify-center z-20 pointer-events-none">
                  <button 
                    onClick={onBack}
                    className="pointer-events-auto flex items-center justify-center bg-green-700 hover:bg-green-600 text-black rounded-full shadow-[0_0_20px_rgba(21,128,61,0.4)] transition-all active:scale-95 border border-green-500/30"
                    style={{ 
                        width: 'min(13.2vw, 7.4vh)', 
                        height: 'min(13.2vw, 7.4vh)' 
                    }}
                  >
                     <ChevronLeft className="w-1/2 h-1/2 stroke-[3]" />
                  </button>
              </div>
              
              {/* Bottom Gradient Fade */}
              <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-950 to-transparent pointer-events-none z-10" />
            </div>
        </div>
    </div>
  );
};
