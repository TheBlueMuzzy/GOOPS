// ============================================================================
// Blob Factory - Creates soft-body blobs from grid cells
// Ported from prototypes/SoftBodyProto9.tsx (lines 180-541)
// ============================================================================

import { TANK_VIEWPORT_WIDTH, TANK_VIEWPORT_HEIGHT } from '../../constants';
import { SoftBlob, Vertex, Spring, Vec2, vecDistance } from './types';

// =============================================================================
// Constants
// =============================================================================

// Cell size in pixels (matches BLOCK_SIZE from coordinateTransform.ts)
// The game uses a 12x16 viewport at 30px per cell
export const PHYSICS_CELL_SIZE = 30;

// Grid offset for physics space (pixels from SVG origin)
// Game VIEWBOX starts at x = -180, y = 0
// Visual grid (0,0) should map to SVG (-180, 0)
export const PHYSICS_GRID_OFFSET = {
  x: -(TANK_VIEWPORT_WIDTH / 2) * PHYSICS_CELL_SIZE,  // -180
  y: 0
};

// =============================================================================
// Edge Types
// =============================================================================

/**
 * An edge of a grid cell boundary (in grid coordinates)
 */
export interface Edge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// =============================================================================
// Boundary Edge Detection
// =============================================================================

/**
 * Find all boundary edges of a set of grid cells.
 * An edge is a boundary if the neighboring cell is not in the set.
 *
 * Edge directions are set up to trace counterclockwise:
 * - Top edge: left to right
 * - Right edge: top to bottom
 * - Bottom edge: right to left
 * - Left edge: bottom to top
 */
export function findBoundaryEdges(cells: Vec2[]): Edge[] {
  const cellSet = new Set(cells.map((c) => `${c.x},${c.y}`));
  const edges: Edge[] = [];

  for (const cell of cells) {
    const { x, y } = cell;

    // Top edge (y to y, x to x+1)
    if (!cellSet.has(`${x},${y - 1}`)) {
      edges.push({ x1: x, y1: y, x2: x + 1, y2: y });
    }
    // Right edge (x+1, y to y+1)
    if (!cellSet.has(`${x + 1},${y}`)) {
      edges.push({ x1: x + 1, y1: y, x2: x + 1, y2: y + 1 });
    }
    // Bottom edge (x+1 to x, y+1)
    if (!cellSet.has(`${x},${y + 1}`)) {
      edges.push({ x1: x + 1, y1: y + 1, x2: x, y2: y + 1 });
    }
    // Left edge (x, y+1 to y)
    if (!cellSet.has(`${x - 1},${y}`)) {
      edges.push({ x1: x, y1: y + 1, x2: x, y2: y });
    }
  }

  return edges;
}

// =============================================================================
// Perimeter Tracing
// =============================================================================

/**
 * Trace the perimeter of a shape by following boundary edges.
 * Uses a right-hand rule to ensure consistent winding order.
 * Returns vertices in grid coordinates.
 */
export function tracePerimeter(edges: Edge[]): Vec2[] {
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
  const getEdgeAngle = (
    edge: Edge,
    fromPoint: { x: number; y: number }
  ): number => {
    const toX =
      fromPoint.x === edge.x1 && fromPoint.y === edge.y1 ? edge.x2 : edge.x1;
    const toY =
      fromPoint.x === edge.x1 && fromPoint.y === edge.y1 ? edge.y2 : edge.y1;
    return Math.atan2(toY - fromPoint.y, toX - fromPoint.x);
  };

  // Helper: normalize angle difference to [-PI, PI]
  const angleDiff = (from: number, to: number): number => {
    let diff = to - from;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return diff;
  };

  // Walk the perimeter using right-hand rule
  const visited = new Set<Edge>();
  const vertices: Vec2[] = [];

  // Start with first edge
  let currentEdge = edges[0];
  let currentPoint = { x: currentEdge.x1, y: currentEdge.y1 };
  let incomingAngle = getEdgeAngle(currentEdge, currentPoint) + Math.PI;

  while (visited.size < edges.length) {
    visited.add(currentEdge);

    // Add the start point as a vertex (in grid coordinates)
    vertices.push({ x: currentPoint.x, y: currentPoint.y });

    // Move to the end of this edge
    const endPoint =
      currentPoint.x === currentEdge.x1 && currentPoint.y === currentEdge.y1
        ? { x: currentEdge.x2, y: currentEdge.y2 }
        : { x: currentEdge.x1, y: currentEdge.y1 };

    // Calculate the angle we arrived from
    const arrivedAngle = Math.atan2(
      endPoint.y - currentPoint.y,
      endPoint.x - currentPoint.x
    );
    incomingAngle = arrivedAngle + Math.PI;

    // Find next unvisited edge from this endpoint
    const endKey = `${endPoint.x},${endPoint.y}`;
    const connectedEdges = edgeMap.get(endKey) || [];
    const unvisitedEdges = connectedEdges.filter((e) => !visited.has(e));

    if (unvisitedEdges.length === 0) break;

    // Pick edge with largest turn (counterclockwise)
    let bestEdge = unvisitedEdges[0];
    let bestTurn = -Infinity;

    for (const candidate of unvisitedEdges) {
      const outAngle = getEdgeAngle(candidate, endPoint);
      const turn = angleDiff(incomingAngle, outAngle);
      if (turn > bestTurn) {
        bestTurn = turn;
        bestEdge = candidate;
      }
    }

    currentEdge = bestEdge;
    currentPoint = endPoint;
  }

  return vertices;
}

