
import { GoopTemplate, GoopShape } from './types';

export const TANK_VIEWPORT_WIDTH = 12; // 12 units wide
export const TANK_WIDTH = 30;   // Cylindrical width (3 screens wide approx)
export const TANK_VIEWPORT_HEIGHT = 16;
export const TANK_HEIGHT = 19;  // 3 rows of buffer at the top
export const BUFFER_HEIGHT = TANK_HEIGHT - TANK_VIEWPORT_HEIGHT;

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
export const INITIAL_TIME_MS = 75 * 1000;

// Piece size zone thresholds (based on pressure row)
// Pressure rises from bottom (row 0) toward top as time elapses
export const TETRA_ZONE_END_ROW = 13;   // Tetra zone: pressure below row 13
export const PENTA_ZONE_END_ROW = 8;    // Penta zone: pressure between row 13 and row 8
// Hexa zone: pressure above row 8 (row 8 to top)

// Corruption chance for spawning corrupted variants
export const CORRUPTION_CHANCE = 0.15;  // 15% chance

// Mirror chance for asymmetric pieces
export const MIRROR_CHANCE = 0.5;       // 50% chance

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
    desc: 'Extends grace period before lights start dimming.',
    type: 'passive' as const,
    category: 'complication' as const,
    unlockRank: 2,
    costPerLevel: 1,
    maxLevel: 4,
    effectPerLevel: 0.75, // +0.75 seconds grace per level
    formatEffect: (lvl: number) => `+${(lvl * 0.75).toFixed(2)}s Grace Period`,
    maxLevelBonus: 'Easier Fixing Sequence'
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
    category: 'complication' as const,
    unlockRank: 4,
    costPerLevel: 1,
    maxLevel: 4,
    effectPerLevel: 0.0625, // -6.25% drain per level
    formatEffect: (lvl: number) => `-${(lvl * 6.25).toFixed(2)}% Drain Rate`,
    maxLevelBonus: 'Easier Fixing Sequence'
  },

  COOLDOWN_BOOSTER: {
    id: 'COOLDOWN_BOOSTER',
    name: 'Cooldown Booster',
    desc: 'When activated, extends all active malfunction cooldowns.',
    type: 'active' as const,
    unlockRank: 5,
    costPerLevel: 1,
    maxLevel: 3,
    chargeCost: 8, // Legacy - charge rate is 3%/sec
    effectPerLevel: 0, // Custom scaling: 25% / 35% / 50%
    formatEffect: (lvl: number) => `+${[25, 35, 50][lvl - 1] || 25}% Cooldown Extension`,
    maxLevelBonus: '+50% Cooldown Extension'
  },

  GEAR_LUBRICATION: {
    id: 'GEAR_LUBRICATION',
    name: 'Gear Lubrication',
    desc: 'Increases heat dissipation rate when idle.',
    type: 'passive' as const,
    category: 'complication' as const,
    unlockRank: 6,
    costPerLevel: 1,
    maxLevel: 4,
    effectPerLevel: 0.125, // +12.5% dissipation per level
    formatEffect: (lvl: number) => `+${(lvl * 12.5).toFixed(1)}% Heat Dissipation`,
    maxLevelBonus: 'Easier Fixing Sequence'
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
    desc: 'When activated, rains same-color junk from the sky. Higher levels add more waves.',
    type: 'active' as const,
    unlockRank: 15,
    costPerLevel: 1,
    maxLevel: 3,
    chargeCost: 12, // Legacy - charge rate is 3%/sec (33s to full)
    effectPerLevel: 1, // Waves: 1 / 2 / 3
    formatEffect: (lvl: number) => `${lvl} wave${lvl > 1 ? 's' : ''} of junk`,
    maxLevelBonus: '3 waves of matching junk'
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
    desc: 'When activated, upcoming goop match your current color.',
    type: 'active' as const,
    unlockRank: 25,
    costPerLevel: 1,
    maxLevel: 3,
    chargeCost: 10, // Legacy - charge rate is 3%/sec
    effectPerLevel: 1, // Pieces: 6 / 7 / 8
    formatEffect: (lvl: number) => `Next ${5 + lvl} goop match`,
    maxLevelBonus: 'Next 8 goop match'
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
    desc: 'When activated, next cracks form in the bottom 4 rows.',
    type: 'active' as const,
    unlockRank: 35,
    costPerLevel: 1,
    maxLevel: 3,
    chargeCost: 10, // Legacy - charge rate is 3%/sec
    effectPerLevel: 2, // Cracks: 3 / 5 / 7
    formatEffect: (lvl: number) => `Next ${1 + lvl * 2} cracks spawn low`,
    maxLevelBonus: 'Next 7 cracks spawn low'
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
  PURPLE: '#a855f7',  // Rank 10+ (moved from 20)
  WHITE: '#f8fafc',   // Rank 30+
  BLACK: '#1a1a2e',   // Rank 50+ (max rank color)
  WILD: 'wild',       // Wild piece marker (not an actual color)
  // Backwards compatibility - kept but not in active palette
  ORANGE: '#f97316',
  TEAL: '#14b8a6',

  GRID_BG: '#020617', // Very dark slate (almost black)
  GRID_EMPTY: '#1e293b', // Dark slate for grid lines
};

