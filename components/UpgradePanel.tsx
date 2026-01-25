import React, { useState, useRef, useEffect } from 'react';
import { UPGRADES } from '../constants';
import { ChevronLeft } from 'lucide-react';

// Tab definitions with unlock conditions
type TabId = 'actives' | 'features' | 'complications' | 'passives';

interface TabDef {
  id: TabId;
  label: string;
  unlockRank: number;
  color: string;
}

// Ordered by final display order (left to right when all unlocked)
const TAB_DEFS: TabDef[] = [
  { id: 'actives', label: 'ACTIVES', unlockRank: 5, color: '#fbbf24' },      // Gold
  { id: 'features', label: 'FEATURES', unlockRank: 20, color: '#a78bfa' },   // Purple
  { id: 'complications', label: 'CONSOLE', unlockRank: 2, color: '#f97316' },  // Orange
  { id: 'passives', label: 'PASSIVES', unlockRank: 3, color: '#5bbc70' },    // Green
];

interface UpgradePanelProps {
  powerUpPoints: number;
  upgrades: Record<string, number>;
  rank: number;
  onPurchase: (upgradeId: string) => void;
  onRefund?: (upgradeId: string) => void;
  onClose: () => void;
  equippedActives?: string[];
  onToggleEquip?: (upgradeId: string) => void;
  maxActiveSlots?: number;
}

// Get accent colors based on upgrade type and ID
const getUpgradeAccent = (upgradeId: string, type: string): { accent: string; text: string } => {
  // Actives get gold
  if (type === 'active') return { accent: '#b45309', text: '#fbbf24' };
  // Features get purple
  if (type === 'feature') return { accent: '#7c3aed', text: '#a78bfa' };
  // Complication-related passives get complication colors
  if (upgradeId === 'CAPACITOR_EFFICIENCY') return { accent: '#d82727', text: '#ff6b6b' };
  if (upgradeId === 'CIRCUIT_STABILIZER') return { accent: '#d36b28', text: '#ffa94d' };
  if (upgradeId === 'GEAR_LUBRICATION') return { accent: '#2d5a87', text: '#74c0fc' };
  // Default passives get green
  return { accent: '#2d7a4d', text: '#5bbc70' };
};

