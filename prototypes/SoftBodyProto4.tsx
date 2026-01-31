import { useRef, useEffect, useState, useCallback } from 'react';

// ============================================================================
// PROTO-4: Two Blobs Attraction
// ============================================================================
// Tests: Do vertex-to-vertex springs create the "reaching" effect?
// Success: Blobs stretch toward each other, no magnet-snap, gummy feel
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

interface Block {
  center: Vec2;        // Center position relative to blob center
  vertexIndices: number[]; // Which vertices belong to this block
}

interface Blob {
  vertices: Vertex[];
  ringsprings: Spring[];
  crossSprings: Spring[];
  restArea: number;
  targetX: number;
  targetY: number;
  color: string;
  blocks: Block[];     // Individual cells that make up this piece
}

interface PhysicsParams {
  damping: number;
  stiffness: number;
  pressure: number;
  iterations: number;
  homeStiffness: number;
  // Attraction params
  attractionRadius: number;    // Max distance to form springs
  attractionRestLength: number; // Target gap when "merged"
  attractionStiffness: number; // How strongly vertices pull
  breakDistance: number;       // Distance at which springs break
}

const UNIT_SIZE = 30;
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 450;

const DEFAULT_PARAMS: PhysicsParams = {
  damping: 0.94,
  stiffness: 10,
  pressure: 2.5,
  iterations: 3,
  homeStiffness: 0.05,
  attractionRadius: UNIT_SIZE,  // One block length
  attractionRestLength: 5,
  attractionStiffness: 0.02,
  breakDistance: 120,
};

// ============================================================================
// PHYSICS ENGINE
// ============================================================================

type ShapeType = 'T' | 'U';