const makePiece = (type: GoopShape, coords: number[][]): GoopTemplate => ({
  type,
  color: COLORS.RED, // Default placeholder, will be randomized on spawn
  cells: coords.map(([x, y]) => ({ x, y })),
});

// SRS-ish definitions (original tetrominoes - kept for backwards compatibility)
export const PIECES: GoopTemplate[] = [
  // I
  makePiece(GoopShape.I, [[-1, 0], [0, 0], [1, 0], [2, 0]]),
  // J
  makePiece(GoopShape.J, [[-1, -1], [-1, 0], [0, 0], [1, 0]]),
  // L
  makePiece(GoopShape.L, [[1, -1], [-1, 0], [0, 0], [1, 0]]),
  // O
  makePiece(GoopShape.O, [[0, 0], [1, 0], [0, 1], [1, 1]]),
  // S
  makePiece(GoopShape.S, [[0, 0], [1, 0], [0, 1], [-1, 1]]),
  // T
  makePiece(GoopShape.T, [[0, -1], [-1, 0], [0, 0], [1, 1]]), // T shape corrected slightly to standard T
  // Z
  makePiece(GoopShape.Z, [[-1, 0], [0, 0], [0, 1], [1, 1]]),
];

// =============================================================================
// NEW PIECE SYSTEM: Tetra, Penta, Hexa (from Minos.svg)
// =============================================================================
// Coordinates parsed from art/Minos.svg (36px grid cells)
// Each piece is normalized to be centered around (0,0) for rotation
// Normal pieces: contiguous cells (edge-touching)
// Corrupted pieces: non-contiguous cells (corner-touching only)

// -----------------------------------------------------------------------------
// TETRA PIECES (4 cells each) - 5 Normal + 5 Corrupted = 10 total
// -----------------------------------------------------------------------------

// Tetra Normal (from SVG cls-5 dark green)
const PIECE_T_I = makePiece(GoopShape.T_I, [[0, -1], [0, 0], [0, 1], [0, 2]]);         // Vertical bar
const PIECE_T_L = makePiece(GoopShape.T_L, [[0, 0], [0, 1], [0, 2], [1, 0]]);          // L-shape
const PIECE_T_T = makePiece(GoopShape.T_T, [[0, 0], [0, 1], [0, 2], [1, 1]]);          // T-shape
const PIECE_T_S = makePiece(GoopShape.T_S, [[0, 0], [0, 1], [1, 1], [1, 2]]);          // S-shape
const PIECE_T_O = makePiece(GoopShape.T_O, [[0, 0], [0, 1], [1, 0], [1, 1]]);          // 2x2 square

