import { useRef, useEffect, useState, useCallback } from 'react';

// ============================================================================
// PROTO-2: Blob Follows Cursor
// ============================================================================
// Tests: Two-layer architecture - render layer follows data layer (cursor)
// Success: Blob smoothly follows slow moves, overshoots fast moves, settles
// ============================================================================

interface Vec2 {
  x: number;
  y: number;
}

interface Vertex {
  pos: Vec2;
  oldPos: Vec2;
  homeOffset: Vec2; // Offset from blob center (rest position)
  mass: number;
}

interface Spring {
  a: number;
  b: number;
  restLength: number;
}

interface Blob {
  vertices: Vertex[];
  ringsprings: Spring[];
  crossSprings: Spring[];
  restArea: number;
  // Target position (the "data layer" - where the blob SHOULD be)
  targetX: number;
  targetY: number;
}

interface PhysicsParams {
  damping: number;
  gravity: number;
  stiffness: number;
  pressure: number;
  iterations: number;
  homeStiffness: number; // How strongly vertices pull toward home position
}

// Proto-2 findings: smooth follow + fantastic rotation morph
// - Home Stiffness 0.03: laggy/stretchy follow, beautiful rotation
// - Damping 0.92: settles quickly after movement
// - Stiffness 10: very soft, allows natural deformation
// - Iterations 3: stable enough
const DEFAULT_PARAMS: PhysicsParams = {
  damping: 0.92,
  gravity: 0,
  stiffness: 10,
  pressure: 2.5,
  iterations: 3,
  homeStiffness: 0.03,
};

const UNIT_SIZE = 40;
const CANVAS_WIDTH = 500;
const CANVAS_HEIGHT = 400;

// ============================================================================
// PHYSICS ENGINE
// ============================================================================

function createBlob(centerX: number, centerY: number): Blob {
  const vertices: Vertex[] = [];
  const ringsprings: Spring[] = [];
  const crossSprings: Spring[] = [];

  const u = UNIT_SIZE;

  // T-tetromino perimeter (same as Proto-1)
  const perimeterPoints: Vec2[] = [
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

  for (const pt of perimeterPoints) {
    vertices.push({
      pos: { x: centerX + pt.x, y: centerY + pt.y },
      oldPos: { x: centerX + pt.x, y: centerY + pt.y },
      homeOffset: { x: pt.x, y: pt.y }, // Store offset from center
      mass: 1.0,
    });
  }

  const n = vertices.length;

  // Ring springs
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    const dx = vertices[next].pos.x - vertices[i].pos.x;
    const dy = vertices[next].pos.y - vertices[i].pos.y;
    const restLength = Math.sqrt(dx * dx + dy * dy);
    ringsprings.push({ a: i, b: next, restLength });
  }

  // Cross springs
  const crossPairs = [
    [0, 4], [0, 5], [3, 9], [3, 8],
    [1, 8], [2, 5], [5, 8], [6, 9],
    [7, 4], [0, 7], [3, 6],
  ];

  for (const [a, b] of crossPairs) {
    const dx = vertices[b].pos.x - vertices[a].pos.x;
    const dy = vertices[b].pos.y - vertices[a].pos.y;
    const restLength = Math.sqrt(dx * dx + dy * dy);
    crossSprings.push({ a, b, restLength });
  }

  const restArea = calculateArea(vertices);

  return {
    vertices,
    ringsprings,
    crossSprings,
    restArea,
    targetX: centerX,
    targetY: centerY,
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
    v.pos.y += vy + params.gravity * dt;
  }
}

