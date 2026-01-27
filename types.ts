
export interface Coordinate {
  x: number;
  y: number;
}

export enum GoopShape {
  // Original tetrominoes (keep for backwards compatibility)
  I = 'I',
  J = 'J',
  L = 'L',
  O = 'O',
  S = 'S',
  T = 'T',
  Z = 'Z',

  // Tetra Normal (5 pieces) - these replace the originals during gameplay
  T_I = 'T_I',     // Vertical bar (4 cells)
  T_L = 'T_L',     // L-shape
  T_T = 'T_T',     // T-shape (with diagonal floater)
  T_S = 'T_S',     // S-shape
  T_O = 'T_O',     // 2x2 square

  // Tetra Corrupted (5 pieces)
  T_I_C = 'T_I_C', // Corrupted I (actually Z-like split)
  T_L_C = 'T_L_C', // Corrupted L
  T_T_C = 'T_T_C', // Corrupted T
  T_S_C = 'T_S_C', // Corrupted S
  T_O_C = 'T_O_C', // Corrupted O

  // Penta Normal (11 pieces)
  P_I = 'P_I',     // 5-cell vertical bar
  P_L = 'P_L',     // L with extra cell
  P_X = 'P_X',     // Plus/cross shape
  P_U = 'P_U',     // U-shape
  P_L2 = 'P_L2',   // Alternate L
  P_Y = 'P_Y',     // Y-shape
  P_T = 'P_T',     // T5 shape
  P_S = 'P_S',     // S5 shape
  P_P = 'P_P',     // P-shape
  P_Z = 'P_Z',     // Z5 shape
  P_W = 'P_W',     // W-shape (stairs)

  // Penta Corrupted (11 pieces)
  P_I_C = 'P_I_C',
  P_L_C = 'P_L_C',
  P_X_C = 'P_X_C',
  P_U_C = 'P_U_C',
  P_L2_C = 'P_L2_C',
  P_Y_C = 'P_Y_C',
  P_T_C = 'P_T_C',
  P_S_C = 'P_S_C',
  P_P_C = 'P_P_C',
  P_Z_C = 'P_Z_C',
  P_W_C = 'P_W_C',

  // Hexa Normal (11 pieces)
  H_I = 'H_I',     // 6-cell shapes
  H_L = 'H_L',
  H_X = 'H_X',
  H_U = 'H_U',
  H_L2 = 'H_L2',
  H_Y = 'H_Y',
  H_T = 'H_T',
  H_S = 'H_S',
  H_P = 'H_P',
  H_Z = 'H_Z',
  H_W = 'H_W',

  // Hexa Corrupted (11 pieces)
  H_I_C = 'H_I_C',
  H_L_C = 'H_L_C',
  H_X_C = 'H_X_C',
  H_U_C = 'H_U_C',
  H_L2_C = 'H_L2_C',
  H_Y_C = 'H_Y_C',
  H_T_C = 'H_T_C',
  H_S_C = 'H_S_C',
  H_P_C = 'H_P_C',
  H_Z_C = 'H_Z_C',
  H_W_C = 'H_W_C',
}

export interface PieceDefinition {
  type: GoopShape;
  cells: Coordinate[]; // Relative coordinates
  color: string;
  cellColors?: string[]; // Per-cell colors, parallel to cells array
  isWild?: boolean;      // Wild piece - seals any crack, converts adjacent goop
}

export enum PieceState {
  SPAWNED = 'SPAWNED', 
  FALLING = 'FALLING', // Default state for active piece
  LOCKED = 'LOCKED'    // Hit bottom, about to merge
}

export interface ActivePiece {
  definition: PieceDefinition;
  x: number; // Logical grid X (0-TOTAL_WIDTH)
  y: number; // Logical grid Y
  screenX: number; // Viewport-relative X coordinate (floating point allowed)
  rotation: number; // 0-3 (0, 90, 180, 270)
  cells: Coordinate[]; // Current relative cells after rotation
  spawnTimestamp: number; // When this piece was created
  startSpawnY: number;    // Where it started falling from
  state: PieceState;      // State of the piece lifecycle
}

export interface BlockData {
  id: string;        // Unique ID for the individual block (persists on move)
  groupId: string;   // ID for the contiguous group this block belongs to
  timestamp: number; // Time when the group was formed/reset
  color: string;
  groupMinY: number; // Top-most Y (smallest value) of the group
  groupMaxY: number; // Bottom-most Y (largest value) of the group
  groupSize: number; // Number of blocks in this group
  isGlowing?: boolean; // Visual effect for blocks that consumed a goal
  isWild?: boolean;    // Wild goop - converts adjacent goop and matches any crack
}

export type GridCell = BlockData | null;

export interface FallingBlock {
  data: BlockData;
  x: number;
  y: number;
  velocity: number;
}

export interface DumpPiece {
  id: string;
  color: string;
  x: number;      // Absolute grid X (0-29) - moves with board rotation
  y: number;      // Float for smooth falling (starts at -1 above visible area)
  spawnDelay: number;  // ms until this piece spawns (for stagger effect)
}

export interface ScoreBreakdown {
    base: number;
    height: number;
    offscreen: number;
    adjacency: number;
    speed: number;
}

export interface GameStats {
    startTime: number;
    totalBonusTime: number;
    maxGroupSize: number;
    penalty?: number;
}

export interface FloatingText {
    id: string;
    text: string;
    x: number; // Grid X
    y: number; // Grid Y
    life: number; // 0 to 1
    color?: string;
}

export interface GoalMark {
  id: string;
  x: number;
  y: number;
  color: string;
  spawnTime: number;
}