// =============================================================================
// Coordinate Conversion
// =============================================================================

/**
 * Convert grid coordinates to pixel coordinates.
 */
export function gridToPixels(gridPoints: Vec2[]): Vec2[] {
  return gridPoints.map((p) => ({
    x: PHYSICS_GRID_OFFSET.x + p.x * PHYSICS_CELL_SIZE,
    y: PHYSICS_GRID_OFFSET.y + p.y * PHYSICS_CELL_SIZE,
  }));
}

/**
 * Get centroid of cells in pixel coordinates.
 */
export function getGridCentroid(cells: Vec2[]): Vec2 {
  let sumX = 0;
  let sumY = 0;
  for (const cell of cells) {
    // Center of each cell
    const px = PHYSICS_GRID_OFFSET.x + (cell.x + 0.5) * PHYSICS_CELL_SIZE;
    const py = PHYSICS_GRID_OFFSET.y + (cell.y + 0.5) * PHYSICS_CELL_SIZE;
    sumX += px;
    sumY += py;
  }
  return { x: sumX / cells.length, y: sumY / cells.length };
}

// =============================================================================
// Winding Order
// =============================================================================

/**
 * Ensure points are in counter-clockwise order (required for pressure normals).
 * Uses the shoelace formula to check signed area.
 */
export function ensureCCW(points: Vec2[]): Vec2[] {
  if (points.length < 3) return points;

  // Shoelace formula for signed area
  let signedArea = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    signedArea += points[i].x * points[j].y;
    signedArea -= points[j].x * points[i].y;
  }
  signedArea /= 2;

  // Positive = CCW (correct), Negative = CW (reverse)
  return signedArea > 0 ? points : [...points].reverse();
}

// =============================================================================
// Blob Creation
// =============================================================================

/**
 * Create a soft-body blob from a set of grid cells.
 *
 * @param cells - Grid cell coordinates (in visual space: 0-11 for x, 0-15 for y)
 * @param color - CSS color string
 * @param id - Unique blob identifier
 * @param isLocked - Whether the blob is locked in place (vs falling)
 * @param tankRotation - Current tank rotation (for position sync when tank rotates)
 * @returns Complete SoftBlob with vertices, springs, and physics state
 */
export function createBlobFromCells(
  cells: Vec2[],
  color: string,
  id: string,
  isLocked: boolean,
  tankRotation: number = 0
): SoftBlob {
  // 1. Find boundary edges and trace perimeter
  const edges = findBoundaryEdges(cells);
  const gridPerimeter = tracePerimeter(edges);
  const pixelPerimeter = gridToPixels(gridPerimeter);
  let points = ensureCCW(pixelPerimeter);

  // Fallback for invalid perimeter (less than 3 vertices)
  if (points.length < 3) {
    const center = getGridCentroid(cells);
    const halfSize = PHYSICS_CELL_SIZE * 0.4;
    points = [
      { x: center.x - halfSize, y: center.y - halfSize },
      { x: center.x + halfSize, y: center.y - halfSize },
      { x: center.x + halfSize, y: center.y + halfSize },
      { x: center.x - halfSize, y: center.y + halfSize },
    ];
  }

  // 2. Calculate centroid
  const centroid = getGridCentroid(cells);
  const cx = centroid.x;
  const cy = centroid.y;

  // 3. Create vertices with home offsets
  const vertices: Vertex[] = points.map((p) => ({
    pos: { x: p.x, y: p.y },
    oldPos: { x: p.x, y: p.y },
    homeOffset: { x: p.x - cx, y: p.y - cy },
    mass: 1,
    attractionRadius: 0.8 + Math.random() * 0.4, // 0.8-1.2 variation
  }));

  // 4. Create ring springs (adjacent vertices)
  const n = vertices.length;
  const ringsprings: Spring[] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    ringsprings.push({
      a: i,
      b: j,
      restLength: vecDistance(vertices[i].pos, vertices[j].pos),
    });
  }

  // 5. Create cross springs (non-adjacent vertices within distance threshold)
  const crossSprings: Spring[] = [];
  const maxCrossDist = PHYSICS_CELL_SIZE * 1.5;
  const addedPairs = new Set<string>();

  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      // Skip wrap-around neighbor
      if (j === n - 1 && i === 0) continue;

      const dist = vecDistance(vertices[i].pos, vertices[j].pos);
      if (dist < maxCrossDist) {
        const pairKey = `${Math.min(i, j)}-${Math.max(i, j)}`;
        if (!addedPairs.has(pairKey)) {
          addedPairs.add(pairKey);
          crossSprings.push({ a: i, b: j, restLength: dist });
        }
      }
    }
  }

  // 6. Calculate rest area (Shoelace formula)
  let restArea = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    restArea += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  restArea = Math.abs(restArea) / 2;

  // 7. Create inner vertices (stable core) - just centroid for now
  const innerVertices: Vertex[] = [
    {
      pos: { x: cx, y: cy },
      oldPos: { x: cx, y: cy },
      homeOffset: { x: 0, y: 0 },
      mass: 1,
      attractionRadius: 1,
    },
  ];

  return {
    id,
    color,
    vertices,
    innerVertices,
    ringsprings,
    crossSprings,
    restArea,
    gridCells: cells,
    isLocked,
    fillAmount: isLocked ? 0 : 1, // Locked = start filling, Falling = full
    wasFullLastFrame: !isLocked,   // Falling pieces start full, locked start empty
    rotation: 0,
    targetX: cx,
    targetY: cy,
    visualOffsetY: 0,
    createdAtRotation: tankRotation,
  };
}