// NEW: Pull vertices toward their home positions (relative to target)
function applyHomeForce(blob: Blob, params: PhysicsParams): void {
  for (const v of blob.vertices) {
    // Where this vertex SHOULD be (target + its offset)
    const homeX = blob.targetX + v.homeOffset.x;
    const homeY = blob.targetY + v.homeOffset.y;

    // Pull toward home
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

function applyBoundaryConstraints(blob: Blob, width: number, height: number): void {
  const margin = 10;
  const bounce = 0.3;

  for (const v of blob.vertices) {
    if (v.pos.y > height - margin) {
      v.pos.y = height - margin;
      v.oldPos.y = v.pos.y + (v.pos.y - v.oldPos.y) * bounce;
    }
    if (v.pos.y < margin) {
      v.pos.y = margin;
      v.oldPos.y = v.pos.y + (v.pos.y - v.oldPos.y) * bounce;
    }
    if (v.pos.x < margin) {
      v.pos.x = margin;
      v.oldPos.x = v.pos.x + (v.pos.x - v.oldPos.x) * bounce;
    }
    if (v.pos.x > width - margin) {
      v.pos.x = width - margin;
      v.oldPos.x = v.pos.x + (v.pos.x - v.oldPos.x) * bounce;
    }
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

  // Draw target position (ghost)
  if (showDebug) {
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = blob.targetX + vertices[i].homeOffset.x;
      const y = blob.targetY + vertices[i].homeOffset.y;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Draw smooth membrane
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
    centroid.x - 20, centroid.y - 20, 0,
    centroid.x, centroid.y, 100
  );
  gradient.addColorStop(0, '#6fcf97');
  gradient.addColorStop(1, '#27ae60');
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.strokeStyle = '#1e8449';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Debug: vertices and springs
  if (showDebug) {
    for (let i = 0; i < n; i++) {
      const v = vertices[i];
      ctx.beginPath();
      ctx.arc(v.pos.x, v.pos.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#e74c3c';
      ctx.fill();
    }

    // Draw target crosshair
    ctx.strokeStyle = '#f39c12';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(blob.targetX - 10, blob.targetY);
    ctx.lineTo(blob.targetX + 10, blob.targetY);
    ctx.moveTo(blob.targetX, blob.targetY - 10);
    ctx.lineTo(blob.targetX, blob.targetY + 10);
    ctx.stroke();
  }
}

// ============================================================================
// REACT COMPONENT
// ============================================================================

export function SoftBodyProto2() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const blobRef = useRef<Blob>(createBlob(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2));
  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(-1);

  const [params, setParams] = useState<PhysicsParams>(DEFAULT_PARAMS);
  const [showDebug, setShowDebug] = useState(true);
  const [fps, setFps] = useState(0);
  const [followMode, setFollowMode] = useState<'cursor' | 'click'>('cursor');

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

      const blob = blobRef.current;

      if (lastTimeRef.current >= 0) {
        const dt = Math.min((time - lastTimeRef.current) / 1000, 0.033);

        verletIntegrate(blob, dt, params);
        applyHomeForce(blob, params); // Pull toward target

        for (let i = 0; i < params.iterations; i++) {
          applySpringConstraints(blob, params);
          applyPressure(blob, params);
        }

        applyBoundaryConstraints(blob, canvas.width, canvas.height);
      }
      lastTimeRef.current = time;

      // Render
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      renderBlob(ctx, blob, showDebug);

      // Instructions
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '12px system-ui';
      ctx.fillText(
        followMode === 'cursor' ? 'Move mouse to guide blob' : 'Click to set target',
        10, 20
      );

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationRef.current);
  }, [params, showDebug, followMode]);

  // Mouse tracking
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (followMode !== 'cursor') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    blobRef.current.targetX = x;
    blobRef.current.targetY = y;
  }, [followMode]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (followMode !== 'click') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    blobRef.current.targetX = e.clientX - rect.left;
    blobRef.current.targetY = e.clientY - rect.top;
  }, [followMode]);

  const handleReset = useCallback(() => {
    blobRef.current = createBlob(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    lastTimeRef.current = -1;
  }, []);

  // Rotate the target shape 90 degrees clockwise
  const handleRotate = useCallback(() => {
    const blob = blobRef.current;
    for (const v of blob.vertices) {
      // Rotate 90° clockwise: (x, y) -> (y, -x)
      const oldX = v.homeOffset.x;
      const oldY = v.homeOffset.y;
      v.homeOffset.x = oldY;
      v.homeOffset.y = -oldX;
    }
    // Also update rest lengths for springs since shape rotated
    // (Not strictly necessary if shape is symmetric, but good practice)
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
      <h1 style={{ margin: '0 0 10px 0' }}>Proto-2: Blob Follows Cursor</h1>
      <p style={{ margin: '0 0 20px 0', opacity: 0.7 }}>
        Testing two-layer architecture: render follows data
      </p>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onMouseMove={handleMouseMove}
          onClick={handleClick}
          style={{
            border: '2px solid #34495e',
            borderRadius: '8px',
            cursor: 'crosshair',
          }}
        />

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '15px',
          padding: '20px',
          backgroundColor: '#34495e',
          borderRadius: '8px',
          minWidth: '250px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>FPS: {fps}</span>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #4a6278', margin: '5px 0' }} />

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setFollowMode('cursor')}
              style={{
                flex: 1,
                padding: '8px',
                backgroundColor: followMode === 'cursor' ? '#3498db' : '#5a6a7a',
                border: 'none',
                borderRadius: '4px',
                color: 'white',
                cursor: 'pointer',
              }}
            >
              Follow Cursor
            </button>
            <button
              onClick={() => setFollowMode('click')}
              style={{
                flex: 1,
                padding: '8px',
                backgroundColor: followMode === 'click' ? '#3498db' : '#5a6a7a',
                border: 'none',
                borderRadius: '4px',
                color: 'white',
                cursor: 'pointer',
              }}
            >
              Click Target
            </button>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #4a6278', margin: '5px 0' }} />

          <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <span>Home Stiffness: {params.homeStiffness.toFixed(3)}</span>
            <input
              type="range"
              min="0.01"
              max="0.5"
              step="0.01"
              value={params.homeStiffness}
              onChange={(e) => setParams(p => ({ ...p, homeStiffness: parseFloat(e.target.value) }))}
            />
            <span style={{ fontSize: '11px', opacity: 0.6 }}>
              Low = laggy/stretchy, High = snappy
            </span>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <span>Damping: {params.damping.toFixed(3)}</span>
            <input
              type="range"
              min="0.9"
              max="1"
              step="0.005"
              value={params.damping}
              onChange={(e) => setParams(p => ({ ...p, damping: parseFloat(e.target.value) }))}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <span>Stiffness: {params.stiffness}</span>
            <input
              type="range"
              min="5"
              max="100"
              step="5"
              value={params.stiffness}
              onChange={(e) => setParams(p => ({ ...p, stiffness: parseFloat(e.target.value) }))}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <span>Iterations: {params.iterations}</span>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={params.iterations}
              onChange={(e) => setParams(p => ({ ...p, iterations: parseInt(e.target.value) }))}
            />
          </label>

          <hr style={{ border: 'none', borderTop: '1px solid #4a6278', margin: '5px 0' }} />

          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showDebug}
              onChange={(e) => setShowDebug(e.target.checked)}
            />
            <span>Show Debug (target, ghost)</span>
          </label>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleRotate}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: '#9b59b6',
                border: 'none',
                borderRadius: '4px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Rotate 90°
            </button>
            <button
              onClick={handleReset}
              style={{
                flex: 1,
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

          <button
            onClick={() => setParams(DEFAULT_PARAMS)}
            style={{
              padding: '10px',
              backgroundColor: '#95a5a6',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            Reset Parameters
          </button>
        </div>
      </div>

      <div style={{
        marginTop: '20px',
        padding: '15px',
        backgroundColor: '#34495e',
        borderRadius: '8px',
        maxWidth: '760px',
      }}>
        <h3 style={{ margin: '0 0 10px 0' }}>Proto-2 Goals:</h3>
        <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: 1.6 }}>
          <li>Test two-layer architecture (data layer drives render layer)</li>
          <li>Blob follows cursor/click target with springy physics</li>
          <li>Slow moves = smooth follow</li>
          <li>Fast/jump moves = overshoot, bounce, settle</li>
          <li>Tune homeStiffness for responsive but physical feel</li>
        </ul>
      </div>
    </div>
  );
}

export default SoftBodyProto2;