function createBlob(centerX: number, centerY: number, color: string, shape: ShapeType): Blob {
  const vertices: Vertex[] = [];
  const ringsprings: Spring[] = [];
  const crossSprings: Spring[] = [];
  const blocks: Block[] = [];

  const u = UNIT_SIZE;

  let perimeterPoints: Vec2[];
  let crossPairs: number[][];
  let blockDefs: { center: Vec2; vertices: number[] }[];

  if (shape === 'T') {
    // T-tetromino:  ███   (3 wide, 2 tall)
    //                █
    // Grid: each cell is u x u, vertices at cell corners
    perimeterPoints = [
      { x: -1.5 * u, y: -1 * u },    // 0: top-left
      { x: -0.5 * u, y: -1 * u },    // 1
      { x: 0.5 * u, y: -1 * u },     // 2
      { x: 1.5 * u, y: -1 * u },     // 3: top-right
      { x: 1.5 * u, y: 0 * u },      // 4
      { x: 0.5 * u, y: 0 * u },      // 5: inner right
      { x: 0.5 * u, y: 1 * u },      // 6: stem bottom-right
      { x: -0.5 * u, y: 1 * u },     // 7: stem bottom-left
      { x: -0.5 * u, y: 0 * u },     // 8: inner left
      { x: -1.5 * u, y: 0 * u },     // 9
    ];
    crossPairs = [
      [0, 4], [0, 5], [3, 9], [3, 8],
      [1, 8], [2, 5], [5, 8], [6, 9],
      [7, 4], [0, 7], [3, 6],
    ];
    // 4 blocks: top-left, top-middle, top-right, stem
    blockDefs = [
      { center: { x: -1 * u, y: -0.5 * u }, vertices: [0, 1, 9] },       // Block 0: top-left
      { center: { x: 0 * u, y: -0.5 * u }, vertices: [1, 2, 5, 8] },     // Block 1: top-middle
      { center: { x: 1 * u, y: -0.5 * u }, vertices: [2, 3, 4, 5] },     // Block 2: top-right
      { center: { x: 0 * u, y: 0.5 * u }, vertices: [5, 6, 7, 8] },      // Block 3: stem
    ];
  } else {
    // U-pentomino:  █ █   (3 wide, 2 tall)
    //               ███
    // Grid: each cell is u x u, vertices at cell corners on square grid
    // 12 vertices to match T structure (4 per block with sharing)
    //
    //  0---1       4---5
    //  |   |       |   |
    // 11   2-------3   6
    //  |               |
    // 10---9-------8---7
    //
    perimeterPoints = [
      { x: -1.5 * u, y: -1 * u },    // 0: top-left outer
      { x: -0.5 * u, y: -1 * u },    // 1: top-left inner top
      { x: -0.5 * u, y: 0 * u },     // 2: notch left
      { x: 0.5 * u, y: 0 * u },      // 3: notch right
      { x: 0.5 * u, y: -1 * u },     // 4: top-right inner top
      { x: 1.5 * u, y: -1 * u },     // 5: top-right outer
      { x: 1.5 * u, y: 0 * u },      // 6: right side middle
      { x: 1.5 * u, y: 1 * u },      // 7: bottom-right
      { x: 0.5 * u, y: 1 * u },      // 8: bottom inner right
      { x: -0.5 * u, y: 1 * u },     // 9: bottom inner left
      { x: -1.5 * u, y: 1 * u },     // 10: bottom-left
      { x: -1.5 * u, y: 0 * u },     // 11: left side middle
    ];
    crossPairs = [
      [0, 6], [5, 10], [1, 11], [4, 6],
      [2, 9], [3, 8], [0, 9], [5, 8],
      [2, 10], [3, 7], [11, 8], [6, 9],
    ];
    // 5 blocks with 4 vertices each (some shared at boundaries)
    blockDefs = [
      { center: { x: -1 * u, y: -0.5 * u }, vertices: [0, 1, 2, 11] },   // Block 0: top-left arm
      { center: { x: 1 * u, y: -0.5 * u }, vertices: [3, 4, 5, 6] },     // Block 1: top-right arm
      { center: { x: -1 * u, y: 0.5 * u }, vertices: [9, 10, 11, 2] },   // Block 2: bottom-left
      { center: { x: 0 * u, y: 0.5 * u }, vertices: [2, 3, 8, 9] },      // Block 3: bottom-middle (alcove floor)
      { center: { x: 1 * u, y: 0.5 * u }, vertices: [3, 6, 7, 8] },      // Block 4: bottom-right
    ];
  }

  for (const pt of perimeterPoints) {
    vertices.push({
      pos: { x: centerX + pt.x, y: centerY + pt.y },
      oldPos: { x: centerX + pt.x, y: centerY + pt.y },
      homeOffset: { x: pt.x, y: pt.y },
      mass: 1.0,
    });
  }

  const n = vertices.length;

  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    const dx = vertices[next].pos.x - vertices[i].pos.x;
    const dy = vertices[next].pos.y - vertices[i].pos.y;
    const restLength = Math.sqrt(dx * dx + dy * dy);
    ringsprings.push({ a: i, b: next, restLength });
  }

  for (const [a, b] of crossPairs) {
    if (a < n && b < n) {
      const dx = vertices[b].pos.x - vertices[a].pos.x;
      const dy = vertices[b].pos.y - vertices[a].pos.y;
      const restLength = Math.sqrt(dx * dx + dy * dy);
      crossSprings.push({ a, b, restLength });
    }
  }

  const restArea = calculateArea(vertices);

  // Create blocks from definitions
  for (const def of blockDefs) {
    blocks.push({
      center: def.center,
      vertexIndices: def.vertices,
    });
  }

  return {
    vertices,
    ringsprings,
    crossSprings,
    restArea,
    targetX: centerX,
    targetY: centerY,
    color,
    blocks,
  };
}

function calculateArea(vertices: Vertex[]): number {
  let area = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += vertices[i].pos.x * vertices[j].pos.y;
    area -= vertices[j].pos.x * vertices[i].pos.y;
  }
  return Math.abs(area) / 2;
}

function calculateCentroid(vertices: Vertex[]): Vec2 {
  let cx = 0, cy = 0;
  for (const v of vertices) {
    cx += v.pos.x;
    cy += v.pos.y;
  }
  return { x: cx / vertices.length, y: cy / vertices.length };
}

