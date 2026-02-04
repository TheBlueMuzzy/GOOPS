// ============================================================================
// Soft-Body Verlet Physics Engine
// Ported from prototypes/SoftBodyProto9.tsx (lines 750-950)
// ============================================================================

import {
  SoftBlob,
  PhysicsParams,
  Vertex,
  Spring,
  AttractionSpring,
  Vec2,
  rotatePoint,
  vecLength,
} from './types';
import {
  CYLINDER_WIDTH_PIXELS,
  VIEWPORT_WIDTH_PIXELS,
  PHYSICS_GRID_OFFSET,
} from './blobFactory';

// =============================================================================
// Cylindrical Wrapping Helpers
// =============================================================================

/**
 * Wrap a pixel X position to stay within the viewport range.
 * When a vertex goes past one edge, it wraps to the other side.
 *
 * The visible range is [-180, 180] (VIEWPORT_WIDTH_PIXELS centered at 0).
 * But the cylinder is 900px wide, so positions can be anywhere in that range.
 * This normalizes to the visible range by adding/subtracting cylinder width.
 */
export function wrapPixelX(x: number): number {
  const minX = PHYSICS_GRID_OFFSET.x;  // -180
  const maxX = minX + VIEWPORT_WIDTH_PIXELS;  // 180

  // Wrap to closest position within one cylinder width of visible area
  while (x < minX - CYLINDER_WIDTH_PIXELS / 2) x += CYLINDER_WIDTH_PIXELS;
  while (x > maxX + CYLINDER_WIDTH_PIXELS / 2) x -= CYLINDER_WIDTH_PIXELS;

  return x;
}

/**
 * Calculate the shortest distance between two X positions on the cylinder.
 * Handles wrap-around: distance from x=170 to x=-170 is 20, not 340.
 */
export function cylindricalDistanceX(x1: number, x2: number): number {
  let dx = x2 - x1;

  // If the direct distance is more than half the cylinder, go the other way
  if (dx > CYLINDER_WIDTH_PIXELS / 2) dx -= CYLINDER_WIDTH_PIXELS;
  if (dx < -CYLINDER_WIDTH_PIXELS / 2) dx += CYLINDER_WIDTH_PIXELS;

  return dx;
}

// =============================================================================
// Integration (Verlet)
// =============================================================================

/**
 * Verlet integration step - updates positions based on velocity and gravity.
 * Applies different damping for locked vs falling blobs.
 */
export function integrate(
  blobs: SoftBlob[],
  dt: number,
  params: PhysicsParams
): void {
  // Cap dt at 33ms for stability (prevents explosion on lag spikes)
  const cappedDt = Math.min(dt, 0.033);

  for (const blob of blobs) {
    // Locked blobs are more viscous (slower, honey-like)
    const effectiveDamping = blob.isLocked
      ? params.damping / params.viscosity
      : params.damping;

    // Update outer vertices
    for (const v of blob.vertices) {
      const vx = (v.pos.x - v.oldPos.x) * effectiveDamping;
      const vy = (v.pos.y - v.oldPos.y) * effectiveDamping;

      v.oldPos.x = v.pos.x;
      v.oldPos.y = v.pos.y;

      v.pos.x += vx;
      v.pos.y += vy + params.gravity * cappedDt * cappedDt;
    }

    // Update inner vertices (same logic)
    for (const v of blob.innerVertices) {
      const vx = (v.pos.x - v.oldPos.x) * effectiveDamping;
      const vy = (v.pos.y - v.oldPos.y) * effectiveDamping;

      v.oldPos.x = v.pos.x;
      v.oldPos.y = v.pos.y;

      v.pos.x += vx;
      v.pos.y += vy + params.gravity * cappedDt * cappedDt;
    }
  }
}

// =============================================================================
// Home Force (Shape Retention)
// =============================================================================

/**
 * Applies force pulling vertices toward their home positions.
 * Locked blobs use viscosity for honey-like movement, falling blobs snap back quickly.
 */
