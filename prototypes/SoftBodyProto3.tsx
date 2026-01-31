import { useRef, useEffect, useState, useCallback } from 'react';

// ============================================================================
// PROTO-3: Rotation Stress Test
// ============================================================================
// Tests: Do rapid 90° rotations break physics or accumulate lag?
// Success: Smooth rotation, no lag buildup, recovers within 100-150ms
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

interface Blob {
  vertices: Vertex[];
  ringsprings: Spring[];
  crossSprings: Spring[];
  restArea: number;
  targetX: number;
  targetY: number;
  rotationCount: number; // Track total rotations
}

interface PhysicsParams {
  damping: number;
  stiffness: number;
  pressure: number;
  iterations: number;
  homeStiffness: number;
}

// Proto-3 findings: stress test at 100ms auto-rotate
// - Home Stiffness 0.18: snappy recovery for rapid rotations
// - Damping 0.94: quick settle without overshoot
// No lag accumulation observed - bounded deviation
const DEFAULT_PARAMS: PhysicsParams = {
  damping: 0.94,
  stiffness: 10,
  pressure: 2.5,
  iterations: 3,
  homeStiffness: 0.18,
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
    rotationCount: 0,
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

// Calculate how far the blob is from its target (for recovery timing)
function calculateDeviation(blob: Blob): number {
  let totalDev = 0;
  for (const v of blob.vertices) {
    const homeX = blob.targetX + v.homeOffset.x;
    const homeY = blob.targetY + v.homeOffset.y;
    const dx = v.pos.x - homeX;
    const dy = v.pos.y - homeY;
    totalDev += Math.sqrt(dx * dx + dy * dy);
  }
  return totalDev / blob.vertices.length;
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

  // Draw target ghost
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

// ============================================================================
// REACT COMPONENT
// ============================================================================

export function SoftBodyProto3() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const blobRef = useRef<Blob>(createBlob(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2));
  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(-1);
  const lastRotateTimeRef = useRef<number>(0);

  const [params, setParams] = useState<PhysicsParams>(DEFAULT_PARAMS);
  const [showDebug, setShowDebug] = useState(true);
  const [fps, setFps] = useState(0);
  const [deviation, setDeviation] = useState(0);
  const [rotationCount, setRotationCount] = useState(0);
  const [autoRotate, setAutoRotate] = useState(false);
  const [autoRotateSpeed, setAutoRotateSpeed] = useState(500); // ms between rotations
  const [peakDeviation, setPeakDeviation] = useState(0);

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

      // Auto-rotate
      if (autoRotate && time - lastRotateTimeRef.current > autoRotateSpeed) {
        for (const v of blob.vertices) {
          const oldX = v.homeOffset.x;
          const oldY = v.homeOffset.y;
          v.homeOffset.x = oldY;
          v.homeOffset.y = -oldX;
        }
        blob.rotationCount++;
        setRotationCount(blob.rotationCount);
        lastRotateTimeRef.current = time;
      }

      if (lastTimeRef.current >= 0) {
        const dt = Math.min((time - lastTimeRef.current) / 1000, 0.033);

        verletIntegrate(blob, dt, params);
        applyHomeForce(blob, params);

        for (let i = 0; i < params.iterations; i++) {
          applySpringConstraints(blob, params);
          applyPressure(blob, params);
        }
      }
      lastTimeRef.current = time;

      // Calculate and track deviation
      const dev = calculateDeviation(blob);
      setDeviation(dev);
      if (dev > peakDeviation) {
        setPeakDeviation(dev);
      }

      // Render
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      renderBlob(ctx, blob, showDebug);

      // Deviation meter
      const meterWidth = 150;
      const meterHeight = 20;
      const meterX = 10;
      const meterY = canvas.height - 30;

      ctx.fillStyle = '#34495e';
      ctx.fillRect(meterX, meterY, meterWidth, meterHeight);

      const devPercent = Math.min(dev / 50, 1); // 50px = full bar
      const devColor = devPercent < 0.3 ? '#27ae60' : devPercent < 0.7 ? '#f39c12' : '#e74c3c';
      ctx.fillStyle = devColor;
      ctx.fillRect(meterX, meterY, meterWidth * devPercent, meterHeight);

      ctx.strokeStyle = '#fff';
      ctx.strokeRect(meterX, meterY, meterWidth, meterHeight);

      ctx.fillStyle = '#fff';
      ctx.font = '12px system-ui';
      ctx.fillText(`Deviation: ${dev.toFixed(1)}px`, meterX + 5, meterY + 14);

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationRef.current);
  }, [params, showDebug, autoRotate, autoRotateSpeed, peakDeviation]);

  const handleRotate = useCallback(() => {
    const blob = blobRef.current;
    for (const v of blob.vertices) {
      const oldX = v.homeOffset.x;
      const oldY = v.homeOffset.y;
      v.homeOffset.x = oldY;
      v.homeOffset.y = -oldX;
    }
    blob.rotationCount++;
    setRotationCount(blob.rotationCount);
  }, []);

  const handleReset = useCallback(() => {
    blobRef.current = createBlob(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    lastTimeRef.current = -1;
    setRotationCount(0);
    setPeakDeviation(0);
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
      <h1 style={{ margin: '0 0 10px 0' }}>Proto-3: Rotation Stress Test</h1>
      <p style={{ margin: '0 0 20px 0', opacity: 0.7 }}>
        Spam rotate - does lag accumulate?
      </p>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          style={{
            border: '2px solid #34495e',
            borderRadius: '8px',
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
            <span>Rotations: {rotationCount}</span>
          </div>

          <div style={{
            padding: '10px',
            backgroundColor: '#2c3e50',
            borderRadius: '4px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
              {deviation.toFixed(1)}px
            </div>
            <div style={{ fontSize: '12px', opacity: 0.7 }}>
              Current Deviation
            </div>
            <div style={{ fontSize: '12px', opacity: 0.5, marginTop: '5px' }}>
              Peak: {peakDeviation.toFixed(1)}px
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #4a6278', margin: '5px 0' }} />

          <button
            onClick={handleRotate}
            style={{
              padding: '15px',
              backgroundColor: '#9b59b6',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '18px',
              fontWeight: 'bold',
            }}
          >
            ROTATE 90°
          </button>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={autoRotate}
                onChange={(e) => setAutoRotate(e.target.checked)}
              />
              <span>Auto-rotate</span>
            </label>
            <input
              type="range"
              min="100"
              max="2000"
              step="100"
              value={autoRotateSpeed}
              onChange={(e) => setAutoRotateSpeed(parseInt(e.target.value))}
              style={{ flex: 1 }}
              disabled={!autoRotate}
            />
            <span style={{ fontSize: '12px', width: '50px' }}>{autoRotateSpeed}ms</span>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #4a6278', margin: '5px 0' }} />

          <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <span>Home Stiffness: {params.homeStiffness.toFixed(3)}</span>
            <input
              type="range"
              min="0.01"
              max="0.2"
              step="0.005"
              value={params.homeStiffness}
              onChange={(e) => setParams(p => ({ ...p, homeStiffness: parseFloat(e.target.value) }))}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <span>Damping: {params.damping.toFixed(3)}</span>
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
            <span>Show Debug</span>
          </label>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setPeakDeviation(0)}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: '#3498db',
                border: 'none',
                borderRadius: '4px',
                color: 'white',
                cursor: 'pointer',
              }}
            >
              Reset Peak
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
              Reset All
            </button>
          </div>
        </div>
      </div>

      <div style={{
        marginTop: '20px',
        padding: '15px',
        backgroundColor: '#34495e',
        borderRadius: '8px',
        maxWidth: '760px',
      }}>
        <h3 style={{ margin: '0 0 10px 0' }}>Proto-3 Goals:</h3>
        <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: 1.6 }}>
          <li>Spam rotate button - observe deviation meter</li>
          <li>Enable auto-rotate at various speeds</li>
          <li>Watch for lag accumulation (peak deviation climbing)</li>
          <li>Target: deviation stays bounded, recovers between rotations</li>
          <li>Success = peak deviation stays under ~40px even with spam</li>
        </ul>
      </div>
    </div>
  );
}

export default SoftBodyProto3;