export interface CrackCell {
  id: string;
  x: number;
  y: number;
  color: string;
  parentIds: string[];      // Empty = root, can have multiple (merge)
  childIds: string[];       // Empty = leaf
  lastGrowthCheck: number;  // Per-cell timer
  growthInterval: number;   // Random 3000-5000ms, regenerates each check
  spawnTime: number;        // For compatibility/animation
}

export enum GamePhase {
  CONSOLE = 'CONSOLE',
  PERISCOPE = 'PERISCOPE',
  COMPLICATION_MINIGAME = 'COMPLICATION_MINIGAME',
  GAME_OVER = 'GAME_OVER'
}

export enum ComplicationType {
    LIGHTS = 'LIGHTS',
    CONTROLS = 'CONTROLS',
    LASER = 'LASER'
}

export interface Complication {
    id: string;
    type: ComplicationType;
    startTime: number;
    severity: number; // 1-3
}

export interface GameState {
  grid: GridCell[][]; // [y][x]
  boardOffset: number; // 0-TOTAL_WIDTH
  activePiece: ActivePiece | null;
  storedPiece: PieceDefinition | null;
  nextPiece: PieceDefinition | null;  // Preview of upcoming piece
  score: number;
  gameOver: boolean;
  isPaused: boolean;
  canSwap: boolean;
  level: number;
  cellsCleared: number;
  combo: number;
  fallingBlocks: FallingBlock[];
  dumpPieces: DumpPiece[];     // Active dump pieces falling from top
  dumpQueue: DumpPiece[];      // Pieces waiting to spawn (staggered)
  timeLeft: number;
  
  // New Stats
  scoreBreakdown: ScoreBreakdown;
  gameStats: GameStats;
  
  // Visuals
  floatingTexts: FloatingText[];
  
  // Goal System (legacy - for migration compatibility)
  goalMarks: GoalMark[];

  // Crack System (new connected crack structure)
  crackCells: CrackCell[];
  goalsCleared: number;
  goalsTarget: number;
  
  // Architecture
  phase: GamePhase;
  complications: Complication[];
  activeComplicationId: string | null;

  // Complication counters (cumulative during run)
  totalUnitsAdded: number;
  totalUnitsPopped: number;
  totalRotations: number;
  rotationTimestamps: number[]; // Timestamps of recent rotations for CONTROLS trigger

  // Complication thresholds (increment after each trigger)
  complicationThresholds: {
    lights: number;
    controls: number;
    laser: number;
  };

  // LASER complication: tracks groups that have been tapped once (primed)
  primedGroups: Set<string>;

  // HUD meters for complication feedback
  laserCapacitor: number;  // 0-100 (100 = full, 0 = empty/triggers LASER)
  controlsHeat: number;    // 0-100 (0 = cool, 100 = overheated/triggers CONTROLS)

  // Lights brightness system (player-controlled via fast drop)
  lightsBrightness: number;        // 5-110 (100 = normal, 5 = failed, 110 = overflare peak)
  lightsGraceStart: number | null; // Timestamp when grace period started (null = fast dropping)
  lightsFlickered: boolean;        // Has the 5-second warning flicker happened this cycle

  // Cooldown timestamps: when each type can next trigger (0 = no cooldown)
  complicationCooldowns: Record<ComplicationType, number>;

  // Active ability charge tracking (charged by popping crack-goop)
  activeCharges: Record<string, number>; // Active ID -> current charge (0 to chargeCost)
  crackGoopPopped: number; // Count of glowing goop popped this session (for charging)

  // GOOP_COLORIZER tracking
  colorizerColor: string | null;    // Locked color for next N pieces
  colorizerRemaining: number;       // Pieces left with forced color

  // CRACK_DOWN active ability tracking
  crackDownRemaining: number; // Cracks left to spawn in bottom 4 rows (0 = normal spawning)
}

// --- State Management Interface ---
// Defines how components interact with game state (documents GameEngine's public API)

export interface GameStateManager {
    // Read-only state access
    readonly state: GameState;
    readonly isSessionActive: boolean;

    // State change notification
    subscribe(listener: () => void): () => void;

    // Command execution (Command type from core/commands/Command.ts)
    execute(command: { type: string; execute(engine: unknown): void }): void;
}

// --- Upgrade System Types ---

export type UpgradeType = 'passive' | 'active' | 'feature';

export interface UpgradeConfig {
  id: string;
  name: string;
  desc: string;
  type: UpgradeType;
  unlockRank: number;
  costPerLevel: number;
  maxLevel: number;
  effectPerLevel: number;
  formatEffect: (lvl: number) => string;
  maxLevelBonus?: string;
  chargeCost?: number; // For actives: crack-goop pops needed to charge
}

// --- Meta Progression Types ---

export interface SaveData {
  rank: number;            // Current Player Rank (1-100)
  totalScore: number;      // Cumulative score across all runs
  powerUpPoints: number;   // Currency to buy upgrades (1 per rank)
  powerUps: Record<string, number>; // Upgrade levels by ID (0 = not purchased)
  equippedActives: string[]; // IDs of equipped active abilities (max based on slots)
  unlockedUpgrades: string[]; // IDs of upgrades that have been revealed to player
  firstRunComplete: boolean;
  milestonesReached: number[];  // Milestone ranks achieved [10, 20, 30...]
  settings: {
    masterVolume: number;
    musicVolume: number;
    sfxVolume: number;
    invertRotation: boolean;
  };
}

export interface RankDetails {
  rank: number;
  progress: number;        // Current XP in this rank
  toNextRank: number;      // Total XP needed for next rank
  totalScore: number;
  isMaxRank: boolean;
}
