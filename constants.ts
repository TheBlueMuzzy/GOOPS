
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

// Rotation tracking (for CONTROLS heat detection)
export const ROTATION_BUFFER_SIZE = 30; // Max rotations tracked (circular buffer)
export const ROTATION_WINDOW_MS = 3000; // 3 second window for heat calculation

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
  // === ONBOARDING BAND (Ranks 0-9) ===

  CIRCUIT_STABILIZER: {
    id: 'CIRCUIT_STABILIZER',
    name: 'Circuit Stabilizer',
    desc: 'Reduces probability of lights malfunction triggering.',
    type: 'passive' as const,
    unlockRank: 2,
    costPerLevel: 1,
    maxLevel: 4,
    effectPerLevel: 0.075, // -7.5% trigger chance per level
    formatEffect: (lvl: number) => `-${(lvl * 7.5).toFixed(1)}% Trigger Chance`,
    maxLevelBonus: '3-button sequence instead of 4'
  },

  AUTO_POPPER: {
    id: 'AUTO_POPPER',
    name: 'Auto-Popper',
    desc: 'At end of game, remaining goop has a chance to auto-pop before penalty.',
    type: 'passive' as const,
    unlockRank: 3,
    costPerLevel: 1,
    maxLevel: 4,
    // Base decay: -20% per unit. Each level reduces decay by 4% (20, 16, 12, 8, 4)
    effectPerLevel: 0.04,
    formatEffect: (lvl: number) => `-${20 - lvl * 4}% decay per unit`,
    maxLevelBonus: undefined
  },

  CAPACITOR_EFFICIENCY: {
    id: 'CAPACITOR_EFFICIENCY',
    name: 'Capacitor Efficiency',
    desc: 'Reduces laser capacitor drain rate when popping goop.',
    type: 'passive' as const,
    unlockRank: 4,
    costPerLevel: 1,
    maxLevel: 4,
    effectPerLevel: 0.0625, // -6.25% drain per level
    formatEffect: (lvl: number) => `-${(lvl * 6.25).toFixed(2)}% Drain Rate`,
    maxLevelBonus: 'No center targets in Reset Laser puzzle'
  },

  COOLDOWN_BOOSTER: {
    id: 'COOLDOWN_BOOSTER',
    name: 'Cooldown Booster',
    desc: 'When activated, extends all active malfunction cooldowns.',
    type: 'active' as const,
    unlockRank: 5,
    costPerLevel: 1,
    maxLevel: 1,
    chargeCost: 8, // Legacy - will be replaced by cooldown system
    effectPerLevel: 0.25, // +25% cooldown extension when activated
    formatEffect: () => '+25% Cooldown Extension',
    maxLevelBonus: undefined
  },

  GEAR_LUBRICATION: {
    id: 'GEAR_LUBRICATION',
    name: 'Gear Lubrication',
    desc: 'Increases heat dissipation rate when idle.',
    type: 'passive' as const,
    unlockRank: 6,
    costPerLevel: 1,
    maxLevel: 4,
    effectPerLevel: 0.125, // +12.5% dissipation per level
    formatEffect: (lvl: number) => `+${(lvl * 12.5).toFixed(1)}% Heat Dissipation`,
    maxLevelBonus: '3 alignments instead of 4'
  },

  FOCUS_MODE: {
    id: 'FOCUS_MODE',
    name: 'Focus Mode',
    desc: 'Time slows while at the console viewing minigames.',
    type: 'passive' as const,
    unlockRank: 7,
    costPerLevel: 1,
    maxLevel: 4,
    effectPerLevel: 0.10, // -10% time speed per level
    formatEffect: (lvl: number) => `-${lvl * 10}% Time Speed`,
    maxLevelBonus: undefined
  },

  DENSE_GOOP: {
    id: 'DENSE_GOOP',
    name: 'Dense Goop',
    desc: 'Goop falls faster. Can add or remove points via respec.',
    type: 'passive' as const,
    unlockRank: 8,
    costPerLevel: 1,
    maxLevel: 4,
    effectPerLevel: 0.125, // +12.5% fall speed per level
    formatEffect: (lvl: number) => `+${(lvl * 12.5).toFixed(1)}% Fall Speed`,
    maxLevelBonus: undefined
  },

  PRESSURE_CONTROL: {
    id: 'PRESSURE_CONTROL',
    name: 'Pressure Control',
    desc: 'Extends time before pressure reaches 100%.',
    type: 'passive' as const,
    unlockRank: 9,
    costPerLevel: 1,
    maxLevel: 8,
    effectPerLevel: 5, // +5 seconds per level
    formatEffect: (lvl: number) => `+${lvl * 5}s Game Time`,
    maxLevelBonus: undefined
  },

  // === JUNK BAND (Ranks 10-19) ===

  JUNK_UNIFORMER: {
    id: 'JUNK_UNIFORMER',
    name: 'Junk Uniformer',
    desc: 'Starting junk is more likely to be the same color.',
    type: 'passive' as const,
    unlockRank: 10,
    costPerLevel: 1,
    maxLevel: 4,
    effectPerLevel: 0.10, // +10% same-color chance per level
    formatEffect: (lvl: number) => `+${lvl * 10}% Same Color`,
    maxLevelBonus: undefined
  },

  GOOP_SWAP: {
    id: 'GOOP_SWAP',
    name: 'Goop Swap',
    desc: 'Swap falling goop with stored goop faster.',
    type: 'passive' as const,
    unlockRank: 12,
    costPerLevel: 1,
    maxLevel: 4,
    // Base: 1.5s, -0.25s per level, min 0.5s
    effectPerLevel: 0.25, // seconds reduced per level
    formatEffect: (lvl: number) => `${(1.5 - lvl * 0.25).toFixed(2)}s Swap Time`,
    maxLevelBonus: undefined
  },

  GOOP_DUMP: {
    id: 'GOOP_DUMP',
    name: 'Goop Dump',
    desc: 'When activated, drops same-color junk across the entire board.',
    type: 'active' as const,
    unlockRank: 15,
    costPerLevel: 1,
    maxLevel: 1,
    chargeCost: 12, // Legacy - will be replaced by cooldown system
    effectPerLevel: 1,
    formatEffect: () => 'Drops matching junk',
    maxLevelBonus: undefined
  },

  SEALING_BONUS: {
    id: 'SEALING_BONUS',
    name: 'Sealing Bonus',
    desc: 'Sealing cracks reduces active cooldowns more.',
    type: 'passive' as const,
    unlockRank: 18,
    costPerLevel: 1,
    maxLevel: 4,
    // Base: 10% cooldown reduction per sealed crack. +5% per level.
    effectPerLevel: 0.05, // +5% bonus per level
    formatEffect: (lvl: number) => `${10 + lvl * 5}% Cooldown per Seal`,
    maxLevelBonus: undefined
  },

  // === MIXER BAND (Ranks 20-29) ===

  ACTIVE_EXPANSION_SLOT: {
    id: 'ACTIVE_EXPANSION_SLOT',
    name: 'Active Expansion Slot',
    desc: 'Allows equipping a second active ability simultaneously.',
    type: 'feature' as const,
    unlockRank: 20,
    costPerLevel: 1,
    maxLevel: 1,
    effectPerLevel: 1,
    formatEffect: () => '2 Active Slots',
    maxLevelBonus: undefined
  },

  GOOP_HOLD_VIEWER: {
    id: 'GOOP_HOLD_VIEWER',
    name: 'Goop Hold Viewer',
    desc: 'Shows the goop currently in holding.',
    type: 'feature' as const,
    unlockRank: 22,
    costPerLevel: 1,
    maxLevel: 1,
    effectPerLevel: 1,
    formatEffect: () => 'View Held Goop',
    maxLevelBonus: undefined
  },

  GOOP_COLORIZER: {
    id: 'GOOP_COLORIZER',
    name: 'Goop Colorizer',
    desc: 'When activated, next 5 goop are same color as current falling goop.',
    type: 'active' as const,
    unlockRank: 25,
    costPerLevel: 1,
    maxLevel: 1,
    chargeCost: 10, // Will be replaced by cooldown system
    effectPerLevel: 1,
    formatEffect: () => 'Next 5 goop match',
    maxLevelBonus: undefined
  },

  GOOP_WINDOW: {
    id: 'GOOP_WINDOW',
    name: 'Goop Window',
    desc: 'Shows you the next goop piece.',
    type: 'feature' as const,
    unlockRank: 28,
    costPerLevel: 1,
    maxLevel: 1,
    effectPerLevel: 1,
    formatEffect: () => 'Preview Next Goop',
    maxLevelBonus: undefined
  },

  // === CRACKED BAND (Ranks 30-39) ===

  SLOW_CRACKS: {
    id: 'SLOW_CRACKS',
    name: 'Slow Cracks',
    desc: 'Cracks grow slower over time.',
    type: 'passive' as const,
    unlockRank: 30,
    costPerLevel: 1,
    maxLevel: 4,
    // Offset to growth chance: -5%, -10%, -15%, -20%
    effectPerLevel: 0.05, // -5% growth chance offset per level
    formatEffect: (lvl: number) => `-${lvl * 5}% Growth Chance`,
    maxLevelBonus: undefined
  },

  CRACK_MATCHER: {
    id: 'CRACK_MATCHER',
    name: 'Crack Matcher',
    desc: 'Falling goop color biased toward the lowest crack.',
    type: 'passive' as const,
    unlockRank: 32,
    costPerLevel: 1,
    maxLevel: 4,
    effectPerLevel: 0.25, // +25% color bias per level
    formatEffect: (lvl: number) => `${lvl * 25}% Match Chance`,
    maxLevelBonus: undefined
  },

  CRACK_DOWN: {
    id: 'CRACK_DOWN',
    name: 'Crack Down',
    desc: 'When activated, new cracks form on the bottom row for a while.',
    type: 'active' as const,
    unlockRank: 35,
    costPerLevel: 1,
    maxLevel: 1,
    chargeCost: 10, // Will be replaced by cooldown system
    effectPerLevel: 1,
    formatEffect: () => 'Cracks spawn low',
    maxLevelBonus: undefined
  },

  ACTIVE_EXPANSION_SLOT_2: {
    id: 'ACTIVE_EXPANSION_SLOT_2',
    name: 'Active Expansion Slot',
    desc: 'Allows equipping a third active ability simultaneously.',
    type: 'feature' as const,
    unlockRank: 38,
    costPerLevel: 1,
    maxLevel: 1,
    effectPerLevel: 1,
    formatEffect: () => '3 Active Slots',
    maxLevelBonus: undefined
  }
};

// Helper to get upgrades by type
export const getPassiveUpgrades = () =>
  Object.values(UPGRADES).filter(u => u.type === 'passive');

export const getActiveUpgrades = () =>
  Object.values(UPGRADES).filter(u => u.type === 'active');

export const getFeatureUpgrades = () =>
  Object.values(UPGRADES).filter(u => u.type === 'feature');

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
