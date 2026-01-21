
import { PieceDefinition, PieceType } from './types';

export const VISIBLE_WIDTH = 12; // 12 units wide
export const TOTAL_WIDTH = 30;   // Cylindrical width (3 screens wide approx)
export const VISIBLE_HEIGHT = 16; 
export const TOTAL_HEIGHT = 19;  // 3 rows of buffer at the top
export const BUFFER_HEIGHT = TOTAL_HEIGHT - VISIBLE_HEIGHT;

export const COMBO_BONUS = 50;

// Linear Interpolation: 1 block = 1000ms, 25 blocks = 10000ms
// T = m * S + c
// 1000 = m + c
// 10000 = 25m + c
// 9000 = 24m -> m = 375
// 1000 = 375 + c -> c = 625
export const BASE_FILL_DURATION = 0; // Base time
export const PER_BLOCK_DURATION = 375;  // Extra time per block in group

// Timer Constants
export const INITIAL_TIME_MS = 60 * 1000;

// Pressure / Time Recovery Constants
export const PRESSURE_RECOVERY_BASE_MS = 0; // Removed base per pop
export const PRESSURE_RECOVERY_PER_UNIT_MS = 100; // +0.1s per unit
export const PRESSURE_TIER_THRESHOLD = 15; // Tier 1 starts at 15
export const PRESSURE_TIER_STEP = 10; // New tier every 10 blocks
export const PRESSURE_TIER_BONUS_MS = 250; // +0.25s per tier

// Upgrade System Configuration
// Two types: 'passive' (always on) and 'active' (equippable, charges via crack-goop pops)
// Upgrades unlock at specific ranks and are revealed to player at that time

export const UPGRADES = {
  // === RANK 1-4: COMPLICATION PASSIVES ===

  LASER: {
    id: 'LASER',
    name: 'CAPACITOR EFFICIENCY',
    desc: 'Reduces laser capacitor drain rate when popping goop.',
    type: 'passive' as const,
    unlockRank: 1,
    costPerLevel: 1,
    maxLevel: 5,
    effectPerLevel: 0.05, // -5% drain per level (0.95, 0.90, 0.85, 0.80, 0.75)
    formatEffect: (lvl: number) => `-${lvl * 5}% Drain Rate`,
    maxLevelBonus: 'No center targets in Reset Laser puzzle'
  },

  LIGHTS: {
    id: 'LIGHTS',
    name: 'CIRCUIT STABILIZER',
    desc: 'Reduces probability of lights malfunction triggering.',
    type: 'passive' as const,
    unlockRank: 2,
    costPerLevel: 1,
    maxLevel: 5,
    effectPerLevel: 0.06, // -6% trigger chance per level (44%, 38%, 32%, 26%, 20%)
    formatEffect: (lvl: number) => `-${lvl * 6}% Trigger Chance`,
    maxLevelBonus: '3-button sequence instead of 4'
  },

  CONTROLS: {
    id: 'CONTROLS',
    name: 'HEAT SINK UPGRADE',
    desc: 'Increases heat dissipation rate when idle.',
    type: 'passive' as const,
    unlockRank: 3,
    costPerLevel: 1,
    maxLevel: 5,
    effectPerLevel: 0.10, // +10% dissipation per level (55, 60, 65, 70, 75 per sec)
    formatEffect: (lvl: number) => `+${lvl * 10}% Heat Dissipation`,
    maxLevelBonus: '3 alignments instead of 4'
  },

  AUTO_POPPER: {
    id: 'AUTO_POPPER',
    name: 'AUTO-POPPER',
    desc: 'At end of game, remaining goop has a chance to auto-pop before penalty.',
    type: 'passive' as const,
    unlockRank: 4,
    costPerLevel: 1,
    maxLevel: 5,
    // Base: 80% first unit, -15% per unit. Each level reduces drop by 1% (14, 13, 12, 11, 10)
    effectPerLevel: 0.01,
    formatEffect: (lvl: number) => `-${15 - lvl}% decay per unit`,
    maxLevelBonus: undefined
  },

  // === RANK 5: FIRST ACTIVE ===

  COOLDOWN_BOOSTER: {
    id: 'COOLDOWN_BOOSTER',
    name: 'COOLDOWN BOOSTER',
    desc: 'When activated, extends all active malfunction cooldowns.',
    type: 'active' as const,
    unlockRank: 5,
    costPerLevel: 1,
    maxLevel: 5,
    chargeCost: 8, // crack-goop pops to charge
    // +10%, +15%, +20%, +25%, +30% cooldown extension
    effectPerLevel: 0.05,
    formatEffect: (lvl: number) => `+${5 + lvl * 5}% Cooldown`,
    maxLevelBonus: undefined
  },

  // === RANK 10: BAND 1 (JUNK) PASSIVE ===

  JUNK_UNIFORMITY: {
    id: 'JUNK_UNIFORMITY',
    name: 'JUNK UNIFORMITY',
    desc: 'Starting junk is more likely to be the same color.',
    type: 'passive' as const,
    unlockRank: 10,
    costPerLevel: 1,
    maxLevel: 5,
    effectPerLevel: 0.10, // +10% same-color chance per level
    formatEffect: (lvl: number) => `+${lvl * 10}% Same Color`,
    maxLevelBonus: undefined
  },

  // === RANK 15: BAND 1 ACTIVE ===

  GOOPER: {
    id: 'GOOPER',
    name: 'GOOPER',
    desc: 'When activated, drops same-color junk across the entire board.',
    type: 'active' as const,
    unlockRank: 15,
    costPerLevel: 1,
    maxLevel: 6,
    chargeCost: 12, // crack-goop pops to charge
    // Spacing: 3-5 -> 3-4 -> 2-4 -> 2-3 -> 1-3 -> 1-2
    effectPerLevel: 1,
    formatEffect: (lvl: number) => {
      const spacings = ['3-5', '3-4', '2-4', '2-3', '1-3', '1-2'];
      return `Every ${spacings[Math.min(lvl - 1, 5)]} spaces`;
    },
    maxLevelBonus: undefined
  },

  // === RANK 20: ACTIVE SLOT EXPANSION ===

  ACTIVE_SLOT_2: {
    id: 'ACTIVE_SLOT_2',
    name: 'ACTIVE SLOT +1',
    desc: 'Allows equipping a second active ability simultaneously.',
    type: 'passive' as const,
    unlockRank: 20,
    costPerLevel: 1,
    maxLevel: 1,
    effectPerLevel: 1,
    formatEffect: () => '2 Active Slots',
    maxLevelBonus: undefined
  }
};

