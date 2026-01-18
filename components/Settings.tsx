
import React, { useEffect } from 'react';
import { Volume2, Music, Speaker, RotateCw, ChevronLeft } from 'lucide-react';
import { SaveData } from '../types';
import { audio } from '../utils/audio';

interface SettingsProps {
  settings: SaveData['settings'];
  onUpdate: (newSettings: SaveData['settings']) => void;
  onBack: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ settings, onUpdate, onBack }) => {
  
  // Attempt to initialize audio if not already, so adjustments can be heard (if user interaction allows)
  useEffect(() => {
      audio.init(settings);
  }, []);

  const handleChange = (key: keyof SaveData['settings'], value: any) => {
    onUpdate({
      ...settings,
      [key]: value
    });
  };

  const VolumeSlider = ({ 
    label, 
    value, 
    onChange, 
    icon: Icon,
    colorClass
  }: { 
    label: string, 
    value: number, 
    onChange: (val: number) => void,
    icon: React.ElementType,
    colorClass: string
  }) => (
    <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 flex flex-col gap-3 transition-colors hover:border-slate-700">
       <div className="flex items-center justify-between">
           <div className="flex items-center gap-3">
               <Icon className={`w-5 h-5 ${colorClass}`} />
               <span className="font-bold text-slate-300 tracking-wide uppercase text-sm">{label}</span>
           </div>
           <span className={`font-bold text-sm ${colorClass}`}>{value}%</span>
       </div>
       <div className="relative w-full h-6 flex items-center">
           <input 
              type="range" 
              min="0" 
              max="100" 
              value={value} 
              onChange={(e) => onChange(Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-opacity-50 focus:ring-cyan-500 z-10"
              style={{
                  background: `linear-gradient(to right, currentColor 0%, currentColor ${value}%, rgba(30, 41, 59, 1) ${value}%, rgba(30, 41, 59, 1) 100%)`
              }} 
           />
           {/* Visual Track fix for input range styling trick */}
           <style>{`
              input[type=range]::-webkit-slider-thumb {
                  -webkit-appearance: none;
                  height: 16px;
                  width: 16px;
                  border-radius: 50%;
                  background: #f1f5f9;
                  margin-top: -2px; /* align center */
                  box-shadow: 0 0 10px rgba(255,255,255,0.5);
              }
              input[type=range]::-moz-range-thumb {
                  height: 16px;
                  width: 16px;
                  border: none;
                  border-radius: 50%;
                  background: #f1f5f9;
                  box-shadow: 0 0 10px rgba(255,255,255,0.5);
              }
           `}</style>
       </div>
    </div>
  );

  const ToggleSwitch = ({ 
    label, 
    value, 
    onChange, 
    icon: Icon,
    colorClass
  }: { 
    label: string, 
    value: boolean, 
    onChange: (val: boolean) => void,
    icon: React.ElementType,
    colorClass: string
  }) => (
    <div 
        className="bg-slate-900 p-5 rounded-xl border border-slate-800 flex items-center justify-between transition-colors hover:border-slate-700 cursor-pointer"
        onClick={() => onChange(!value)}
    >
       <div className="flex items-center gap-3">
           <Icon className={`w-5 h-5 ${colorClass}`} />
           <span className="font-bold text-slate-300 tracking-wide uppercase text-sm">{label}</span>
       </div>
       
       <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${value ? 'bg-cyan-600' : 'bg-slate-700'}`}>
           <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-300 ${value ? 'translate-x-6' : 'translate-x-0'}`} />
       </div>
    </div>
  );

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
                  <div className="w-full max-w-md flex items-center justify-center mb-6">
                      <h2 className="text-3xl text-slate-200 tracking-wider uppercase" style={{ fontFamily: '"From Where You Are", cursive' }}>Config</h2>
                  </div>

                  <div className="w-full max-w-md space-y-4">
                      <VolumeSlider 
                         label="Master Output" 
                         value={settings.masterVolume} 
                         onChange={(v) => handleChange('masterVolume', v)}
                         icon={Volume2}
                         colorClass="text-cyan-400"
                      />
                      
                      <VolumeSlider 
                         label="Music Level" 
                         value={settings.musicVolume} 
                         onChange={(v) => handleChange('musicVolume', v)}
                         icon={Music}
                         colorClass="text-purple-400"
                      />

                      <VolumeSlider 
                         label="SFX Level" 
                         value={settings.sfxVolume} 
                         onChange={(v) => {
                             handleChange('sfxVolume', v);
                         }}
                         icon={Speaker}
                         colorClass="text-green-400"
                      />

                      <div className="h-px bg-slate-800 my-2" />

                      <ToggleSwitch 
                         label="Invert Rotation" 
                         value={settings.invertRotation || false}
                         onChange={(v) => handleChange('invertRotation', v)}
                         icon={RotateCw}
                         colorClass="text-yellow-400"
                      />
                  </div>
                  
                   <div className="mt-8 text-center text-slate-700 text-[10px] uppercase tracking-widest font-bold">
                      Audio System v2.1 &bull; Initialized
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
