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
  rotation: number;
  color: string;
}

interface PhysicsParams {
  damping: number;
  stiffness: number;
  pressure: number;
  iterations: number;
  homeStiffness: number;
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
};

// User's preferred settings
const FILTER_PRESETS = {
  none: { enabled: false, stdDeviation: 8, alphaMultiplier: 20, alphaOffset: -7 },
  subtle: { enabled: true, stdDeviation: 5, alphaMultiplier: 15, alphaOffset: -6 },
  medium: { enabled: true, stdDeviation: 8, alphaMultiplier: 20, alphaOffset: -7 },
  aggressive: { enabled: true, stdDeviation: 12, alphaMultiplier: 25, alphaOffset: -9 },
};

// ============================================================================
// BLOB CREATION (Single perimeter around entire shape)
// ============================================================================

type ShapeType = 'T' | 'U';

function createBlob(centerX: number, centerY: number, shape: ShapeType, color: string): Blob {
  const vertices: Vertex[] = [];
  const ringsprings: Spring[] = [];
  const crossSprings: Spring[] = [];

  const u = UNIT_SIZE;

  let perimeterPoints: Vec2[];
  let crossPairs: number[][];

  if (shape === 'T') {
    // T-tetromino:  ███   (3 wide, 2 tall)
    //                █
    // Single perimeter around entire shape
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
  } else {
    // U-pentomino:  █ █   (3 wide, 2 tall)
    //               ███
    //
    //  0---1       4---5
    //  |   |       |   |
    // 11   2-------3   6
    //  |               |
    // 10---9-------8---7
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
  }

  // Create vertices
  for (const pt of perimeterPoints) {
    vertices.push({
      pos: { x: centerX + pt.x, y: centerY + pt.y },
      oldPos: { x: centerX + pt.x, y: centerY + pt.y },
      homeOffset: { x: pt.x, y: pt.y },
      mass: 1.0,
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
  const dragIndexRef = useRef<number | null>(null);
  const dragOffsetRef = useRef<Vec2>({ x: 0, y: 0 });

  const [physics] = useState<PhysicsParams>(DEFAULT_PHYSICS);
  const [filterParams, setFilterParams] = useState<FilterParams>(FILTER_PRESETS.medium);
  const [activePreset, setActivePreset] = useState<string>('medium');
  const [, forceUpdate] = useState({});

  // Initialize blobs
  useEffect(() => {
    const blobs: Blob[] = [
      createBlob(180, 250, 'T', '#e74c3c'),
      createBlob(380, 250, 'U', '#e74c3c'),
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
        applyPressure(blob, physics);
      }

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
        </div>
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
        <text x={180} y={30} fill="#fff" fontSize={14} textAnchor="middle" opacity={0.7}>T (single perimeter)</text>
        <text x={380} y={30} fill="#fff" fontSize={14} textAnchor="middle" opacity={0.7}>U (single perimeter)</text>

        {/* All blobs in one filtered group */}
        <g filter={filterParams.enabled ? 'url(#goo-filter-5b)' : undefined}>
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
        <strong>Difference from Proto-5:</strong> Each shape is ONE soft body with a continuous
        perimeter, not composed of separate block blobs. This should give more cohesive rotation
        and better membrane behavior.
        <br /><br />
        <strong>Test:</strong> Rotate pieces — they should deform as a unit, not fly apart.
        Drag T into U's alcove to see merge effect.
      </div>
    </div>
  );
}
