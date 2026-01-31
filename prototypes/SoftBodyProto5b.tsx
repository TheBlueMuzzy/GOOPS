import { useRef, useEffect, useState, useCallback } from 'react';

// ============================================================================
// PROTO-5b: Goo Filter with Single-Perimeter Shapes
// ============================================================================
// Tests: Does a single continuous perimeter (vs composed blocks) merge better?
// T and U shapes as ONE soft body each (like Proto-4), with gooey filter
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
  attractionRadius: number;  // Multiplier for this vertex's attraction reach (0.3-1.5)
}

interface Spring {
  a: number;
  b: number;
  restLength: number;
}

// Springs that form between vertices of DIFFERENT blobs
interface AttractionSpring {
  blobA: number;
  vertA: number;
  blobB: number;
  vertB: number;
  restLength: number;
}

interface Blob {
  vertices: Vertex[];
  ringsprings: Spring[];
  crossSprings: Spring[];
  restArea: number;
  targetX: number;
  targetY: number;
  rotation: number;
  color: string;
  usePressure: boolean;  // Disable for self-intersecting shapes like Corrupt
}

interface PhysicsParams {
  damping: number;
  stiffness: number;
  pressure: number;
  iterations: number;
  homeStiffness: number;
  // Attraction between blobs
  attractionRadius: number;      // How close vertices must be to form springs
  attractionRestLength: number;  // Target distance when "merged" (0 = touching)
  attractionStiffness: number;   // Base pull strength
  goopiness: number;             // Break distance - how far springs stretch before snapping
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
  // Attraction params - tuned for mozzarella pull effect
  attractionRadius: 20,          // How close vertices must be to connect
  attractionRestLength: 0,       // Pull all the way together
  attractionStiffness: 0.005,    // Gentle pull
  goopiness: 25,                 // Break distance - snappy mozzarella
};

// User's preferred settings
const FILTER_PRESETS = {
  none: { enabled: false, stdDeviation: 8, alphaMultiplier: 20, alphaOffset: -12 },
  subtle: { enabled: true, stdDeviation: 5, alphaMultiplier: 15, alphaOffset: -6 },
  medium: { enabled: true, stdDeviation: 8, alphaMultiplier: 20, alphaOffset: -12 },
  aggressive: { enabled: true, stdDeviation: 12, alphaMultiplier: 25, alphaOffset: -9 },
};

// ============================================================================
// BLOB CREATION (Single perimeter around entire shape)
// ============================================================================

type ShapeType = 'T' | 'U' | 'Corrupt';

