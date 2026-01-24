import React from 'react';
import { UPGRADES } from '../constants';

interface UpgradePanelProps {
  powerUpPoints: number;
  upgrades: Record<string, number>;
  rank: number;
  onPurchase: (upgradeId: string) => void;
  onClose: () => void;
  equippedActives?: string[];
  onToggleEquip?: (upgradeId: string) => void;
  maxActiveSlots?: number; // Max actives player can equip (default 1)
}

// Get accent colors based on upgrade ID
const getUpgradeAccent = (upgradeId: string): { accent: string; text: string } => {
  // Complication-related upgrades get complication colors
  if (upgradeId === 'CAPACITOR_EFFICIENCY') return { accent: '#d82727', text: '#ff6b6b' }; // LASER red
  if (upgradeId === 'CIRCUIT_STABILIZER') return { accent: '#d36b28', text: '#ffa94d' }; // LIGHTS orange
  if (upgradeId === 'GEAR_LUBRICATION') return { accent: '#2d5a87', text: '#74c0fc' }; // CONTROLS blue
  // Default for other passives
  return { accent: '#2d7a4d', text: '#5bbc70' }; // Green
};

export const UpgradePanel: React.FC<UpgradePanelProps> = ({
  powerUpPoints,
  upgrades,
  rank,
  onPurchase,
  onClose,
  equippedActives = [],
  onToggleEquip,
  maxActiveSlots = 1
}) => {
  // Filter passive upgrades by player rank, sorted by unlock rank
  const availableUpgrades = Object.values(UPGRADES)
    .filter(u => u.type === 'passive' && u.unlockRank <= rank)
    .sort((a, b) => a.unlockRank - b.unlockRank);

  // Filter active abilities by player rank
  const availableActives = Object.values(UPGRADES)
    .filter(u => u.type === 'active' && u.unlockRank <= rank)
    .sort((a, b) => a.unlockRank - b.unlockRank);

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

        {/* HEADER: PASSIVE UPGRADES */}
        <text fill="#f2a743" fontFamily="'From Where You Are'" fontSize="32" transform="translate(291.5 115)" textAnchor="middle">
          PASSIVE UPGRADES
        </text>

        {/* Available Power Section */}
        <text fill="#6acbda" fontFamily="'Amazon Ember'" fontSize="18" transform="translate(291.5 160)" textAnchor="middle">
          AVAILABLE POWER
        </text>
        <text fill="#5bbc70" fontFamily="'Amazon Ember'" fontWeight="800" fontSize="48" transform="translate(291.5 215)" textAnchor="middle">
          {powerUpPoints}
        </text>

        {/* Close Button - X in top right */}
        <g
          className="cursor-pointer hover:opacity-80 transition-opacity"
          onClick={onClose}
        >
          <circle fill="#1d1d3a" cx="530" cy="90" r="24"/>
          <text fill="#f2a743" fontFamily="'Amazon Ember'" fontWeight="800" fontSize="28" transform="translate(530 100)" textAnchor="middle">
            ✕
          </text>
        </g>

        {/* Upgrades Content Area */}
        <foreignObject x="40" y="240" width="503" height="600">
          <div
            // @ts-ignore - xmlns is valid for foreignObject content
            xmlns="http://www.w3.org/1999/xhtml"
            className="w-full h-full overflow-y-auto pr-2"
            style={{ fontFamily: "'Amazon Ember', sans-serif" }}
          >
            {availableUpgrades.length === 0 ? (
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
              <div className="space-y-5">
                {availableUpgrades.map(upgrade => {
                  const currentLevel = upgrades[upgrade.id] || 0;
                  const isMaxLevel = currentLevel >= upgrade.maxLevel;
                  const canAfford = powerUpPoints >= upgrade.costPerLevel;
                  const canPurchase = canAfford && !isMaxLevel;
                  const accent = getUpgradeAccent(upgrade.id);

                  return (
                    <div
                      key={upgrade.id}
                      className="rounded-xl p-4 border"
                      style={{
                        backgroundColor: '#0c0f19',
                        borderColor: '#ffffff'
                      }}
                    >
                      {/* Upgrade Header */}
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3
                            className="font-bold tracking-wide"
                            style={{ color: accent.text, fontSize: '20px' }}
                          >
                            {upgrade.name}
                          </h3>
                          <p style={{ color: '#59acae', fontSize: '14px' }} className="mt-1">
                            {upgrade.desc}
                          </p>
                        </div>
                      </div>

                      {/* Level Indicator */}
                      <div className="flex items-center gap-2 my-3">
                        <span style={{ color: '#6acbda', fontSize: '14px' }}>
                          LVL
                        </span>
                        <div className="flex gap-1">
                          {Array.from({ length: upgrade.maxLevel }).map((_, i) => (
                            <div
                              key={i}
                              className="w-8 h-4 rounded-sm border"
                              style={{
                                borderColor: i < currentLevel ? accent.accent : '#59acae60',
                                backgroundColor: i < currentLevel ? accent.accent : 'transparent'
                              }}
                            />
                          ))}
                        </div>
                        <span
                          className="font-bold"
                          style={{ color: accent.text, fontSize: '18px' }}
                        >
                          {currentLevel}/{upgrade.maxLevel}
                        </span>
                      </div>

                      {/* Current Effect */}
                      {currentLevel > 0 && (
                        <div style={{ color: '#ffffff', fontSize: '16px' }} className="mb-2">
                          Current: {upgrade.formatEffect(currentLevel)}
                        </div>
                      )}

                      {/* Max Level Bonus */}
                      {isMaxLevel && upgrade.maxLevelBonus && (
                        <div
                          className="mb-2 italic"
                          style={{ color: '#5bbc70', fontSize: '16px' }}
                        >
                          MAX: {upgrade.maxLevelBonus}
                        </div>
                      )}

                      {/* Purchase Button */}
                      <button
                        onClick={() => onPurchase(upgrade.id)}
                        disabled={!canPurchase}
                        className="w-full mt-2 py-3 px-4 rounded-lg font-bold transition-all border-2"
                        style={{
                          borderColor: canPurchase ? accent.accent : '#59acae40',
                          color: canPurchase ? accent.text : '#59acae60',
                          backgroundColor: canPurchase ? accent.accent + '20' : 'transparent',
                          cursor: canPurchase ? 'pointer' : 'not-allowed',
                          fontSize: '16px'
                        }}
                      >
                        {isMaxLevel ? 'MAX LEVEL' : `UPGRADE (${upgrade.costPerLevel} PWR)`}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Active Abilities Section */}
            {availableActives.length > 0 && (
              <>
                <div
                  className="text-xl tracking-wide mt-6 mb-4 text-center"
                  style={{ color: '#f2a743', fontFamily: "'From Where You Are', sans-serif" }}
                >
                  ACTIVE ABILITIES ({equippedActives.length}/{maxActiveSlots})
                </div>
                <div className="space-y-4">
                  {availableActives.map(active => {
                    const currentLevel = upgrades[active.id] || 0;
                    const isUnlocked = currentLevel > 0;
                    const canAfford = powerUpPoints >= active.costPerLevel;
                    const canPurchase = canAfford && currentLevel === 0; // Actives are 1 level
                    const isEquipped = equippedActives.includes(active.id);

                    return (
                      <div
                        key={active.id}
                        className="rounded-xl p-4 border"
                        style={{
                          backgroundColor: '#0c0f19',
                          borderColor: isEquipped ? '#5bbc70' : '#ffffff'
                        }}
                      >
                        {/* Active Header */}
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3
                              className="font-bold tracking-wide"
                              style={{ color: '#f2a743', fontSize: '20px' }}
                            >
                              {active.name}
                            </h3>
                            <p style={{ color: '#59acae', fontSize: '14px' }} className="mt-1">
                              {active.desc}
                            </p>
                          </div>
                        </div>

                        {/* Effect */}
                        <div style={{ color: '#ffffff', fontSize: '16px' }} className="mb-3">
                          Effect: {active.formatEffect(1)}
                        </div>

                        {/* Equip Checkbox (only if unlocked) */}
                        {isUnlocked && onToggleEquip && (
                          <label
                            className="flex items-center gap-3 mb-2 p-2 rounded-lg"
                            style={{
                              backgroundColor: isEquipped ? '#5bbc7020' : 'transparent',
                              cursor: (!isEquipped && equippedActives.length >= maxActiveSlots) ? 'not-allowed' : 'pointer',
                              opacity: (!isEquipped && equippedActives.length >= maxActiveSlots) ? 0.5 : 1
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isEquipped}
                              onChange={() => onToggleEquip(active.id)}
                              disabled={!isEquipped && equippedActives.length >= maxActiveSlots}
                              className="w-5 h-5 accent-green-500"
                            />
                            <span
                              style={{
                                color: isEquipped ? '#5bbc70' : '#59acae',
                                fontSize: '16px',
                                fontWeight: isEquipped ? 'bold' : 'normal'
                              }}
                            >
                              {isEquipped ? 'EQUIPPED' : (equippedActives.length >= maxActiveSlots ? 'Slots Full' : 'Equip')}
                            </span>
                          </label>
                        )}

                        {/* Unlock Button (if not unlocked) */}
                        {!isUnlocked && (
                          <button
                            onClick={() => onPurchase(active.id)}
                            disabled={!canPurchase}
                            className="w-full mt-2 py-3 px-4 rounded-lg font-bold transition-all border-2"
                            style={{
                              borderColor: canPurchase ? '#f2a743' : '#59acae40',
                              color: canPurchase ? '#f2a743' : '#59acae60',
                              backgroundColor: canPurchase ? '#f2a74320' : 'transparent',
                              cursor: canPurchase ? 'pointer' : 'not-allowed',
                              fontSize: '16px'
                            }}
                          >
                            UNLOCK ({active.costPerLevel} PWR)
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </foreignObject>

        {/* Footer Tip */}
        <text fill="#59acae" fontFamily="'Amazon Ember'" fontSize="14" transform="translate(291.5 870)" textAnchor="middle">
          Earn 1 PWR per rank gained
        </text>
        </svg>
      </div>
    </div>
  );
};
