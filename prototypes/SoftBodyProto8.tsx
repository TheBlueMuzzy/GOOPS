import { useRef, useEffect, useState, useCallback } from 'react';

// ============================================================================
// PROTO-8: Pop - What happens when goop is cleared
// ============================================================================
// Building on Proto-7, now testing:
//   - Pop with residue: main blob disappears, droplets scatter and fade
//   - Click on locked blob to pop it
//   - Droplets spawn at vertex positions with outward velocity
//   - Droplets fade out over time
//   - All Proto-7 physics still apply
// ============================================================================

interface Vec2 {
  x: number;
  y: number;
}

interface Vertex {
  pos: Vec2;
  oldPos: Vec2;
  homeOffset: Vec2;
  mass: number;
  attractionRadius: number;
}

interface InnerVertex {
  pos: Vec2;
  oldPos: Vec2;
  homeOffset: Vec2;
}

interface Spring {
  a: number;
  b: number;
  restLength: number;
}

interface AttractionSpring {
  blobA: number;
  vertA: number;
  blobB: number;
  vertB: number;
  restLength: number;
}

// Grid cell - tracks which blob owns it
interface GridCell {
  blobId: string;
  color: string;
}

// Blob now tracks its grid cells
interface Blob {
  id: string;
  vertices: Vertex[];
  innerVertices: InnerVertex[];
  ringsprings: Spring[];
  crossSprings: Spring[];
  restArea: number;
  targetX: number;
  targetY: number;
  rotation: number;
  color: string;
  usePressure: boolean;
  fillAmount: number;      // 0-1, how full (1 = full/solid for falling pieces)
  isShaking: boolean;
  wasFullLastFrame: boolean;
  gridCells: Vec2[];       // Which grid cells this blob occupies
  isLocked: boolean;       // false = falling, true = locked in place
  visualOffsetY: number;   // Smooth visual offset from grid position (for falling)
}

// Droplet - small particle that scatters when blob pops
interface Droplet {
  id: string;
  pos: Vec2;
  vel: Vec2;
  radius: number;
  color: string;
  opacity: number;
  lifetime: number;      // seconds remaining
  maxLifetime: number;   // for opacity calculation
}

interface PhysicsParams {
  damping: number;
  stiffness: number;
  pressure: number;
  iterations: number;
  homeStiffness: number;
  innerHomeStiffness: number;
  returnSpeed: number;  // How fast blobs return to shape (0.01 = slow, 1.0 = snappy)
  viscosity: number;    // Resistance to return motion (0 = off, 1 = honey-like)
  attractionRadius: number;
  attractionRestLength: number;
  attractionStiffness: number;
  goopiness: number;
  tendrilEndRadius: number;
  tendrilSkinniness: number;
  wallThickness: number;
}

interface FillParams {
  autoFill: boolean;
  fillRate: number;
}

interface FilterParams {
  enabled: boolean;
  stdDeviation: number;
  alphaMultiplier: number;
  alphaOffset: number;
}

// Grid configuration
const GRID_COLS = 6;
const GRID_ROWS = 8;
const CELL_SIZE = 50;  // pixels per cell
const GRID_OFFSET_X = 50;  // left margin
const GRID_OFFSET_Y = 50;  // top margin

const CANVAS_WIDTH = GRID_COLS * CELL_SIZE + GRID_OFFSET_X * 2;
const CANVAS_HEIGHT = GRID_ROWS * CELL_SIZE + GRID_OFFSET_Y * 2;

const DEFAULT_PHYSICS: PhysicsParams = {
  damping: 0.97,
  stiffness: 1,
  pressure: 3,  // Higher values can cause issues with complex merged shapes
  iterations: 3,
  homeStiffness: 0.01,
  innerHomeStiffness: 0.1,
  returnSpeed: 0.5,  // 1.0 = instant, lower = slower return
  viscosity: 2.5,    // 0 = off, higher = more honey-like resistance
  attractionRadius: 20,
  attractionRestLength: 0,
  attractionStiffness: 0.005,
  goopiness: 25,
  tendrilEndRadius: 10,
  tendrilSkinniness: 0.7,
  wallThickness: 8,
};

const FILTER_PRESETS = {
  none: { enabled: false, stdDeviation: 8, alphaMultiplier: 20, alphaOffset: -12 },
  subtle: { enabled: true, stdDeviation: 5, alphaMultiplier: 15, alphaOffset: -6 },
  medium: { enabled: true, stdDeviation: 8, alphaMultiplier: 20, alphaOffset: -12 },
  aggressive: { enabled: true, stdDeviation: 12, alphaMultiplier: 25, alphaOffset: -9 },
};

const DEFAULT_FILL: FillParams = {
  autoFill: true,
  fillRate: 0.15,
};

// Ready-to-pop impulse (one-time outward push when blob fills)
const PULSE_AMPLITUDE = 4;      // pixels - impulse strength for outward push

// Fall speed in pixels per second
const FALL_SPEED = 200;  // Adjust for desired fall rate

const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12'];

// ============================================================================
// GRID UTILITIES
// ============================================================================

// Convert grid position to pixel position (center of cell)
function gridToPixel(gx: number, gy: number): Vec2 {
  return {
    x: GRID_OFFSET_X + (gx + 0.5) * CELL_SIZE,
    y: GRID_OFFSET_Y + (gy + 0.5) * CELL_SIZE,
  };
}

// Convert grid position to pixel position (corner of cell)
function gridCornerToPixel(gx: number, gy: number): Vec2 {
  return {
    x: GRID_OFFSET_X + gx * CELL_SIZE,
    y: GRID_OFFSET_Y + gy * CELL_SIZE,
  };
}

// Get centroid of a set of grid cells
function getGridCentroid(cells: Vec2[]): Vec2 {
  let sumX = 0, sumY = 0;
  for (const cell of cells) {
    const pixel = gridToPixel(cell.x, cell.y);
    sumX += pixel.x;
    sumY += pixel.y;
  }
  return { x: sumX / cells.length, y: sumY / cells.length };
}

// ============================================================================
// PERIMETER TRACING - Convert grid cells to vertices
// ============================================================================

interface Edge {
  x1: number; y1: number;  // start corner (grid coords)
  x2: number; y2: number;  // end corner (grid coords)
}

// Find all boundary edges of a set of grid cells
function findBoundaryEdges(cells: Vec2[]): Edge[] {
  const cellSet = new Set(cells.map(c => `${c.x},${c.y}`));
  const edges: Edge[] = [];

  for (const cell of cells) {
    const { x, y } = cell;

    // Check each of 4 edges - if neighbor missing, it's a boundary
    // Top edge (y to y, x to x+1)
    if (!cellSet.has(`${x},${y - 1}`)) {
      edges.push({ x1: x, y1: y, x2: x + 1, y2: y });
    }
    // Right edge (x+1 to x+1, y to y+1)
    if (!cellSet.has(`${x + 1},${y}`)) {
      edges.push({ x1: x + 1, y1: y, x2: x + 1, y2: y + 1 });
    }
    // Bottom edge (x+1 to x, y+1 to y+1)
    if (!cellSet.has(`${x},${y + 1}`)) {
      edges.push({ x1: x + 1, y1: y + 1, x2: x, y2: y + 1 });
    }
    // Left edge (x to x, y+1 to y)
    if (!cellSet.has(`${x - 1},${y}`)) {
      edges.push({ x1: x, y1: y + 1, x2: x, y2: y });
    }
  }

  return edges;
}

// Sort edges into a continuous path and extract vertices
function tracePerimeter(edges: Edge[]): Vec2[] {
  if (edges.length === 0) return [];

  // Build adjacency: for each endpoint, which edges connect?
  const edgeMap = new Map<string, Edge[]>();

  for (const edge of edges) {
    const startKey = `${edge.x1},${edge.y1}`;
    const endKey = `${edge.x2},${edge.y2}`;

    if (!edgeMap.has(startKey)) edgeMap.set(startKey, []);
    if (!edgeMap.has(endKey)) edgeMap.set(endKey, []);

    edgeMap.get(startKey)!.push(edge);
    edgeMap.get(endKey)!.push(edge);
  }

  // Helper: get angle of edge from a point
  const getEdgeAngle = (edge: Edge, fromPoint: { x: number; y: number }): number => {
    const toX = (fromPoint.x === edge.x1 && fromPoint.y === edge.y1) ? edge.x2 : edge.x1;
    const toY = (fromPoint.x === edge.x1 && fromPoint.y === edge.y1) ? edge.y2 : edge.y1;
    return Math.atan2(toY - fromPoint.y, toX - fromPoint.x);
  };

  // Helper: normalize angle difference to [-PI, PI]
  const angleDiff = (from: number, to: number): number => {
    let diff = to - from;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return diff;
  };

  // Walk the perimeter using right-hand rule (always turn right/clockwise)
  const visited = new Set<Edge>();
  const vertices: Vec2[] = [];

  // Start with first edge, pick a consistent starting direction
  let currentEdge = edges[0];
  let currentPoint = { x: currentEdge.x1, y: currentEdge.y1 };
  let incomingAngle = getEdgeAngle(currentEdge, currentPoint) + Math.PI; // Pretend we came from opposite direction

  while (visited.size < edges.length) {
    visited.add(currentEdge);

    // Add the start point as a vertex
    vertices.push(gridCornerToPixel(currentPoint.x, currentPoint.y));

    // Move to the end of this edge
    const endPoint = (currentPoint.x === currentEdge.x1 && currentPoint.y === currentEdge.y1)
      ? { x: currentEdge.x2, y: currentEdge.y2 }
      : { x: currentEdge.x1, y: currentEdge.y1 };

    // Calculate the angle we arrived from (opposite of edge direction)
    const arrivedAngle = Math.atan2(endPoint.y - currentPoint.y, endPoint.x - currentPoint.x);
    incomingAngle = arrivedAngle + Math.PI; // We "came from" the opposite direction

    // Find next unvisited edge from this endpoint
    // Use RIGHT-HAND RULE: pick the edge with smallest clockwise turn
    const endKey = `${endPoint.x},${endPoint.y}`;
    const connectedEdges = edgeMap.get(endKey) || [];
    const unvisitedEdges = connectedEdges.filter(e => !visited.has(e));

    if (unvisitedEdges.length === 0) break;  // Closed the loop

    // Pick edge with smallest right turn (most clockwise = most negative angle diff)
    let bestEdge = unvisitedEdges[0];
    let bestTurn = Infinity;

    for (const candidate of unvisitedEdges) {
      const outAngle = getEdgeAngle(candidate, endPoint);
      const turn = angleDiff(incomingAngle, outAngle);
      // We want the rightmost turn = smallest (most negative) angle difference
      // But we need to go counterclockwise around the perimeter, so pick LARGEST turn
      if (turn > bestTurn || bestTurn === Infinity) {
        bestTurn = turn;
        bestEdge = candidate;
      }
    }

    currentEdge = bestEdge;
    currentPoint = endPoint;
  }

  return vertices;
}

