
import React, { useState, useEffect } from 'react';
import { Zap, CheckCircle2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { audio } from '../../utils/audio';

interface BlownFuseProps {
    onResolve: () => void;
    onBack: () => void;
}

interface Fuse {
    id: number;
    isBlown: boolean;
    isReplaced: boolean;
}

export const BlownFuse: React.FC<BlownFuseProps> = ({ onResolve, onBack }) => {
    // Generate 6 fuses, 2-3 are blown
    const [fuses, setFuses] = useState<Fuse[]>(() => {
        const initial = Array.from({length: 6}, (_, i) => ({
            id: i,
            isBlown: false,
            isReplaced: false
        }));
        
        // Blow 3 random fuses
        let blownCount = 0;
        while (blownCount < 3) {
            const idx = Math.floor(Math.random() * 6);
            if (!initial[idx].isBlown) {
                initial[idx].isBlown = true;
                blownCount++;
            }
        }
        return initial;
    });
    
    const [isComplete, setIsComplete] = useState(false);

    useEffect(() => {
        const allFixed = fuses.every(f => !f.isBlown || f.isReplaced);
        if (allFixed && !isComplete) {
            setIsComplete(true);
            setTimeout(() => {
                onResolve();
            }, 1000);
        }
    }, [fuses, isComplete, onResolve]);

    const handleFuseClick = (id: number) => {
        if (isComplete) return;
        
        setFuses(prev => prev.map(f => {
            if (f.id === id) {
                if (f.isBlown && !f.isReplaced) {
                    audio.playPop(1); // Feedback
                    return { ...f, isReplaced: true };
                }
            }
            return f;
        }));
    };

    return (
        <div className="absolute inset-0 z-[200] bg-slate-900/95 flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in duration-300">
             <div className="w-full max-w-md bg-slate-800 border-2 border-slate-600 rounded-xl p-6 shadow-2xl relative">
                 {/* Header */}
                 <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-700">
                     <button onClick={onBack} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
                         <ArrowLeft className="w-6 h-6 text-slate-400" />
                     </button>
                     <div className="text-center">
                         <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-2 justify-center">
                            <Zap className="w-6 h-6 text-yellow-500 fill-current" />
                            Fuse Box A-9
                         </h2>
                         <div className="text-xs text-slate-400 font-mono">REPLACE BLOWN FUSES</div>
                     </div>
                     <div className="w-10" />
                 </div>

                 {/* Fuse Grid */}
                 <div className="grid grid-cols-3 gap-6 mb-8">
                     {fuses.map(fuse => {
                         const isBroken = fuse.isBlown && !fuse.isReplaced;
                         const isGood = !fuse.isBlown || fuse.isReplaced;
                         
                         return (
                             <button
                                key={fuse.id}
                                onClick={() => handleFuseClick(fuse.id)}
                                className={`
                                    relative h-24 rounded-lg border-4 transition-all duration-200 active:scale-95 flex flex-col items-center justify-center gap-2
                                    ${isBroken 
                                        ? 'bg-red-900/50 border-red-500 hover:bg-red-900/80 shadow-[0_0_15px_rgba(239,68,68,0.4)]' 
                                        : 'bg-slate-700 border-slate-500 hover:bg-slate-600'
                                    }
                                    ${fuse.isReplaced ? 'border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)]' : ''}
                                `}
                             >
                                 <div className={`w-2 h-12 rounded-full ${isBroken ? 'bg-slate-800' : 'bg-gradient-to-b from-transparent via-white/50 to-transparent w-3 bg-yellow-500/20'}`}>
                                     {isBroken && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-red-500"><AlertTriangle /></div>}
                                     {isGood && <div className="w-full h-full bg-yellow-400/80 rounded-full shadow-[0_0_10px_rgba(250,204,21,0.6)]" />}
                                 </div>
                                 <div className="text-[10px] font-mono font-bold text-slate-400">
                                     {isBroken ? 'BLOWN' : 'ACTIVE'}
                                 </div>
                             </button>
                         );
                     })}
                 </div>

                 {/* Status */}
                 <div className="h-12 flex items-center justify-center">
                     {isComplete ? (
                         <div className="flex items-center gap-2 text-green-400 animate-bounce">
                             <CheckCircle2 className="w-6 h-6" />
                             <span className="font-bold text-lg tracking-widest">SYSTEM RESTORED</span>
                         </div>
                     ) : (
                         <div className="text-slate-500 text-sm font-mono animate-pulse">
                             CIRCUIT UNSTABLE...
                         </div>
                     )}
                 </div>
             </div>
        </div>
    );
};