// Tetra Corrupted (from SVG cls-3 light green) - non-contiguous patterns
const PIECE_T_I_C = makePiece(GoopShape.T_I_C, [[0, 2], [0, 3], [1, 0], [1, 1]]);      // Split Z (2+2 diagonal)
const PIECE_T_L_C = makePiece(GoopShape.T_L_C, [[0, 0], [0, 1], [1, 0], [1, 2]]);      // L with gap
const PIECE_T_T_C = makePiece(GoopShape.T_T_C, [[0, 0], [0, 2], [1, 1], [2, 1]]);      // Spread T
const PIECE_T_S_C = makePiece(GoopShape.T_S_C, [[0, 2], [1, 0], [1, 1], [2, 1]]);      // Corrupted S
const PIECE_T_O_C = makePiece(GoopShape.T_O_C, [[0, 0], [0, 2], [1, 1], [1, 2]]);      // Diagonal corners

export const TETRA_NORMAL = [PIECE_T_I, PIECE_T_L, PIECE_T_T, PIECE_T_S, PIECE_T_O];
export const TETRA_CORRUPTED = [PIECE_T_I_C, PIECE_T_L_C, PIECE_T_T_C, PIECE_T_S_C, PIECE_T_O_C];
export const TETRA_PIECES = [...TETRA_NORMAL, ...TETRA_CORRUPTED];

// -----------------------------------------------------------------------------
// PENTA PIECES (5 cells each) - 11 Normal + 11 Corrupted = 22 total
// -----------------------------------------------------------------------------

// Penta Normal (from SVG cls-2 dark red)
// Parsed from SVG Penta group, normalized to center
const PIECE_P_I = makePiece(GoopShape.P_I, [[0, -2], [0, -1], [0, 0], [0, 1], [0, 2]]);         // Vertical bar (5 cells)
const PIECE_P_L = makePiece(GoopShape.P_L, [[0, 0], [0, 1], [1, 1], [1, 2], [2, 1]]);           // Cross-like L
const PIECE_P_X = makePiece(GoopShape.P_X, [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]]);           // Plus/cross shape
const PIECE_P_U = makePiece(GoopShape.P_U, [[0, 0], [1, 0], [1, 1], [1, 2], [2, 0]]);           // U-shape open bottom
const PIECE_P_L2 = makePiece(GoopShape.P_L2, [[0, 0], [0, 1], [1, 0], [1, 1], [1, 2]]);         // Chunky L
const PIECE_P_Y = makePiece(GoopShape.P_Y, [[0, 0], [0, 1], [1, 1], [1, 2], [2, 2]]);           // Diagonal stairs
const PIECE_P_T = makePiece(GoopShape.P_T, [[0, 0], [0, 1], [0, 2], [0, 3], [1, 1]]);           // Long T
const PIECE_P_S = makePiece(GoopShape.P_S, [[0, 0], [0, 1], [0, 3], [1, 1], [1, 3]]);           // Split S
const PIECE_P_P = makePiece(GoopShape.P_P, [[0, 0], [0, 1], [0, 3], [1, 0], [1, 2]]);           // P-shape variant
const PIECE_P_Z = makePiece(GoopShape.P_Z, [[0, 0], [0, 1], [0, 2], [0, 3], [1, 1]]);           // Z5 shape
const PIECE_P_W = makePiece(GoopShape.P_W, [[0, 0], [0, 2], [1, 1], [1, 2], [2, 2]]);           // W-shape (stairs)