export function applyHomeForce(
  blobs: SoftBlob[],
  params: PhysicsParams
): void {
  for (const blob of blobs) {
    // Speed multiplier: locked blobs return slower (squared for finer control at low values)
    // Falling blobs use full speed to keep up with grid position changes
    const speedMult = blob.isLocked
      ? params.returnSpeed * params.returnSpeed
      : 1.0;

    // Viscosity: converts instant position correction into gradual velocity-based movement
    // 0 = normal (position-based, snappy)
    // 1+ = full viscosity (velocity-based, honey-like slow return)
    const viscosity = blob.isLocked ? params.viscosity : 0;
    const positionFactor = Math.max(0, 1 - viscosity);
    const velocityFactor = viscosity > 0 ? 0.03 / Math.max(1, viscosity) : 0;

    // Apply to outer vertices
    for (const v of blob.vertices) {
      const rotatedHome = rotatePoint(v.homeOffset, blob.rotation);
      const targetX = blob.targetX + rotatedHome.x;
      const targetY = blob.targetY + rotatedHome.y;

      // Use cylindrical distance for X (shortest path around cylinder)
      const dx = cylindricalDistanceX(v.pos.x, targetX);
      const dy = targetY - v.pos.y;

      const forceX = dx * params.homeStiffness * speedMult;
      const forceY = dy * params.homeStiffness * speedMult;

      // Position correction (instant, jello-like)
      v.pos.x += forceX * positionFactor;
      v.pos.y += forceY * positionFactor;

      // Velocity correction (gradual, honey-like) - adjusting oldPos adds velocity
      if (viscosity > 0) {
        v.oldPos.x -= forceX * velocityFactor;
        v.oldPos.y -= forceY * velocityFactor;
      }
    }

    // Apply to inner vertices (use innerHomeStiffness param)
    for (const v of blob.innerVertices) {
      const rotatedHome = rotatePoint(v.homeOffset, blob.rotation);
      const targetX = blob.targetX + rotatedHome.x;
      const targetY = blob.targetY + rotatedHome.y;

      // Use cylindrical distance for X
      const dx = cylindricalDistanceX(v.pos.x, targetX);
      const dy = targetY - v.pos.y;

      const forceX = dx * params.innerHomeStiffness * speedMult;
      const forceY = dy * params.innerHomeStiffness * speedMult;

      v.pos.x += forceX * positionFactor;
      v.pos.y += forceY * positionFactor;

      if (viscosity > 0) {
        v.oldPos.x -= forceX * velocityFactor;
        v.oldPos.y -= forceY * velocityFactor;
      }
    }
  }
}

// =============================================================================
// Spring Constraint Solving
// =============================================================================

/**
 * Solves a single spring constraint between two vertices.
 * Moves vertices toward satisfying the rest length.
 * Uses cylindrical distance for X to handle wrap-around.
 */
function solveSpring(
  vertices: Vertex[],
  spring: Spring,
  strength: number
): void {
  const a = vertices[spring.a];
  const b = vertices[spring.b];

  // Use cylindrical distance for X (shortest path around cylinder)
  const dx = cylindricalDistanceX(a.pos.x, b.pos.x);
  const dy = b.pos.y - a.pos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Avoid division by zero
  if (dist < 0.0001) return;

  const error = (dist - spring.restLength) / dist;
  const correction = error * strength * 0.5;

  a.pos.x += dx * correction;
  a.pos.y += dy * correction;
  b.pos.x -= dx * correction;
  b.pos.y -= dy * correction;
}

/**
 * Iteratively solves all spring constraints.
 * Ring springs (perimeter) are stiffer than cross springs (structural).
 */
export function solveConstraints(
  blobs: SoftBlob[],
  params: PhysicsParams
): void {
  for (let iter = 0; iter < params.iterations; iter++) {
    for (const blob of blobs) {
      // Ring springs (perimeter) - stiffness * 0.01
      for (const spring of blob.ringsprings) {
        solveSpring(blob.vertices, spring, params.stiffness * 0.01);
      }
      // Cross springs (structural) - stiffness * 0.005
      for (const spring of blob.crossSprings) {
        solveSpring(blob.vertices, spring, params.stiffness * 0.005);
      }
    }
  }
}

// =============================================================================
// Pressure (Volume Maintenance)
// =============================================================================

/**
 * Applies radial pressure to maintain blob shape.
 * Only applies to locked blobs - falling blobs don't need pressure.
 */
export function applyPressure(
  blobs: SoftBlob[],
  params: PhysicsParams
): void {
  for (const blob of blobs) {
    // Only locked blobs get pressure
    if (!blob.isLocked) continue;

    // Calculate current centroid
    let cx = 0;
    let cy = 0;
    for (const v of blob.vertices) {
      cx += v.pos.x;
      cy += v.pos.y;
    }
    cx /= blob.vertices.length;
    cy /= blob.vertices.length;

    // Calculate average rest distance from home offsets
    const restDist =
      blob.vertices.reduce((sum, v) => sum + vecLength(v.homeOffset), 0) /
      blob.vertices.length;

    const pressureStrength = params.pressure * 0.002;

    // Apply radial pressure to each vertex
    for (const v of blob.vertices) {
      const dx = v.pos.x - cx;
      const dy = v.pos.y - cy;
      const currentDist = Math.sqrt(dx * dx + dy * dy);

      if (currentDist > 0.0001 && restDist > 0.0001) {
        // Error: positive if compressed (need to push out), negative if stretched
        const error = restDist - currentDist;
        const force = error * pressureStrength;

        v.pos.x += (dx / currentDist) * force;
        v.pos.y += (dy / currentDist) * force;
      }
    }
  }
}