export const UpgradePanel: React.FC<UpgradePanelProps> = ({
  powerUpPoints,
  upgrades,
  rank,
  onPurchase,
  onRefund,
  onClose,
  equippedActives = [],
  onToggleEquip,
  maxActiveSlots = 1
}) => {
  // Get unlocked tabs in display order
  const unlockedTabs = TAB_DEFS.filter(tab => tab.unlockRank <= rank);

  // Default to first unlocked tab
  const [activeTab, setActiveTab] = useState<TabId>(unlockedTabs[0]?.id || 'complications');

  // Swipe handling (follows periscope drag pattern)
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const SWIPE_THRESHOLD = 50;

  const handleSwipeStart = (x: number, y: number) => {
    setIsDragging(true);
    startX.current = x;
    startY.current = y;
  };

  const handleSwipeEnd = (x: number, y: number) => {
    if (!isDragging) return;
    setIsDragging(false);

    const deltaX = x - startX.current;
    const deltaY = y - startY.current;

    // Only register horizontal swipes (more horizontal than vertical, min threshold)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > SWIPE_THRESHOLD) {
      const currentIndex = unlockedTabs.findIndex(t => t.id === activeTab);
      if (deltaX > 0 && currentIndex < unlockedTabs.length - 1) {
        // Swipe right = next tab (to the right)
        setActiveTab(unlockedTabs[currentIndex + 1].id);
      } else if (deltaX < 0 && currentIndex > 0) {
        // Swipe left = previous tab (to the left)
        setActiveTab(unlockedTabs[currentIndex - 1].id);
      }
    }
  };

  // Global event listeners for swipe (follows periscope pattern)
  useEffect(() => {
    const mouseUp = (e: MouseEvent) => {
      if (isDragging) handleSwipeEnd(e.clientX, e.clientY);
    };
    const touchEnd = (e: TouchEvent) => {
      if (isDragging && e.changedTouches[0]) {
        handleSwipeEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
      }
    };

    if (isDragging) {
      window.addEventListener('mouseup', mouseUp);
      window.addEventListener('touchend', touchEnd);
    }
    return () => {
      window.removeEventListener('mouseup', mouseUp);
      window.removeEventListener('touchend', touchEnd);
    };
  }, [isDragging, activeTab, unlockedTabs]);

  // Filter upgrades based on active tab
  const getFilteredUpgrades = () => {
    const allUpgrades = Object.values(UPGRADES).filter(u => u.unlockRank <= rank);

    switch (activeTab) {
      case 'actives':
        return allUpgrades.filter(u => u.type === 'active').sort((a, b) => a.unlockRank - b.unlockRank);
      case 'features':
        return allUpgrades.filter(u => u.type === 'feature').sort((a, b) => a.unlockRank - b.unlockRank);
      case 'complications':
        return allUpgrades.filter(u => (u as any).category === 'complication').sort((a, b) => a.unlockRank - b.unlockRank);
      case 'passives':
        // Passives that are NOT complications
        return allUpgrades.filter(u => u.type === 'passive' && (u as any).category !== 'complication').sort((a, b) => a.unlockRank - b.unlockRank);
      default:
        return [];
    }
  };

  const filteredUpgrades = getFilteredUpgrades();
  const hasAnyUpgrades = unlockedTabs.length > 0;

  // Render a single upgrade card
  const renderUpgradeCard = (upgrade: typeof UPGRADES[keyof typeof UPGRADES]) => {
    const currentLevel = upgrades[upgrade.id] || 0;
    const isMaxLevel = currentLevel >= upgrade.maxLevel;
    const canAfford = powerUpPoints >= upgrade.costPerLevel;
    const canIncrease = canAfford && !isMaxLevel;
    const canDecrease = currentLevel > 0;
    const accent = getUpgradeAccent(upgrade.id, upgrade.type);
    const isActive = upgrade.type === 'active';
    const isEquipped = equippedActives.includes(upgrade.id);

    return (
      <div
        key={upgrade.id}
        className="rounded-xl p-4 border"
        style={{
          backgroundColor: '#0c0f19',
          borderColor: isActive && isEquipped ? '#5bbc70' : '#ffffff40'
        }}
      >
        {/* Upgrade Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <h3
              className="font-bold tracking-wide"
              style={{ color: accent.text, fontSize: '18px' }}
            >
              {upgrade.name}
            </h3>
            <p style={{ color: '#59acae', fontSize: '13px' }} className="mt-1">
              {upgrade.desc}
            </p>
          </div>
          {/* Equip toggle for actives (top right) */}
          {isActive && currentLevel > 0 && onToggleEquip && (
            <button
              onClick={() => onToggleEquip(upgrade.id)}
              disabled={!isEquipped && equippedActives.length >= maxActiveSlots}
              className="ml-2 px-3 py-1 rounded-lg font-bold text-sm border-2 transition-all"
              style={{
                borderColor: isEquipped ? '#5bbc70' : '#59acae60',
                color: isEquipped ? '#5bbc70' : '#59acae',
                backgroundColor: isEquipped ? '#5bbc7020' : 'transparent',
                cursor: (!isEquipped && equippedActives.length >= maxActiveSlots) ? 'not-allowed' : 'pointer',
                opacity: (!isEquipped && equippedActives.length >= maxActiveSlots) ? 0.5 : 1
              }}
            >
              {isEquipped ? 'ON' : 'OFF'}
            </button>
          )}
        </div>

        {/* Level Indicator with +/- buttons */}
        <div className="flex items-center gap-3 my-3">
          {/* Minus Button */}
          <button
            onClick={() => canDecrease && onRefund?.(upgrade.id)}
            disabled={!canDecrease}
            className="w-8 h-8 rounded-lg font-bold text-xl border-2 transition-all flex items-center justify-center"
            style={{
              borderColor: canDecrease ? accent.accent : '#59acae30',
              color: canDecrease ? accent.text : '#59acae40',
              backgroundColor: canDecrease ? accent.accent + '20' : 'transparent',
              cursor: canDecrease ? 'pointer' : 'not-allowed'
            }}
          >
            −
          </button>

          {/* Level boxes */}
          <div className="flex gap-1 flex-1 justify-center">
            {Array.from({ length: upgrade.maxLevel }).map((_, i) => (
              <div
                key={i}
                className="h-4 rounded-sm border flex-1 max-w-8"
                style={{
                  borderColor: i < currentLevel ? accent.accent : '#59acae40',
                  backgroundColor: i < currentLevel ? accent.accent : 'transparent'
                }}
              />
            ))}
          </div>

          {/* Plus Button */}
          <button
            onClick={() => canIncrease && onPurchase(upgrade.id)}
            disabled={!canIncrease}
            className="w-8 h-8 rounded-lg font-bold text-xl border-2 transition-all flex items-center justify-center"
            style={{
              borderColor: canIncrease ? accent.accent : '#59acae30',
              color: canIncrease ? accent.text : '#59acae40',
              backgroundColor: canIncrease ? accent.accent + '20' : 'transparent',
              cursor: canIncrease ? 'pointer' : 'not-allowed'
            }}
          >
            +
          </button>

          {/* Level text */}
          <span
            className="font-bold w-12 text-right"
            style={{ color: accent.text, fontSize: '16px' }}
          >
            {currentLevel}/{upgrade.maxLevel}
          </span>
        </div>

        {/* Current Effect + Max on same line */}
        <div className="flex justify-between items-start" style={{ fontSize: '14px' }}>
          <div style={{ color: '#ffffff' }}>
            {isActive ? (
              <>Effect: {upgrade.formatEffect(1)}</>
            ) : currentLevel > 0 ? (
              <>Current: {upgrade.formatEffect(currentLevel)}</>
            ) : (
              <span style={{ color: '#59acae' }}>Current: Spend points to upgrade</span>
            )}
          </div>
          {isMaxLevel && upgrade.maxLevelBonus && (
            <div className="italic text-right ml-2" style={{ color: '#5bbc70' }}>
              Max: {upgrade.maxLevelBonus}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render tab bar
  const renderTabBar = () => {
    if (unlockedTabs.length === 0) return null;

    return (
      <div className="flex w-full mb-3" style={{ height: '36px' }}>
        {unlockedTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="font-bold text-center transition-all"
              style={{
                width: '25%',
                backgroundColor: isActive ? tab.color + '30' : 'transparent',
                color: isActive ? tab.color : '#59acae',
                borderBottom: isActive ? `3px solid ${tab.color}` : '3px solid transparent',
                fontSize: '11px',
                padding: '8px 4px',
                fontFamily: "'From Where You Are', sans-serif",
                letterSpacing: '0.05em'
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      {/* Container matches ConsoleView 9:16 aspect ratio */}
      <div
        className="relative"
        style={{
          width: 'min(100vw, 100dvh * 0.5625)',
          height: 'min(100dvh, 100vw * 1.7778)',
        }}
      >
        {/* SVG Monitor Container - matches EndGameScreen structure */}
        <svg
          viewBox="0 0 583.67 910"
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
        {/* Monitor Body - Orange */}
        <path fill="#f2a743" d="M16.86,32.56h549.95c9.31,0,16.86,7.55,16.86,16.86v847.89c0,6.78-5.5,12.28-12.28,12.28H12.28c-6.78,0-12.28-5.5-12.28-12.28V49.42c0-9.31,7.55-16.86,16.86-16.86Z"/>
        <path fill="#d36b28" d="M574.73,37.21H8.94c-3.39,0-5.14-4.05-2.82-6.52L25.37,10.16C31.46,3.68,39.96,0,48.85,0h485.98c8.89,0,17.39,3.68,23.47,10.16l19.25,20.52c2.32,2.47.57,6.52-2.82,6.52Z"/>

        {/* Bezel Outline - Dark Blue */}
        <path fill="#1d1d3a" d="M520.88,888.84H62.79c-23.18,0-42.03-18.86-42.03-42.03V100c0-23.18,18.86-42.03,42.03-42.03h458.1c23.18,0,42.03,18.86,42.03,42.03v746.81c0,23.18-18.86,42.03-42.03,42.03ZM62.79,62.96c-20.42,0-37.03,16.61-37.03,37.03v746.81c0,20.42,16.61,37.03,37.03,37.03h458.1c20.42,0,37.03-16.61,37.03-37.03V100c0-20.42-16.61-37.03-37.03-37.03H62.79Z"/>

        {/* Screen Background - Darker Blue */}
        <rect fill="#1f1f38" x="23.26" y="60.46" width="537.16" height="825.87" rx="39.53" ry="39.53"/>

        {/* HEADER: System Upgrades (left) + Points (right) */}
        <text fill="#f2a743" fontFamily="'From Where You Are'" fontSize="28" transform="translate(50 105)">
          SYSTEM UPGRADES
        </text>
        <text fill="#5bbc70" fontFamily="'Amazon Ember'" fontWeight="800" fontSize="32" transform="translate(530 105)" textAnchor="end">
          {powerUpPoints} PWR
        </text>

        {/* Upgrades Content Area */}
        <foreignObject x="40" y="125" width="503" height="720">
          {/* Hide scrollbar for webkit browsers */}
          {/* @ts-ignore */}
          <style>{`.upgrade-scroll::-webkit-scrollbar { display: none; }`}</style>
          <div
            // @ts-ignore - xmlns is valid for foreignObject content
            xmlns="http://www.w3.org/1999/xhtml"
            className="upgrade-scroll w-full h-full overflow-y-auto"
            style={{
              fontFamily: "'Amazon Ember', sans-serif",
              scrollbarWidth: 'none',  /* Firefox */
              msOverflowStyle: 'none'  /* IE/Edge */
            }}
            onMouseDown={(e) => handleSwipeStart(e.clientX, e.clientY)}
            onTouchStart={(e) => handleSwipeStart(e.touches[0].clientX, e.touches[0].clientY)}
          >
            {!hasAnyUpgrades ? (
              // Empty state
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <p
                  className="text-2xl tracking-wide mb-3"
                  style={{ color: '#6acbda', fontFamily: "'From Where You Are', sans-serif" }}
                >
                  NO UPGRADES AVAILABLE
                </p>
                <p style={{ color: '#59acae', fontSize: '16px' }}>
                  Reach Rank 2 to unlock your first upgrade
                </p>
              </div>
            ) : (
              <div className="pb-20">
                {/* PWR earning message - subtitle */}
                <div
                  className="text-lg mb-3 text-center"
                  style={{ color: '#fbbf24', fontFamily: "'Amazon Ember', sans-serif" }}
                >
                  Earn PWR by Increasing your Operator Rank
                </div>

                {/* Tab Bar */}
                {renderTabBar()}

                {/* Filtered upgrades */}
                <div className="space-y-3">
                  {filteredUpgrades.length > 0 ? (
                    filteredUpgrades.map(renderUpgradeCard)
                  ) : (
                    <div className="text-center py-8" style={{ color: '#59acae' }}>
                      No upgrades available in this category yet.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </foreignObject>

        </svg>

        {/* Floating Back Button (like Settings) */}
        <div className="absolute bottom-8 left-0 right-0 flex justify-center z-20 pointer-events-none">
          <button
            onClick={onClose}
            className="pointer-events-auto flex items-center justify-center bg-green-700 hover:bg-green-600 text-black rounded-full shadow-[0_0_20px_rgba(21,128,61,0.4)] transition-all active:scale-95 border border-green-500/30"
            style={{
              width: 'min(13.2vw, 7.4vh)',
              height: 'min(13.2vw, 7.4vh)'
            }}
          >
            <ChevronLeft className="w-1/2 h-1/2 stroke-[3]" />
          </button>
        </div>
      </div>
    </div>
  );
};
