
import React, { useState, useEffect, useCallback } from 'react';
import Game from './Game';
import { Upgrades } from './components/Upgrades';
import { Settings } from './components/Settings';
import { HowToPlay } from './components/HowToPlay';
import { SaveData } from './types';
import { loadSaveData, saveGameData, wipeSaveData } from './utils/storage';
import { calculateRankDetails, getScoreForMidRank, getMilestonesInRange, calculateCappedProgression } from './utils/progression';
import { gameEventBus } from './core/events/EventBus';
import { GameEventType } from './core/events/GameEvents';
import { audio } from './utils/audio';
import { useAudioSubscription } from './hooks/useAudioSubscription';
import { UPGRADES } from './constants';
import { SoftBodyProto1 } from './prototypes/SoftBodyProto1';
import { SoftBodyProto2 } from './prototypes/SoftBodyProto2';
import { SoftBodyProto3 } from './prototypes/SoftBodyProto3';
import { SoftBodyProto4 } from './prototypes/SoftBodyProto4';
import { SoftBodyProto5 } from './prototypes/SoftBodyProto5';
import { SoftBodyProto5b } from './prototypes/SoftBodyProto5b';

type ViewState = 'GAME' | 'UPGRADES' | 'SETTINGS' | 'HOW_TO_PLAY';

// Check URL for prototype mode: ?proto=1, ?proto=2, ?proto=3, ?proto=5b
const getProtoMode = (): string | null => {
  const params = new URLSearchParams(window.location.search);
  return params.get('proto');
};

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

  const handleRunComplete = useCallback((result: { score: number; won: boolean }) => {
    setSaveData(prev => {
      const oldRankDetails = calculateRankDetails(prev.careerScore);

      // Use capped progression: win = guaranteed +1 rank, max +2 ranks per shift
      const { newCareerScore, ranksGained } = calculateCappedProgression(
        prev.careerScore,
        result.score,
        result.won
      );

      const newRankDetails = calculateRankDetails(newCareerScore);

      // Award 1 Point per Rank gained (no bonuses - exactly 1 per rank)
      const pointsEarned = ranksGained > 0 ? ranksGained : 0;

      // Track milestones crossed (for future UI celebration, no bonus points)
      const milestoneCandidates = getMilestonesInRange(oldRankDetails.rank, newRankDetails.rank);
      const newMilestones = milestoneCandidates.filter(m => !prev.milestonesReached.includes(m));

      // Emit event for UI celebration (future use)
      if (newMilestones.length > 0) {
        gameEventBus.emit(GameEventType.MILESTONE_REACHED, { milestones: newMilestones });
      }

      return {
        ...prev,
        careerScore: newCareerScore,
        careerRank: newRankDetails.rank,
        scraps: prev.scraps + pointsEarned,
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
          // Set to specific rank - reset powerUps so player can test fresh
          const newOperatorXP = getScoreForMidRank(rank);
          setSaveData(prev => ({
              ...prev,
              careerScore: newOperatorXP,
              careerRank: rank,
              scraps: rank, // Points = rank level
              powerUps: {} // Reset all purchased upgrades
          }));
          setGameKey(prev => prev + 1); // Force remount to apply new score
      }
  };

  const handlePurchaseUpgrade = useCallback((upgradeId: string) => {
    setSaveData(prev => {
      const currentLevel = prev.powerUps[upgradeId] || 0;
      const upgrade = UPGRADES[upgradeId as keyof typeof UPGRADES];
      const maxLevel = upgrade?.maxLevel || 4;
      const cost = upgrade?.costPerLevel || 1;

      if (prev.scraps < cost || currentLevel >= maxLevel) {
        return prev; // Can't purchase
      }

      return {
        ...prev,
        scraps: prev.scraps - cost,
        powerUps: {
          ...prev.powerUps,
          [upgradeId]: currentLevel + 1
        }
      };
    });
  }, []);

  const handleRefundUpgrade = useCallback((upgradeId: string) => {
    setSaveData(prev => {
      const currentLevel = prev.powerUps[upgradeId] || 0;
      const upgrade = UPGRADES[upgradeId as keyof typeof UPGRADES];
      const refund = upgrade?.costPerLevel || 1;

      if (currentLevel <= 0) {
        return prev; // Nothing to refund
      }

      // If active is equipped and we're removing its only level, unequip it
      let newEquipped = prev.equippedActives;
      if (currentLevel === 1 && prev.equippedActives.includes(upgradeId)) {
        newEquipped = prev.equippedActives.filter(id => id !== upgradeId);
      }

      return {
        ...prev,
        scraps: prev.scraps + refund,
        powerUps: {
          ...prev.powerUps,
          [upgradeId]: currentLevel - 1
        },
        equippedActives: newEquipped
      };
    });
  }, []);

  const handleToggleEquip = useCallback((upgradeId: string) => {
    setSaveData(prev => {
      const isCurrentlyEquipped = prev.equippedActives.includes(upgradeId);
      let newEquipped: string[];

      if (isCurrentlyEquipped) {
        // Unequip
        newEquipped = prev.equippedActives.filter(id => id !== upgradeId);
      } else {
        // Equip (for now, allow only 1 active - can expand with ACTIVE_EXPANSION_SLOT later)
        // Check if player has expansion slot upgrade for multiple actives
        const expansionSlots = (prev.powerUps['ACTIVE_EXPANSION_SLOT'] || 0) +
                               (prev.powerUps['ACTIVE_EXPANSION_SLOT_2'] || 0);
        const maxActives = 1 + expansionSlots;

        if (prev.equippedActives.length >= maxActives) {
          // Replace the last equipped active
          newEquipped = [...prev.equippedActives.slice(0, maxActives - 1), upgradeId];
        } else {
          newEquipped = [...prev.equippedActives, upgradeId];
        }
      }

      return {
        ...prev,
        equippedActives: newEquipped
      };
    });
  }, []);

  // Render prototype if ?proto=N in URL
  const protoMode = getProtoMode();
  if (protoMode === '1') return <SoftBodyProto1 />;
  if (protoMode === '2') return <SoftBodyProto2 />;
  if (protoMode === '3') return <SoftBodyProto3 />;
  if (protoMode === '4') return <SoftBodyProto4 />;
  if (protoMode === '5') return <SoftBodyProto5 />;
  if (protoMode === '5b') return <SoftBodyProto5b />;

  return (
    <div className="w-full h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
      {view === 'GAME' && (
        <Game
          key={gameKey}
          onExit={() => { /* No Exit in Console Mode concept anymore, just idle */ }}
          onRunComplete={handleRunComplete}
          initialTotalScore={saveData.careerScore}
          powerUps={saveData.powerUps}
          scraps={saveData.scraps}
          settings={saveData.settings}
          onOpenSettings={() => setView('SETTINGS')}
          onOpenHelp={() => setView('HOW_TO_PLAY')}
          onOpenUpgrades={() => setView('UPGRADES')}
          onSetRank={handleSetRank}
          onPurchaseUpgrade={handlePurchaseUpgrade}
          onRefundUpgrade={handleRefundUpgrade}
          equippedActives={saveData.equippedActives}
          onToggleEquip={handleToggleEquip}
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