function verletIntegrate(blob: Blob, dt: number, params: PhysicsParams): void {
  for (const v of blob.vertices) {
    const vx = (v.pos.x - v.oldPos.x) * params.damping;
    const vy = (v.pos.y - v.oldPos.y) * params.damping;

    v.oldPos.x = v.pos.x;
    v.oldPos.y = v.pos.y;

    v.pos.x += vx;
    v.pos.y += vy;
  }
}

function applyHomeForce(blob: Blob, params: PhysicsParams): void {
  for (const v of blob.vertices) {
    const homeX = blob.targetX + v.homeOffset.x;
    const homeY = blob.targetY + v.homeOffset.y;

    const dx = homeX - v.pos.x;
    const dy = homeY - v.pos.y;

    v.pos.x += dx * params.homeStiffness;
    v.pos.y += dy * params.homeStiffness;
  }
}

function applySpringConstraints(blob: Blob, params: PhysicsParams): void {
  const stiffness = params.stiffness / 100;
  const allSprings = [...blob.ringsprings, ...blob.crossSprings];

  for (const spring of allSprings) {
    const a = blob.vertices[spring.a];
    const b = blob.vertices[spring.b];

    const dx = b.pos.x - a.pos.x;
    const dy = b.pos.y - a.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.0001) continue;

    const error = dist - spring.restLength;
    const correction = (error / dist) * stiffness * 0.5;
    const cx = dx * correction;
    const cy = dy * correction;

    a.pos.x += cx;
    a.pos.y += cy;
    b.pos.x -= cx;
    b.pos.y -= cy;
  }
}

function applyPressure(blob: Blob, params: PhysicsParams): void {
  const currentArea = calculateArea(blob.vertices);
  if (currentArea < 1) return;

  const areaRatio = blob.restArea / currentArea;
  const centroid = calculateCentroid(blob.vertices);

  if (Math.abs(areaRatio - 1) < 0.001) return;

  for (const v of blob.vertices) {
    const dx = v.pos.x - centroid.x;
    const dy = v.pos.y - centroid.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.0001) continue;

    const pressureStrength = Math.max(-0.5, Math.min(0.5, (areaRatio - 1) * params.pressure * 0.1));
    v.pos.x += (dx / dist) * pressureStrength;
    v.pos.y += (dy / dist) * pressureStrength;
  }
}

// Get the world position of a block's center
function getBlockWorldCenter(blob: Blob, block: Block): Vec2 {
  return {
    x: blob.targetX + block.center.x,
    y: blob.targetY + block.center.y,
  };
}