// =============================================================================
// Boundary Constraints
// =============================================================================

/**
 * Boundary configuration for the physics simulation
 */
export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Keeps vertices inside the specified boundaries.
 * HORIZONTAL: Wraps around the cylinder (no hard walls).
 * VERTICAL: Clamps to floor/ceiling with velocity dampening.
 */
export function applyBoundaryConstraints(
  blobs: SoftBlob[],
  bounds: Bounds
): void {
  const MARGIN = 2; // Small margin so vertices don't sit exactly on the edge
  const BOUNDARY_DAMPING = 0.3; // How much to dampen velocity on contact

  for (const blob of blobs) {
    // Constrain outer vertices
    for (const v of blob.vertices) {
      // HORIZONTAL: Wrap around cylinder (no hard walls)
      v.pos.x = wrapPixelX(v.pos.x);
      v.oldPos.x = wrapPixelX(v.oldPos.x);

      // VERTICAL: Keep hard floor/ceiling (top/bottom of tank)
      // Top wall
      if (v.pos.y < bounds.minY + MARGIN) {
        v.pos.y = bounds.minY + MARGIN;
        const vy = v.pos.y - v.oldPos.y;
        v.oldPos.y = v.pos.y - vy * BOUNDARY_DAMPING;
      }
      // Bottom wall
      if (v.pos.y > bounds.maxY - MARGIN) {
        v.pos.y = bounds.maxY - MARGIN;
        const vy = v.pos.y - v.oldPos.y;
        v.oldPos.y = v.pos.y - vy * BOUNDARY_DAMPING;
      }
    }

    // Constrain inner vertices
    for (const v of blob.innerVertices) {
      // HORIZONTAL: Wrap around cylinder
      v.pos.x = wrapPixelX(v.pos.x);
      v.oldPos.x = wrapPixelX(v.oldPos.x);

      // VERTICAL: Hard floor/ceiling
      if (v.pos.y < bounds.minY + MARGIN) {
        v.pos.y = bounds.minY + MARGIN;
      }
      if (v.pos.y > bounds.maxY - MARGIN) {
        v.pos.y = bounds.maxY - MARGIN;
      }
    }
  }
}

// =============================================================================
// Main Physics Step
// =============================================================================

/**
 * Runs one complete physics step:
 * 1. Integration (Verlet with gravity)
 * 2. Home force (shape retention)
 * 3. Spring constraints (structural integrity)
 * 4. Pressure (volume maintenance for locked blobs)
 * 5. Boundary constraints (keep inside container)
 */
export function stepPhysics(
  blobs: SoftBlob[],
  dt: number,
  params: PhysicsParams,
  bounds: Bounds
): void {
  integrate(blobs, dt, params);
  applyHomeForce(blobs, params);
  solveConstraints(blobs, params);
  applyPressure(blobs, params);
  applyBoundaryConstraints(blobs, bounds);
}

// =============================================================================
// Outward Impulse (Ready-to-Pop Effect)
// =============================================================================

/**
 * Applies outward impulse to blob vertices when it fills to 100%.
 * Creates a bouncy "ready to pop" effect by pushing vertices outward.
 * Uses Verlet trick: move oldPos inward to create outward velocity.
 */
export function applyOutwardImpulse(blob: SoftBlob, impulseStrength: number): void {
  const vertices = blob.vertices;
  const n = vertices.length;

  for (let i = 0; i < n; i++) {
    const prev = vertices[(i - 1 + n) % n];
    const curr = vertices[i];
    const next = vertices[(i + 1) % n];

    // Edge vectors
    const e1x = curr.pos.x - prev.pos.x;
    const e1y = curr.pos.y - prev.pos.y;
    const e2x = next.pos.x - curr.pos.x;
    const e2y = next.pos.y - curr.pos.y;

    // Edge lengths
    const len1 = Math.sqrt(e1x * e1x + e1y * e1y);
    const len2 = Math.sqrt(e2x * e2x + e2y * e2y);
    if (len1 < 0.0001 || len2 < 0.0001) continue;

    // Outward normals (CCW winding: rotate edges +90 degrees for outward)
    const n1x = e1y / len1;
    const n1y = -e1x / len1;
    const n2x = e2y / len2;
    const n2y = -e2x / len2;

    // Average outward normal
    let avgNx = n1x + n2x;
    let avgNy = n1y + n2y;
    const avgLen = Math.sqrt(avgNx * avgNx + avgNy * avgNy);
    if (avgLen < 0.0001) continue;
    avgNx /= avgLen;
    avgNy /= avgLen;

    // Move oldPos inward to create outward velocity (Verlet trick)
    vertices[i].oldPos.x -= avgNx * impulseStrength;
    vertices[i].oldPos.y -= avgNy * impulseStrength;
  }
}

