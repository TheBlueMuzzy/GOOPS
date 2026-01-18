
import React from 'react';
import { GamePhase } from '../types';

interface TransitionOverlayProps {
    phase: GamePhase;
}

export const TransitionOverlay: React.FC<TransitionOverlayProps> = ({ phase }) => {
    const isPeriscopeActive = phase === GamePhase.PERISCOPE || phase === GamePhase.COMPLICATION_MINIGAME || phase === GamePhase.GAME_OVER;

    return (
        <div className="absolute inset-0 pointer-events-none z-[80] overflow-hidden">
            {/* Top Shutter */}
            <div 
                className="absolute top-0 left-0 right-0 bg-slate-950 border-b-4 border-slate-800 transition-all duration-700 ease-in-out shadow-2xl"
                style={{ height: isPeriscopeActive ? '0%' : '50%' }}
            />
            {/* Bottom Shutter */}
            <div 
                className="absolute bottom-0 left-0 right-0 bg-slate-950 border-t-4 border-slate-800 transition-all duration-700 ease-in-out shadow-2xl"
                style={{ height: isPeriscopeActive ? '0%' : '50%' }}
            />
            
            {/* Dark Vignette when in Periscope */}
            <div className={`absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.8)_100%)] transition-opacity duration-1000 ${isPeriscopeActive ? 'opacity-100' : 'opacity-0'}`} />
        </div>
    );
};