// ============================================================================
// DYNAMIC BLOB CREATION FROM GRID CELLS
// ============================================================================

let blobIdCounter = 0;

function createBlobFromCells(cells: Vec2[], color: string, isLocked: boolean): Blob {
  const id = `blob-${blobIdCounter++}`;

  // Get perimeter vertices
  const boundaryEdges = findBoundaryEdges(cells);
  const perimeterPixels = tracePerimeter(boundaryEdges);

  if (perimeterPixels.length < 3) {
    console.warn('Failed to create valid perimeter for cells:', cells);
    // Fallback to a simple square
    const center = getGridCentroid(cells);
    const halfSize = CELL_SIZE * 0.4;
    perimeterPixels.push(
      { x: center.x - halfSize, y: center.y - halfSize },
      { x: center.x + halfSize, y: center.y - halfSize },
      { x: center.x + halfSize, y: center.y + halfSize },
      { x: center.x - halfSize, y: center.y + halfSize },
    );
  }

  // Check winding order and fix if clockwise
  // Pressure normals only point outward for CCW vertices
  let signedAreaCheck = 0;
  for (let i = 0; i < perimeterPixels.length; i++) {
    const next = (i + 1) % perimeterPixels.length;
    signedAreaCheck += perimeterPixels[i].x * perimeterPixels[next].y;
    signedAreaCheck -= perimeterPixels[next].x * perimeterPixels[i].y;
  }
  if (signedAreaCheck < 0) {
    // Clockwise - reverse to make CCW so pressure normals point outward
    perimeterPixels.reverse();
    console.log(`Blob ${id}: Reversed CW to CCW`);
  }

  // Calculate centroid for home offsets
  const centroid = getGridCentroid(cells);

  // Create outer vertices
  const vertices: Vertex[] = perimeterPixels.map(p => ({
    pos: { x: p.x, y: p.y },
    oldPos: { x: p.x, y: p.y },
    homeOffset: { x: p.x - centroid.x, y: p.y - centroid.y },
    mass: 1.0,
    attractionRadius: 1.0,  // All corners equal for now
  }));

  // Create inner vertices (same positions, will be used for stable core)
  const innerVertices: InnerVertex[] = perimeterPixels.map(p => ({
    pos: { x: p.x, y: p.y },
    oldPos: { x: p.x, y: p.y },
    homeOffset: { x: p.x - centroid.x, y: p.y - centroid.y },
  }));

  // Create ring springs (perimeter)
  const ringsprings: Spring[] = [];
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    const dx = vertices[next].homeOffset.x - vertices[i].homeOffset.x;
    const dy = vertices[next].homeOffset.y - vertices[i].homeOffset.y;
    ringsprings.push({
      a: i,
      b: next,
      restLength: Math.sqrt(dx * dx + dy * dy),
    });
  }

  // Create cross springs - DISTANCE BASED for floppy arms
  // Only connect vertices that are physically close (within ~1.5 cells)
  // This allows arms of T/L shapes to swing independently
  const crossSprings: Spring[] = [];
  const MAX_CROSS_DISTANCE = CELL_SIZE * 1.5;  // ~75px - only local connections
  const addedPairs = new Set<string>();

  for (let i = 0; i < n; i++) {
    // Skip immediate neighbors (already connected by ring springs)
    for (let j = i + 2; j < n; j++) {
      // Also skip the wrap-around neighbor
      if (j === n - 1 && i === 0) continue;

      const dx = vertices[j].homeOffset.x - vertices[i].homeOffset.x;
      const dy = vertices[j].homeOffset.y - vertices[i].homeOffset.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Only create spring if vertices are close enough
      if (dist < MAX_CROSS_DISTANCE) {
        const pairKey = `${Math.min(i, j)}-${Math.max(i, j)}`;
        if (!addedPairs.has(pairKey)) {
          addedPairs.add(pairKey);
          crossSprings.push({
            a: i,
            b: j,
            restLength: dist,
          });
        }
      }
    }
  }

  // Calculate rest area (Shoelace formula)
  // Positive = counterclockwise (correct), Negative = clockwise (will invert!)
  let signedArea = 0;
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    signedArea += vertices[i].homeOffset.x * vertices[next].homeOffset.y;
    signedArea -= vertices[next].homeOffset.x * vertices[i].homeOffset.y;
  }

  // DEBUG: Log winding order
  const winding = signedArea >= 0 ? 'CCW (correct)' : 'CW (WILL INVERT!)';
  console.log(`Blob ${id}: signedArea=${signedArea.toFixed(0)}, winding=${winding}, cells=${cells.length}`);

  const restArea = Math.abs(signedArea) / 2;

  return {
    id,
    vertices,
    innerVertices,
    ringsprings,
    crossSprings,
    restArea,
    targetX: centroid.x,
    targetY: centroid.y,
    rotation: 0,
    color,
    usePressure: true,
    fillAmount: isLocked ? 0 : 1,  // Locked = empty (start filling), Falling = full
    isShaking: false,
    wasFullLastFrame: !isLocked,
    gridCells: [...cells],
    isLocked,
    visualOffsetY: 0,  // Smooth falling offset
  };
}

// Transfer physics state from old blobs to a new merged blob
function transferPhysicsToMergedBlob(mergedBlob: Blob, oldBlobs: Blob[]): void {
  // Collect all old vertices with their positions and velocities
  const oldVertexData: { pos: Vec2; velocity: Vec2 }[] = [];
  for (const oldBlob of oldBlobs) {
    for (const v of oldBlob.vertices) {
      oldVertexData.push({
        pos: { x: v.pos.x, y: v.pos.y },
        velocity: { x: v.pos.x - v.oldPos.x, y: v.pos.y - v.oldPos.y },
      });
    }
  }

  // For each new vertex, find the nearest old vertex and transfer its velocity
  for (const newV of mergedBlob.vertices) {
    let nearestDist = Infinity;
    let nearestVelocity = { x: 0, y: 0 };

    for (const old of oldVertexData) {
      const dx = newV.pos.x - old.pos.x;
      const dy = newV.pos.y - old.pos.y;
      const dist = dx * dx + dy * dy;
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestVelocity = old.velocity;
      }
    }

    // Apply the velocity by adjusting oldPos
    newV.oldPos.x = newV.pos.x - nearestVelocity.x;
    newV.oldPos.y = newV.pos.y - nearestVelocity.y;
  }

  // Same for inner vertices
  const oldInnerData: { pos: Vec2; velocity: Vec2 }[] = [];
  for (const oldBlob of oldBlobs) {
    for (const v of oldBlob.innerVertices) {
      oldInnerData.push({
        pos: { x: v.pos.x, y: v.pos.y },
        velocity: { x: v.pos.x - v.oldPos.x, y: v.pos.y - v.oldPos.y },
      });
    }
  }

  for (const newV of mergedBlob.innerVertices) {
    let nearestDist = Infinity;
    let nearestVelocity = { x: 0, y: 0 };

    for (const old of oldInnerData) {
      const dx = newV.pos.x - old.pos.x;
      const dy = newV.pos.y - old.pos.y;
      const dist = dx * dx + dy * dy;
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestVelocity = old.velocity;
      }
    }

    newV.oldPos.x = newV.pos.x - nearestVelocity.x;
    newV.oldPos.y = newV.pos.y - nearestVelocity.y;
  }
}

// ============================================================================
// TETROMINO DEFINITIONS (for falling pieces)
// ============================================================================

type TetrominoType = 'I' | 'O' | 'T' | 'L' | 'J' | 'S' | 'Z';

