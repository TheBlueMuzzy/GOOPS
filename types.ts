
export interface Coordinate {
  x: number;
  y: number;
}

export enum PieceType {
  I = 'I',
  J = 'J',
  L = 'L',
  O = 'O',
  S = 'S',
  T = 'T',
  Z = 'Z',
}

export interface PieceDefinition {
  type: PieceType;
  cells: Coordinate[]; // Relative coordinates
  color: string;
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
}

export type GridCell = BlockData | null;

export interface FallingBlock {
  data: BlockData;
  x: number;
  y: number;
  velocity: number;
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
  timeLeft: number;
  
  // New Stats
  scoreBreakdown: ScoreBreakdown;
  gameStats: GameStats;
  
  // Visuals
  floatingTexts: FloatingText[];
  
  // Goal System
  goalMarks: GoalMark[];
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

  // Lights brightness system (player-controlled via soft drop)
  lightsBrightness: number;        // 5-110 (100 = normal, 5 = failed, 110 = overflare peak)
  lightsGraceStart: number | null; // Timestamp when grace period started (null = soft dropping)
  lightsFlickered: boolean;        // Has the 5-second warning flicker happened this cycle

  // Cooldown timestamps: when each type can next trigger (0 = no cooldown)
  complicationCooldowns: Record<ComplicationType, number>;

  // Active ability charge tracking (charged by popping crack-goop)
  activeCharges: Record<string, number>; // Active ID -> current charge (0 to chargeCost)
  crackGoopPopped: number; // Count of glowing goop popped this session (for charging)
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
