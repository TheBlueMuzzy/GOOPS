import { useRef, useEffect, useState, useCallback } from 'react';

// ============================================================================
// PROTO-5c: Cell Wall Rendering (Outer Goop - Inner Core)
// ============================================================================
// Two boundaries:
//   - OUTER: Gooey silhouette that stretches and merges (like 5b)
//   - INNER: Stable core shape with minimal deformation
//   - CELL WALL: The filled ring between outer and inner
//   - INTERIOR: Empty space for future "time to pop" fill
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

// Inner vertices track the stable core
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

// For complex shapes, define simple inner regions separately
interface InnerRegion {
  offsetX: number;  // Offset from blob center
  offsetY: number;
  points: Vec2[];   // Local home coordinates
  vertices: InnerVertex[];  // Physics-simulated vertices (like innerVertices)
}

interface Blob {
  vertices: Vertex[];           // Outer vertices (gooey)
  innerVertices: InnerVertex[]; // Inner vertices (stable core) - unused for complex shapes
  innerRegions?: InnerRegion[]; // Optional: separate simple regions for inner cutout
  ringsprings: Spring[];
  crossSprings: Spring[];
  restArea: number;
  targetX: number;
  targetY: number;
  rotation: number;
  color: string;
  usePressure: boolean;
}

interface PhysicsParams {
  damping: number;
  stiffness: number;
  pressure: number;
  iterations: number;
  homeStiffness: number;
  innerHomeStiffness: number;  // Much higher for stable inner core
  attractionRadius: number;
  attractionRestLength: number;
  attractionStiffness: number;
  goopiness: number;
  // Tendril (mozzarella string) params
  tendrilEndRadius: number;    // Fixed size of beads at ends of string
  tendrilSkinniness: number;   // How much the middle thins when stretched (0-1)
  // Cell wall
  wallThickness: number;       // How far inner shape is inset from outer (pixels)
}

interface FilterParams {
  enabled: boolean;
  stdDeviation: number;
  alphaMultiplier: number;
  alphaOffset: number;
}

const UNIT_SIZE = 30;
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 450;

const DEFAULT_PHYSICS: PhysicsParams = {
  damping: 0.94,
  stiffness: 15,
  pressure: 2.5,
  iterations: 3,
  homeStiffness: 0.08,
  innerHomeStiffness: 0.5,     // Very stiff - inner core barely moves
  attractionRadius: 20,
  attractionRestLength: 0,
  attractionStiffness: 0.005,
  goopiness: 25,
  tendrilEndRadius: 10,        // Size of beads at ends of string
  tendrilSkinniness: 0.7,      // How much middle thins when stretched (0=none, 1=max)
  wallThickness: 8,            // How far inner shape is inset from outer
};

const FILTER_PRESETS = {
  none: { enabled: false, stdDeviation: 8, alphaMultiplier: 20, alphaOffset: -12 },
  subtle: { enabled: true, stdDeviation: 5, alphaMultiplier: 15, alphaOffset: -6 },
  medium: { enabled: true, stdDeviation: 8, alphaMultiplier: 20, alphaOffset: -12 },
  aggressive: { enabled: true, stdDeviation: 12, alphaMultiplier: 25, alphaOffset: -9 },
};

// ============================================================================
// BLOB CREATION
// ============================================================================

type ShapeType = 'T' | 'U' | 'Corrupt' | 'Square' | 'Rect2x1';