const TETROMINO_SHAPES: Record<TetrominoType, Vec2[]> = {
  'I': [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }],
  'O': [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
  'T': [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }],
  'L': [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }],
  'J': [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 0, y: 2 }],
  'S': [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
  'Z': [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
};

// ============================================================================
// PHYSICS (same as Proto-6)
// ============================================================================

function rotatePoint(x: number, y: number, angleDeg: number): Vec2 {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

function integrate(blob: Blob, params: PhysicsParams, dt: number): void {
  for (const v of blob.vertices) {
    const vx = (v.pos.x - v.oldPos.x) * params.damping;
    const vy = (v.pos.y - v.oldPos.y) * params.damping;
    v.oldPos.x = v.pos.x;
    v.oldPos.y = v.pos.y;
    v.pos.x += vx;
    v.pos.y += vy + 10 * dt * dt;
  }

  for (const v of blob.innerVertices) {
    const vx = (v.pos.x - v.oldPos.x) * params.damping;
    const vy = (v.pos.y - v.oldPos.y) * params.damping;
    v.oldPos.x = v.pos.x;
    v.oldPos.y = v.pos.y;
    v.pos.x += vx;
    v.pos.y += vy + 10 * dt * dt;
  }
}

function applyHomeForce(blob: Blob, params: PhysicsParams): void {
  // returnSpeed controls how fast the blob returns to shape
  // Power curve gives finer control at low values (0.1 → 0.01 effective)
  // NOTE: Falling pieces use full speed (1.0) to keep up with grid position
  const speedMult = blob.isLocked
    ? params.returnSpeed * params.returnSpeed  // squared for finer low-end control
    : 1.0;  // Falling pieces stay snappy

  // Viscosity: converts instant position correction into gradual velocity-based movement
  // 0 = normal (position-based, snappy)
  // 1+ = full viscosity (velocity-based, honey-like slow return)
  // NOTE: Falling pieces (not locked) skip viscosity to avoid lagging behind
  const viscosity = blob.isLocked ? params.viscosity : 0;
  // At viscosity >= 1, position correction is fully off, only velocity-based
  const positionFactor = Math.max(0, 1 - viscosity);
  // Higher viscosity = even slower velocity application
  const velocityFactor = viscosity > 0 ? 0.03 / Math.max(1, viscosity) : 0;

  for (const v of blob.vertices) {
    const rotatedHome = rotatePoint(v.homeOffset.x, v.homeOffset.y, blob.rotation);
    const targetX = blob.targetX + rotatedHome.x;
    const targetY = blob.targetY + rotatedHome.y;
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

  for (const v of blob.innerVertices) {
    const rotatedHome = rotatePoint(v.homeOffset.x, v.homeOffset.y, blob.rotation);
    const targetX = blob.targetX + rotatedHome.x;
    const targetY = blob.targetY + rotatedHome.y;
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

function solveConstraints(blob: Blob, params: PhysicsParams): void {
  for (const spring of blob.ringsprings) {
    const a = blob.vertices[spring.a];
    const b = blob.vertices[spring.b];
    const dx = b.pos.x - a.pos.x;
    const dy = b.pos.y - a.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.0001) continue;
    const error = (dist - spring.restLength) / dist;
    const correction = error * params.stiffness * 0.01;
    a.pos.x += dx * correction;
    a.pos.y += dy * correction;
    b.pos.x -= dx * correction;
    b.pos.y -= dy * correction;
  }

  for (const spring of blob.crossSprings) {
    const a = blob.vertices[spring.a];
    const b = blob.vertices[spring.b];
    const dx = b.pos.x - a.pos.x;
    const dy = b.pos.y - a.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.0001) continue;
    const error = (dist - spring.restLength) / dist;
    const correction = error * params.stiffness * 0.005;
    a.pos.x += dx * correction;
    a.pos.y += dy * correction;
    b.pos.x -= dx * correction;
    b.pos.y -= dy * correction;
  }
}

function applyPressure(blob: Blob, params: PhysicsParams): void {
  // No pressure on falling pieces - only locked blobs
  if (!blob.isLocked) return;

  // Radial spring pressure: each vertex wants to be at its rest distance from center
  // Closer than rest → push out, farther than rest → pull in
  // This maintains shape while giving bounciness

  const cx = blob.targetX;
  const cy = blob.targetY;

  const pressureStrength = params.pressure * 0.002;

  for (const v of blob.vertices) {
    // Current position relative to center
    const dx = v.pos.x - cx;
    const dy = v.pos.y - cy;
    const currentDist = Math.sqrt(dx * dx + dy * dy);

    // Rest distance (how far this vertex should be from center)
    const restDist = Math.sqrt(v.homeOffset.x * v.homeOffset.x + v.homeOffset.y * v.homeOffset.y);

    if (currentDist > 0.0001 && restDist > 0.0001) {
      // Error: positive if compressed (need to push out), negative if stretched
      const error = restDist - currentDist;

      // Push/pull along radial direction
      const force = error * pressureStrength;
      v.pos.x += (dx / currentDist) * force;
      v.pos.y += (dy / currentDist) * force;
    }
  }
}

// Solid container - keeps vertices inside the grid boundaries
// Blobs squish against floor/walls instead of passing through
function applyBoundaryConstraints(blob: Blob): void {
  // Container bounds (the grid area)
  const LEFT = GRID_OFFSET_X;
  const RIGHT = GRID_OFFSET_X + GRID_COLS * CELL_SIZE;
  const TOP = GRID_OFFSET_Y;
  const BOTTOM = GRID_OFFSET_Y + GRID_ROWS * CELL_SIZE;

  // Small margin so vertices don't sit exactly on the edge
  const MARGIN = 2;
  // How much to dampen velocity on boundary contact (0 = full stop, 1 = no damping)
  const BOUNDARY_DAMPING = 0.3;

  for (const v of blob.vertices) {
    // Left wall
    if (v.pos.x < LEFT + MARGIN) {
      v.pos.x = LEFT + MARGIN;
      // Dampen horizontal velocity instead of killing it completely
      const vx = v.pos.x - v.oldPos.x;
      v.oldPos.x = v.pos.x - vx * BOUNDARY_DAMPING;
    }
    // Right wall
    if (v.pos.x > RIGHT - MARGIN) {
      v.pos.x = RIGHT - MARGIN;
      const vx = v.pos.x - v.oldPos.x;
      v.oldPos.x = v.pos.x - vx * BOUNDARY_DAMPING;
    }
    // Top wall (rarely needed but good to have)
    if (v.pos.y < TOP + MARGIN) {
      v.pos.y = TOP + MARGIN;
      const vy = v.pos.y - v.oldPos.y;
      v.oldPos.y = v.pos.y - vy * BOUNDARY_DAMPING;
    }
    // Floor - the main one for squishing
    if (v.pos.y > BOTTOM - MARGIN) {
      v.pos.y = BOTTOM - MARGIN;
      // Dampen vertical velocity - softer landing, less bounce
      const vy = v.pos.y - v.oldPos.y;
      v.oldPos.y = v.pos.y - vy * BOUNDARY_DAMPING;
    }
  }

  // Also constrain inner vertices
  for (const v of blob.innerVertices) {
    if (v.pos.x < LEFT + MARGIN) {
      v.pos.x = LEFT + MARGIN;
      const vx = v.pos.x - v.oldPos.x;
      v.oldPos.x = v.pos.x - vx * BOUNDARY_DAMPING;
    }
    if (v.pos.x > RIGHT - MARGIN) {
      v.pos.x = RIGHT - MARGIN;
      const vx = v.pos.x - v.oldPos.x;
      v.oldPos.x = v.pos.x - vx * BOUNDARY_DAMPING;
    }
    if (v.pos.y < TOP + MARGIN) {
      v.pos.y = TOP + MARGIN;
      const vy = v.pos.y - v.oldPos.y;
      v.oldPos.y = v.pos.y - vy * BOUNDARY_DAMPING;
    }
    if (v.pos.y > BOTTOM - MARGIN) {
      v.pos.y = BOTTOM - MARGIN;
      const vy = v.pos.y - v.oldPos.y;
      v.oldPos.y = v.pos.y - vy * BOUNDARY_DAMPING;
    }
  }
}

// Blob-to-blob collision - push apart vertices of different-colored blobs
function applyBlobCollisions(blobs: Blob[]): void {
  const MIN_DISTANCE = 20;  // Minimum distance between vertices (larger = more separation)
  const PUSH_STRENGTH = 0.8;  // How hard to push apart (higher = snappier)
  const ITERATIONS = 3;  // Multiple passes for stability

  for (let iter = 0; iter < ITERATIONS; iter++) {
    for (let i = 0; i < blobs.length; i++) {
      for (let j = i + 1; j < blobs.length; j++) {
        const blobA = blobs[i];
        const blobB = blobs[j];

        // Skip same-color blobs (they can overlap/merge)
        if (blobA.color === blobB.color) continue;

        // Quick bounding box check to skip distant blobs
        const dx = blobA.targetX - blobB.targetX;
        const dy = blobA.targetY - blobB.targetY;
        const centerDist = Math.sqrt(dx * dx + dy * dy);
        if (centerDist > CELL_SIZE * 4) continue;  // Too far apart

        // Check vertex-to-vertex collisions
        for (const vA of blobA.vertices) {
          for (const vB of blobB.vertices) {
            const vdx = vB.pos.x - vA.pos.x;
            const vdy = vB.pos.y - vA.pos.y;
            const dist = Math.sqrt(vdx * vdx + vdy * vdy);

            if (dist < MIN_DISTANCE && dist > 0.01) {
              // Push apart
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

// ============================================================================
// ATTRACTION SPRINGS (same as Proto-6, but only between same-color blobs)
// ============================================================================

function updateAttractionSprings(
  blobs: Blob[],
  springs: AttractionSpring[],
  params: PhysicsParams
): AttractionSpring[] {
  const newSprings: AttractionSpring[] = [];
  const existingPairs = new Set<string>();

  for (const spring of springs) {
    const blobA = blobs[spring.blobA];
    const blobB = blobs[spring.blobB];
    if (!blobA || !blobB) continue;

    // Only maintain springs between same-color blobs
    if (blobA.color !== blobB.color) continue;

    const vA = blobA.vertices[spring.vertA];
    const vB = blobB.vertices[spring.vertB];
    if (!vA || !vB) continue;

    const dx = vB.pos.x - vA.pos.x;
    const dy = vB.pos.y - vA.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < params.goopiness) {
      newSprings.push(spring);
      existingPairs.add(`${spring.blobA}-${spring.vertA}-${spring.blobB}-${spring.vertB}`);
    }
  }

  for (let bi = 0; bi < blobs.length; bi++) {
    for (let bj = bi + 1; bj < blobs.length; bj++) {
      const blobA = blobs[bi];
      const blobB = blobs[bj];

      // Only create springs between same-color blobs
      if (blobA.color !== blobB.color) continue;

      const centerDx = blobA.targetX - blobB.targetX;
      const centerDy = blobA.targetY - blobB.targetY;
      const centerDist = Math.sqrt(centerDx * centerDx + centerDy * centerDy);

      if (centerDist > params.attractionRadius * 6) continue;

      for (let vi = 0; vi < blobA.vertices.length; vi++) {
        for (let vj = 0; vj < blobB.vertices.length; vj++) {
          const vA = blobA.vertices[vi];
          const vB = blobB.vertices[vj];

          const pairKey = `${bi}-${vi}-${bj}-${vj}`;
          if (existingPairs.has(pairKey)) continue;

          const dx = vB.pos.x - vA.pos.x;
          const dy = vB.pos.y - vA.pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          const radiusA = params.attractionRadius * vA.attractionRadius;
          const radiusB = params.attractionRadius * vB.attractionRadius;
          const effectiveRadius = radiusA + radiusB;

          if (dist < effectiveRadius) {
            newSprings.push({
              blobA: bi,
              vertA: vi,
              blobB: bj,
              vertB: vj,
              restLength: params.attractionRestLength,
            });
            existingPairs.add(pairKey);
          }
        }
      }
    }
  }

  return newSprings;
}

function applyAttractionSprings(
  blobs: Blob[],
  springs: AttractionSpring[],
  params: PhysicsParams
): void {
  const MIN_STIFFNESS = params.attractionStiffness * 0.1;
  const MAX_STIFFNESS = params.attractionStiffness;

  for (const spring of springs) {
    const blobA = blobs[spring.blobA];
    const blobB = blobs[spring.blobB];
    if (!blobA || !blobB) continue;

    const vA = blobA.vertices[spring.vertA];
    const vB = blobB.vertices[spring.vertB];
    if (!vA || !vB) continue;

    const dx = vB.pos.x - vA.pos.x;
    const dy = vB.pos.y - vA.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.0001) continue;

    const maxDist = params.attractionRadius * (vA.attractionRadius + vB.attractionRadius);
    const t = 1 - Math.max(0, Math.min(1, (dist - spring.restLength) / (maxDist - spring.restLength)));
    const stiffness = MIN_STIFFNESS + t * (MAX_STIFFNESS - MIN_STIFFNESS);

    const error = dist - spring.restLength;
    const fx = (dx / dist) * error * stiffness;
    const fy = (dy / dist) * error * stiffness;

    vA.pos.x += fx;
    vA.pos.y += fy;
    vB.pos.x -= fx;
    vB.pos.y -= fy;
  }
}

// Apply outward impulse to all vertices (for ready-to-pop effect)
// In Verlet, velocity = pos - oldPos, so moving oldPos inward creates outward velocity
function applyOutwardImpulse(blob: Blob, impulseStrength: number): void {
  const vertices = blob.vertices;
  const n = vertices.length;
  if (n < 3) return;

  for (let i = 0; i < n; i++) {
    const prev = vertices[(i - 1 + n) % n].pos;
    const curr = vertices[i].pos;
    const next = vertices[(i + 1) % n].pos;

    // Edge vectors
    const e1x = curr.x - prev.x;
    const e1y = curr.y - prev.y;
    const e2x = next.x - curr.x;
    const e2y = next.y - curr.y;

    // Normalize edges
    const len1 = Math.sqrt(e1x * e1x + e1y * e1y) || 1;
    const len2 = Math.sqrt(e2x * e2x + e2y * e2y) || 1;
    const n1x = e1x / len1;
    const n1y = e1y / len1;
    const n2x = e2x / len2;
    const n2y = e2y / len2;

    // Perpendicular outward normals (rotate 90° clockwise for outward)
    const out1x = n1y;
    const out1y = -n1x;
    const out2x = n2y;
    const out2y = -n2x;

    // Average the two outward normals
    let avgNx = out1x + out2x;
    let avgNy = out1y + out2y;
    const avgLen = Math.sqrt(avgNx * avgNx + avgNy * avgNy) || 1;
    avgNx /= avgLen;
    avgNy /= avgLen;

    // Move oldPos inward to create outward velocity
    vertices[i].oldPos.x -= avgNx * impulseStrength;
    vertices[i].oldPos.y -= avgNy * impulseStrength;
  }
}

// ============================================================================
// RENDERING (same as Proto-6)
// ============================================================================

function catmullRomToBezier(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2): { cp1: Vec2; cp2: Vec2 } {
  return {
    cp1: { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 },
    cp2: { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 },
  };
}

function getPath(points: Vec2[]): string {
  const n = points.length;
  if (n < 3) return '';

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    const { cp1, cp2 } = catmullRomToBezier(p0, p1, p2, p3);
    path += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${p2.x} ${p2.y}`;
  }

  return path + ' Z';
}

function getBlobPath(vertices: Vertex[]): string {
  return getPath(vertices.map(v => v.pos));
}

function getInsetPath(points: Vec2[], insetAmount: number): Vec2[] {
  const n = points.length;
  if (n < 3) return points;

  const localWidths: number[] = [];
  for (let i = 0; i < n; i++) {
    const curr = points[i];
    let minDist = Infinity;

    for (let j = 0; j < n; j++) {
      const diff = Math.abs(j - i);
      const wrapDiff = n - diff;
      if (diff <= 2 || wrapDiff <= 2) continue;

      const other = points[j];
      const dx = other.x - curr.x;
      const dy = other.y - curr.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) minDist = dist;
    }

    localWidths[i] = minDist === Infinity ? 1000 : minDist;
  }

  const insetPoints: Vec2[] = [];

  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const curr = points[i];
    const next = points[(i + 1) % n];

    const e1x = curr.x - prev.x;
    const e1y = curr.y - prev.y;
    const e2x = next.x - curr.x;
    const e2y = next.y - curr.y;

    const len1 = Math.sqrt(e1x * e1x + e1y * e1y);
    const len2 = Math.sqrt(e2x * e2x + e2y * e2y);

    if (len1 < 0.001 || len2 < 0.001) {
      insetPoints.push(curr);
      continue;
    }

    const n1x = e1x / len1;
    const n1y = e1y / len1;
    const n2x = e2x / len2;
    const n2y = e2y / len2;

    const in1x = -n1y;
    const in1y = n1x;
    const in2x = -n2y;
    const in2y = n2x;

    let avgNx = in1x + in2x;
    let avgNy = in1y + in2y;
    const avgLen = Math.sqrt(avgNx * avgNx + avgNy * avgNy);

    if (avgLen < 0.001) {
      avgNx = in1x;
      avgNy = in1y;
    } else {
      avgNx /= avgLen;
      avgNy /= avgLen;
    }

    const dot = n1x * n2x + n1y * n2y;
    const halfAngleCos = Math.sqrt((1 + dot) / 2);
    const miter = halfAngleCos > 0.1 ? 1 / halfAngleCos : 10;

    const maxInset = localWidths[i] * 0.4;
    const effectiveInset = Math.min(insetAmount, maxInset);

    insetPoints.push({
      x: curr.x + avgNx * effectiveInset * Math.min(miter, 3),
      y: curr.y + avgNy * effectiveInset * Math.min(miter, 3),
    });
  }

  return insetPoints;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SoftBodyProto8() {
  const svgRef = useRef<SVGSVGElement>(null);
  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const blobsRef = useRef<Blob[]>([]);
  const gridRef = useRef<(GridCell | null)[][]>([]);
  const attractionSpringsRef = useRef<AttractionSpring[]>([]);

  // Falling piece state
  const fallingBlobIndexRef = useRef<number | null>(null);
  const needsLockRef = useRef<boolean>(false);
  const [fallSpeed, setFallSpeed] = useState(FALL_SPEED);

  const [physics, setPhysics] = useState<PhysicsParams>(DEFAULT_PHYSICS);
  const [fillParams, setFillParams] = useState<FillParams>(DEFAULT_FILL);
  const [filterParams, setFilterParams] = useState<FilterParams>(FILTER_PRESETS.medium);
  const [activePreset, setActivePreset] = useState<string>('medium');
  const [showGrid, setShowGrid] = useState(true);
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [selectedShape, setSelectedShape] = useState<TetrominoType>('T');
  const [, forceUpdate] = useState({});

  // Impact parameters (tweakable)
  const [impactStrength, setImpactStrength] = useState(5);
  const [impactRadius, setImpactRadius] = useState(1.5);  // In cell units

  // Refs to keep current values accessible in animation loop callbacks
  const impactStrengthRef = useRef(impactStrength);
  const impactRadiusRef = useRef(impactRadius);
  impactStrengthRef.current = impactStrength;
  impactRadiusRef.current = impactRadius;

  // Droplets for pop effect
  const dropletsRef = useRef<Droplet[]>([]);
  const dropletIdCounter = useRef(0);

  // Pop parameters
  const [dropletCount, setDropletCount] = useState(12);      // Droplets per pop
  const [dropletSpeed, setDropletSpeed] = useState(150);     // Initial scatter speed
  const [dropletLifetime, setDropletLifetime] = useState(1.0); // Seconds to fade out
  const [dropletSize, setDropletSize] = useState(8);         // Base radius

  // Dev menu state
  const [showDevMenu, setShowDevMenu] = useState(false);
  const DEV_SETTINGS_KEY = 'proto8-dev-settings';

  // Load settings from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(DEV_SETTINGS_KEY);
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        if (settings.physics) setPhysics(settings.physics);
        if (settings.fillParams) setFillParams(settings.fillParams);
        if (settings.filterParams) {
          setFilterParams(settings.filterParams);
          setActivePreset('custom');
        }
        if (settings.fallSpeed) setFallSpeed(settings.fallSpeed);
        if (settings.impactStrength) setImpactStrength(settings.impactStrength);
        if (settings.impactRadius) setImpactRadius(settings.impactRadius);
        if (settings.dropletCount) setDropletCount(settings.dropletCount);
        if (settings.dropletSpeed) setDropletSpeed(settings.dropletSpeed);
        if (settings.dropletLifetime) setDropletLifetime(settings.dropletLifetime);
        if (settings.dropletSize) setDropletSize(settings.dropletSize);
        console.log('Loaded dev settings from localStorage');
      } catch (e) {
        console.warn('Failed to load dev settings:', e);
      }
    }
  }, []);

  // Toggle dev menu with ` key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '`') {
        e.preventDefault();
        setShowDevMenu(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Save all dev settings to localStorage
  const saveDevSettings = useCallback(() => {
    const settings = {
      physics,
      fillParams,
      filterParams,
      fallSpeed,
      impactStrength,
      impactRadius,
      dropletCount,
      dropletSpeed,
      dropletLifetime,
      dropletSize,
    };
    localStorage.setItem(DEV_SETTINGS_KEY, JSON.stringify(settings));
    console.log('Saved dev settings to localStorage');
  }, [physics, fillParams, filterParams, fallSpeed, impactStrength, impactRadius, dropletCount, dropletSpeed, dropletLifetime, dropletSize]);

  // Helper to initialize grid with starting pieces
  const initializeGrid = useCallback(() => {
    // Clear and create fresh grid
    const grid: (GridCell | null)[][] = [];
    for (let y = 0; y < GRID_ROWS; y++) {
      grid[y] = [];
      for (let x = 0; x < GRID_COLS; x++) {
        grid[y][x] = null;
      }
    }
    gridRef.current = grid;

    // Reset blob counter
    blobIdCounter = 0;

    // Create initial locked pieces at bottom for testing
    const initialBlobs: Blob[] = [];

    // Red T at bottom left
    const redCells = [
      { x: 0, y: GRID_ROWS - 1 },
      { x: 1, y: GRID_ROWS - 1 },
      { x: 2, y: GRID_ROWS - 1 },
      { x: 1, y: GRID_ROWS - 2 },
    ];
    const redBlob = createBlobFromCells(redCells, COLORS[0], true);
    initialBlobs.push(redBlob);
    for (const cell of redCells) {
      grid[cell.y][cell.x] = { blobId: redBlob.id, color: redBlob.color };
    }

    // Blue square at bottom right
    const blueCells = [
      { x: 4, y: GRID_ROWS - 1 },
      { x: 5, y: GRID_ROWS - 1 },
      { x: 4, y: GRID_ROWS - 2 },
      { x: 5, y: GRID_ROWS - 2 },
    ];
    const blueBlob = createBlobFromCells(blueCells, COLORS[1], true);
    initialBlobs.push(blueBlob);
    for (const cell of blueCells) {
      grid[cell.y][cell.x] = { blobId: blueBlob.id, color: blueBlob.color };
    }

    blobsRef.current = initialBlobs;
    attractionSpringsRef.current = [];
    dropletsRef.current = [];
    fallingBlobIndexRef.current = null;
    needsLockRef.current = false;
  }, []);

  // Initialize on mount
  useEffect(() => {
    initializeGrid();
  }, [initializeGrid]);

  // Animation loop
  useEffect(() => {
    let skipFirst = true;

    const animate = (time: number) => {
      if (skipFirst) {
        lastTimeRef.current = time;
        skipFirst = false;
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      const dt = Math.min((time - lastTimeRef.current) / 1000, 0.033);
      lastTimeRef.current = time;

      for (const blob of blobsRef.current) {
        integrate(blob, physics, dt);
        applyHomeForce(blob, physics);
        for (let i = 0; i < physics.iterations; i++) {
          solveConstraints(blob, physics);
        }
        if (blob.usePressure) {
          applyPressure(blob, physics);
        }
        // Keep vertices inside the container (floor/walls)
        applyBoundaryConstraints(blob);
      }

      // Apply collision between different-colored blobs (after all individual physics)
      applyBlobCollisions(blobsRef.current);

      for (const blob of blobsRef.current) {
        // Fill update only for locked blobs
        if (blob.isLocked && fillParams.autoFill && blob.fillAmount < 1) {
          blob.fillAmount = Math.min(1, blob.fillAmount + fillParams.fillRate * dt);
        }

        // One-time outward impulse when blob becomes full (ready to pop)
        const isFull = blob.fillAmount >= 1;
        if (isFull && !blob.wasFullLastFrame) {
          // Apply outward impulse to each vertex along its normal
          applyOutwardImpulse(blob, PULSE_AMPLITUDE);
        }
        blob.wasFullLastFrame = isFull;
      }

      // Handle smooth falling for falling pieces
      if (fallingBlobIndexRef.current !== null) {
        const fallingBlob = blobsRef.current[fallingBlobIndexRef.current];
        if (fallingBlob && !fallingBlob.isLocked) {
          // Calculate the "ghost Y" - maximum grid row this piece can reach
          let maxGridY = GRID_ROWS - 1;
          for (const cell of fallingBlob.gridCells) {
            let testY = cell.y;
            while (testY < GRID_ROWS - 1) {
              const nextY = testY + 1;
              const targetCell = gridRef.current[nextY]?.[cell.x];
              if (targetCell && targetCell.blobId !== fallingBlob.id) {
                break;  // Hit something
              }
              testY = nextY;
            }
            // This cell can reach testY, but we need the minimum across all cells
            const cellMaxY = testY - cell.y + fallingBlob.gridCells[0].y;
            // Actually, calculate how many rows down from current position
            const rowsCanFall = testY - cell.y;
            const maxYForThisCell = cell.y + rowsCanFall;
            // Track the limiting cell
            if (maxYForThisCell - cell.y < maxGridY - fallingBlob.gridCells[0].y) {
              // This cell is the limiting factor
            }
          }

          // Simpler approach: find how many complete rows we can fall
          let rowsCanFall = GRID_ROWS;
          for (const cell of fallingBlob.gridCells) {
            let testRows = 0;
            while (cell.y + testRows + 1 < GRID_ROWS) {
              const nextY = cell.y + testRows + 1;
              const targetCell = gridRef.current[nextY]?.[cell.x];
              if (targetCell && targetCell.blobId !== fallingBlob.id) {
                break;
              }
              testRows++;
            }
            rowsCanFall = Math.min(rowsCanFall, testRows);
          }

          // Calculate max visual offset (in pixels) before we'd hit something
          const maxVisualOffset = rowsCanFall * CELL_SIZE;

          // Update visual offset, but cap at max
          const fallAmount = fallSpeed * dt;
          const newOffset = Math.min(fallingBlob.visualOffsetY + fallAmount, maxVisualOffset);
          fallingBlob.visualOffsetY = newOffset;

          // Check if we've completed falling a full cell
          while (fallingBlob.visualOffsetY >= CELL_SIZE) {
            // Move grid cells down
            for (const cell of fallingBlob.gridCells) {
              cell.y += 1;
            }
            fallingBlob.visualOffsetY -= CELL_SIZE;
          }

          // Update targetY for smooth visual
          const gridCentroid = getGridCentroid(fallingBlob.gridCells);
          fallingBlob.targetY = gridCentroid.y + fallingBlob.visualOffsetY;

          // Check if we've reached the landing position (can't fall further)
          // Piece can only fall if ALL cells can move down
          let canFallMore = true;
          for (const cell of fallingBlob.gridCells) {
            const nextY = cell.y + 1;
            if (nextY >= GRID_ROWS) {
              canFallMore = false;
              break;
            }
            const targetCell = gridRef.current[nextY]?.[cell.x];
            if (targetCell && targetCell.blobId !== fallingBlob.id) {
              canFallMore = false;
              break;
            }
          }
          // If piece can't fall more AND we've consumed the offset, lock
          if (!canFallMore && fallingBlob.visualOffsetY < 0.1) {
            fallingBlob.visualOffsetY = 0;
            fallingBlob.targetY = gridCentroid.y;
            needsLockRef.current = true;
          }
        }
      }

      attractionSpringsRef.current = updateAttractionSprings(
        blobsRef.current,
        attractionSpringsRef.current,
        physics
      );
      applyAttractionSprings(blobsRef.current, attractionSpringsRef.current, physics);

      // Handle deferred lock (from falling logic)
      if (needsLockRef.current && fallingBlobIndexRef.current !== null) {
        needsLockRef.current = false;
        performLock();
      }

      // Update droplets (physics + lifetime)
      const GRAVITY = 300;  // Droplets fall
      const LEFT = GRID_OFFSET_X;
      const RIGHT = GRID_OFFSET_X + GRID_COLS * CELL_SIZE;
      const TOP = GRID_OFFSET_Y;
      const BOTTOM = GRID_OFFSET_Y + GRID_ROWS * CELL_SIZE;

      for (const droplet of dropletsRef.current) {
        // Apply gravity
        droplet.vel.y += GRAVITY * dt;

        // Apply velocity
        droplet.pos.x += droplet.vel.x * dt;
        droplet.pos.y += droplet.vel.y * dt;

        // Side walls: kill droplet when it exits (no walls in real game)
        if (droplet.pos.x + droplet.radius < LEFT || droplet.pos.x - droplet.radius > RIGHT) {
          droplet.lifetime = 0;  // Mark for removal
        }
        // Top: kill droplet if it escapes upward
        if (droplet.pos.y + droplet.radius < TOP) {
          droplet.lifetime = 0;
        }
        // Floor: bounce with damping
        if (droplet.pos.y + droplet.radius > BOTTOM) {
          droplet.pos.y = BOTTOM - droplet.radius;
          droplet.vel.y *= -0.3;
        }

        // Decrease lifetime and fade
        droplet.lifetime -= dt;
        droplet.opacity = Math.max(0, droplet.lifetime / droplet.maxLifetime);

        // Shrink as it fades
        droplet.radius *= 0.995;
      }

      // Remove dead droplets
      dropletsRef.current = dropletsRef.current.filter(d => d.lifetime > 0 && d.opacity > 0.01);

      forceUpdate({});
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationRef.current);
  }, [physics, fillParams, fallSpeed]);

  // Check if a cell is occupied
  const isCellOccupied = useCallback((x: number, y: number): boolean => {
    if (y < 0 || y >= GRID_ROWS || x < 0 || x >= GRID_COLS) return true;
    return gridRef.current[y]?.[x] !== null;
  }, []);

  // Find adjacent same-color blobs
  const findAdjacentSameColorBlobs = useCallback((cells: Vec2[], color: string): Set<string> => {
    const adjacentBlobIds = new Set<string>();
    const grid = gridRef.current;

    for (const cell of cells) {
      // Check 4 neighbors
      const neighbors = [
        { x: cell.x - 1, y: cell.y },
        { x: cell.x + 1, y: cell.y },
        { x: cell.x, y: cell.y - 1 },
        { x: cell.x, y: cell.y + 1 },
      ];

      for (const n of neighbors) {
        if (n.y >= 0 && n.y < GRID_ROWS && n.x >= 0 && n.x < GRID_COLS) {
          const neighborCell = grid[n.y][n.x];
          if (neighborCell && neighborCell.color === color) {
            adjacentBlobIds.add(neighborCell.blobId);
          }
        }
      }
    }

    return adjacentBlobIds;
  }, []);

  // Apply impact impulse to nearby blobs - LOCALIZED to contact points
  const applyImpactToNearbyBlobs = useCallback((impactBlob: Blob) => {
    // Use refs to get current slider values (avoids stale closure)
    const impactStrength = impactStrengthRef.current;
    const impactRadius = impactRadiusRef.current;
    // Find contact points - where falling blob cells are adjacent to grid cells
    const contactPoints: Vec2[] = [];
    for (const cell of impactBlob.gridCells) {
      // Check cell directly below (main impact direction)
      const belowY = cell.y + 1;
      if (belowY < GRID_ROWS && gridRef.current[belowY]?.[cell.x]) {
        // Contact point is at the bottom edge of this cell
        contactPoints.push(gridCornerToPixel(cell.x + 0.5, cell.y + 1));
      }
      // Also check sides for horizontal contact
      if (cell.x > 0 && gridRef.current[cell.y]?.[cell.x - 1]) {
        contactPoints.push(gridCornerToPixel(cell.x, cell.y + 0.5));
      }
      if (cell.x < GRID_COLS - 1 && gridRef.current[cell.y]?.[cell.x + 1]) {
        contactPoints.push(gridCornerToPixel(cell.x + 1, cell.y + 0.5));
      }
    }

    if (contactPoints.length === 0) return;

    // Impact radius - how far from contact point vertices are affected (uses state)
    const vertexImpactRadius = CELL_SIZE * impactRadius;

    for (const blob of blobsRef.current) {
      if (blob.id === impactBlob.id) continue;  // Skip the falling blob itself

      // Apply impulse only to vertices near contact points
      for (const v of blob.vertices) {
        // Find distance to nearest contact point
        let minDist = Infinity;
        let nearestContact: Vec2 | null = null;
        for (const contact of contactPoints) {
          const dx = v.pos.x - contact.x;
          const dy = v.pos.y - contact.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDist) {
            minDist = dist;
            nearestContact = contact;
          }
        }

        // Only affect vertices within the impact radius
        if (minDist < vertexImpactRadius && nearestContact) {
          const falloff = 1 - (minDist / vertexImpactRadius);
          const strength = impactStrength * falloff * falloff;  // Quadratic falloff for sharper localization

          // Push vertex away from contact point (outward, not downward - floor kills downward velocity)
          const dirX = (v.pos.x - nearestContact.x) / (minDist + 0.1);
          const dirY = (v.pos.y - nearestContact.y) / (minDist + 0.1);

          // Impulse is applied by adjusting oldPos (Verlet integration)
          // Strong lateral push, weak vertical (outward from contact)
          v.oldPos.x -= dirX * strength;
          v.oldPos.y -= dirY * strength * 0.5;
        }
      }

      // Same for inner vertices but weaker effect
      for (const v of blob.innerVertices) {
        let minDist = Infinity;
        let nearestContact: Vec2 | null = null;
        for (const contact of contactPoints) {
          const dx = v.pos.x - contact.x;
          const dy = v.pos.y - contact.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDist) {
            minDist = dist;
            nearestContact = contact;
          }
        }

        if (minDist < vertexImpactRadius && nearestContact) {
          const falloff = 1 - (minDist / vertexImpactRadius);
          const strength = impactStrength * falloff * falloff * 0.3;  // Inner is more stable
          const dirX = (v.pos.x - nearestContact.x) / (minDist + 0.1);
          const dirY = (v.pos.y - nearestContact.y) / (minDist + 0.1);
          v.oldPos.x -= dirX * strength;
          v.oldPos.y -= dirY * strength * 0.5;
        }
      }
    }
  }, []);  // Uses refs, no dependencies needed

  // Pop a blob - remove it and spawn droplets
  const popBlob = useCallback((blob: Blob) => {
    // Spawn droplets at vertex positions
    const centerX = blob.targetX;
    const centerY = blob.targetY;

    for (let i = 0; i < dropletCount; i++) {
      // Pick a random vertex position (or interpolate between them)
      const vertIndex = Math.floor(Math.random() * blob.vertices.length);
      const vert = blob.vertices[vertIndex];

      // Direction: outward from center with some randomness
      const dx = vert.pos.x - centerX;
      const dy = vert.pos.y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.8;  // Add spread

      // Random speed variation
      const speed = dropletSpeed * (0.5 + Math.random() * 0.8);

      const droplet: Droplet = {
        id: `droplet-${dropletIdCounter.current++}`,
        pos: { x: vert.pos.x, y: vert.pos.y },
        vel: {
          x: Math.cos(angle) * speed,
          y: Math.sin(angle) * speed - 50  // Slight upward bias for "pop" feel
        },
        radius: dropletSize * (0.5 + Math.random() * 0.7),
        color: blob.color,
        opacity: 1,
        lifetime: dropletLifetime * (0.7 + Math.random() * 0.6),
        maxLifetime: dropletLifetime,
      };

      dropletsRef.current.push(droplet);
      console.log('Created droplet:', droplet.pos, droplet.radius, droplet.color);
    }

    // Clear grid cells
    for (const cell of blob.gridCells) {
      if (gridRef.current[cell.y]?.[cell.x]?.blobId === blob.id) {
        gridRef.current[cell.y][cell.x] = null;
      }
    }

    // Remove blob from list
    blobsRef.current = blobsRef.current.filter(b => b.id !== blob.id);

    console.log(`Popped blob with ${blob.gridCells.length} cells, spawned ${dropletsRef.current.length} droplets total`);
  }, [dropletCount, dropletSpeed, dropletLifetime, dropletSize]);

  // Perform the actual lock (called from animation loop or drop)
  const performLock = useCallback(() => {
    if (fallingBlobIndexRef.current === null) return;

    const fallingBlob = blobsRef.current[fallingBlobIndexRef.current];
    if (!fallingBlob) return;

    // Apply impact to nearby blobs BEFORE we modify anything
    applyImpactToNearbyBlobs(fallingBlob);

    // Snap to grid position
    fallingBlob.visualOffsetY = 0;
    const gridCentroid = getGridCentroid(fallingBlob.gridCells);
    fallingBlob.targetY = gridCentroid.y;

    // Find adjacent same-color blobs
    const adjacentBlobIds = findAdjacentSameColorBlobs(fallingBlob.gridCells, fallingBlob.color);

    if (adjacentBlobIds.size > 0) {
      // MERGE: Combine all same-color adjacent blobs + falling piece into one
      const allCells: Vec2[] = [...fallingBlob.gridCells];
      const blobsToMerge: Blob[] = [fallingBlob];
      const blobIdsToRemove: string[] = [fallingBlob.id];

      for (const blobId of adjacentBlobIds) {
        const blob = blobsRef.current.find(b => b.id === blobId);
        if (blob) {
          allCells.push(...blob.gridCells);
          blobsToMerge.push(blob);
          blobIdsToRemove.push(blobId);
        }
      }

      // Create new merged blob
      const mergedBlob = createBlobFromCells(allCells, fallingBlob.color, true);

      // Transfer physics from old blobs to maintain momentum
      transferPhysicsToMergedBlob(mergedBlob, blobsToMerge);

      // Update grid
      for (const cell of allCells) {
        gridRef.current[cell.y][cell.x] = { blobId: mergedBlob.id, color: mergedBlob.color };
      }

      // Remove old blobs, add merged blob
      blobsRef.current = blobsRef.current.filter(b => !blobIdsToRemove.includes(b.id));
      blobsRef.current.push(mergedBlob);

      console.log(`Merged ${blobIdsToRemove.length} blobs into one with ${allCells.length} cells`);
    } else {
      // NO MERGE: Just lock the falling piece in place
      fallingBlob.isLocked = true;
      fallingBlob.fillAmount = 0;  // Start filling
      fallingBlob.wasFullLastFrame = false;

      // Update grid
      for (const cell of fallingBlob.gridCells) {
        gridRef.current[cell.y][cell.x] = { blobId: fallingBlob.id, color: fallingBlob.color };
      }

      console.log('Locked piece (no same-color neighbors)');
    }

    // Clear falling reference
    fallingBlobIndexRef.current = null;
  }, [findAdjacentSameColorBlobs, applyImpactToNearbyBlobs]);

  // Spawn a new falling piece
  const spawnFallingPiece = useCallback(() => {
    // Don't spawn if there's already a falling piece
    if (fallingBlobIndexRef.current !== null) return;

    const shape = TETROMINO_SHAPES[selectedShape];
    const startX = Math.floor((GRID_COLS - 4) / 2);  // Center horizontally
    const startY = 0;

    const cells = shape.map(s => ({ x: s.x + startX, y: s.y + startY }));

    // Check if spawn location is clear
    for (const cell of cells) {
      if (isCellOccupied(cell.x, cell.y)) {
        console.log('Cannot spawn - space occupied');
        return;
      }
    }

    const newBlob = createBlobFromCells(cells, selectedColor, false);
    newBlob.visualOffsetY = 0;  // Start at grid position
    blobsRef.current.push(newBlob);
    fallingBlobIndexRef.current = blobsRef.current.length - 1;

    // Falling is now handled in the animation loop (smooth)
  }, [selectedShape, selectedColor, isCellOccupied]);

  // Drop piece instantly
  const dropPiece = useCallback(() => {
    if (fallingBlobIndexRef.current === null) return;

    const blob = blobsRef.current[fallingBlobIndexRef.current];
    if (!blob) return;

    // Move down until we can't
    while (true) {
      let canMove = true;
      for (const cell of blob.gridCells) {
        const nextY = cell.y + 1;
        if (nextY >= GRID_ROWS) {
          canMove = false;
          break;
        }
        const targetCell = gridRef.current[nextY]?.[cell.x];
        if (targetCell && targetCell.blobId !== blob.id) {
          canMove = false;
          break;
        }
      }

      if (!canMove) break;

      // Move down one row
      for (const cell of blob.gridCells) {
        cell.y += 1;
      }
    }

    // Reset visual offset and lock
    blob.visualOffsetY = 0;
    performLock();
  }, [performLock]);

  // Reset everything - respawns initial pieces
  const resetAll = useCallback(() => {
    initializeGrid();
  }, [initializeGrid]);

  const applyPreset = (presetName: string) => {
    const preset = FILTER_PRESETS[presetName as keyof typeof FILTER_PRESETS];
    if (preset) {
      setFilterParams(preset);
      setActivePreset(presetName);
    }
  };

  const getFilterMatrix = () => {
    const { alphaMultiplier, alphaOffset } = filterParams;
    return `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${alphaMultiplier} ${alphaOffset}`;
  };

  const bgColor = '#2c3e50';

  const getBounds = (points: Vec2[]): { minX: number; maxX: number; minY: number; maxY: number } => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX, maxX, minY, maxY };
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: 20,
      background: '#1a1a2e',
      minHeight: '100vh',
      color: '#fff',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <h2 style={{ margin: '0 0 10px 0' }}>Proto-8: Pop</h2>
      <p style={{ margin: '0 0 20px 0', opacity: 0.7, fontSize: 14 }}>
        Pop with residue — click filled blobs to pop them, droplets scatter and fade
      </p>

      {/* Controls Row 1: Piece Selection */}
      <div style={{
        display: 'flex',
        gap: 15,
        marginBottom: 15,
        background: '#27ae60',
        padding: 15,
        borderRadius: 8,
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <span style={{ fontWeight: 'bold' }}>Color:</span>
        {COLORS.map((color, i) => (
          <button
            key={color}
            onClick={() => setSelectedColor(color)}
            style={{
              width: 30,
              height: 30,
              background: color,
              border: selectedColor === color ? '3px solid white' : '3px solid transparent',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          />
        ))}

        <span style={{ marginLeft: 20, fontWeight: 'bold' }}>Shape:</span>
        {(['T', 'O', 'L', 'I', 'S', 'Z', 'J'] as TetrominoType[]).map(shape => (
          <button
            key={shape}
            onClick={() => setSelectedShape(shape)}
            style={{
              padding: '6px 12px',
              background: selectedShape === shape ? '#fff' : '#2c3e50',
              color: selectedShape === shape ? '#000' : '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            {shape}
          </button>
        ))}
      </div>

      {/* Controls Row 2: Actions */}
      <div style={{
        display: 'flex',
        gap: 15,
        marginBottom: 15,
        background: '#2c3e50',
        padding: 15,
        borderRadius: 8,
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}>
        <button
          onClick={spawnFallingPiece}
          disabled={fallingBlobIndexRef.current !== null}
          style={{
            padding: '10px 20px',
            background: fallingBlobIndexRef.current !== null ? '#7f8c8d' : '#3498db',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: fallingBlobIndexRef.current !== null ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
          }}
        >
          Spawn Piece
        </button>
        <button
          onClick={dropPiece}
          disabled={fallingBlobIndexRef.current === null}
          style={{
            padding: '10px 20px',
            background: fallingBlobIndexRef.current === null ? '#7f8c8d' : '#e67e22',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: fallingBlobIndexRef.current === null ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
          }}
        >
          Drop (Lock)
        </button>
        <button
          onClick={resetAll}
          style={{
            padding: '10px 20px',
            background: '#c0392b',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          Reset All
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
          <input
            type="checkbox"
            checked={showGrid}
            onChange={e => setShowGrid(e.target.checked)}
          />
          <span>Show Grid</span>
        </label>
        <span style={{ opacity: 0.5, fontSize: 12 }}>Press ` for dev menu</span>
      </div>

      {/* DEV MENU - Toggle with ` key */}
      {showDevMenu && (
      <div style={{
        background: 'rgba(0,0,0,0.8)',
        border: '2px solid #3498db',
        borderRadius: 8,
        padding: 15,
        marginBottom: 15,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
          <h3 style={{ margin: 0, color: '#3498db' }}>Dev Menu</h3>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={saveDevSettings}
              style={{
                padding: '8px 16px',
                background: '#27ae60',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              Save Settings
            </button>
            <button
              onClick={() => setShowDevMenu(false)}
              style={{
                padding: '8px 16px',
                background: '#e74c3c',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              Close
            </button>
          </div>
        </div>

      {/* Filter presets */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 15 }}>
        {Object.keys(FILTER_PRESETS).map(name => (
          <button
            key={name}
            onClick={() => applyPreset(name)}
            style={{
              padding: '6px 12px',
              background: activePreset === name ? '#3498db' : '#2c3e50',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontWeight: activePreset === name ? 'bold' : 'normal',
              fontSize: 12,
            }}
          >
            {name.charAt(0).toUpperCase() + name.slice(1)}
          </button>
        ))}
      </div>

      {/* Game Controls */}
      <div style={{
        display: 'flex',
        gap: 15,
        marginBottom: 10,
        background: '#27ae60',
        padding: 10,
        borderRadius: 8,
        flexWrap: 'wrap',
        justifyContent: 'center',
        fontSize: 11,
      }}>
        <label style={{ display: 'flex', flexDirection: 'column' }}>
          <span>Fill Rate: {fillParams.fillRate.toFixed(2)}/s</span>
          <input
            type="range" min="0.05" max="0.5" step="0.01"
            value={fillParams.fillRate}
            onChange={e => setFillParams(p => ({ ...p, fillRate: Number(e.target.value) }))}
            style={{ width: 80 }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column' }}>
          <span>Fall Speed: {fallSpeed}px/s</span>
          <input
            type="range" min="20" max="200" step="10"
            value={fallSpeed}
            onChange={e => setFallSpeed(Number(e.target.value))}
            style={{ width: 80 }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column' }}>
          <span>Wall Thickness: {physics.wallThickness}px</span>
          <input
            type="range" min="2" max="20" step="1"
            value={physics.wallThickness}
            onChange={e => setPhysics(p => ({ ...p, wallThickness: Number(e.target.value) }))}
            style={{ width: 80 }}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={fillParams.autoFill}
            onChange={e => setFillParams(p => ({ ...p, autoFill: e.target.checked }))}
          />
          <span>Auto-Fill</span>
        </label>
      </div>

      {/* Physics Controls - Spring & Damping */}
      <div style={{
        display: 'flex',
        gap: 12,
        marginBottom: 10,
        background: '#8e44ad',
        padding: 10,
        borderRadius: 8,
        flexWrap: 'wrap',
        justifyContent: 'center',
        fontSize: 11,
      }}>
        <span style={{ fontWeight: 'bold', width: '100%', textAlign: 'center', marginBottom: 5 }}>Physics (affects jiggle propagation)</span>
        <label style={{ display: 'flex', flexDirection: 'column' }}>
          <span>Damping: {physics.damping.toFixed(2)}</span>
          <input
            type="range" min="0.8" max="0.99" step="0.01"
            value={physics.damping}
            onChange={e => setPhysics(p => ({ ...p, damping: Number(e.target.value) }))}
            style={{ width: 80 }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column' }}>
          <span>Stiffness: {physics.stiffness}</span>
          <input
            type="range" min="1" max="30" step="1"
            value={physics.stiffness}
            onChange={e => setPhysics(p => ({ ...p, stiffness: Number(e.target.value) }))}
            style={{ width: 80 }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column' }}>
          <span>Pressure: {physics.pressure.toFixed(1)}</span>
          <input
            type="range" min="0" max="25" step="0.5"
            value={physics.pressure}
            onChange={e => setPhysics(p => ({ ...p, pressure: Number(e.target.value) }))}
            style={{ width: 80 }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column' }}>
          <span>Home Stiff: {physics.homeStiffness.toFixed(2)}</span>
          <input
            type="range" min="0.01" max="0.3" step="0.01"
            value={physics.homeStiffness}
            onChange={e => setPhysics(p => ({ ...p, homeStiffness: Number(e.target.value) }))}
            style={{ width: 80 }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column' }}>
          <span>Inner Stiff: {physics.innerHomeStiffness.toFixed(2)}</span>
          <input
            type="range" min="0.1" max="0.9" step="0.05"
            value={physics.innerHomeStiffness}
            onChange={e => setPhysics(p => ({ ...p, innerHomeStiffness: Number(e.target.value) }))}
            style={{ width: 80 }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column' }}>
          <span>Return Speed: {physics.returnSpeed.toFixed(2)}</span>
          <input
            type="range" min="0.1" max="1.0" step="0.05"
            value={physics.returnSpeed}
            onChange={e => setPhysics(p => ({ ...p, returnSpeed: Number(e.target.value) }))}
            style={{ width: 80 }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column' }}>
          <span>Viscosity: {physics.viscosity.toFixed(2)}</span>
          <input
            type="range" min="0" max="3.0" step="0.1"
            value={physics.viscosity}
            onChange={e => setPhysics(p => ({ ...p, viscosity: Number(e.target.value) }))}
            style={{ width: 80 }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column' }}>
          <span>Iterations: {physics.iterations}</span>
          <input
            type="range" min="1" max="10" step="1"
            value={physics.iterations}
            onChange={e => setPhysics(p => ({ ...p, iterations: Number(e.target.value) }))}
            style={{ width: 80 }}
          />
        </label>
      </div>

      {/* Impact Controls */}
      <div style={{
        display: 'flex',
        gap: 12,
        marginBottom: 10,
        background: '#c0392b',
        padding: 10,
        borderRadius: 8,
        flexWrap: 'wrap',
        justifyContent: 'center',
        fontSize: 11,
      }}>
        <span style={{ fontWeight: 'bold', width: '100%', textAlign: 'center', marginBottom: 5 }}>Impact Effect</span>
        <label style={{ display: 'flex', flexDirection: 'column' }}>
          <span>Impact Strength: {impactStrength}</span>
          <input
            type="range" min="0" max="30" step="1"
            value={impactStrength}
            onChange={e => setImpactStrength(Number(e.target.value))}
            style={{ width: 100 }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column' }}>
          <span>Impact Radius: {impactRadius.toFixed(1)} cells</span>
          <input
            type="range" min="0.5" max="4" step="0.25"
            value={impactRadius}
            onChange={e => setImpactRadius(Number(e.target.value))}
            style={{ width: 100 }}
          />
        </label>
      </div>

      {/* Pop Controls */}
      <div style={{
        display: 'flex',
        gap: 12,
        marginBottom: 10,
        background: '#9b59b6',
        padding: 10,
        borderRadius: 8,
        flexWrap: 'wrap',
        justifyContent: 'center',
        fontSize: 11,
      }}>
        <span style={{ fontWeight: 'bold', width: '100%', textAlign: 'center', marginBottom: 5 }}>Pop Effect (click filled blob to pop)</span>
        <label style={{ display: 'flex', flexDirection: 'column' }}>
          <span>Droplets: {dropletCount}</span>
          <input
            type="range" min="4" max="30" step="2"
            value={dropletCount}
            onChange={e => setDropletCount(Number(e.target.value))}
            style={{ width: 80 }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column' }}>
          <span>Speed: {dropletSpeed}</span>
          <input
            type="range" min="50" max="300" step="10"
            value={dropletSpeed}
            onChange={e => setDropletSpeed(Number(e.target.value))}
            style={{ width: 80 }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column' }}>
          <span>Lifetime: {dropletLifetime.toFixed(1)}s</span>
          <input
            type="range" min="0.3" max="3.0" step="0.1"
            value={dropletLifetime}
            onChange={e => setDropletLifetime(Number(e.target.value))}
            style={{ width: 80 }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column' }}>
          <span>Size: {dropletSize}px</span>
          <input
            type="range" min="3" max="15" step="1"
            value={dropletSize}
            onChange={e => setDropletSize(Number(e.target.value))}
            style={{ width: 80 }}
          />
        </label>
      </div>

      {/* Attraction/Goopiness Controls */}
      <div style={{
        display: 'flex',
        gap: 12,
        marginBottom: 15,
        background: '#34495e',
        padding: 10,
        borderRadius: 8,
        flexWrap: 'wrap',
        justifyContent: 'center',
        fontSize: 11,
      }}>
        <span style={{ fontWeight: 'bold', width: '100%', textAlign: 'center', marginBottom: 5 }}>Attraction (tendrils)</span>
        <label style={{ display: 'flex', flexDirection: 'column' }}>
          <span>Goopiness: {physics.goopiness}px</span>
          <input
            type="range" min="10" max="80" step="5"
            value={physics.goopiness}
            onChange={e => setPhysics(p => ({ ...p, goopiness: Number(e.target.value) }))}
            style={{ width: 80 }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column' }}>
          <span>Attract Radius: {physics.attractionRadius}px</span>
          <input
            type="range" min="10" max="50" step="5"
            value={physics.attractionRadius}
            onChange={e => setPhysics(p => ({ ...p, attractionRadius: Number(e.target.value) }))}
            style={{ width: 80 }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column' }}>
          <span>Attract Stiff: {physics.attractionStiffness.toFixed(3)}</span>
          <input
            type="range" min="0.001" max="0.02" step="0.001"
            value={physics.attractionStiffness}
            onChange={e => setPhysics(p => ({ ...p, attractionStiffness: Number(e.target.value) }))}
            style={{ width: 80 }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column' }}>
          <span>Tendril Size: {physics.tendrilEndRadius}px</span>
          <input
            type="range" min="4" max="20" step="1"
            value={physics.tendrilEndRadius}
            onChange={e => setPhysics(p => ({ ...p, tendrilEndRadius: Number(e.target.value) }))}
            style={{ width: 80 }}
          />
        </label>
      </div>

      </div>
      )}
      {/* END DEV MENU */}

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        style={{ background: bgColor, borderRadius: 8 }}
      >
        <defs>
          <filter id="goo-filter-7" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation={filterParams.stdDeviation} result="blur" />
            <feColorMatrix in="blur" mode="matrix" values={getFilterMatrix()} result="goo" />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>

        {/* Grid lines */}
        {showGrid && (
          <g opacity={0.2}>
            {Array.from({ length: GRID_COLS + 1 }).map((_, i) => (
              <line
                key={`v${i}`}
                x1={GRID_OFFSET_X + i * CELL_SIZE}
                y1={GRID_OFFSET_Y}
                x2={GRID_OFFSET_X + i * CELL_SIZE}
                y2={GRID_OFFSET_Y + GRID_ROWS * CELL_SIZE}
                stroke="#fff"
                strokeWidth={1}
              />
            ))}
            {Array.from({ length: GRID_ROWS + 1 }).map((_, i) => (
              <line
                key={`h${i}`}
                x1={GRID_OFFSET_X}
                y1={GRID_OFFSET_Y + i * CELL_SIZE}
                x2={GRID_OFFSET_X + GRID_COLS * CELL_SIZE}
                y2={GRID_OFFSET_Y + i * CELL_SIZE}
                stroke="#fff"
                strokeWidth={1}
              />
            ))}
          </g>
        )}

        {/* LAYER 1: Outer goop (solid, filtered) */}
        <g filter={filterParams.enabled ? 'url(#goo-filter-7)' : undefined}>
          {/* Tendrils for same-color attraction */}
          {attractionSpringsRef.current.map((spring, i) => {
            const blobA = blobsRef.current[spring.blobA];
            const blobB = blobsRef.current[spring.blobB];
            if (!blobA || !blobB) return null;

            const vA = blobA.vertices[spring.vertA];
            const vB = blobB.vertices[spring.vertB];
            if (!vA || !vB) return null;

            const dx = vB.pos.x - vA.pos.x;
            const dy = vB.pos.y - vA.pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const stretchRatio = Math.min(1, dist / physics.goopiness);
            const endRadius = physics.tendrilEndRadius;
            const minMiddleScale = 1 - physics.tendrilSkinniness;
            const maxMiddleScale = 1 - physics.tendrilSkinniness * 0.3;
            const middleScale = maxMiddleScale - (maxMiddleScale - minMiddleScale) * stretchRatio;
            const middleRadius = endRadius * middleScale;
            const beadSpacing = endRadius * 1.4;
            const numBeads = Math.max(2, Math.ceil(dist / beadSpacing));

            const beads = [];
            for (let j = 0; j <= numBeads; j++) {
              const t = j / numBeads;
              const middleness = Math.sin(t * Math.PI);
              const r = endRadius - (endRadius - middleRadius) * middleness;
              beads.push({ cx: vA.pos.x + dx * t, cy: vA.pos.y + dy * t, r: Math.max(2, r) });
            }

            return (
              <g key={`tendril-${i}`}>
                {beads.map((bead, j) => (
                  <circle key={j} cx={bead.cx} cy={bead.cy} r={bead.r} fill={blobA.color} />
                ))}
              </g>
            );
          })}

          {/* Outer shapes - click to pop locked full blobs */}
          {blobsRef.current.map((blob, i) => {
            // Can pop if locked and full
            const canPop = blob.isLocked && blob.fillAmount >= 1;

            return (
              <g
                key={blob.id}
                style={{ cursor: canPop ? 'pointer' : 'default' }}
                onClick={() => canPop && popBlob(blob)}
              >
                <path
                  d={getBlobPath(blob.vertices)}
                  fill={blob.color}
                  stroke={blob.color}
                  strokeWidth={2}
                />
              </g>
            );
          })}
        </g>

        {/* LAYER 2: Inner cutout (only for locked pieces that aren't full) */}
        {blobsRef.current.map((blob) => {
          // Skip if not locked (falling pieces are full, no cutout)
          if (!blob.isLocked) return null;
          // Skip if already full
          if (blob.fillAmount >= 1) return null;

          const outerPoints = blob.vertices.map(v => v.pos);
          const insetPoints = getInsetPath(outerPoints, physics.wallThickness);
          const bounds = getBounds(insetPoints);
          const height = bounds.maxY - bounds.minY;
          const fillTop = bounds.maxY - height * blob.fillAmount;
          const padding = 50;

          const clipId = `unfilled-clip-${blob.id}`;

          return (
            <g key={`inner-${blob.id}`}>
              <defs>
                <clipPath id={clipId}>
                  <rect
                    x={bounds.minX - padding}
                    y={bounds.minY - padding}
                    width={bounds.maxX - bounds.minX + padding * 2}
                    height={fillTop - bounds.minY + padding}
                  />
                </clipPath>
              </defs>
              <path
                d={getPath(insetPoints)}
                fill={bgColor}
                clipPath={`url(#${clipId})`}
              />
            </g>
          );
        })}

        {/* LAYER 3: Droplets from popped blobs (NO filter - would hide small circles) */}
        <g>
          {dropletsRef.current.map(droplet => (
            <circle
              key={droplet.id}
              cx={droplet.pos.x}
              cy={droplet.pos.y}
              r={droplet.radius}
              fill={droplet.color}
              opacity={droplet.opacity}
            />
          ))}
        </g>

        {/* Debug: vertex order visualization for merged blobs */}
        {blobsRef.current.filter(b => b.gridCells.length > 4).map(blob => (
          <g key={`debug-verts-${blob.id}`}>
            {blob.vertices.map((v, idx) => (
              <g key={`v-${idx}`}>
                <circle cx={v.pos.x} cy={v.pos.y} r={4} fill="yellow" stroke="black" strokeWidth={1} />
                <text x={v.pos.x + 6} y={v.pos.y + 3} fontSize={8} fill="yellow" stroke="black" strokeWidth={0.3}>{idx}</text>
              </g>
            ))}
            {/* Draw lines between consecutive vertices to show trace order */}
            {blob.vertices.map((v, idx) => {
              const next = blob.vertices[(idx + 1) % blob.vertices.length];
              return (
                <line
                  key={`edge-${idx}`}
                  x1={v.pos.x} y1={v.pos.y}
                  x2={next.pos.x} y2={next.pos.y}
                  stroke="lime" strokeWidth={1} opacity={0.5}
                />
              );
            })}
          </g>
        ))}

        {/* Debug: blob info */}
        {blobsRef.current.map((blob, i) => (
          <text
            key={`info-${blob.id}`}
            x={blob.targetX}
            y={blob.targetY - 30}
            fill="#fff"
            fontSize={10}
            textAnchor="middle"
            opacity={0.7}
          >
            {blob.isLocked ? `${Math.round(blob.fillAmount * 100)}%` : 'falling'}
          </text>
        ))}
      </svg>

      {/* Info */}
      <div style={{
        marginTop: 20,
        padding: 15,
        background: '#2c3e50',
        borderRadius: 8,
        maxWidth: 500,
        fontSize: 13,
        lineHeight: 1.6,
      }}>
        <strong>Proto-8: Pop</strong>
        <br /><br />
        <strong>How to test:</strong>
        <br />• Wait for a blob to fill to 100%
        <br />• Click the filled blob to pop it
        <br />• Droplets scatter outward and fade
        <br /><br />
        <strong>Blobs:</strong> {blobsRef.current.length} | <strong>Droplets:</strong> {dropletsRef.current.length}
      </div>
    </div>
  );
}
