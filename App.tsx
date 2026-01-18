
import React, { useState, useEffect, useCallback } from 'react';
import Game from './Game';
import { Upgrades } from './components/Upgrades';
import { Settings } from './components/Settings';
import { HowToPlay } from './components/HowToPlay';
import { SaveData } from './types';
import { loadSaveData, saveGameData, wipeSaveData } from './utils/storage';
import { calculateRankDetails } from './utils/progression';
import { audio } from './utils/audio';
import { useAudioSubscription } from './hooks/useAudioSubscription';

type ViewState = 'GAME' | 'UPGRADES' | 'SETTINGS' | 'HOW_TO_PLAY';

const App: React.FC = () => {
  // Start directly in GAME view (which now acts as the Console/Menu)
  const [view, setView] = useState<ViewState>('GAME');
  
  // Lazy initialization ensures loadSaveData only runs once on mount
  const [saveData, setSaveData] = useState<SaveData>(() => loadSaveData());
  
  // Key to force re-mounting Game component on wipe
  const [gameKey, setGameKey] = useState(0);

  // Subscribe Audio System to GameEvents (Global)
  useAudioSubscription();

  // Save whenever state updates
  useEffect(() => {
    saveGameData(saveData);
  }, [saveData]);

  // Init audio settings on mount
  useEffect(() => {
      audio.init(saveData.settings);
  }, []);

  const handleRunComplete = useCallback((runScore: number) => {
    setSaveData(prev => {
      const newTotalScore = prev.totalScore + runScore;
      
      const oldRankDetails = calculateRankDetails(prev.totalScore);
      const newRankDetails = calculateRankDetails(newTotalScore);
      
      const rankDiff = newRankDetails.rank - oldRankDetails.rank;
      
      // Award 1 Point per Rank gained
      const pointsEarned = rankDiff > 0 ? rankDiff : 0;
      
      let points = prev.powerUpPoints + pointsEarned;

      return {
        ...prev,
        totalScore: newTotalScore,
        rank: newRankDetails.rank,
        powerUpPoints: points,
        firstRunComplete: true
      };
    });
  }, []);

  const handleUpdateSettings = (newSettings: SaveData['settings']) => {
    setSaveData(prev => ({ ...prev, settings: newSettings }));
    audio.updateSettings(newSettings);
  };

  const handleWipeSave = () => {
      const fresh = wipeSaveData();
      setSaveData(fresh);
      setGameKey(prev => prev + 1); // Force remount of Game to reset engine
      audio.init(fresh.settings);
  };

  return (
    <div className="w-full h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
      {view === 'GAME' && (
        <Game 
          key={gameKey}
          onExit={() => { /* No Exit in Console Mode concept anymore, just idle */ }} 
          onRunComplete={handleRunComplete} 
          initialTotalScore={saveData.totalScore}
          powerUps={saveData.powerUps}
          powerUpPoints={saveData.powerUpPoints}
          settings={saveData.settings}
          onOpenSettings={() => setView('SETTINGS')}
          onOpenHelp={() => setView('HOW_TO_PLAY')}
          onOpenUpgrades={() => setView('UPGRADES')}
          onWipe={handleWipeSave}
        />
      )}

      {view === 'UPGRADES' && (
        <Upgrades onBack={() => setView('GAME')} />
      )}

      {view === 'SETTINGS' && (
        <Settings 
          settings={saveData.settings} 
          onUpdate={handleUpdateSettings}
          onBack={() => setView('GAME')} 
        />
      )}

      {view === 'HOW_TO_PLAY' && (
        <HowToPlay onBack={() => setView('GAME')} />
      )}
    </div>
  );
};

export default App;