function createBlob(centerX: number, centerY: number, shape: ShapeType, color: string): Blob {
  const vertices: Vertex[] = [];
  const ringsprings: Spring[] = [];
  const crossSprings: Spring[] = [];

  const u = UNIT_SIZE;

  let perimeterPoints: Vec2[];
  let crossPairs: number[][];

  // Attraction radius multipliers: outer edges reach far (1.5), inner corners stay tight (0.3)
  const OUTER = 1.5;
  const INNER = 0.3;
  const MID = 1.0;
  let attractionMultipliers: number[];

  if (shape === 'T') {
    // T-tetromino:  ███   (3 wide, 2 tall)
    //                █
    // Single perimeter around entire shape
    perimeterPoints = [
      { x: -1.5 * u, y: -1 * u },    // 0: top-left (outer corner)
      { x: -0.5 * u, y: -1 * u },    // 1: top edge
      { x: 0.5 * u, y: -1 * u },     // 2: top edge
      { x: 1.5 * u, y: -1 * u },     // 3: top-right (outer corner)
      { x: 1.5 * u, y: 0 * u },      // 4: right edge
      { x: 0.5 * u, y: 0 * u },      // 5: inner right (concave)
      { x: 0.5 * u, y: 1 * u },      // 6: stem bottom-right (outer)
      { x: -0.5 * u, y: 1 * u },     // 7: stem bottom-left (outer)
      { x: -0.5 * u, y: 0 * u },     // 8: inner left (concave)
      { x: -1.5 * u, y: 0 * u },     // 9: left edge
    ];
    // Inner concave corners (5, 8) have low radius; outer corners have high
    attractionMultipliers = [OUTER, MID, MID, OUTER, MID, INNER, OUTER, OUTER, INNER, MID];
    crossPairs = [
      [0, 4], [0, 5], [3, 9], [3, 8],
      [1, 8], [2, 5], [5, 8], [6, 9],
      [7, 4], [0, 7], [3, 6],
    ];
  } else if (shape === 'U') {
    // U-pentomino:  █ █   (3 wide, 2 tall)
    //               ███
    //
    //  0---1       4---5
    //  |   |       |   |
    // 11   2-------3   6
    //  |               |
    // 10---9-------8---7
    perimeterPoints = [
      { x: -1.5 * u, y: -1 * u },    // 0: top-left outer (corner)
      { x: -0.5 * u, y: -1 * u },    // 1: top-left inner top (corner)
      { x: -0.5 * u, y: 0 * u },     // 2: notch left (concave)
      { x: 0.5 * u, y: 0 * u },      // 3: notch right (concave)
      { x: 0.5 * u, y: -1 * u },     // 4: top-right inner top (corner)
      { x: 1.5 * u, y: -1 * u },     // 5: top-right outer (corner)
      { x: 1.5 * u, y: 0 * u },      // 6: right side middle
      { x: 1.5 * u, y: 1 * u },      // 7: bottom-right (corner)
      { x: 0.5 * u, y: 1 * u },      // 8: bottom inner right
      { x: -0.5 * u, y: 1 * u },     // 9: bottom inner left
      { x: -1.5 * u, y: 1 * u },     // 10: bottom-left (corner)
      { x: -1.5 * u, y: 0 * u },     // 11: left side middle
    ];
    // Notch corners (2, 3) are concave - low attraction. Outer corners high.
    attractionMultipliers = [OUTER, OUTER, INNER, INNER, OUTER, OUTER, MID, OUTER, MID, MID, OUTER, MID];
    crossPairs = [
      [0, 6], [5, 10], [1, 11], [4, 6],
      [2, 9], [3, 8], [0, 9], [5, 8],
      [2, 10], [3, 7], [11, 8], [6, 9],
    ];
  } else {
    // Corrupted T (T_T_C): Actual game piece layout
    //   █   █   (row 0: blocks at col 0 and 2, gap at col 1)
    //     █     (row 1: corner-connected to both top blocks)
    //     █     (row 2: edge-connected to row 1)
    //
    // Continuous perimeter with thin bridges at corner connections:
    //
    //   0-----------1   2-----------3
    //   |           |   |           |
    //   |           5---4           |
    //   |            \ /            |
    //   7-------------6-------------8   <- bridges meet at middle top
    //                 |   |
    //                 |   |
    //                11---10
    //                 |   |
    //                13---12
    //
    const bridge = 0.08 * u; // Thin bridge width
    perimeterPoints = [
      // Start at TL block, top-left, go clockwise
      { x: -1.5 * u, y: -1.5 * u },       // 0: TL top-left
      { x: -0.5 * u, y: -1.5 * u },       // 1: TL top-right
      { x: -0.5 * u, y: -0.5 * u },       // 2: TL bottom-right
      { x: -bridge, y: -0.5 * u },        // 3: bridge to middle (left side)
      { x: -bridge, y: -0.5 * u + bridge }, // 4: bridge corner
      // Middle block left edge going down
      { x: -0.5 * u, y: -0.5 * u + bridge }, // 5: middle top-left
      { x: -0.5 * u, y: 1.5 * u },        // 6: bottom-left
      { x: 0.5 * u, y: 1.5 * u },         // 7: bottom-right
      { x: 0.5 * u, y: -0.5 * u + bridge }, // 8: middle top-right
      // Bridge to TR block
      { x: bridge, y: -0.5 * u + bridge }, // 9: bridge corner
      { x: bridge, y: -0.5 * u },         // 10: bridge to TR (right side)
      { x: 0.5 * u, y: -0.5 * u },        // 11: TR bottom-left
      { x: 0.5 * u, y: -1.5 * u },        // 12: TR top-left
      { x: 1.5 * u, y: -1.5 * u },        // 13: TR top-right
      { x: 1.5 * u, y: -0.5 * u },        // 14: TR bottom-right
      // Bridge back through top gap
      { x: 0.5 * u + bridge, y: -0.5 * u }, // 15: start gap traverse
      { x: 0.5 * u + bridge, y: -0.5 * u - bridge }, // 16: gap top
      { x: -0.5 * u - bridge, y: -0.5 * u - bridge }, // 17: gap top left
      { x: -0.5 * u - bridge, y: -0.5 * u }, // 18: gap end
      { x: -1.5 * u, y: -0.5 * u },       // 19: TL bottom-left, close loop
    ];
    // All outer corners have high attraction
    attractionMultipliers = [
      OUTER, MID, OUTER, INNER, INNER,  // 0-4: TL block + bridge
      OUTER, OUTER, OUTER, OUTER,       // 5-8: middle/bottom
      INNER, INNER, OUTER, MID, OUTER,  // 9-13: bridge + TR
      OUTER, INNER, INNER, INNER, INNER, MID  // 14-19: TR + gap traverse
    ];
    crossPairs = [
      [0, 2], [1, 19],   // TL block
      [5, 7], [6, 8],    // Middle block
      [11, 13], [12, 14], // TR block
      [0, 6], [13, 7],   // Long diagonals
      [3, 10], [4, 9],   // Bridge cross
    ];
  }

  // Create vertices with attraction radius multipliers
  for (let i = 0; i < perimeterPoints.length; i++) {
    const pt = perimeterPoints[i];
    vertices.push({
      pos: { x: centerX + pt.x, y: centerY + pt.y },
      oldPos: { x: centerX + pt.x, y: centerY + pt.y },
      homeOffset: { x: pt.x, y: pt.y },
      mass: 1.0,
      attractionRadius: attractionMultipliers[i],
    });
  }

  const n = vertices.length;

  // Ring springs (connect adjacent vertices)
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

  // Cross springs for structure
  for (const [a, b] of crossPairs) {
    const dx = vertices[b].homeOffset.x - vertices[a].homeOffset.x;
    const dy = vertices[b].homeOffset.y - vertices[a].homeOffset.y;
    crossSprings.push({
      a,
      b,
      restLength: Math.sqrt(dx * dx + dy * dy),
    });
  }

  // Calculate rest area
  let area = 0;
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    area += vertices[i].homeOffset.x * vertices[next].homeOffset.y;
    area -= vertices[next].homeOffset.x * vertices[i].homeOffset.y;
  }
  const restArea = Math.abs(area) / 2;

  return {
    vertices,
    ringsprings,
    crossSprings,
    restArea,
    targetX: centerX,
    targetY: centerY,
    rotation: 0,
    color,
    usePressure: shape !== 'Corrupt',  // Disable pressure for self-intersecting shapes
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
  for (const v of blob.vertices) {
    const vx = (v.pos.x - v.oldPos.x) * params.damping;
    const vy = (v.pos.y - v.oldPos.y) * params.damping;
    v.oldPos.x = v.pos.x;
    v.oldPos.y = v.pos.y;
    v.pos.x += vx;
    v.pos.y += vy + 10 * dt * dt;
  }
}

