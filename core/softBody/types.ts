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
  ringsprings: Spring[];     // Perimeter edge springs
  crossSprings: Spring[];    // Structural support springs
  restArea: number;          // Target area (Shoelace formula)
  gridCells: Vec2[];         // Which grid cells this blob occupies
  isLocked: boolean;         // Locked = viscous, Falling = snappy
  fillAmount: number;        // 0-1 for fill animation
  rotation: number;          // Current rotation angle
  targetX: number;           // Target center X (pixels)
  targetY: number;           // Target center Y (pixels)
  visualOffsetY: number;     // Smooth falling offset
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
  pressure: number;          // Volume maintenance force (5 = strong)
  iterations: number;        // Constraint solver iterations (3-5)
  homeStiffness: number;     // Shape retention strength (0.3)
  returnSpeed: number;       // Home position return rate (0.5)
  viscosity: number;         // Locked blob dampening (2.5)
  gravity: number;           // Downward acceleration (10)
}

/**
 * Default parameters (tuned from Proto-9)
 */
export const DEFAULT_PHYSICS: PhysicsParams = {
  damping: 0.97,
  stiffness: 1,
  pressure: 5,
  iterations: 3,
  homeStiffness: 0.3,
  returnSpeed: 0.5,
  viscosity: 2.5,
  gravity: 10,
};
