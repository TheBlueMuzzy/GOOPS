import React from 'react';
import { UPGRADES } from '../constants';
import { X } from 'lucide-react';

interface UpgradePanelProps {
  powerUpPoints: number;
  upgrades: Record<string, number>;
  onPurchase: (upgradeId: string) => void;
  onClose: () => void;
}

const SYSTEM_UPGRADES = ['LASER', 'LIGHTS', 'CONTROLS'] as const;

const UPGRADE_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  LASER: { bg: 'bg-red-950/80', border: 'border-red-500', text: 'text-red-400', glow: 'shadow-red-500/30' },
  LIGHTS: { bg: 'bg-yellow-950/80', border: 'border-yellow-500', text: 'text-yellow-400', glow: 'shadow-yellow-500/30' },
  CONTROLS: { bg: 'bg-blue-950/80', border: 'border-blue-500', text: 'text-blue-400', glow: 'shadow-blue-500/30' },
};

export const UpgradePanel: React.FC<UpgradePanelProps> = ({
  powerUpPoints,
  upgrades,
  onPurchase,
  onClose
}) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-[90%] max-w-md bg-slate-900 border-2 border-slate-600 rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-600">
          <h2 className="text-xl font-bold text-slate-100 tracking-wider font-mono">SYSTEM UPGRADES</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-700 transition-colors"
          >
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        {/* Points Display */}
        <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-mono text-sm">AVAILABLE POWER</span>
            <span className="text-2xl font-bold text-emerald-400 font-mono">{powerUpPoints}</span>
          </div>
        </div>

        {/* Upgrades List */}
        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {SYSTEM_UPGRADES.map(upgradeId => {
            const config = UPGRADES[upgradeId];
            const currentLevel = upgrades[upgradeId] || 0;
            const isMaxLevel = currentLevel >= config.maxLevel;
            const canAfford = powerUpPoints >= config.costPerLevel;
            const canPurchase = canAfford && !isMaxLevel;
            const colors = UPGRADE_COLORS[upgradeId];

            return (
              <div
                key={upgradeId}
                className={`${colors.bg} ${colors.border} border rounded-lg p-4 shadow-lg ${colors.glow}`}
              >
                {/* Upgrade Header */}
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className={`font-bold ${colors.text} font-mono text-lg`}>
                      {config.name}
                    </h3>
                    <p className="text-slate-400 text-sm mt-1">{config.desc}</p>
                  </div>
                </div>

                {/* Level Indicator */}
                <div className="flex items-center gap-2 my-3">
                  <span className="text-slate-500 text-xs font-mono">LVL</span>
                  <div className="flex gap-1">
                    {Array.from({ length: config.maxLevel }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-6 h-3 rounded-sm border ${
                          i < currentLevel
                            ? `${colors.border} ${colors.bg.replace('/80', '')}`
                            : 'border-slate-600 bg-slate-800'
                        }`}
                      />
                    ))}
                  </div>
                  <span className={`text-sm font-mono ${colors.text}`}>
                    {currentLevel}/{config.maxLevel}
                  </span>
                </div>

                {/* Current Effect */}
                {currentLevel > 0 && (
                  <div className="text-sm text-slate-300 font-mono mb-2">
                    Current: {config.formatEffect(currentLevel)}
                  </div>
                )}

                {/* Max Level Bonus */}
                {isMaxLevel && config.maxLevelBonus && (
                  <div className="text-sm text-emerald-400 font-mono mb-2 italic">
                    MAX: {config.maxLevelBonus}
                  </div>
                )}

                {/* Purchase Button */}
                <button
                  onClick={() => onPurchase(upgradeId)}
                  disabled={!canPurchase}
                  className={`w-full mt-2 py-2 px-4 rounded font-mono font-bold text-sm transition-all ${
                    canPurchase
                      ? `${colors.border} border-2 ${colors.text} hover:bg-slate-700 active:scale-95`
                      : 'border-2 border-slate-600 text-slate-600 cursor-not-allowed'
                  }`}
                >
                  {isMaxLevel ? 'MAX LEVEL' : `UPGRADE (${config.costPerLevel} PWR)`}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer Tip */}
        <div className="px-4 py-3 bg-slate-800/50 border-t border-slate-700">
          <p className="text-slate-500 text-xs font-mono text-center">
            Earn 1 PWR per rank gained
          </p>
        </div>
      </div>
    </div>
  );
};
