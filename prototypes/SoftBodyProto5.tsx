import { useRef, useEffect, useState, useCallback } from 'react';

// ============================================================================
// PROTO-5: Goo Filter Variations
// ============================================================================
// Tests: What filter settings create the best membrane merge look?
// Success: Smooth visual merge between same-color blobs without metaball math
// Now with T-tetromino + U-pentomino shapes (rounded square blocks)
// ============================================================================

interface Vec2 {
  x: number;
  y: number;
}

interface Vertex {
  pos: Vec2;
  oldPos: Vec2;
  homeOffset: Vec2;  // Relative to block center
  mass: number;
}

interface Spring {
  a: number;
  b: number;
  restLength: number;
}

interface Block {
  vertices: Vertex[];
  springs: Spring[];
  restArea: number;
  centerOffset: Vec2;  // Block center relative to piece center
}

interface Piece {
  blocks: Block[];
  targetX: number;
  targetY: number;
  rotation: number;  // 0, 90, 180, 270
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

// Physics params from Proto 1-4 learnings
const DEFAULT_PHYSICS: PhysicsParams = {
  damping: 0.94,
  stiffness: 15,
  pressure: 2.5,
  iterations: 3,
  homeStiffness: 0.08,
};

// Filter presets - user's preferred aggressive settings as default
const FILTER_PRESETS = {
  none: { enabled: false, stdDeviation: 20, alphaMultiplier: 27, alphaOffset: -6 },
  subtle: { enabled: true, stdDeviation: 10, alphaMultiplier: 20, alphaOffset: -8 },
  medium: { enabled: true, stdDeviation: 15, alphaMultiplier: 24, alphaOffset: -7 },
  aggressive: { enabled: true, stdDeviation: 20, alphaMultiplier: 27, alphaOffset: -6 },
};

// ============================================================================
// BLOCK CREATION (Rounded Square)
// ============================================================================

function createRoundedSquareBlock(centerOffsetX: number, centerOffsetY: number): Block {
  const vertices: Vertex[] = [];
  const springs: Spring[] = [];
  const size = UNIT_SIZE * 0.45;  // Slightly smaller than full cell
  const cornerRadius = 8;  // Roundness
  const numVertices = 12;  // 3 per corner

  // Create rounded square vertices
  const corners = [
    { x: -size, y: -size },  // Top-left
    { x: size, y: -size },   // Top-right
    { x: size, y: size },    // Bottom-right
    { x: -size, y: size },   // Bottom-left
  ];

  for (let c = 0; c < 4; c++) {
    const corner = corners[c];
    const nextCorner = corners[(c + 1) % 4];

    // Direction from corner toward center for rounding
    const toCenter = { x: -Math.sign(corner.x), y: -Math.sign(corner.y) };

    // 3 vertices per corner: entering, corner (rounded), exiting
    const enterX = corner.x + toCenter.x * cornerRadius;
    const enterY = corner.y;
    const exitX = corner.x;
    const exitY = corner.y + toCenter.y * cornerRadius;

    // Swap enter/exit based on corner to maintain winding order
    if (c === 0) {
      vertices.push(
        { pos: { x: 0, y: 0 }, oldPos: { x: 0, y: 0 }, homeOffset: { x: exitX, y: exitY }, mass: 1 },
        { pos: { x: 0, y: 0 }, oldPos: { x: 0, y: 0 }, homeOffset: { x: corner.x + toCenter.x * cornerRadius * 0.5, y: corner.y + toCenter.y * cornerRadius * 0.5 }, mass: 1 },
        { pos: { x: 0, y: 0 }, oldPos: { x: 0, y: 0 }, homeOffset: { x: enterX, y: enterY }, mass: 1 },
      );
    } else if (c === 1) {
      vertices.push(
        { pos: { x: 0, y: 0 }, oldPos: { x: 0, y: 0 }, homeOffset: { x: enterX, y: enterY }, mass: 1 },
        { pos: { x: 0, y: 0 }, oldPos: { x: 0, y: 0 }, homeOffset: { x: corner.x + toCenter.x * cornerRadius * 0.5, y: corner.y + toCenter.y * cornerRadius * 0.5 }, mass: 1 },
        { pos: { x: 0, y: 0 }, oldPos: { x: 0, y: 0 }, homeOffset: { x: exitX, y: exitY }, mass: 1 },
      );
    } else if (c === 2) {
      vertices.push(
        { pos: { x: 0, y: 0 }, oldPos: { x: 0, y: 0 }, homeOffset: { x: exitX, y: exitY }, mass: 1 },
        { pos: { x: 0, y: 0 }, oldPos: { x: 0, y: 0 }, homeOffset: { x: corner.x + toCenter.x * cornerRadius * 0.5, y: corner.y + toCenter.y * cornerRadius * 0.5 }, mass: 1 },
        { pos: { x: 0, y: 0 }, oldPos: { x: 0, y: 0 }, homeOffset: { x: enterX, y: enterY }, mass: 1 },
      );
    } else {
      vertices.push(
        { pos: { x: 0, y: 0 }, oldPos: { x: 0, y: 0 }, homeOffset: { x: enterX, y: enterY }, mass: 1 },
        { pos: { x: 0, y: 0 }, oldPos: { x: 0, y: 0 }, homeOffset: { x: corner.x + toCenter.x * cornerRadius * 0.5, y: corner.y + toCenter.y * cornerRadius * 0.5 }, mass: 1 },
        { pos: { x: 0, y: 0 }, oldPos: { x: 0, y: 0 }, homeOffset: { x: exitX, y: exitY }, mass: 1 },
      );
    }
  }

  // Ring springs
  for (let i = 0; i < numVertices; i++) {
    const next = (i + 1) % numVertices;
    const dx = vertices[next].homeOffset.x - vertices[i].homeOffset.x;
    const dy = vertices[next].homeOffset.y - vertices[i].homeOffset.y;
    springs.push({ a: i, b: next, restLength: Math.sqrt(dx * dx + dy * dy) });
  }

  // Cross springs for structure
  for (let i = 0; i < numVertices / 2; i++) {
    const opposite = (i + numVertices / 2) % numVertices;
    const dx = vertices[opposite].homeOffset.x - vertices[i].homeOffset.x;
    const dy = vertices[opposite].homeOffset.y - vertices[i].homeOffset.y;
    springs.push({ a: i, b: Math.floor(opposite), restLength: Math.sqrt(dx * dx + dy * dy) });
  }

  // Calculate rest area
  let area = 0;
  for (let i = 0; i < numVertices; i++) {
    const next = (i + 1) % numVertices;
    area += vertices[i].homeOffset.x * vertices[next].homeOffset.y;
    area -= vertices[next].homeOffset.x * vertices[i].homeOffset.y;
  }

  return {
    vertices,
    springs,
    restArea: Math.abs(area) / 2,
    centerOffset: { x: centerOffsetX, y: centerOffsetY },
  };
}

// ============================================================================
// PIECE CREATION
// ============================================================================

type ShapeType = 'T' | 'U';

function createPiece(centerX: number, centerY: number, shape: ShapeType, color: string): Piece {
  const blocks: Block[] = [];
  const u = UNIT_SIZE;

  // Block positions relative to piece center
  let blockPositions: Vec2[];

  if (shape === 'T') {
    // T-tetromino:  ███
    //                █
    blockPositions = [
      { x: -u, y: -u * 0.5 },   // Top-left
      { x: 0, y: -u * 0.5 },    // Top-middle
      { x: u, y: -u * 0.5 },    // Top-right
      { x: 0, y: u * 0.5 },     // Stem
    ];
  } else {
    // U-pentomino:  █ █
    //               ███
    blockPositions = [
      { x: -u, y: -u * 0.5 },   // Top-left
      { x: u, y: -u * 0.5 },    // Top-right
      { x: -u, y: u * 0.5 },    // Bottom-left
      { x: 0, y: u * 0.5 },     // Bottom-middle
      { x: u, y: u * 0.5 },     // Bottom-right
    ];
  }

  for (const pos of blockPositions) {
    const block = createRoundedSquareBlock(pos.x, pos.y);
    blocks.push(block);
  }

  // Initialize vertex positions
  const piece: Piece = { blocks, targetX: centerX, targetY: centerY, rotation: 0, color };
  updateBlockPositions(piece);

  return piece;
}

function rotatePoint(x: number, y: number, angleDeg: number): Vec2 {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

function updateBlockPositions(piece: Piece): void {
  for (const block of piece.blocks) {
    // Rotate block center offset
    const rotatedCenter = rotatePoint(block.centerOffset.x, block.centerOffset.y, piece.rotation);
    const blockWorldX = piece.targetX + rotatedCenter.x;
    const blockWorldY = piece.targetY + rotatedCenter.y;

    for (const v of block.vertices) {
      // Rotate vertex home offset
      const rotatedHome = rotatePoint(v.homeOffset.x, v.homeOffset.y, piece.rotation);
      const worldX = blockWorldX + rotatedHome.x;
      const worldY = blockWorldY + rotatedHome.y;

      // Initialize positions if not set
      if (v.pos.x === 0 && v.pos.y === 0) {
        v.pos = { x: worldX, y: worldY };
        v.oldPos = { x: worldX, y: worldY };
      }
    }
  }
}

// ============================================================================
// PHYSICS
// ============================================================================

function integrateBlock(block: Block, params: PhysicsParams, dt: number): void {
  for (const v of block.vertices) {
    const vx = (v.pos.x - v.oldPos.x) * params.damping;
    const vy = (v.pos.y - v.oldPos.y) * params.damping;
    v.oldPos.x = v.pos.x;
    v.oldPos.y = v.pos.y;
    v.pos.x += vx;
    v.pos.y += vy + 10 * dt * dt;
  }
}

function applyHomeForce(piece: Piece, block: Block, params: PhysicsParams): void {
  const rotatedCenter = rotatePoint(block.centerOffset.x, block.centerOffset.y, piece.rotation);
  const blockWorldX = piece.targetX + rotatedCenter.x;
  const blockWorldY = piece.targetY + rotatedCenter.y;

  for (const v of block.vertices) {
    const rotatedHome = rotatePoint(v.homeOffset.x, v.homeOffset.y, piece.rotation);
    const targetX = blockWorldX + rotatedHome.x;
    const targetY = blockWorldY + rotatedHome.y;
    const dx = targetX - v.pos.x;
    const dy = targetY - v.pos.y;
    v.pos.x += dx * params.homeStiffness;
    v.pos.y += dy * params.homeStiffness;
  }
}

function solveBlockConstraints(block: Block, params: PhysicsParams): void {
  for (const spring of block.springs) {
    const a = block.vertices[spring.a];
    const b = block.vertices[spring.b];
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
}

function applyBlockPressure(block: Block, params: PhysicsParams): void {
  const n = block.vertices.length;
  let currentArea = 0;
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    currentArea += block.vertices[i].pos.x * block.vertices[next].pos.y;
    currentArea -= block.vertices[next].pos.x * block.vertices[i].pos.y;
  }
  currentArea = Math.abs(currentArea) / 2;
  const pressureError = (block.restArea - currentArea) / block.restArea;
  const pressureForce = pressureError * params.pressure * 0.1;

  // Calculate centroid
  let cx = 0, cy = 0;
  for (const v of block.vertices) {
    cx += v.pos.x;
    cy += v.pos.y;
  }
  cx /= n;
  cy /= n;

  for (const v of block.vertices) {
    const dx = v.pos.x - cx;
    const dy = v.pos.y - cy;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0.0001) {
      v.pos.x += (dx / len) * pressureForce;
      v.pos.y += (dy / len) * pressureForce;
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

function getBlockPath(vertices: Vertex[]): string {
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

export function SoftBodyProto5() {
  const svgRef = useRef<SVGSVGElement>(null);
  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const piecesRef = useRef<Piece[]>([]);
  const dragIndexRef = useRef<number | null>(null);
  const dragOffsetRef = useRef<Vec2>({ x: 0, y: 0 });

  const [physics] = useState<PhysicsParams>(DEFAULT_PHYSICS);
  const [filterParams, setFilterParams] = useState<FilterParams>(FILTER_PRESETS.aggressive);
  const [activePreset, setActivePreset] = useState<string>('aggressive');
  const [, forceUpdate] = useState({});

  // Initialize pieces
  useEffect(() => {
    const pieces: Piece[] = [
      createPiece(180, 250, 'T', '#e74c3c'),  // Red T-tetromino
      createPiece(380, 250, 'U', '#e74c3c'),  // Red U-pentomino (same color for merge)
    ];
    piecesRef.current = pieces;
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

      for (const piece of piecesRef.current) {
        for (const block of piece.blocks) {
          integrateBlock(block, physics, dt);
          applyHomeForce(piece, block, physics);
          for (let i = 0; i < physics.iterations; i++) {
            solveBlockConstraints(block, physics);
          }
          applyBlockPressure(block, physics);
        }
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

    for (let i = 0; i < piecesRef.current.length; i++) {
      const piece = piecesRef.current[i];
      const dx = x - piece.targetX;
      const dy = y - piece.targetY;
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

    piecesRef.current[dragIndexRef.current].targetX = x;
    piecesRef.current[dragIndexRef.current].targetY = y;
  }, []);

  const handlePointerUp = useCallback(() => {
    dragIndexRef.current = null;
  }, []);

  const rotatePiece = (index: number) => {
    const piece = piecesRef.current[index];
    piece.rotation = (piece.rotation + 90) % 360;
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
      <h2 style={{ margin: '0 0 10px 0' }}>Proto-5: Goo Filter Variations</h2>
      <p style={{ margin: '0 0 20px 0', opacity: 0.7, fontSize: 14 }}>
        Drag pieces to overlap. Use Rotate buttons. Both pieces are same color for merge test.
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

      {/* Filter sliders + Rotate buttons */}
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
            onClick={() => rotatePiece(0)}
            style={{ padding: '8px 12px', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            Rotate T
          </button>
          <button
            onClick={() => rotatePiece(1)}
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
          <filter id="goo-filter" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation={filterParams.stdDeviation} result="blur" />
            <feColorMatrix in="blur" mode="matrix" values={getFilterMatrix()} result="goo" />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>

        {/* Labels */}
        <text x={180} y={30} fill="#fff" fontSize={14} textAnchor="middle" opacity={0.7}>T-tetromino</text>
        <text x={380} y={30} fill="#fff" fontSize={14} textAnchor="middle" opacity={0.7}>U-pentomino</text>

        {/* All pieces in one filtered group (same color = should merge) */}
        <g filter={filterParams.enabled ? 'url(#goo-filter)' : undefined}>
          {piecesRef.current.map((piece, pi) =>
            piece.blocks.map((block, bi) => (
              <path
                key={`${pi}-${bi}`}
                d={getBlockPath(block.vertices)}
                fill={piece.color}
                stroke={piece.color}
                strokeWidth={2}
              />
            ))
          )}
        </g>

        {/* Center markers */}
        {piecesRef.current.map((piece, i) => (
          <circle
            key={`center-${i}`}
            cx={piece.targetX}
            cy={piece.targetY}
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
        <strong>Goal:</strong> Find filter settings where blocks within a piece merge smoothly,
        AND where two pieces overlap their blocks also merge into one membrane.
        <br /><br />
        <strong>Test:</strong> Drag the T into the U's alcove. Rotate pieces. Watch how blocks merge visually.
      </div>
    </div>
  );
}