// Penta Corrupted (from SVG cls-4 light red) - non-contiguous patterns
const PIECE_P_I_C = makePiece(GoopShape.P_I_C, [[0, 0], [0, 2], [0, 4], [1, 1], [1, 3]]);       // Zigzag split
const PIECE_P_L_C = makePiece(GoopShape.P_L_C, [[0, 0], [0, 2], [1, 1], [1, 2], [2, 0]]);       // Scattered L
const PIECE_P_X_C = makePiece(GoopShape.P_X_C, [[0, 0], [1, 1], [1, 2], [2, 0], [2, 2]]);       // Spread cross
const PIECE_P_U_C = makePiece(GoopShape.P_U_C, [[0, 0], [0, 2], [1, 1], [1, 2], [2, 0]]);       // Scattered U
const PIECE_P_L2_C = makePiece(GoopShape.P_L2_C, [[0, 0], [0, 2], [1, 1], [1, 2], [2, 2]]);     // Scattered chunky L
const PIECE_P_Y_C = makePiece(GoopShape.P_Y_C, [[0, 0], [0, 1], [1, 1], [2, 0], [2, 2]]);       // Spread Y
const PIECE_P_T_C = makePiece(GoopShape.P_T_C, [[0, 0], [0, 1], [0, 3], [1, 2], [1, 3]]);       // Scattered T
const PIECE_P_S_C = makePiece(GoopShape.P_S_C, [[0, 0], [0, 1], [1, 0], [1, 2], [2, 1]]);       // Corrupted S
const PIECE_P_P_C = makePiece(GoopShape.P_P_C, [[0, 0], [0, 2], [1, 0], [1, 1], [1, 3]]);       // Corrupted P
const PIECE_P_Z_C = makePiece(GoopShape.P_Z_C, [[0, 0], [0, 2], [1, 1], [1, 3], [2, 0]]);       // Corrupted Z
const PIECE_P_W_C = makePiece(GoopShape.P_W_C, [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]]);       // Corrupted W

export const PENTA_NORMAL = [PIECE_P_I, PIECE_P_L, PIECE_P_X, PIECE_P_U, PIECE_P_L2, PIECE_P_Y, PIECE_P_T, PIECE_P_S, PIECE_P_P, PIECE_P_Z, PIECE_P_W];
export const PENTA_CORRUPTED = [PIECE_P_I_C, PIECE_P_L_C, PIECE_P_X_C, PIECE_P_U_C, PIECE_P_L2_C, PIECE_P_Y_C, PIECE_P_T_C, PIECE_P_S_C, PIECE_P_P_C, PIECE_P_Z_C, PIECE_P_W_C];
export const PENTA_PIECES = [...PENTA_NORMAL, ...PENTA_CORRUPTED];

// -----------------------------------------------------------------------------
// HEXA PIECES (6 cells each) - 11 Normal + 11 Corrupted = 22 total
// -----------------------------------------------------------------------------

// Hexa Normal (from SVG cls-1 dark blue)
// Parsed from SVG Hexa group, normalized to center
const PIECE_H_I = makePiece(GoopShape.H_I, [[0, -2], [0, -1], [0, 0], [0, 1], [0, 2], [0, 3]]); // Vertical bar (6 cells)
const PIECE_H_L = makePiece(GoopShape.H_L, [[0, 0], [0, 1], [0, 2], [0, 3], [1, 1], [2, 1]]);   // Long L with bump
const PIECE_H_X = makePiece(GoopShape.H_X, [[0, 0], [0, 1], [0, 2], [0, 3], [1, 1], [1, 3]]);   // Extended cross
const PIECE_H_U = makePiece(GoopShape.H_U, [[0, 0], [0, 1], [1, 0], [1, 1], [1, 2], [2, 0]]);   // Big U-shape
const PIECE_H_L2 = makePiece(GoopShape.H_L2, [[0, 0], [0, 1], [1, 0], [1, 1], [1, 2], [1, 3]]); // Chunky long L
const PIECE_H_Y = makePiece(GoopShape.H_Y, [[0, 0], [0, 1], [1, 0], [1, 1], [1, 2], [2, 2]]);   // Y-shape extended
const PIECE_H_T = makePiece(GoopShape.H_T, [[0, 0], [0, 1], [0, 2], [0, 3], [1, 1], [1, 2]]);   // T6 shape
const PIECE_H_S = makePiece(GoopShape.H_S, [[0, 0], [0, 1], [1, 0], [1, 1], [2, 1], [2, 2]]);   // S6 shape
const PIECE_H_P = makePiece(GoopShape.H_P, [[0, 0], [0, 1], [0, 2], [0, 3], [1, 2], [1, 3]]);   // P6 shape
const PIECE_H_Z = makePiece(GoopShape.H_Z, [[0, 0], [0, 1], [0, 2], [0, 3], [1, 0], [1, 3]]);   // Z6 shape
const PIECE_H_W = makePiece(GoopShape.H_W, [[0, 0], [0, 3], [1, 1], [1, 2], [1, 3], [2, 3]]);   // W6 shape (stairs)

