
import React from 'react';
import { ArrowLeft, MousePointer, Gauge, Combine, ArrowUpCircle, Keyboard, Zap, Target, RefreshCw, ChevronLeft } from 'lucide-react';

interface HowToPlayProps {
  onBack: () => void;
}

export const HowToPlay: React.FC<HowToPlayProps> = ({ onBack }) => {
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
              
              {/* Scrollable Content Area */}
              <div className="w-full h-full flex flex-col items-center overflow-y-auto px-6 pt-6 pb-32 animate-in slide-in-from-right duration-300 scrollbar-hide">
                  <div className="w-full max-w-md flex items-center justify-center mb-6 flex-shrink-0">
                      <h2 className="text-3xl text-slate-200 tracking-wider uppercase" style={{ fontFamily: '"From Where You Are", cursive' }}>Operations Manual</h2>
                  </div>

                  <div className="w-full max-w-md space-y-6">
                      
                      {/* Section 1: Objective */}
                      <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 backdrop-blur-sm">
                          <div className="flex items-center gap-3 mb-3">
                              <Gauge className="w-6 h-6 text-red-500" />
                              <h3 className="text-xl font-bold text-white tracking-wide">THE OBJECTIVE</h3>
                          </div>
                          <p className="text-slate-400 leading-relaxed text-base">
                              The filtration system is clogging! Pop as much ooze as you can before the <span className="text-red-400 font-bold">Pressure</span> reaches 100%. 
                              <br/><br/>
                              <span className="text-green-400 font-bold">PRO TIP:</span> Popping larger groups of goop vents pressure, buying you more time to work.
                          </p>
                      </div>

                      {/* Section 2: Controls */}
                      <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 backdrop-blur-sm">
                          <div className="flex items-center gap-3 mb-4">
                              <Keyboard className="w-6 h-6 text-slate-400" />
                              <h3 className="text-xl font-bold text-white tracking-wide">CONTROLS</h3>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                              <ControlKey keyName="A / D" action="Rotate Tank View" />
                              <ControlKey keyName="Q / E" action="Rotate Falling Goop" />
                              <ControlKey keyName="S" action="Fall Faster" />
                              <ControlKey keyName="R" action="Swap Held Goop" />
                              <ControlKey keyName="W / Space" action="Return to Console" />
                              <ControlKey keyName="CLICK" action="Pop Solid Goop" />
                          </div>
                          <div className="mt-4 text-center text-sm text-slate-500 italic">
                              * Touch controls: Drag to rotate tank, tap sides to rotate piece.
                          </div>
                      </div>

                      {/* Section 3: Mechanics */}
                      <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 backdrop-blur-sm space-y-4">
                          <div className="flex items-center gap-3 mb-1">
                              <Combine className="w-6 h-6 text-cyan-400" />
                              <h3 className="text-xl font-bold text-white tracking-wide">MECHANICS</h3>
                          </div>
                          
                          <div className="flex gap-4 items-start">
                              <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 shrink-0 mt-1">
                                <Target className="w-5 h-5 text-red-500" />
                              </div>
                              <div>
                                  <h4 className="font-bold text-slate-200 text-base">Priority Targets</h4>
                                  <p className="text-slate-400 text-sm mt-1">
                                      Sensors identify impurity hotspots with <span className="text-white font-bold">colored markers</span> on the grid. 
                                      Clear goop of the <span className="text-white font-bold">matching color</span> at these coordinates to execute a localized flush protocol.
                                  </p>
                              </div>
                          </div>

                          <div className="flex gap-4 items-start">
                              <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 shrink-0 mt-1">
                                <MousePointer className="w-5 h-5 text-yellow-400" />
                              </div>
                              <div>
                                  <h4 className="font-bold text-slate-200 text-base">Purging (Clicking)</h4>
                                  <p className="text-slate-400 text-sm mt-1">
                                      You can only pop goop that is <span className="text-white font-bold">fully filled</span> (solid) and sitting <span className="text-white font-bold">below the pressure line</span> (the water level).
                                  </p>
                              </div>
                          </div>

                          <div className="flex gap-4 items-start">
                              <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 shrink-0 mt-1">
                                <ArrowUpCircle className="w-5 h-5 text-green-400" />
                              </div>
                              <div>
                                  <h4 className="font-bold text-slate-200 text-base">Scoring</h4>
                                  <p className="text-slate-400 text-sm mt-1">
                                      Goop combines with like colors. 
                                      <br/>• <span className="text-green-400">Bigger Groups</span> = More XP.
                                      <br/>• <span className="text-green-400">Higher Elevation</span> = More XP.
                                  </p>
                              </div>
                          </div>

                          <div className="flex gap-4 items-start">
                              <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 shrink-0 mt-1">
                                <RefreshCw className="w-5 h-5 text-orange-400" />
                              </div>
                              <div>
                                  <h4 className="font-bold text-slate-200 text-base">Console Maintenance</h4>
                                  <p className="text-slate-400 text-sm mt-1">
                                      Sometimes equipment fails! If controls lock up or lights go out, press <span className="text-white font-bold">SPACE</span> or <span className="text-white font-bold">W</span> to return to the Console and fix the issue manually.
                                  </p>
                              </div>
                          </div>

                          <div className="flex gap-4 items-start">
                              <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 shrink-0 mt-1">
                                <Zap className="w-5 h-5 text-purple-400" />
                              </div>
                              <div>
                                  <h4 className="font-bold text-slate-200 text-base">Progression</h4>
                                  <p className="text-slate-400 text-sm mt-1">
                                      Level up your Operator Rank to earn <span className="text-yellow-400">Scraps</span>. Spend these in the Upgrades menu to enhance your efficiency!
                                  </p>
                              </div>
                          </div>
                      </div>
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

const ControlKey = ({ keyName, action }: { keyName: string, action: string }) => (
    <div className="flex flex-col bg-slate-950 border border-slate-800 p-2 rounded-lg text-center">
        <span className="text-cyan-400 font-black text-base mb-1">{keyName}</span>
        <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">{action}</span>
    </div>
);
