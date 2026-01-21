
import React, { useState, useEffect, useCallback } from 'react';
import Game from './Game';
import { Upgrades } from './components/Upgrades';
import { Settings } from './components/Settings';
import { HowToPlay } from './components/HowToPlay';
import { SaveData } from './types';
import { loadSaveData, saveGameData, wipeSaveData } from './utils/storage';
import { calculateRankDetails, getScoreForMidRank, getMilestonesInRange } from './utils/progression';
import { gameEventBus } from './core/events/EventBus';
import { GameEventType } from './core/events/GameEvents';
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

      // Award 1 Point per Rank gained (no bonuses - exactly 1 per rank)
      const pointsEarned = rankDiff > 0 ? rankDiff : 0;

      // Track milestones crossed (for future UI celebration, no bonus points)
      const milestoneCandidates = getMilestonesInRange(oldRankDetails.rank, newRankDetails.rank);
      const newMilestones = milestoneCandidates.filter(m => !prev.milestonesReached.includes(m));

      // Emit event for UI celebration (future use)
      if (newMilestones.length > 0) {
        gameEventBus.emit(GameEventType.MILESTONE_REACHED, { milestones: newMilestones });
      }

      return {
        ...prev,
        totalScore: newTotalScore,
        rank: newRankDetails.rank,
        powerUpPoints: prev.powerUpPoints + pointsEarned,
        milestonesReached: [...prev.milestonesReached, ...newMilestones],
        firstRunComplete: true
      };
    });
  }, []);

  const handleUpdateSettings = (newSettings: SaveData['settings']) => {
    setSaveData(prev => ({ ...prev, settings: newSettings }));
    audio.updateSettings(newSettings);
  };

  const handleSetRank = (rank: number) => {
      if (rank === 0) {
          // Wipe save data
          const fresh = wipeSaveData();
          setSaveData(fresh);
          setGameKey(prev => prev + 1);
          audio.init(fresh.settings);
      } else {
          // Set to specific rank
          const newTotalScore = getScoreForMidRank(rank);
          setSaveData(prev => ({
              ...prev,
              totalScore: newTotalScore,
              rank: rank,
              powerUpPoints: rank // Points = rank level
          }));
          setGameKey(prev => prev + 1); // Force remount to apply new score
      }
  };

  const handlePurchaseUpgrade = useCallback((upgradeId: string) => {
    setSaveData(prev => {
      const currentLevel = prev.powerUps[upgradeId] || 0;
      const maxLevel = 5;
      const cost = 1;

      if (prev.powerUpPoints < cost || currentLevel >= maxLevel) {
        return prev; // Can't purchase
      }

      return {
        ...prev,
        powerUpPoints: prev.powerUpPoints - cost,
        powerUps: {
          ...prev.powerUps,
          [upgradeId]: currentLevel + 1
        }
      };
    });
  }, []);

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
          onSetRank={handleSetRank}
          onPurchaseUpgrade={handlePurchaseUpgrade}
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
