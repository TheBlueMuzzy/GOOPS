// ============================================================================
// Soft-Body Physics Types
// Ported from prototypes/SoftBodyProto9.tsx
// ============================================================================

// =============================================================================
// Vector Math
// =============================================================================

export interface Vec2 {
  x: number;
  y: number;
}

/**
 * Add two vectors
 */
export function vecAdd(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

/**
 * Subtract vector b from vector a
 */
export function vecSub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

/**
 * Scale a vector by a scalar
 */
export function vecScale(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}

/**
 * Get the length (magnitude) of a vector
 */
export function vecLength(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

/**
 * Normalize a vector to unit length
 * Returns zero vector if input has zero length
 */
export function vecNormalize(v: Vec2): Vec2 {
  const len = vecLength(v);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

/**
 * Dot product of two vectors
 */
export function vecDot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

/**
 * Distance between two points
 */
export function vecDistance(a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Rotate a point around the origin by the given angle (in degrees)
 */
export function rotatePoint(point: Vec2, angleDeg: number): Vec2 {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}

// =============================================================================
// Physics Vertex
// =============================================================================

/**
 * Physics vertex with Verlet state
 */
export interface Vertex {
  pos: Vec2;              // Current position (pixels)
  oldPos: Vec2;           // Previous position (for Verlet integration)
  homeOffset: Vec2;       // Offset from blob center (rest shape)
  mass: number;           // Usually 1.0
  attractionRadius: number; // Per-vertex attraction multiplier (0.3-1.5)
}

// =============================================================================
// Spring Constraints
// =============================================================================

/**
 * Spring constraint between vertices
 */
export interface Spring {
  a: number;              // Index of first vertex
  b: number;              // Index of second vertex
  restLength: number;     // Target distance
}

/**
 * Attraction spring between blobs (for merge tendrils)
 */
export interface AttractionSpring {
  blobA: number;          // Index of first blob
  blobB: number;          // Index of second blob
  vertexA: number;        // Vertex index in blobA
  vertexB: number;        // Vertex index in blobB
  restLength: number;
}

// =============================================================================
// Soft Blob
// =============================================================================

/**
 * Complete blob state
 */
export interface SoftBlob {
  id: string;
  color: string;
  vertices: Vertex[];
  innerVertices: Vertex[];   // Stable core for complex merges
  loopStarts: number[];      // Start indices for each boundary loop (outer + holes)
  ringsprings: Spring[];     // Perimeter edge springs
  crossSprings: Spring[];    // Structural support springs
  restArea: number;          // Target area (Shoelace formula)
  gridCells: Vec2[];         // Which grid cells this blob occupies
  isColliding: boolean;      // True when blob can't fall more (for GameEngine lock timer)
  isLocked: boolean;         // Locked = viscous, Falling = snappy
  isFalling: boolean;        // Active falling piece (not yet locked)
  isLoose: boolean;          // Falling after losing support (was locked)
  looseTime: number;         // Seconds since becoming loose (for gravity ease-in)
  fillAmount: number;        // 0-1 for fill animation
  wasFullLastFrame: boolean; // For triggering impulse when fill reaches 100%
  rotation: number;          // Current rotation angle
  targetX: number;           // Target center X (pixels)
  targetY: number;           // Target center Y (pixels)
  visualOffsetY: number;     // Smooth falling offset
  createdAtRotation: number; // Tank rotation when blob was created (for position sync)
  minCellYOffset: number;    // Minimum Y offset from piece definition (for I-piece gridY correction)
}

// =============================================================================
// Droplet (Pop Effect Particles)
// =============================================================================

/**
 * Small particle that scatters when a blob pops.
 * Rendered as simple circles without the goo filter.
 * Ported from Proto-9 lines 77-87.
 */
export interface Droplet {
  id: string;
  pos: Vec2;
  vel: Vec2;
  radius: number;
  color: string;
  opacity: number;
  lifetime: number;      // Seconds remaining
  maxLifetime: number;   // For opacity calculation
}

// =============================================================================
// Physics Parameters
// =============================================================================

/**
 * Tunable physics parameters
 */
export interface PhysicsParams {
  damping: number;           // Energy loss per frame (0.97 = high)
  stiffness: number;         // Spring correction strength (1 = very low)
  pressure: number;          // Volume maintenance force (3 = good)
  iterations: number;        // Constraint solver iterations (3-5)
  homeStiffness: number;     // Shape retention strength (0.01)
  innerHomeStiffness: number; // Inner vertex home stiffness (0.1)
  returnSpeed: number;       // Home position return rate (0.5)
  viscosity: number;         // Locked blob dampening (2.5)
  gravity: number;           // Downward acceleration (10)
  // Falling-specific overrides (independent tuning for falling pieces)
  fallingHomeStiffness: number;   // Home stiffness for falling blobs
  fallingReturnSpeed: number;     // Return speed for falling blobs
  fallingViscosity: number;       // Viscosity for falling blobs (0 = snappy)
  fallingGravity: number;         // Gravity for falling blobs
  // Attraction params (for merge tendrils)
  attractionRadius: number;      // Max distance for attraction (20)
  attractionRestLength: number;  // Target distance for attraction springs (0)
  attractionStiffness: number;   // Strength of attraction springs (0.005)
  // Rendering params
  goopiness: number;         // SVG filter strength (25)
  tendrilEndRadius: number;  // Tendril endpoint size (10)
  tendrilSkinniness: number; // Tendril mid-point scaling (0.7)
  wallThickness: number;     // Stroke width (8)
  // Falling-specific rendering overrides
  fallingGoopiness: number;         // Goopiness for falling blobs (also affects attraction range)
  fallingTendrilEndRadius: number;  // Tendril endpoint size for falling blobs
  fallingTendrilSkinniness: number; // Tendril skinniness for falling blobs
  // Droplet params (for pop effect)
  dropletCount: number;      // Droplets per pop (30)
  dropletSpeed: number;      // Initial scatter speed (60)
  dropletLifetime: number;   // Seconds to fade out (3)
  dropletSize: number;       // Base radius (9)
  dropletGravity: number;    // Droplet gravity (180, separate from blob gravity)
}

/**
 * Default parameters (tuned from Proto-9)
 * These are the FINAL tweaked values from Proto 9, scaled for 30px cells.
 * All distance/size parameters scaled by 0.6 (30px / 50px proto cell size)
 */
export const DEFAULT_PHYSICS: PhysicsParams = {
  damping: 0.98,
  stiffness: 10,
  pressure: 20,
  iterations: 3,
  homeStiffness: 0.35,
  innerHomeStiffness: 0.64,
  returnSpeed: 0.8,
  viscosity: 0.7,
  gravity: 10,
  fallingHomeStiffness: 0.35,
  fallingReturnSpeed: 0.8,
  fallingViscosity: 0.7,
  fallingGravity: 10,
  attractionRadius: 30,
  attractionRestLength: 1,
  attractionStiffness: 0.037,
  goopiness: 36,
  tendrilEndRadius: 1,
  tendrilSkinniness: 0.2,
  wallThickness: 8,
  fallingGoopiness: 36,
  fallingTendrilEndRadius: 1,
  fallingTendrilSkinniness: 0.2,
  dropletCount: 30,
  dropletSpeed: 60,
  dropletLifetime: 3,
  dropletSize: 9,
  dropletGravity: 180,
};