// Helper to get upgrades by type
export const getPassiveUpgrades = () =>
  Object.values(UPGRADES).filter(u => u.type === 'passive');

export const getActiveUpgrades = () =>
  Object.values(UPGRADES).filter(u => u.type === 'active');

export const getUpgradesUnlockedAtRank = (rank: number) =>
  Object.values(UPGRADES).filter(u => u.unlockRank === rank);

export const getUpgradesAvailableAtRank = (rank: number) =>
  Object.values(UPGRADES).filter(u => u.unlockRank <= rank);

// Backwards compatibility alias
export const UPGRADE_CONFIG = UPGRADES;
export const SYSTEM_UPGRADE_CONFIG = UPGRADES;

// The 4 Game Colors
export const GAME_COLORS = [
  '#ef4444', // Red
  '#3b82f6', // Blue
  '#22c55e', // Green
  '#eab308', // Yellow
];

export const COLORS = {
  RED: '#ef4444',
  BLUE: '#3b82f6',
  GREEN: '#22c55e',
  YELLOW: '#eab308',
  TEAL: '#14b8a6',   // Rank 2+
  WHITE: '#f8fafc',  // Rank 5+
  ORANGE: '#f97316', // Rank 8+
  
  GRID_BG: '#020617', // Very dark slate (almost black)
  GRID_EMPTY: '#1e293b', // Dark slate for grid lines
};

const makePiece = (type: PieceType, coords: number[][]): PieceDefinition => ({
  type,
  color: COLORS.RED, // Default placeholder, will be randomized on spawn
  cells: coords.map(([x, y]) => ({ x, y })),
});

// SRS-ish definitions
export const PIECES: PieceDefinition[] = [
  // I
  makePiece(PieceType.I, [[-1, 0], [0, 0], [1, 0], [2, 0]]),
  // J
  makePiece(PieceType.J, [[-1, -1], [-1, 0], [0, 0], [1, 0]]),
  // L
  makePiece(PieceType.L, [[1, -1], [-1, 0], [0, 0], [1, 0]]),
  // O
  makePiece(PieceType.O, [[0, 0], [1, 0], [0, 1], [1, 1]]),
  // S
  makePiece(PieceType.S, [[0, 0], [1, 0], [0, 1], [-1, 1]]),
  // T
  makePiece(PieceType.T, [[0, -1], [-1, 0], [0, 0], [1, 1]]), // T shape corrected slightly to standard T
  // Z
  makePiece(PieceType.Z, [[-1, 0], [0, 0], [0, 1], [1, 1]]),
];
