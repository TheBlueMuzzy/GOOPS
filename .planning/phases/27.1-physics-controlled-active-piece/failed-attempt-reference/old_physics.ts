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
  PHYSICS_CELL_SIZE,
} from './blobFactory';
import { TankCell } from '../../types';
import { BUFFER_HEIGHT } from '../../constants';

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
    // Proto-9 uses damping directly for all blobs
    // Viscosity affects home force, not damping
    const effectiveDamping = params.damping;

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

      // Use direct distance like Proto-9 (not cylindrical)
      // Cylindrical wrapping is handled elsewhere in position updates
      const dx = targetX - v.pos.x;
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

      // Use direct distance like Proto-9 (not cylindrical)
      const dx = targetX - v.pos.x;
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

    // Use target position as pressure center (Proto-9 approach)
    // This is more stable than calculated centroid
    const cx = blob.targetX;
    const cy = blob.targetY;

    const pressureStrength = params.pressure * 0.002;

    // Apply radial pressure to each vertex
    for (const v of blob.vertices) {
      const dx = v.pos.x - cx;
      const dy = v.pos.y - cy;
      const currentDist = Math.sqrt(dx * dx + dy * dy);

      // Rest distance for THIS vertex (how far it should be from center)
      const restDist = Math.sqrt(
        v.homeOffset.x * v.homeOffset.x + v.homeOffset.y * v.homeOffset.y
      );

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
      // HORIZONTAL: No constraints - blobs can exist anywhere in X
      // Wrapping is handled at RENDER time, not physics time.
      // This prevents the "explosion" when vertices wrap mid-physics.

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
      // HORIZONTAL: No constraints (same as outer)

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
  // Use params.attractionStiffness as base, scaled for min/max (matches Proto-9)
  const MIN_STIFFNESS = params.attractionStiffness * 0.1;
  const MAX_STIFFNESS = params.attractionStiffness;

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

    // Variable stiffness: stronger when closer (matches Proto-9 lines 1136-1141)
    const t = Math.max(0, Math.min(1, 1 - dist / params.goopiness));
    const stiffness = MIN_STIFFNESS + t * (MAX_STIFFNESS - MIN_STIFFNESS);

    const error = dist - spring.restLength;
    // Note: stiffness already incorporates attractionStiffness via MIN/MAX
    const force = error * stiffness;

    // Move both vertices toward each other
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;

    vA.pos.x += fx;
    vA.pos.y += fy;
    vB.pos.x -= fx;
    vB.pos.y -= fy;
  }
}

// =============================================================================
// Blob-to-Blob Collision (Different Colors)
// =============================================================================

/**
 * Push apart vertices of different-colored blobs when they overlap.
 * Only runs when at least one blob is moving (falling/loose).
 * Prevents blobs from visually overlapping each other.
 * Ported from Proto-9 lines 970-1029.
 */
export function applyBlobCollisions(
  blobs: SoftBlob[],
  cellSize: number = 30
): void {
  const MIN_DISTANCE = 20;    // Minimum distance between vertices
  const PUSH_STRENGTH = 0.8;  // How hard to push apart
  const ITERATIONS = 3;       // Multiple passes for stability

  for (let iter = 0; iter < ITERATIONS; iter++) {
    for (let i = 0; i < blobs.length; i++) {
      for (let j = i + 1; j < blobs.length; j++) {
        const blobA = blobs[i];
        const blobB = blobs[j];

        // Skip same-color blobs (they can overlap/merge)
        if (blobA.color === blobB.color) continue;

        // Skip collision between two locked blobs - they're grid-aligned
        // Only apply collision when at least one blob is moving
        const aIsMoving = blobA.isFalling || blobA.isLoose;
        const bIsMoving = blobB.isFalling || blobB.isLoose;
        if (!aIsMoving && !bIsMoving) continue;

        // Quick bounding box check to skip distant blobs
        const dx = blobA.targetX - blobB.targetX;
        const dy = blobA.targetY - blobB.targetY;
        const centerDist = Math.sqrt(dx * dx + dy * dy);
        if (centerDist > cellSize * 4) continue;

        // Check vertex-to-vertex collisions
        for (const vA of blobA.vertices) {
          for (const vB of blobB.vertices) {
            const vdx = vB.pos.x - vA.pos.x;
            const vdy = vB.pos.y - vA.pos.y;
            const dist = Math.sqrt(vdx * vdx + vdy * vdy);

            if (dist < MIN_DISTANCE && dist > 0.01) {
              const overlap = MIN_DISTANCE - dist;
              const nx = vdx / dist;
              const ny = vdy / dist;
              const push = overlap * PUSH_STRENGTH;

              // Move both vertices apart (positions)
              vA.pos.x -= nx * push * 0.5;
              vA.pos.y -= ny * push * 0.5;
              vB.pos.x += nx * push * 0.5;
              vB.pos.y += ny * push * 0.5;

              // Also update oldPos to kill velocity into each other
              // This prevents "bouncing" through each other
              vA.oldPos.x -= nx * push * 0.3;
              vA.oldPos.y -= ny * push * 0.3;
              vB.oldPos.x += nx * push * 0.3;
              vB.oldPos.y += ny * push * 0.3;
            }
          }
        }
      }
    }
  }
}