function applyHomeForce(blob: Blob, params: PhysicsParams): void {
  for (const v of blob.vertices) {
    const rotatedHome = rotatePoint(v.homeOffset.x, v.homeOffset.y, blob.rotation);
    const targetX = blob.targetX + rotatedHome.x;
    const targetY = blob.targetY + rotatedHome.y;
    const dx = targetX - v.pos.x;
    const dy = targetY - v.pos.y;
    v.pos.x += dx * params.homeStiffness;
    v.pos.y += dy * params.homeStiffness;
  }
}

function solveConstraints(blob: Blob, params: PhysicsParams): void {
  // Ring springs
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

  // Cross springs
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
// ATTRACTION SPRINGS (between different blobs)
// ============================================================================

function updateAttractionSprings(
  blobs: Blob[],
  springs: AttractionSpring[],
  params: PhysicsParams
): AttractionSpring[] {
  const newSprings: AttractionSpring[] = [];
  const existingPairs = new Set<string>();

  // PHASE 1: Keep existing springs if distance < goopiness (break distance)
  for (const spring of springs) {
    const vA = blobs[spring.blobA].vertices[spring.vertA];
    const vB = blobs[spring.blobB].vertices[spring.vertB];
    const dx = vB.pos.x - vA.pos.x;
    const dy = vB.pos.y - vA.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < params.goopiness) {
      // Spring survives - under break distance
      newSprings.push(spring);
      existingPairs.add(`${spring.blobA}-${spring.vertA}-${spring.blobB}-${spring.vertB}`);
    }
    // else: spring breaks (mozzarella snaps)
  }

  // PHASE 2: Create new springs for nearby vertices of different blobs
  for (let bi = 0; bi < blobs.length; bi++) {
    for (let bj = bi + 1; bj < blobs.length; bj++) {
      const blobA = blobs[bi];
      const blobB = blobs[bj];

      // Quick distance check between blob centers
      const centerDx = blobA.targetX - blobB.targetX;
      const centerDy = blobA.targetY - blobB.targetY;
      const centerDist = Math.sqrt(centerDx * centerDx + centerDy * centerDy);

      // Skip if blobs are too far apart (optimization)
      if (centerDist > params.attractionRadius * 6) continue;

      // Check all vertex pairs
      for (let vi = 0; vi < blobA.vertices.length; vi++) {
        for (let vj = 0; vj < blobB.vertices.length; vj++) {
          const vA = blobA.vertices[vi];
          const vB = blobB.vertices[vj];

          // Skip if spring already exists
          const pairKey = `${bi}-${vi}-${bj}-${vj}`;
          if (existingPairs.has(pairKey)) continue;

          const dx = vB.pos.x - vA.pos.x;
          const dy = vB.pos.y - vA.pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // Effective radius = sum of both vertices' attraction radii
          const radiusA = params.attractionRadius * vA.attractionRadius;
          const radiusB = params.attractionRadius * vB.attractionRadius;
          const effectiveRadius = radiusA + radiusB;

          if (dist < effectiveRadius) {
            // Create new spring
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
  // Stiffness ramp: 10% at max distance → 100% when close
  const MIN_STIFFNESS = params.attractionStiffness * 0.1;
  const MAX_STIFFNESS = params.attractionStiffness;

  for (const spring of springs) {
    const vA = blobs[spring.blobA].vertices[spring.vertA];
    const vB = blobs[spring.blobB].vertices[spring.vertB];

    const dx = vB.pos.x - vA.pos.x;
    const dy = vB.pos.y - vA.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.0001) continue;

    // Calculate max connection distance (sum of radii)
    const maxDist = params.attractionRadius * (vA.attractionRadius + vB.attractionRadius);

    // Interpolate stiffness: far = weak "reaching", close = strong pull
    // t=0 at maxDist, t=1 at restLength
    const t = 1 - Math.max(0, Math.min(1, (dist - spring.restLength) / (maxDist - spring.restLength)));
    const stiffness = MIN_STIFFNESS + t * (MAX_STIFFNESS - MIN_STIFFNESS);

    // Apply spring force
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

function getBlobPath(vertices: Vertex[]): string {
  const n = vertices.length;
  if (n < 3) return '';

  const points = vertices.map(v => v.pos);
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

// ============================================================================
// COMPONENT
// ============================================================================

export function SoftBodyProto5b() {
  const svgRef = useRef<SVGSVGElement>(null);
  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const blobsRef = useRef<Blob[]>([]);
  const attractionSpringsRef = useRef<AttractionSpring[]>([]);
  const dragIndexRef = useRef<number | null>(null);
  const dragOffsetRef = useRef<Vec2>({ x: 0, y: 0 });

  const [physics, setPhysics] = useState<PhysicsParams>(DEFAULT_PHYSICS);
  const [filterParams, setFilterParams] = useState<FilterParams>(FILTER_PRESETS.medium);
  const [activePreset, setActivePreset] = useState<string>('medium');
  const [showSprings, setShowSprings] = useState(false);
  const [, forceUpdate] = useState({});

  // Initialize blobs
  useEffect(() => {
    const blobs: Blob[] = [
      createBlob(120, 250, 'T', '#e74c3c'),
      createBlob(300, 250, 'U', '#e74c3c'),
      createBlob(480, 250, 'Corrupt', '#e74c3c'),
    ];
    blobsRef.current = blobs;
  }, []);

  // Physics loop
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

      // Update and apply attraction springs between blobs
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

  // Drag handlers
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
      <h2 style={{ margin: '0 0 10px 0' }}>Proto-5b: Single Perimeter Shapes</h2>
      <p style={{ margin: '0 0 20px 0', opacity: 0.7, fontSize: 14 }}>
        Each shape is ONE continuous soft body (not composed of blocks). Same color for merge test.
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

      {/* Attraction Controls */}
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
          <span style={{ color: '#f39c12', fontWeight: 'bold' }}>Goopiness: {physics.goopiness}px</span>
          <input
            type="range" min="30" max="150" step="5"
            value={physics.goopiness}
            onChange={e => setPhysics(p => ({ ...p, goopiness: Number(e.target.value) }))}
            style={{ width: 120 }}
          />
          <span style={{ fontSize: 10, opacity: 0.7 }}>Break distance (mozzarella)</span>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
          <span>Attraction Radius: {physics.attractionRadius}px</span>
          <input
            type="range" min="15" max="60" step="5"
            value={physics.attractionRadius}
            onChange={e => setPhysics(p => ({ ...p, attractionRadius: Number(e.target.value) }))}
            style={{ width: 100 }}
          />
          <span style={{ fontSize: 10, opacity: 0.7 }}>How close to connect</span>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
          <span>Attraction Strength: {physics.attractionStiffness.toFixed(3)}</span>
          <input
            type="range" min="0.005" max="0.08" step="0.005"
            value={physics.attractionStiffness}
            onChange={e => setPhysics(p => ({ ...p, attractionStiffness: Number(e.target.value) }))}
            style={{ width: 100 }}
          />
          <span style={{ fontSize: 10, opacity: 0.7 }}>Pull force (10%-100%)</span>
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
      </div>

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        style={{ background: '#2c3e50', borderRadius: 8, cursor: 'grab' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <defs>
          <filter id="goo-filter-5b" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation={filterParams.stdDeviation} result="blur" />
            <feColorMatrix in="blur" mode="matrix" values={getFilterMatrix()} result="goo" />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>

        {/* Labels */}
        <text x={120} y={30} fill="#fff" fontSize={14} textAnchor="middle" opacity={0.7}>T</text>
        <text x={300} y={30} fill="#fff" fontSize={14} textAnchor="middle" opacity={0.7}>U</text>
        <text x={480} y={30} fill="#fff" fontSize={14} textAnchor="middle" opacity={0.7}>Corrupt</text>

        {/* All blobs in one filtered group */}
        <g filter={filterParams.enabled ? 'url(#goo-filter-5b)' : undefined}>
          {/* Draw tendrils as "beads on a string" - circles along path that filter merges */}
          {attractionSpringsRef.current.map((spring, i) => {
            const vA = blobsRef.current[spring.blobA]?.vertices[spring.vertA];
            const vB = blobsRef.current[spring.blobB]?.vertices[spring.vertB];
            if (!vA || !vB) return null;

            const dx = vB.pos.x - vA.pos.x;
            const dy = vB.pos.y - vA.pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // How stretched is this spring? (0 = touching, 1 = at break point)
            const stretchRatio = Math.min(1, dist / physics.goopiness);

            // Bead sizing: larger beads when relaxed, smaller when stretched
            const maxBeadRadius = 8;
            const minBeadRadius = 4;
            const beadRadius = maxBeadRadius - (maxBeadRadius - minBeadRadius) * stretchRatio;

            // Number of beads scales with distance (more beads = continuous look)
            const beadSpacing = beadRadius * 1.5; // Overlap slightly for filter to merge
            const numBeads = Math.max(2, Math.ceil(dist / beadSpacing));

            // Generate bead positions along the line
            const beads = [];
            for (let j = 0; j <= numBeads; j++) {
              const t = j / numBeads;
              // Taper: beads in middle are slightly smaller
              const midTaper = 1 - 0.3 * Math.sin(t * Math.PI); // Pinch in middle
              const r = beadRadius * midTaper;
              beads.push({
                cx: vA.pos.x + dx * t,
                cy: vA.pos.y + dy * t,
                r: Math.max(minBeadRadius * 0.5, r),
              });
            }

            return (
              <g key={`tendril-${i}`}>
                {beads.map((bead, j) => (
                  <circle
                    key={j}
                    cx={bead.cx}
                    cy={bead.cy}
                    r={bead.r}
                    fill="#e74c3c"
                  />
                ))}
              </g>
            );
          })}

          {/* Main blob shapes */}
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

        {/* Debug: Show attraction springs */}
        {showSprings && attractionSpringsRef.current.map((spring, i) => {
          const vA = blobsRef.current[spring.blobA]?.vertices[spring.vertA];
          const vB = blobsRef.current[spring.blobB]?.vertices[spring.vertB];
          if (!vA || !vB) return null;
          const dx = vB.pos.x - vA.pos.x;
          const dy = vB.pos.y - vA.pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          // Color based on stretch: green when close, yellow mid, red near break
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
        <strong>Proto-5b + Attraction:</strong> Single-perimeter shapes with physics-based
        attraction springs. When pieces get close, springs form. Pull them apart to see the
        "mozzarella pull" effect — they stretch until breaking at the Goopiness distance.
        <br /><br />
        <strong>Goopiness:</strong> Controls how far the "mozzarella strings" stretch before snapping.
        Higher = longer stretchy connections when pulling apart.
        <br /><br />
        <strong>Stiffness Ramp:</strong> Attraction is weak (10%) at max distance (reaching effect)
        and strong (100%) when close (solid merge). This creates natural-looking goop behavior.
        <br /><br />
        <strong>Test:</strong> Drag T into U's notch, let them merge, then slowly pull apart
        to see the stretching effect.
      </div>
    </div>
  );
}