// Find and update attraction springs using BLOCK-BASED proximity
// Only vertices belonging to nearby blocks can attract
function updateAttractionSprings(
  blobs: Blob[],
  springs: AttractionSpring[],
  params: PhysicsParams
): AttractionSpring[] {
  const newSprings: AttractionSpring[] = [];

  // For each pair of blobs
  for (let bi = 0; bi < blobs.length; bi++) {
    for (let bj = bi + 1; bj < blobs.length; bj++) {
      const blobA = blobs[bi];
      const blobB = blobs[bj];

      // For each pair of blocks (one from each blob)
      for (const blockA of blobA.blocks) {
        for (const blockB of blobB.blocks) {
          // Check if these two blocks are close enough
          const centerA = getBlockWorldCenter(blobA, blockA);
          const centerB = getBlockWorldCenter(blobB, blockB);

          const blockDx = centerB.x - centerA.x;
          const blockDy = centerB.y - centerA.y;
          const blockDist = Math.sqrt(blockDx * blockDx + blockDy * blockDy);

          // Only create vertex springs if blocks are within attraction radius
          if (blockDist < params.attractionRadius) {
            // Now check vertices belonging to these blocks
            for (const vi of blockA.vertexIndices) {
              for (const vj of blockB.vertexIndices) {
                const vA = blobA.vertices[vi];
                const vB = blobB.vertices[vj];

                const dx = vB.pos.x - vA.pos.x;
                const dy = vB.pos.y - vA.pos.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // Check if spring already exists
                const existing = springs.find(
                  s => s.blobA === bi && s.vertA === vi && s.blobB === bj && s.vertB === vj
                );

                if (existing) {
                  // Keep existing spring if not broken
                  if (dist < params.breakDistance) {
                    newSprings.push(existing);
                  }
                } else if (dist < params.attractionRadius) {
                  // Create new spring only if vertices are also close
                  newSprings.push({
                    blobA: bi,
                    vertA: vi,
                    blobB: bj,
                    vertB: vj,
                    restLength: params.attractionRestLength,
                  });
                }
              }
            }
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
  for (const spring of springs) {
    const vA = blobs[spring.blobA].vertices[spring.vertA];
    const vB = blobs[spring.blobB].vertices[spring.vertB];

    const dx = vB.pos.x - vA.pos.x;
    const dy = vB.pos.y - vA.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.0001) continue;

    const error = dist - spring.restLength;
    const correction = error * params.attractionStiffness * 0.5;
    const cx = (dx / dist) * correction;
    const cy = (dy / dist) * correction;

    vA.pos.x += cx;
    vA.pos.y += cy;
    vB.pos.x -= cx;
    vB.pos.y -= cy;
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

function renderBlob(ctx: CanvasRenderingContext2D, blob: Blob, showDebug: boolean): void {
  const { vertices } = blob;
  const n = vertices.length;

  ctx.beginPath();
  const first = vertices[0].pos;
  ctx.moveTo(first.x, first.y);

  for (let i = 0; i < n; i++) {
    const p0 = vertices[(i - 1 + n) % n].pos;
    const p1 = vertices[i].pos;
    const p2 = vertices[(i + 1) % n].pos;
    const p3 = vertices[(i + 2) % n].pos;

    const { cp1, cp2 } = catmullRomToBezier(p0, p1, p2, p3);
    ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p2.x, p2.y);
  }
  ctx.closePath();

  const centroid = calculateCentroid(vertices);
  const gradient = ctx.createRadialGradient(
    centroid.x - 15, centroid.y - 15, 0,
    centroid.x, centroid.y, 60
  );
  gradient.addColorStop(0, '#6fcf97');
  gradient.addColorStop(1, '#27ae60');
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.strokeStyle = '#1e8449';
  ctx.lineWidth = 2;
  ctx.stroke();

  if (showDebug) {
    for (let i = 0; i < n; i++) {
      const v = vertices[i];
      ctx.beginPath();
      ctx.arc(v.pos.x, v.pos.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#e74c3c';
      ctx.fill();
    }
  }
}

function renderAttractionSprings(
  ctx: CanvasRenderingContext2D,
  blobs: Blob[],
  springs: AttractionSpring[]
): void {
  ctx.strokeStyle = '#f39c12';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);

  for (const spring of springs) {
    const vA = blobs[spring.blobA].vertices[spring.vertA];
    const vB = blobs[spring.blobB].vertices[spring.vertB];

    ctx.beginPath();
    ctx.moveTo(vA.pos.x, vA.pos.y);
    ctx.lineTo(vB.pos.x, vB.pos.y);
    ctx.stroke();
  }

  ctx.setLineDash([]);
}

// ============================================================================
// REACT COMPONENT
// ============================================================================

export function SoftBodyProto4() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const blobsRef = useRef<Blob[]>([
    createBlob(CANVAS_WIDTH / 3, CANVAS_HEIGHT / 2, '#27ae60', 'T'),      // Left: T-tetromino (anchored)
    createBlob(CANVAS_WIDTH * 2 / 3, CANVAS_HEIGHT / 2, '#27ae60', 'U'),  // Right: U-pentomino (draggable)
  ]);
  const attractionSpringsRef = useRef<AttractionSpring[]>([]);
  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(-1);
  const dragRef = useRef<{ blobIndex: number; offsetX: number; offsetY: number } | null>(null);

  const [params, setParams] = useState<PhysicsParams>(DEFAULT_PARAMS);
  const [showDebug, setShowDebug] = useState(true);
  const [fps, setFps] = useState(0);
  const [springCount, setSpringCount] = useState(0);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameCount = 0;
    let lastFpsTime = performance.now();

    const animate = (time: number) => {
      frameCount++;
      if (time - lastFpsTime > 1000) {
        setFps(frameCount);
        frameCount = 0;
        lastFpsTime = time;
      }

      const blobs = blobsRef.current;

      if (lastTimeRef.current >= 0) {
        const dt = Math.min((time - lastTimeRef.current) / 1000, 0.033);

        // Update attraction springs
        attractionSpringsRef.current = updateAttractionSprings(
          blobs,
          attractionSpringsRef.current,
          params
        );
        setSpringCount(attractionSpringsRef.current.length);

        for (let bi = 0; bi < blobs.length; bi++) {
          const blob = blobs[bi];
          verletIntegrate(blob, dt, params);

          // Left blob (0) is anchored with high stiffness, right blob uses slider
          const homeParams = bi === 0
            ? { ...params, homeStiffness: 0.3 }
            : params;
          applyHomeForce(blob, homeParams);

          for (let i = 0; i < params.iterations; i++) {
            applySpringConstraints(blob, params);
            applyPressure(blob, params);
          }
        }

        // Apply attraction between blobs
        applyAttractionSprings(blobs, attractionSpringsRef.current, params);
      }
      lastTimeRef.current = time;

      // Render
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw per-block attraction radius guides
      if (showDebug) {
        ctx.strokeStyle = 'rgba(243, 156, 18, 0.3)';
        ctx.lineWidth = 1;
        for (const blob of blobs) {
          for (const block of blob.blocks) {
            const center = getBlockWorldCenter(blob, block);
            ctx.beginPath();
            ctx.arc(center.x, center.y, params.attractionRadius, 0, Math.PI * 2);
            ctx.stroke();

            // Draw block center dot
            ctx.fillStyle = 'rgba(243, 156, 18, 0.7)';
            ctx.beginPath();
            ctx.arc(center.x, center.y, 4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Draw attraction springs
      if (showDebug) {
        renderAttractionSprings(ctx, blobs, attractionSpringsRef.current);
      }

      // Draw blobs
      for (const blob of blobs) {
        renderBlob(ctx, blob, showDebug);
      }

      // Instructions
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '12px system-ui';
      ctx.fillText('Drag blobs to test attraction', 10, 20);

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationRef.current);
  }, [params, showDebug]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Only blob 1 (right) is draggable - blob 0 (left) is locked/anchored
    const blob = blobsRef.current[1];
    const centroid = calculateCentroid(blob.vertices);
    const dx = x - centroid.x;
    const dy = y - centroid.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 150) {
      dragRef.current = {
        blobIndex: 1,
        offsetX: blob.targetX - x,
        offsetY: blob.targetY - y,
      };
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const blob = blobsRef.current[dragRef.current.blobIndex];
    blob.targetX = x + dragRef.current.offsetX;
    blob.targetY = y + dragRef.current.offsetY;
  }, []);

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleReset = useCallback(() => {
    blobsRef.current = [
      createBlob(CANVAS_WIDTH / 3, CANVAS_HEIGHT / 2, '#27ae60', 'T'),
      createBlob(CANVAS_WIDTH * 2 / 3, CANVAS_HEIGHT / 2, '#27ae60', 'U'),
    ];
    attractionSpringsRef.current = [];
    lastTimeRef.current = -1;
  }, []);

  // Rotate a specific blob 90° clockwise
  const handleRotateBlob = useCallback((blobIndex: number) => {
    const blob = blobsRef.current[blobIndex];
    // Rotate vertex home offsets
    for (const v of blob.vertices) {
      const oldX = v.homeOffset.x;
      const oldY = v.homeOffset.y;
      v.homeOffset.x = oldY;
      v.homeOffset.y = -oldX;
    }
    // Rotate block centers too
    for (const block of blob.blocks) {
      const oldX = block.center.x;
      const oldY = block.center.y;
      block.center.x = oldY;
      block.center.y = -oldX;
    }
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '20px',
      backgroundColor: '#1a252f',
      minHeight: '100vh',
      color: '#ecf0f1',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <h1 style={{ margin: '0 0 10px 0' }}>Proto-4: Two Blobs Attraction</h1>
      <p style={{ margin: '0 0 20px 0', opacity: 0.7 }}>
        Do vertex springs create the "reaching" effect?
      </p>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            border: '2px solid #34495e',
            borderRadius: '8px',
            cursor: 'grab',
          }}
        />

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          padding: '20px',
          backgroundColor: '#34495e',
          borderRadius: '8px',
          minWidth: '280px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>FPS: {fps}</span>
            <span>Springs: {springCount}</span>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #4a6278', margin: '5px 0' }} />

          <div style={{ fontWeight: 'bold', color: '#f39c12' }}>Attraction Settings</div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <span>Attraction Radius: {params.attractionRadius}px</span>
            <input
              type="range"
              min="10"
              max="60"
              step="5"
              value={params.attractionRadius}
              onChange={(e) => setParams(p => ({ ...p, attractionRadius: parseInt(e.target.value) }))}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <span>Rest Length: {params.attractionRestLength}px</span>
            <input
              type="range"
              min="0"
              max="30"
              step="1"
              value={params.attractionRestLength}
              onChange={(e) => setParams(p => ({ ...p, attractionRestLength: parseInt(e.target.value) }))}
            />
            <span style={{ fontSize: '10px', opacity: 0.6 }}>0 = vertices touch</span>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <span>Attraction Stiffness: {params.attractionStiffness.toFixed(3)}</span>
            <input
              type="range"
              min="0.005"
              max="0.1"
              step="0.005"
              value={params.attractionStiffness}
              onChange={(e) => setParams(p => ({ ...p, attractionStiffness: parseFloat(e.target.value) }))}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <span>Break Distance: {params.breakDistance}px</span>
            <input
              type="range"
              min="50"
              max="200"
              step="10"
              value={params.breakDistance}
              onChange={(e) => setParams(p => ({ ...p, breakDistance: parseInt(e.target.value) }))}
            />
          </label>

          <hr style={{ border: 'none', borderTop: '1px solid #4a6278', margin: '5px 0' }} />

          <div style={{ fontWeight: 'bold', color: '#3498db' }}>Blob Physics</div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <span>Home Stiffness: {params.homeStiffness.toFixed(3)}</span>
            <input
              type="range"
              min="0.01"
              max="0.2"
              step="0.01"
              value={params.homeStiffness}
              onChange={(e) => setParams(p => ({ ...p, homeStiffness: parseFloat(e.target.value) }))}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <span>Damping: {params.damping.toFixed(2)}</span>
            <input
              type="range"
              min="0.8"
              max="0.99"
              step="0.01"
              value={params.damping}
              onChange={(e) => setParams(p => ({ ...p, damping: parseFloat(e.target.value) }))}
            />
          </label>

          <hr style={{ border: 'none', borderTop: '1px solid #4a6278', margin: '5px 0' }} />

          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showDebug}
              onChange={(e) => setShowDebug(e.target.checked)}
            />
            <span>Show Debug (springs, radius)</span>
          </label>

          <hr style={{ border: 'none', borderTop: '1px solid #4a6278', margin: '5px 0' }} />

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => handleRotateBlob(0)}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: '#9b59b6',
                border: 'none',
                borderRadius: '4px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              Rotate T
            </button>
            <button
              onClick={() => handleRotateBlob(1)}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: '#9b59b6',
                border: 'none',
                borderRadius: '4px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              Rotate U
            </button>
          </div>

          <button
            onClick={handleReset}
            style={{
              padding: '10px',
              backgroundColor: '#e74c3c',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
        </div>
      </div>

      <div style={{
        marginTop: '20px',
        padding: '15px',
        backgroundColor: '#34495e',
        borderRadius: '8px',
        maxWidth: '860px',
      }}>
        <h3 style={{ margin: '0 0 10px 0' }}>Proto-4 Goals:</h3>
        <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: 1.6 }}>
          <li>Drag blobs close together - watch for "reaching" effect</li>
          <li>Vertices should stretch toward each other before touching</li>
          <li>Orange dashed lines = attraction springs forming</li>
          <li>Drag apart - springs should break cleanly</li>
          <li>Success = gummy/stretchy feel, NOT magnetic snap</li>
        </ul>
      </div>
    </div>
  );
}

export default SoftBodyProto4;