function createBlob(centerX: number, centerY: number, shape: ShapeType, color: string): Blob {
  const vertices: Vertex[] = [];
  const innerVertices: InnerVertex[] = [];
  const ringsprings: Spring[] = [];
  const crossSprings: Spring[] = [];

  const u = UNIT_SIZE;

  let perimeterPoints: Vec2[];
  let crossPairs: number[][];

  const OUTER = 1.5;
  const INNER = 0.3;
  const MID = 1.0;
  let attractionMultipliers: number[];

  if (shape === 'T') {
    perimeterPoints = [
      { x: -1.5 * u, y: -1 * u },
      { x: -0.5 * u, y: -1 * u },
      { x: 0.5 * u, y: -1 * u },
      { x: 1.5 * u, y: -1 * u },
      { x: 1.5 * u, y: 0 * u },
      { x: 0.5 * u, y: 0 * u },
      { x: 0.5 * u, y: 1 * u },
      { x: -0.5 * u, y: 1 * u },
      { x: -0.5 * u, y: 0 * u },
      { x: -1.5 * u, y: 0 * u },
    ];
    attractionMultipliers = [OUTER, MID, MID, OUTER, MID, INNER, OUTER, OUTER, INNER, MID];
    crossPairs = [
      [0, 4], [0, 5], [3, 9], [3, 8],
      [1, 8], [2, 5], [5, 8], [6, 9],
      [7, 4], [0, 7], [3, 6],
    ];
  } else if (shape === 'U') {
    perimeterPoints = [
      { x: -1.5 * u, y: -1 * u },
      { x: -0.5 * u, y: -1 * u },
      { x: -0.5 * u, y: 0 * u },
      { x: 0.5 * u, y: 0 * u },
      { x: 0.5 * u, y: -1 * u },
      { x: 1.5 * u, y: -1 * u },
      { x: 1.5 * u, y: 0 * u },
      { x: 1.5 * u, y: 1 * u },
      { x: 0.5 * u, y: 1 * u },
      { x: -0.5 * u, y: 1 * u },
      { x: -1.5 * u, y: 1 * u },
      { x: -1.5 * u, y: 0 * u },
    ];
    attractionMultipliers = [OUTER, OUTER, INNER, INNER, OUTER, OUTER, MID, OUTER, MID, MID, OUTER, MID];
    crossPairs = [
      [0, 6], [5, 10], [1, 11], [4, 6],
      [2, 9], [3, 8], [0, 9], [5, 8],
      [2, 10], [3, 7], [11, 8], [6, 9],
    ];
  } else if (shape === 'Corrupt') {
    // Complex outer perimeter (same as 5b) - single connected shape for gooey merging
    const bridge = 0.08 * u;
    perimeterPoints = [
      { x: -1.5 * u, y: -1.5 * u },
      { x: -0.5 * u, y: -1.5 * u },
      { x: -0.5 * u, y: -0.5 * u },
      { x: -bridge, y: -0.5 * u },
      { x: -bridge, y: -0.5 * u + bridge },
      { x: -0.5 * u, y: -0.5 * u + bridge },
      { x: -0.5 * u, y: 1.5 * u },
      { x: 0.5 * u, y: 1.5 * u },
      { x: 0.5 * u, y: -0.5 * u + bridge },
      { x: bridge, y: -0.5 * u + bridge },
      { x: bridge, y: -0.5 * u },
      { x: 0.5 * u, y: -0.5 * u },
      { x: 0.5 * u, y: -1.5 * u },
      { x: 1.5 * u, y: -1.5 * u },
      { x: 1.5 * u, y: -0.5 * u },
      { x: 0.5 * u + bridge, y: -0.5 * u },
      { x: 0.5 * u + bridge, y: -0.5 * u - bridge },
      { x: -0.5 * u - bridge, y: -0.5 * u - bridge },
      { x: -0.5 * u - bridge, y: -0.5 * u },
      { x: -1.5 * u, y: -0.5 * u },
    ];
    attractionMultipliers = [
      OUTER, MID, OUTER, INNER, INNER,
      OUTER, OUTER, OUTER, OUTER,
      INNER, INNER, OUTER, MID, OUTER,
      OUTER, INNER, INNER, INNER, INNER, MID
    ];
    crossPairs = [
      [0, 2], [1, 19],
      [5, 7], [6, 8],
      [11, 13], [12, 14],
      [0, 6], [13, 7],
      [3, 10], [4, 9],
    ];
  } else if (shape === 'Square') {
    // Simple 1x1 square
    perimeterPoints = [
      { x: -0.5 * u, y: -0.5 * u },
      { x: 0.5 * u, y: -0.5 * u },
      { x: 0.5 * u, y: 0.5 * u },
      { x: -0.5 * u, y: 0.5 * u },
    ];
    attractionMultipliers = [OUTER, OUTER, OUTER, OUTER];
    crossPairs = [[0, 2], [1, 3]];
  } else {
    // Rect2x1: 1 wide x 2 tall rectangle (for stem of corrupt shape)
    perimeterPoints = [
      { x: -0.5 * u, y: -1 * u },
      { x: 0.5 * u, y: -1 * u },
      { x: 0.5 * u, y: 1 * u },
      { x: -0.5 * u, y: 1 * u },
    ];
    attractionMultipliers = [OUTER, OUTER, OUTER, OUTER];
    crossPairs = [[0, 2], [1, 3]];
  }

  // Create outer vertices (gooey)
  for (let i = 0; i < perimeterPoints.length; i++) {
    const pt = perimeterPoints[i];
    vertices.push({
      pos: { x: centerX + pt.x, y: centerY + pt.y },
      oldPos: { x: centerX + pt.x, y: centerY + pt.y },
      homeOffset: { x: pt.x, y: pt.y },
      mass: 1.0,
      attractionRadius: attractionMultipliers[i],
    });

    // Create matching inner vertices (stable core)
    innerVertices.push({
      pos: { x: centerX + pt.x, y: centerY + pt.y },
      oldPos: { x: centerX + pt.x, y: centerY + pt.y },
      homeOffset: { x: pt.x, y: pt.y },
    });
  }

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

  for (const [a, b] of crossPairs) {
    const dx = vertices[b].homeOffset.x - vertices[a].homeOffset.x;
    const dy = vertices[b].homeOffset.y - vertices[a].homeOffset.y;
    crossSprings.push({
      a,
      b,
      restLength: Math.sqrt(dx * dx + dy * dy),
    });
  }

  let area = 0;
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    area += vertices[i].homeOffset.x * vertices[next].homeOffset.y;
    area -= vertices[next].homeOffset.x * vertices[i].homeOffset.y;
  }
  const restArea = Math.abs(area) / 2;

  // For Corrupt shape, define 3 separate simple inner regions with physics vertices
  let innerRegions: InnerRegion[] | undefined;
  if (shape === 'Corrupt') {
    const halfU = 0.5 * u;
    const regionDefs = [
      // Top-left square (1x1)
      {
        offsetX: -u,
        offsetY: -u,
        points: [
          { x: -halfU, y: -halfU },
          { x: halfU, y: -halfU },
          { x: halfU, y: halfU },
          { x: -halfU, y: halfU },
        ],
      },
      // Top-right square (1x1)
      {
        offsetX: u,
        offsetY: -u,
        points: [
          { x: -halfU, y: -halfU },
          { x: halfU, y: -halfU },
          { x: halfU, y: halfU },
          { x: -halfU, y: halfU },
        ],
      },
      // Stem rectangle (1x2)
      {
        offsetX: 0,
        offsetY: halfU,
        points: [
          { x: -halfU, y: -u },
          { x: halfU, y: -u },
          { x: halfU, y: u },
          { x: -halfU, y: u },
        ],
      },
    ];

    // Create physics vertices for each region
    innerRegions = regionDefs.map(def => {
      const regionVertices: InnerVertex[] = def.points.map(p => {
        const worldX = centerX + def.offsetX + p.x;
        const worldY = centerY + def.offsetY + p.y;
        return {
          pos: { x: worldX, y: worldY },
          oldPos: { x: worldX, y: worldY },
          // homeOffset is relative to the REGION center (blob center + region offset)
          homeOffset: { x: p.x, y: p.y },
        };
      });
      return {
        ...def,
        vertices: regionVertices,
      };
    });
  }

  return {
    vertices,
    innerVertices,
    innerRegions,
    ringsprings,
    crossSprings,
    restArea,
    targetX: centerX,
    targetY: centerY,
    rotation: 0,
    color,
    usePressure: shape !== 'Corrupt',
  };
}