// Hexa Corrupted (from SVG cls-6 light blue) - non-contiguous patterns
const PIECE_H_I_C = makePiece(GoopShape.H_I_C, [[0, 0], [0, 3], [0, 5], [1, 1], [1, 2], [1, 4]]); // Split zigzag
const PIECE_H_L_C = makePiece(GoopShape.H_L_C, [[0, 0], [0, 2], [1, 1], [1, 2], [1, 3], [2, 0]]); // Scattered L
const PIECE_H_X_C = makePiece(GoopShape.H_X_C, [[0, 0], [0, 2], [0, 3], [1, 1], [1, 3], [2, 0]]); // Spread cross
const PIECE_H_U_C = makePiece(GoopShape.H_U_C, [[0, 0], [0, 3], [1, 1], [1, 2], [1, 4], [2, 0]]); // Scattered U
const PIECE_H_L2_C = makePiece(GoopShape.H_L2_C, [[0, 0], [0, 1], [1, 1], [1, 2], [1, 3], [2, 0]]); // Scattered chunky L
const PIECE_H_Y_C = makePiece(GoopShape.H_Y_C, [[0, 0], [0, 2], [1, 0], [1, 2], [1, 3], [2, 1]]); // Spread Y
const PIECE_H_T_C = makePiece(GoopShape.H_T_C, [[0, 0], [0, 1], [0, 3], [1, 1], [1, 2], [1, 4]]); // Scattered T
const PIECE_H_S_C = makePiece(GoopShape.H_S_C, [[0, 0], [0, 2], [1, 1], [1, 3], [2, 0], [2, 2]]); // Corrupted S
const PIECE_H_P_C = makePiece(GoopShape.H_P_C, [[0, 0], [0, 2], [0, 4], [1, 1], [1, 2], [1, 3]]); // Corrupted P
const PIECE_H_Z_C = makePiece(GoopShape.H_Z_C, [[0, 0], [0, 1], [0, 3], [1, 0], [1, 2], [2, 3]]); // Corrupted Z
const PIECE_H_W_C = makePiece(GoopShape.H_W_C, [[0, 0], [0, 3], [1, 1], [1, 2], [2, 0], [2, 3]]); // Corrupted W

export const HEXA_NORMAL = [PIECE_H_I, PIECE_H_L, PIECE_H_X, PIECE_H_U, PIECE_H_L2, PIECE_H_Y, PIECE_H_T, PIECE_H_S, PIECE_H_P, PIECE_H_Z, PIECE_H_W];
export const HEXA_CORRUPTED = [PIECE_H_I_C, PIECE_H_L_C, PIECE_H_X_C, PIECE_H_U_C, PIECE_H_L2_C, PIECE_H_Y_C, PIECE_H_T_C, PIECE_H_S_C, PIECE_H_P_C, PIECE_H_Z_C, PIECE_H_W_C];
export const HEXA_PIECES = [...HEXA_NORMAL, ...HEXA_CORRUPTED];

// =============================================================================
// COMBINED EXPORTS
// =============================================================================

export const ALL_NEW_PIECES = [...TETRA_PIECES, ...PENTA_PIECES, ...HEXA_PIECES];