// =============================================================================
// Attraction Springs (Merge Tendrils)
// =============================================================================

/**
 * Updates attraction springs between nearby same-color blob vertices.
 * Creates tendril connections that visually merge adjacent blobs.
 */
export function updateAttractionSprings(
  blobs: SoftBlob[],
  existingSprings: AttractionSpring[],
  params: PhysicsParams
): AttractionSpring[] {
  const newSprings: AttractionSpring[] = [];
  const existingPairs = new Set<string>();

  // Keep existing springs that are still valid
  for (const spring of existingSprings) {
    const blobA = blobs[spring.blobA];
    const blobB = blobs[spring.blobB];
    if (!blobA || !blobB) continue;
    if (blobA.color !== blobB.color) continue;

    const vA = blobA.vertices[spring.vertexA];
    const vB = blobB.vertices[spring.vertexB];
    if (!vA || !vB) continue;

    const dx = vB.pos.x - vA.pos.x;
    const dy = vB.pos.y - vA.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Keep spring if still within goopiness range
    if (dist < params.goopiness) {
      newSprings.push(spring);
      existingPairs.add(`${spring.blobA}-${spring.vertexA}-${spring.blobB}-${spring.vertexB}`);
    }
  }

  // Look for new potential springs between same-color blobs
  for (let i = 0; i < blobs.length; i++) {
    for (let j = i + 1; j < blobs.length; j++) {
      const blobA = blobs[i];
      const blobB = blobs[j];

      // Only same-color blobs attract
      if (blobA.color !== blobB.color) continue;

      // Quick center distance check (use cylindrical distance)
      const centerDx = cylindricalDistanceX(blobB.targetX, blobA.targetX);
      const centerDy = blobA.targetY - blobB.targetY;
      const centerDist = Math.sqrt(centerDx * centerDx + centerDy * centerDy);

      // Skip if centers too far apart
      if (centerDist > params.attractionRadius * 6) continue;

      // Check each vertex pair
      for (let vi = 0; vi < blobA.vertices.length; vi++) {
        const vA = blobA.vertices[vi];
        const maxRadiusA = params.attractionRadius * vA.attractionRadius;

        for (let vj = 0; vj < blobB.vertices.length; vj++) {
          const vB = blobB.vertices[vj];
          const maxRadiusB = params.attractionRadius * vB.attractionRadius;
          const maxRadius = (maxRadiusA + maxRadiusB) / 2;

          // Use cylindrical distance for X
          const dx = cylindricalDistanceX(vA.pos.x, vB.pos.x);
          const dy = vB.pos.y - vA.pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // Skip if pair already exists or too far
          const pairKey = `${i}-${vi}-${j}-${vj}`;
          if (existingPairs.has(pairKey)) continue;
          if (dist > maxRadius) continue;

          // Create new attraction spring
          newSprings.push({
            blobA: i,
            blobB: j,
            vertexA: vi,
            vertexB: vj,
            restLength: params.attractionRestLength,
          });
          existingPairs.add(pairKey);
        }
      }
    }
  }

  return newSprings;
}

/**
 * Applies attraction spring forces between connected blob vertices.
 * Stiffness increases as vertices get closer (variable stiffness).
 * Uses cylindrical distance for X to handle wrap-around.
 */
export function applyAttractionSprings(
  blobs: SoftBlob[],
  springs: AttractionSpring[],
  params: PhysicsParams
): void {
  const MIN_STIFFNESS = 0.1;
  const MAX_STIFFNESS = 1.0;

  for (const spring of springs) {
    const blobA = blobs[spring.blobA];
    const blobB = blobs[spring.blobB];
    if (!blobA || !blobB) continue;

    const vA = blobA.vertices[spring.vertexA];
    const vB = blobB.vertices[spring.vertexB];
    if (!vA || !vB) continue;

    // Use cylindrical distance for X (shortest path around cylinder)
    const dx = cylindricalDistanceX(vA.pos.x, vB.pos.x);
    const dy = vB.pos.y - vA.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.0001) continue;

    // Variable stiffness: stronger when closer
    const t = Math.max(0, Math.min(1, 1 - dist / params.goopiness));
    const stiffnessMult = MIN_STIFFNESS + t * (MAX_STIFFNESS - MIN_STIFFNESS);

    const error = dist - spring.restLength;
    const force = error * params.attractionStiffness * stiffnessMult;

    // Move both vertices toward each other
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;

    vA.pos.x += fx;
    vA.pos.y += fy;
    vB.pos.x -= fx;
    vB.pos.y -= fy;
  }
}