// =============================================================================
// Active Piece Falling (Physics-Controlled)
// =============================================================================

/**
 * Steps the falling motion for an active piece blob.
 * Ported from Proto-9 lines 1598-1635.
 *
 * Physics owns the falling motion:
 * - Accumulates visualOffsetY based on fallSpeed
 * - Moves gridCells down when offset exceeds CELL_SIZE
 * - Sets isColliding when piece can't fall further
 * - Updates targetX/targetY for soft-body rendering
 *
 * @param blob - The active piece blob to update
 * @param dt - Delta time in seconds
 * @param fallSpeed - Pixels per second (GameEngine controls fast-fall)
 * @param grid - The game grid for collision detection
 * @param gridRows - Number of rows in the grid
 */
export function stepActivePieceFalling(
  blob: SoftBlob,
  dt: number,
  fallSpeed: number,
  grid: TankCell[][],
  visibleRows: number, // Visible rows (16)
  tankWidth: number,   // Cylindrical width (30)
  tankRotation: number // Current tank rotation for collision conversion
): void {
  // Skip if not a falling blob
  if (blob.isLocked || blob.isLoose) return;

  // gridCells are in VISUAL/SCREEN coordinates:
  // x: screenX (stays constant as tank rotates - piece doesn't move with rotation)
  // y: visual Y (0-15 for visible area, can be negative for buffer zone)
  //
  // For collision, we convert visual X to grid X using tankRotation.
  // This matches base game where screenX is constant and gridX = screenX + tankRotation.

  // Check collision BEFORE moving
  let canFallMore = true;
  for (const cell of blob.gridCells) {
    const nextVisY = cell.y + 1;
    // Floor check: hit bottom of visible area
    if (nextVisY >= visibleRows) {
      canFallMore = false;
      break;
    }
    // Convert visual Y to full grid Y for grid access
    const fullGridY = nextVisY + BUFFER_HEIGHT;
    // Convert screen X to grid X: gridX = (screenX + tankRotation) % tankWidth
    // Handle negative screenX by adding tankWidth before modulo
    const gridX = ((Math.round(cell.x) + tankRotation) % tankWidth + tankWidth) % tankWidth;
    // Check if cell below is occupied
    const targetCell = grid[fullGridY]?.[gridX];
    if (targetCell && targetCell.goopGroupId !== undefined) {
      canFallMore = false;
      break;
    }
  }

  blob.isColliding = !canFallMore;

  if (canFallMore) {
    // Accumulate visual offset
    const fallAmount = fallSpeed * dt;
    blob.visualOffsetY += fallAmount;

    // Move grid cells when offset exceeds cell size
    while (blob.visualOffsetY >= PHYSICS_CELL_SIZE) {
      for (const cell of blob.gridCells) {
        cell.y += 1;
      }
      blob.visualOffsetY -= PHYSICS_CELL_SIZE;
    }
  }

  // Update physics target position from grid cells + offset
  // gridCells are already in visual coordinates - use directly
  let sumX = 0, sumY = 0;
  for (const cell of blob.gridCells) {
    sumX += cell.x;
    sumY += cell.y;
  }
  const centroidX = sumX / blob.gridCells.length;
  const centroidY = sumY / blob.gridCells.length;

  // Convert visual to pixels (direct - no rotation conversion needed)
  blob.targetX = PHYSICS_GRID_OFFSET.x + (centroidX + 0.5) * PHYSICS_CELL_SIZE;
  blob.targetY = PHYSICS_GRID_OFFSET.y + (centroidY + 0.5) * PHYSICS_CELL_SIZE + blob.visualOffsetY;
}