// ============================================================================
// PHYSICS
// ============================================================================

function rotatePoint(x: number, y: number, angleDeg: number): Vec2 {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

function integrate(blob: Blob, params: PhysicsParams, dt: number): void {
  // Outer vertices - normal physics
  for (const v of blob.vertices) {
    const vx = (v.pos.x - v.oldPos.x) * params.damping;
    const vy = (v.pos.y - v.oldPos.y) * params.damping;
    v.oldPos.x = v.pos.x;
    v.oldPos.y = v.pos.y;
    v.pos.x += vx;
    v.pos.y += vy + 10 * dt * dt;
  }

  // Inner vertices - same physics but will have stronger home force
  for (const v of blob.innerVertices) {
    const vx = (v.pos.x - v.oldPos.x) * params.damping;
    const vy = (v.pos.y - v.oldPos.y) * params.damping;
    v.oldPos.x = v.pos.x;
    v.oldPos.y = v.pos.y;
    v.pos.x += vx;
    v.pos.y += vy + 10 * dt * dt;
  }

  // Inner region vertices (for complex shapes like Corrupt)
  if (blob.innerRegions) {
    for (const region of blob.innerRegions) {
      for (const v of region.vertices) {
        const vx = (v.pos.x - v.oldPos.x) * params.damping;
        const vy = (v.pos.y - v.oldPos.y) * params.damping;
        v.oldPos.x = v.pos.x;
        v.oldPos.y = v.pos.y;
        v.pos.x += vx;
        v.pos.y += vy + 10 * dt * dt;
      }
    }
  }
}

function applyHomeForce(blob: Blob, params: PhysicsParams): void {
  // Outer vertices - normal home stiffness
  for (const v of blob.vertices) {
    const rotatedHome = rotatePoint(v.homeOffset.x, v.homeOffset.y, blob.rotation);
    const targetX = blob.targetX + rotatedHome.x;
    const targetY = blob.targetY + rotatedHome.y;
    const dx = targetX - v.pos.x;
    const dy = targetY - v.pos.y;
    v.pos.x += dx * params.homeStiffness;
    v.pos.y += dy * params.homeStiffness;
  }

  // Inner vertices - MUCH stronger home force (stable core)
  for (const v of blob.innerVertices) {
    const rotatedHome = rotatePoint(v.homeOffset.x, v.homeOffset.y, blob.rotation);
    const targetX = blob.targetX + rotatedHome.x;
    const targetY = blob.targetY + rotatedHome.y;
    const dx = targetX - v.pos.x;
    const dy = targetY - v.pos.y;
    v.pos.x += dx * params.innerHomeStiffness;
    v.pos.y += dy * params.innerHomeStiffness;
  }

  // Inner region vertices (for complex shapes like Corrupt)
  if (blob.innerRegions) {
    for (const region of blob.innerRegions) {
      // Rotate the region offset with the blob
      const rotatedOffset = rotatePoint(region.offsetX, region.offsetY, blob.rotation);
      const regionCenterX = blob.targetX + rotatedOffset.x;
      const regionCenterY = blob.targetY + rotatedOffset.y;

      for (const v of region.vertices) {
        // Rotate the vertex's local home offset
        const rotatedHome = rotatePoint(v.homeOffset.x, v.homeOffset.y, blob.rotation);
        const targetX = regionCenterX + rotatedHome.x;
        const targetY = regionCenterY + rotatedHome.y;
        const dx = targetX - v.pos.x;
        const dy = targetY - v.pos.y;
        v.pos.x += dx * params.innerHomeStiffness;
        v.pos.y += dy * params.innerHomeStiffness;
      }
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
  const n = blob.vertices.length;
  let currentArea = 0;
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    currentArea += blob.vertices[i].pos.x * blob.vertices[next].pos.y;
    currentArea -= blob.vertices[next].pos.x * blob.vertices[i].pos.y;
  }
  currentArea = Math.abs(currentArea) / 2;
  const pressureError = (blob.restArea - currentArea) / blob.restArea;
  const pressureForce = pressureError * params.pressure * 0.1;

  for (let i = 0; i < n; i++) {
    const prev = (i - 1 + n) % n;
    const next = (i + 1) % n;
    const ex = blob.vertices[next].pos.x - blob.vertices[prev].pos.x;
    const ey = blob.vertices[next].pos.y - blob.vertices[prev].pos.y;
    const nx = -ey;
    const ny = ex;
    const len = Math.sqrt(nx * nx + ny * ny);
    if (len > 0.0001) {
      blob.vertices[i].pos.x += (nx / len) * pressureForce;
      blob.vertices[i].pos.y += (ny / len) * pressureForce;
    }
  }
}

// ============================================================================
// ATTRACTION SPRINGS
// ============================================================================

function updateAttractionSprings(
  blobs: Blob[],
  springs: AttractionSpring[],
  params: PhysicsParams
): AttractionSpring[] {
  const newSprings: AttractionSpring[] = [];
  const existingPairs = new Set<string>();

  for (const spring of springs) {
    const vA = blobs[spring.blobA].vertices[spring.vertA];
    const vB = blobs[spring.blobB].vertices[spring.vertB];
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
    const vA = blobs[spring.blobA].vertices[spring.vertA];
    const vB = blobs[spring.blobB].vertices[spring.vertB];

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

// ============================================================================
// RENDERING
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

function getInnerPath(innerVertices: InnerVertex[]): string {
  return getPath(innerVertices.map(v => v.pos));
}

// Compute inset path by moving each vertex inward along its normal
// Handles thin sections by limiting inset to half the local width
function getInsetPath(points: Vec2[], insetAmount: number): Vec2[] {
  const n = points.length;
  if (n < 3) return points;

  // First pass: find the minimum distance from each vertex to non-adjacent vertices
  // This estimates the local "width" at that vertex
  const localWidths: number[] = [];
  for (let i = 0; i < n; i++) {
    const curr = points[i];
    let minDist = Infinity;

    // Check distance to all non-adjacent vertices (skip i-1, i, i+1)
    for (let j = 0; j < n; j++) {
      // Skip adjacent vertices (within 2 steps)
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

    // Edge vectors
    const e1x = curr.x - prev.x;
    const e1y = curr.y - prev.y;
    const e2x = next.x - curr.x;
    const e2y = next.y - curr.y;

    // Normalize edge vectors
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

    // Inward normals (rotate 90 degrees clockwise for CW winding, CCW for CCW)
    const in1x = -n1y;
    const in1y = n1x;
    const in2x = -n2y;
    const in2y = n2x;

    // Average the two inward normals
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

    // Miter factor for sharp corners
    const dot = n1x * n2x + n1y * n2y;
    const halfAngleCos = Math.sqrt((1 + dot) / 2);
    const miter = halfAngleCos > 0.1 ? 1 / halfAngleCos : 10;

    // Limit inset to 40% of local width to prevent collapse in thin sections
    const maxInset = localWidths[i] * 0.4;
    const effectiveInset = Math.min(insetAmount, maxInset);

    // Move inward
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

export function SoftBodyProto5c() {
  const svgRef = useRef<SVGSVGElement>(null);
  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const blobsRef = useRef<Blob[]>([]);
  const attractionSpringsRef = useRef<AttractionSpring[]>([]);
  const dragIndexRef = useRef<number | null>(null);
  const dragOffsetRef = useRef<Vec2>({ x: 0, y: 0 });

  const [physics, setPhysics] = useState<PhysicsParams>(DEFAULT_PHYSICS);
  const [filterParams, setFilterParams] = useState<FilterParams>(FILTER_PRESETS.medium);
  const [activePreset, setActivePreset] = useState<string>('medium');  // Filter ON by default
  const [showSprings, setShowSprings] = useState(false);
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const blobs: Blob[] = [
      createBlob(120, 250, 'T', '#e74c3c'),
      createBlob(300, 250, 'U', '#e74c3c'),
      createBlob(480, 250, 'Corrupt', '#e74c3c'),
    ];
    blobsRef.current = blobs;
  }, []);

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
      }

      attractionSpringsRef.current = updateAttractionSprings(
        blobsRef.current,
        attractionSpringsRef.current,
        physics
      );
      applyAttractionSprings(blobsRef.current, attractionSpringsRef.current, physics);

      forceUpdate({});
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationRef.current);
  }, [physics]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    for (let i = 0; i < blobsRef.current.length; i++) {
      const blob = blobsRef.current[i];
      const dx = x - blob.targetX;
      const dy = y - blob.targetY;
      if (dx * dx + dy * dy < 80 * 80) {
        dragIndexRef.current = i;
        dragOffsetRef.current = { x: dx, y: dy };
        (e.target as Element).setPointerCapture(e.pointerId);
        break;
      }
    }
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (dragIndexRef.current === null) return;

    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left - dragOffsetRef.current.x;
    const y = e.clientY - rect.top - dragOffsetRef.current.y;

    blobsRef.current[dragIndexRef.current].targetX = x;
    blobsRef.current[dragIndexRef.current].targetY = y;
  }, []);

  const handlePointerUp = useCallback(() => {
    dragIndexRef.current = null;
  }, []);

  const rotateBlob = (index: number) => {
    blobsRef.current[index].rotation = (blobsRef.current[index].rotation + 90) % 360;
  };

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

  // Background color for cutting out inner core
  const bgColor = '#2c3e50';

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
      <h2 style={{ margin: '0 0 10px 0' }}>Proto-5c: Cell Wall (Outer - Inner)</h2>
      <p style={{ margin: '0 0 20px 0', opacity: 0.7, fontSize: 14 }}>
        Outer gooey silhouette + stable inner core = visible cell wall ring
      </p>

      {/* Filter presets */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 15 }}>
        {Object.keys(FILTER_PRESETS).map(name => (
          <button
            key={name}
            onClick={() => applyPreset(name)}
            style={{
              padding: '8px 16px',
              background: activePreset === name ? '#3498db' : '#2c3e50',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontWeight: activePreset === name ? 'bold' : 'normal',
            }}
          >
            {name.charAt(0).toUpperCase() + name.slice(1)}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div style={{
        display: 'flex',
        gap: 20,
        marginBottom: 20,
        background: '#2c3e50',
        padding: 15,
        borderRadius: 8,
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
          <span>Blur: {filterParams.stdDeviation}</span>
          <input
            type="range" min="1" max="30" step="1"
            value={filterParams.stdDeviation}
            onChange={e => {
              setFilterParams(p => ({ ...p, stdDeviation: Number(e.target.value) }));
              setActivePreset('custom');
            }}
            style={{ width: 100 }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
          <span>Alpha Mult: {filterParams.alphaMultiplier}</span>
          <input
            type="range" min="5" max="40" step="1"
            value={filterParams.alphaMultiplier}
            onChange={e => {
              setFilterParams(p => ({ ...p, alphaMultiplier: Number(e.target.value) }));
              setActivePreset('custom');
            }}
            style={{ width: 100 }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
          <span>Alpha Offset: {filterParams.alphaOffset}</span>
          <input
            type="range" min="-20" max="0" step="1"
            value={filterParams.alphaOffset}
            onChange={e => {
              setFilterParams(p => ({ ...p, alphaOffset: Number(e.target.value) }));
              setActivePreset('custom');
            }}
            style={{ width: 100 }}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          <input
            type="checkbox"
            checked={filterParams.enabled}
            onChange={e => {
              setFilterParams(p => ({ ...p, enabled: e.target.checked }));
              setActivePreset(e.target.checked ? 'custom' : 'none');
            }}
          />
          <span>Filter On</span>
        </label>
        <div style={{ display: 'flex', gap: 10, marginLeft: 20 }}>
          <button
            onClick={() => rotateBlob(0)}
            style={{ padding: '8px 12px', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            Rotate T
          </button>
          <button
            onClick={() => rotateBlob(1)}
            style={{ padding: '8px 12px', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            Rotate U
          </button>
          <button
            onClick={() => rotateBlob(2)}
            style={{ padding: '8px 12px', background: '#9b59b6', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            Rotate Corrupt
          </button>
        </div>
      </div>

      {/* Physics Controls */}
      <div style={{
        display: 'flex',
        gap: 20,
        marginBottom: 20,
        background: '#34495e',
        padding: 15,
        borderRadius: 8,
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
          <span style={{ color: '#2ecc71', fontWeight: 'bold' }}>Inner Stiffness: {physics.innerHomeStiffness.toFixed(2)}</span>
          <input
            type="range" min="0.1" max="0.9" step="0.05"
            value={physics.innerHomeStiffness}
            onChange={e => setPhysics(p => ({ ...p, innerHomeStiffness: Number(e.target.value) }))}
            style={{ width: 100 }}
          />
          <span style={{ fontSize: 10, opacity: 0.7 }}>How stable inner core is</span>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
          <span style={{ color: '#f39c12', fontWeight: 'bold' }}>Goopiness: {physics.goopiness}px</span>
          <input
            type="range" min="30" max="150" step="5"
            value={physics.goopiness}
            onChange={e => setPhysics(p => ({ ...p, goopiness: Number(e.target.value) }))}
            style={{ width: 120 }}
          />
          <span style={{ fontSize: 10, opacity: 0.7 }}>Break distance</span>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
          <span>Attraction Radius: {physics.attractionRadius}px</span>
          <input
            type="range" min="15" max="60" step="5"
            value={physics.attractionRadius}
            onChange={e => setPhysics(p => ({ ...p, attractionRadius: Number(e.target.value) }))}
            style={{ width: 100 }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
          <span>Attraction Strength: {physics.attractionStiffness.toFixed(3)}</span>
          <input
            type="range" min="0.005" max="0.08" step="0.005"
            value={physics.attractionStiffness}
            onChange={e => setPhysics(p => ({ ...p, attractionStiffness: Number(e.target.value) }))}
            style={{ width: 100 }}
          />
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', fontSize: 12, justifyContent: 'center' }}>
          <span style={{ opacity: 0.7 }}>Springs: {attractionSpringsRef.current.length}</span>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          <input
            type="checkbox"
            checked={showSprings}
            onChange={e => setShowSprings(e.target.checked)}
          />
          <span>Show Springs</span>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
          <span style={{ color: '#e67e22', fontWeight: 'bold' }}>Tendril End Size: {physics.tendrilEndRadius}px</span>
          <input
            type="range" min="4" max="20" step="1"
            value={physics.tendrilEndRadius}
            onChange={e => setPhysics(p => ({ ...p, tendrilEndRadius: Number(e.target.value) }))}
            style={{ width: 100 }}
          />
          <span style={{ fontSize: 10, opacity: 0.7 }}>Bead size at ends</span>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
          <span style={{ color: '#9b59b6', fontWeight: 'bold' }}>Skinniness: {physics.tendrilSkinniness.toFixed(2)}</span>
          <input
            type="range" min="0" max="0.95" step="0.05"
            value={physics.tendrilSkinniness}
            onChange={e => setPhysics(p => ({ ...p, tendrilSkinniness: Number(e.target.value) }))}
            style={{ width: 100 }}
          />
          <span style={{ fontSize: 10, opacity: 0.7 }}>Middle thinning when stretched</span>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
          <span style={{ color: '#1abc9c', fontWeight: 'bold' }}>Wall Thickness: {physics.wallThickness}px</span>
          <input
            type="range" min="2" max="20" step="1"
            value={physics.wallThickness}
            onChange={e => setPhysics(p => ({ ...p, wallThickness: Number(e.target.value) }))}
            style={{ width: 100 }}
          />
          <span style={{ fontSize: 10, opacity: 0.7 }}>Cell wall ring width</span>
        </label>
      </div>

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        style={{ background: bgColor, borderRadius: 8, cursor: 'grab' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <defs>
          <filter id="goo-filter-5c" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation={filterParams.stdDeviation} result="blur" />
            <feColorMatrix in="blur" mode="matrix" values={getFilterMatrix()} result="goo" />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>

        {/* Labels */}
        <text x={120} y={30} fill="#fff" fontSize={14} textAnchor="middle" opacity={0.7}>T</text>
        <text x={300} y={30} fill="#fff" fontSize={14} textAnchor="middle" opacity={0.7}>U</text>
        <text x={480} y={30} fill="#fff" fontSize={14} textAnchor="middle" opacity={0.7}>Corrupt</text>

        {/* LAYER 1: Outer gooey shapes with filter (filled) */}
        <g filter={filterParams.enabled ? 'url(#goo-filter-5c)' : undefined}>
          {/* Tendrils for mozzarella effect */}
          {attractionSpringsRef.current.map((spring, i) => {
            const vA = blobsRef.current[spring.blobA]?.vertices[spring.vertA];
            const vB = blobsRef.current[spring.blobB]?.vertices[spring.vertB];
            if (!vA || !vB) return null;

            const dx = vB.pos.x - vA.pos.x;
            const dy = vB.pos.y - vA.pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // How stretched is this string? (0 = touching, 1 = at break point)
            const stretchRatio = Math.min(1, dist / physics.goopiness);

            // End beads: always fixed size
            const endRadius = physics.tendrilEndRadius;

            // Middle beads: smaller, and get even smaller as string stretches
            // At rest (stretchRatio=0): middle = endRadius * (1 - skinniness * 0.3)
            // At max stretch (stretchRatio=1): middle = endRadius * (1 - skinniness)
            const minMiddleScale = 1 - physics.tendrilSkinniness;
            const maxMiddleScale = 1 - physics.tendrilSkinniness * 0.3;
            const middleScale = maxMiddleScale - (maxMiddleScale - minMiddleScale) * stretchRatio;
            const middleRadius = endRadius * middleScale;

            // Spacing based on end radius for consistent overlap
            const beadSpacing = endRadius * 1.4;
            const numBeads = Math.max(2, Math.ceil(dist / beadSpacing));

            const beads = [];
            for (let j = 0; j <= numBeads; j++) {
              const t = j / numBeads;

              // t=0 or t=1 are ends (large), t=0.5 is middle (small)
              // Use sine curve: sin(0)=0, sin(PI/2)=1, sin(PI)=0
              const middleness = Math.sin(t * Math.PI); // 0 at ends, 1 at middle

              // Interpolate between end radius and middle radius
              const r = endRadius - (endRadius - middleRadius) * middleness;

              beads.push({
                cx: vA.pos.x + dx * t,
                cy: vA.pos.y + dy * t,
                r: Math.max(2, r), // minimum 2px
              });
            }

            return (
              <g key={`tendril-${i}`}>
                {beads.map((bead, j) => (
                  <circle key={j} cx={bead.cx} cy={bead.cy} r={bead.r} fill="#e74c3c" />
                ))}
              </g>
            );
          })}

          {/* Outer blob shapes (filled) */}
          {blobsRef.current.map((blob, i) => (
            <path
              key={i}
              d={getBlobPath(blob.vertices)}
              fill={blob.color}
              stroke={blob.color}
              strokeWidth={2}
            />
          ))}
        </g>

        {/* LAYER 2: Inner cutout - use innerRegions if available, else inset outer */}
        {blobsRef.current.map((blob, i) => {
          if (blob.innerRegions) {
            // Render separate simple inner regions (for complex shapes like Corrupt)
            // Use physics-simulated vertices
            return blob.innerRegions.map((region, ri) => {
              const worldPoints = region.vertices.map(v => v.pos);
              // Apply inset to each region
              const insetPoints = getInsetPath(worldPoints, physics.wallThickness);
              return (
                <path
                  key={`inner-${i}-${ri}`}
                  d={getPath(insetPoints)}
                  fill={bgColor}
                />
              );
            });
          } else {
            // Use the OUTER vertices and compute proper inset
            const outerPoints = blob.vertices.map(v => v.pos);
            const insetPoints = getInsetPath(outerPoints, physics.wallThickness);
            return (
              <path
                key={`inner-${i}`}
                d={getPath(insetPoints)}
                fill={bgColor}
              />
            );
          }
        })}

        {/* Debug: Show attraction springs */}
        {showSprings && attractionSpringsRef.current.map((spring, i) => {
          const vA = blobsRef.current[spring.blobA]?.vertices[spring.vertA];
          const vB = blobsRef.current[spring.blobB]?.vertices[spring.vertB];
          if (!vA || !vB) return null;
          const dx = vB.pos.x - vA.pos.x;
          const dy = vB.pos.y - vA.pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const stretchRatio = dist / physics.goopiness;
          const r = Math.min(255, Math.floor(stretchRatio * 255));
          const g = Math.max(0, 255 - Math.floor(stretchRatio * 255));
          return (
            <line
              key={`spring-${i}`}
              x1={vA.pos.x}
              y1={vA.pos.y}
              x2={vB.pos.x}
              y2={vB.pos.y}
              stroke={`rgb(${r},${g},100)`}
              strokeWidth={2}
              opacity={0.7}
            />
          );
        })}

        {/* Center markers */}
        {blobsRef.current.map((blob, i) => (
          <circle
            key={`center-${i}`}
            cx={blob.targetX}
            cy={blob.targetY}
            r={5}
            fill="rgba(255,255,255,0.4)"
          />
        ))}
      </svg>

      {/* Info */}
      <div style={{
        marginTop: 20,
        padding: 15,
        background: '#2c3e50',
        borderRadius: 8,
        maxWidth: 600,
        fontSize: 13,
        lineHeight: 1.6,
      }}>
        <strong>Proto-5c: Cell Wall Model</strong>
        <br /><br />
        <strong>Two layers:</strong>
        <br />• <strong>Outer</strong> (gooey): Stretches, merges with filter effect
        <br />• <strong>Inner</strong> (stable): Barely moves, cuts out the center
        <br />• <strong>Cell Wall</strong>: The visible ring between them
        <br /><br />
        <strong>Inner Stiffness:</strong> Controls how stable the core is (higher = more rigid)
        <br /><br />
        <strong>Next:</strong> Dynamic rebuilding when pieces lock (merge walls) or become loose goop (amputate)
      </div>
    </div>
  );
}
