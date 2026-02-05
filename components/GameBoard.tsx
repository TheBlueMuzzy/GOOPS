// --- Imports ---
import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { GameState, GoopState, TankSystem, ScreenType, GoopTemplate, DumpPiece, Crack } from '../types';
import { TANK_VIEWPORT_WIDTH, TANK_VIEWPORT_HEIGHT, COLORS, TANK_WIDTH, TANK_HEIGHT, BUFFER_HEIGHT, PER_BLOCK_DURATION } from '../constants';
import { normalizeX, getGhostY, getPaletteForRank } from '../utils/gameLogic';
import { isMobile } from '../utils/device';
import { HudMeter } from './HudMeter';
import { VIEWBOX, BLOCK_SIZE, visXToScreenX } from '../utils/coordinateTransform';
import { useInputHandlers } from '../hooks/useInputHandlers';
import { getBlobPath, getContourPath, buildRenderableGroups } from '../utils/goopRenderer';
import { gameEventBus } from '../core/events/EventBus';
import { GameEventType, SwapHoldPayload } from '../core/events/GameEvents';
import { ActiveAbilityCircle } from './ActiveAbilityCircle';
import { PiecePreview } from './PiecePreview';
import { UPGRADES } from '../constants';
import { UseSoftBodyPhysicsReturn } from '../hooks/useSoftBodyPhysics';
import { Vec2, SoftBlob, PhysicsParams } from '../core/softBody/types';
import {
  getSoftBlobPath,
  getPath,
  getInsetPath,
  getBounds,
  FilterParams,
  DEFAULT_FILTER,
  getFilterMatrix,
} from '../core/softBody/rendering';
import { CYLINDER_WIDTH_PIXELS, PHYSICS_CELL_SIZE, PHYSICS_GRID_OFFSET } from '../core/softBody/blobFactory';
import './GameBoard.css';

// =============================================================================
// Edge-Straddling Blob Detection
// =============================================================================

/**
 * Calculate render offsets for a blob to make it visible in the viewport.
 * Returns array of X offsets to apply when rendering.
 *
 * Since physics doesn't wrap, blobs can exist at any X position.
 * We check if the blob (or shifted copies) would overlap the viewport.
 * ClipPath handles masking - we just need to render at positions that overlap.
 */
function getBlobRenderOffsets(blob: SoftBlob): number[] {
  if (blob.vertices.length < 3) return [0];

  // Get blob's X extent
  const xs = blob.vertices.map(v => v.pos.x);
  const blobMinX = Math.min(...xs);
  const blobMaxX = Math.max(...xs);

  // Viewport bounds (from VIEWBOX)
  const viewportMinX = -180;
  const viewportMaxX = 180;

  // Check which render positions would overlap the viewport
  const offsets: number[] = [];
  const cylinderWidth = CYLINDER_WIDTH_PIXELS; // 900

  // Check original position and ±1 cylinder width
  for (const offset of [0, cylinderWidth, -cylinderWidth]) {
    const shiftedMinX = blobMinX + offset;
    const shiftedMaxX = blobMaxX + offset;

    // Does this shifted position overlap the viewport?
    if (shiftedMaxX >= viewportMinX && shiftedMinX <= viewportMaxX) {
      offsets.push(offset);
    }
  }

  // Debug: Log when blob straddles seam (needs multiple render positions)
  if (offsets.length > 1) {
    console.log(`Blob ${blob.id} straddles seam, rendering at offsets:`, offsets,
      `(X range: ${blobMinX.toFixed(0)} to ${blobMaxX.toFixed(0)})`);
  }

  // If no overlap at all (shouldn't happen normally), return original
  return offsets.length > 0 ? offsets : [0];
}

// --- Props Interface ---
// Input callbacks removed - now handled via EventBus (see Game.tsx subscriptions)
interface GameBoardProps {
  state: GameState;
  rank: number;
  maxTime: number;
  lightsBrightness?: number; // 5-110: brightness level (100 = normal, lower = dimmer, 110 = overflare)
  laserCharge?: number;  // HUD meter: 0-100 (100 = full)
  controlsHeat?: number;    // HUD meter: 0-100 (0 = cool)
  complicationCooldowns?: Record<TankSystem, number>;  // Cooldown timestamps
  equippedActives?: string[];  // Active ability IDs equipped
  activeCharges?: Record<string, number>;  // Active ID -> charge (0-100)
  onActivateAbility?: (upgradeId: string) => void;  // Called when ability activated
  powerUps?: Record<string, number>;  // Upgrade levels for GOOP_SWAP effect
  storedGoop?: GoopTemplate | null;  // Held goop for preview
  nextGoop?: GoopTemplate | null;    // Next goop for preview
  softBodyPhysics?: UseSoftBodyPhysicsReturn;  // Soft-body physics for blob rendering (Phase 26)
  normalGoopOpacity?: number;  // 0-1, for fading normal goop to see SBGs (debug)
  showVertexDebug?: boolean;   // Show numbered vertices on SBGs (debug)
}

// --- Component ---
export const GameBoard: React.FC<GameBoardProps> = ({
    state, rank, maxTime, lightsBrightness = 100,
    laserCharge = 100, controlsHeat = 0, complicationCooldowns,
    equippedActives = [], activeCharges = {}, onActivateAbility,
    powerUps, storedGoop, nextGoop, softBodyPhysics, normalGoopOpacity = 1, showVertexDebug = false
}) => {
  const { grid, tankRotation, activeGoop, looseGoop, floatingTexts, shiftTime, goalMarks, crackCells, dumpPieces } = state;

  const palette = useMemo(() => getPaletteForRank(rank), [rank]);

  // --- Derived Values ---
  const tankPressure = useMemo(() => {
    if (shiftTime <= 0) return 1;
    return Math.max(0, 1 - (shiftTime / maxTime));
  }, [shiftTime, maxTime]);

  const pressureHue = Math.max(0, 120 * (1 - tankPressure));
  const pressureColor = `hsla(${pressureHue}, 100%, 50%, 0.15)`;

  const waterHeightBlocks = 1 + (tankPressure * (TANK_VIEWPORT_HEIGHT - 1));

  // ViewBox values from module-level constants (no useMemo needed - these never change)
  const { x: vbX, y: vbY, w: vbW, h: vbH } = VIEWBOX;

  const waterHeightPx = waterHeightBlocks * BLOCK_SIZE;
  const waterTopY = vbH - waterHeightPx;

  // Use imported coordinate transform functions (pure functions, no hooks needed)
  const getScreenPercentCoords = useCallback((gridX: number, gridY: number) => {
      let visX = gridX - tankRotation;
      if (visX > TANK_WIDTH / 2) visX -= TANK_WIDTH;
      if (visX < -TANK_WIDTH / 2) visX += TANK_WIDTH;

      const svgX = visXToScreenX(visX);
      const svgY = (gridY - BUFFER_HEIGHT) * BLOCK_SIZE + (BLOCK_SIZE / 2);

      const pctX = ((svgX - vbX) / vbW) * 100;
      const pctY = ((svgY - vbY) / vbH) * 100;

      return { x: pctX, y: pctY };
  }, [tankRotation]); // Only tankRotation changes - vbX/vbY/vbW/vbH are constants

  // --- INPUT HANDLING (via hook) ---
  // Events are now emitted via EventBus, subscribed in Game.tsx
  const { handlers, holdState, highlightedGroupId, shakingGroupId } = useInputHandlers({
      callbacks: {}, // Callbacks optional - events emitted regardless
      tankRotation,
      grid,
      tankPressure,
      powerUps  // For GOOP_SWAP: reduces hold-to-swap duration
  });

  // --- KEYBOARD SWAP HOLD (via EventBus) ---
  // Keyboard R key hold emits events from Game.tsx, we show the visual here
  const [keyboardSwapProgress, setKeyboardSwapProgress] = useState(-1);

  // --- Soft-Body Blob Render Trigger ---
  // The physics hook uses refs, so we need state to trigger re-renders when blobs change
  const [blobRenderKey, setBlobRenderKey] = useState(0);
  useEffect(() => {
      const unsub = gameEventBus.on<SwapHoldPayload>(GameEventType.INPUT_SWAP_HOLD, (p) => {
          setKeyboardSwapProgress(p?.progress ?? -1);
      });
      return unsub;
  }, []);

  // --- Soft-Body Blob Sync (Phase 26) ---
  // Sync soft-body blobs with current grid state
  // Key insight: blobs should persist even when off-screen, only removed when popped
  useEffect(() => {
      if (!softBodyPhysics || isMobile) return;

      // 1. Scan FULL grid to get ALL goopGroupIds that exist (for removal check)
      // This prevents blobs from being removed just because they're off-screen
      const allGroupIds = new Set<string>();
      for (let gridY = BUFFER_HEIGHT; gridY < TANK_HEIGHT; gridY++) {
          for (let gridX = 0; gridX < TANK_WIDTH; gridX++) {
              const cell = grid[gridY]?.[gridX];
              if (cell?.goopGroupId) {
                  allGroupIds.add(cell.goopGroupId);
              }
          }
      }

      // 2. Collect VISIBLE goopGroupIds and their cells (for blob creation only)
      // Grid is indexed as grid[y][x], matching buildRenderableGroups
      const visibleGroups = new Map<string, { cells: Vec2[]; color: string }>();
      for (let visY = 0; visY < TANK_VIEWPORT_HEIGHT; visY++) {
          const gridY = visY + BUFFER_HEIGHT;
          for (let visX = 0; visX < TANK_VIEWPORT_WIDTH; visX++) {
              const gridX = (tankRotation + visX) % TANK_WIDTH;
              const cell = grid[gridY]?.[gridX];
              // Only process cells with goopGroupId (locked goop)
              if (cell?.goopGroupId) {
                  const groupId = cell.goopGroupId;
                  if (!visibleGroups.has(groupId)) {
                      visibleGroups.set(groupId, { cells: [], color: cell.color });
                  }
                  visibleGroups.get(groupId)!.cells.push({ x: visX, y: visY });
              }
          }
      }

      // 3. Create blobs for NEW groups that we haven't seen before
      // Blobs are only created when first visible (when piece locks, it should be fully visible)
      const existingIds = new Set(softBodyPhysics.blobs.map(b => b.id));
      let changed = false;
      for (const [groupId, data] of visibleGroups) {
          if (!existingIds.has(groupId)) {
              softBodyPhysics.createBlob(data.cells, data.color, groupId, true, tankRotation);
              changed = true;
          }
      }

      // 4. Shift existing blob positions when tank rotation changes
      // Use shiftBlobsForRotation which handles cylindrical wrapping correctly
      // This replaces the old approach of recalculating from visible cells
      softBodyPhysics.shiftBlobsForRotation(tankRotation);

      // 5. Sync loose goop positions - blobs falling after pop need animated targetY
      // Build map of goopGroupId -> average Y position from looseGoop array
      const looseGoopMap = new Map<string, { avgY: number; cells: { x: number; y: number }[] }>();
      for (const lg of looseGoop) {
          const gid = lg.data.goopGroupId;
          if (!looseGoopMap.has(gid)) {
              looseGoopMap.set(gid, { avgY: 0, cells: [] });
          }
          looseGoopMap.get(gid)!.cells.push({ x: lg.x, y: lg.y });
      }
      // Calculate average Y for each loose goopGroup
      for (const [gid, data] of looseGoopMap) {
          const avgY = data.cells.reduce((sum, c) => sum + c.y, 0) / data.cells.length;
          data.avgY = avgY;
      }

      // Update blobs that are loose - set isLoose flag and update targetY
      for (const blob of softBodyPhysics.blobs) {
          const looseData = looseGoopMap.get(blob.id);
          if (looseData) {
              // This blob is loose goop - update its target position
              blob.isLoose = true;
              blob.isLocked = false;
              // Convert looseGoop's Y (grid units) to pixel position
              // looseGoop.y is in grid coordinates (with BUFFER_HEIGHT included)
              // We need to convert to physics pixel space
              const physicsY = (looseData.avgY - BUFFER_HEIGHT) * PHYSICS_CELL_SIZE;
              blob.targetY = physicsY;
          } else if (blob.isLoose) {
              // Was loose but no longer in looseGoop array - must have landed
              blob.isLoose = false;
              blob.isLocked = true;
              blob.fillAmount = 0; // Start fill animation again
          }
      }

      // 6. Remove blobs ONLY when the goopGroupId no longer exists in the FULL grid
      // AND is not currently falling as loose goop (i.e., truly popped)
      // Loose goop keeps its goopGroupId but is removed from grid temporarily
      const looseGoopIds = new Set(looseGoop.map(lg => lg.data.goopGroupId));
      for (const blob of softBodyPhysics.blobs) {
          if (!allGroupIds.has(blob.id) && !looseGoopIds.has(blob.id)) {
              // Only create droplets if this was an explicit pop (not merge/consolidation)
              // Merge removes the blob but shouldn't spawn droplets
              if (state.poppedGoopGroupIds.has(blob.id)) {
                  softBodyPhysics.createDropletsForPop(blob);
                  // Remove from set to prevent duplicate droplets and memory buildup
                  state.poppedGoopGroupIds.delete(blob.id);
              }
              softBodyPhysics.removeBlob(blob.id);
              changed = true;
          }
      }

      // Trigger re-render if blobs changed (since physics uses refs, not state)
      if (changed) {
          setBlobRenderKey(k => k + 1);
      }
  }, [grid, tankRotation, softBodyPhysics]);

  // --- Active Piece Soft-Body Blob (Phase 27) ---
  // Create a soft-body blob for the active falling piece
  // Track previous activeGoop to detect lock transitions (using spawnTimestamp as unique ID)
  const prevActiveGoopRef = useRef<typeof activeGoop>(null);

  // Create blob when new active piece spawns (falling state)
  useEffect(() => {
      if (!softBodyPhysics || isMobile) return;
      if (!activeGoop || activeGoop.state !== GoopState.FALLING) return;

      // Use spawnTimestamp as unique ID since ActivePiece doesn't have an id field
      const blobId = `active-${activeGoop.spawnTimestamp}`;
      const existingBlob = softBodyPhysics.getBlob(blobId);

      // Create blob if it doesn't exist
      if (!existingBlob) {
          // Convert piece cells to absolute grid coordinates (in visual space)
          const cells = activeGoop.cells.map(cell => ({
              x: cell.x,  // Relative to piece origin, converted to visual space below
              y: cell.y
          }));

          // For the visual position, we use the piece's visual X (relative to rotation)
          // The blob needs cells in visual grid coordinates (0-11 for visible area)
          let visX = activeGoop.x - tankRotation;
          if (visX > TANK_WIDTH / 2) visX -= TANK_WIDTH;
          if (visX < -TANK_WIDTH / 2) visX += TANK_WIDTH;

          // Convert to visual grid cells
          const visualCells = cells.map(cell => ({
              x: visX + cell.x,
              y: (activeGoop.y + cell.y) - BUFFER_HEIGHT
          }));

          // Get color (handle multi-color pieces by using first cell color)
          const color = activeGoop.definition.cellColors?.[0] ?? activeGoop.definition.color;

          softBodyPhysics.createBlob(visualCells, color, blobId, false, tankRotation);
          setBlobRenderKey(k => k + 1);
      }
  }, [activeGoop?.spawnTimestamp, softBodyPhysics, tankRotation]);

  // Update blob position every frame while falling
  useEffect(() => {
      if (!softBodyPhysics || isMobile) return;
      if (!activeGoop || activeGoop.state !== GoopState.FALLING) return;

      const blobId = `active-${activeGoop.spawnTimestamp}`;
      const blob = softBodyPhysics.getBlob(blobId);
      if (!blob) return;

      // Calculate piece center in visual coordinates
      let visX = activeGoop.x - tankRotation;
      if (visX > TANK_WIDTH / 2) visX -= TANK_WIDTH;
      if (visX < -TANK_WIDTH / 2) visX += TANK_WIDTH;

      // Calculate centroid of piece cells
      const cells = activeGoop.cells;
      let sumX = 0, sumY = 0;
      for (const cell of cells) {
          sumX += visX + cell.x;
          sumY += (activeGoop.y + cell.y) - BUFFER_HEIGHT;
      }
      const centerX = sumX / cells.length;
      const centerY = sumY / cells.length;

      // Grid to pixel: PHYSICS_GRID_OFFSET + (grid + 0.5) * PHYSICS_CELL_SIZE
      const targetX = PHYSICS_GRID_OFFSET.x + (centerX + 0.5) * PHYSICS_CELL_SIZE;
      const targetY = PHYSICS_GRID_OFFSET.y + (centerY + 0.5) * PHYSICS_CELL_SIZE;

      softBodyPhysics.updateBlobTarget(blobId, targetX, targetY);
  }, [activeGoop?.x, activeGoop?.y, activeGoop?.state, softBodyPhysics, tankRotation]);

  // Handle lock transition: remove falling blob when piece locks
  useEffect(() => {
      if (!softBodyPhysics || isMobile) return;

      const prevPiece = prevActiveGoopRef.current;
      const currPiece = activeGoop;

      // Piece locked: was falling, now null or new piece
      if (prevPiece && prevPiece.state === GoopState.FALLING &&
          (!currPiece || currPiece.spawnTimestamp !== prevPiece.spawnTimestamp)) {
          const blobId = `active-${prevPiece.spawnTimestamp}`;

          // Remove the falling blob — locked goop sync will create a new blob for locked cells
          softBodyPhysics.removeBlob(blobId);
          setBlobRenderKey(k => k + 1);
      }

      prevActiveGoopRef.current = currPiece;
  }, [activeGoop, softBodyPhysics]);

  const now = Date.now();

  // --- Render Groups Preparation (via utility function) ---
  const groups = useMemo(
      () => buildRenderableGroups(grid, tankRotation, looseGoop),
      [grid, tankRotation, looseGoop]
  );

  // Wild color cycling - wave effect moving left to right
  // Each X position shows a different phase of the color cycle
  const getWildColorAtX = useCallback((screenX: number) => {
      if (palette.length === 0) return '#a855f7'; // Fallback

      const cycleSpeed = 400; // ms per color
      const waveSpeed = 0.02; // How much X position offsets the phase (lower = wider wave)

      // Time-based phase plus X-based offset for wave effect
      const basePhase = (now % (palette.length * cycleSpeed)) / cycleSpeed;
      const xOffset = Math.abs(screenX) * waveSpeed; // Use abs to avoid negative modulo issues
      // Ensure positive modulo result
      let t = (basePhase + xOffset) % palette.length;
      if (t < 0) t += palette.length;

      const index = Math.floor(t);
      const nextIndex = (index + 1) % palette.length;
      const blend = t - index; // 0 to 1 blend factor

      // Lerp between current and next color
      const c1 = palette[index];
      const c2 = palette[nextIndex];

      if (!c1 || !c2) return '#a855f7'; // Fallback if palette access fails

      // Parse hex colors and lerp
      const r1 = parseInt(c1.slice(1, 3), 16);
      const g1 = parseInt(c1.slice(3, 5), 16);
      const b1 = parseInt(c1.slice(5, 7), 16);
      const r2 = parseInt(c2.slice(1, 3), 16);
      const g2 = parseInt(c2.slice(3, 5), 16);
      const b2 = parseInt(c2.slice(5, 7), 16);

      const r = Math.round(r1 + (r2 - r1) * blend);
      const g = Math.round(g1 + (g2 - g1) * blend);
      const b = Math.round(b1 + (b2 - b1) * blend);

      return `rgb(${r}, ${g}, ${b})`;
  }, [now, palette]);

  // OPTIMIZATION: Skip masks entirely on mobile - they're very expensive
  const maskDefinitions = useMemo(() => {
      if (isMobile) return null;
      return (
          <defs>
              {Array.from(groups.entries()).map(([gid, cells]) => (
                  <mask key={`mask-${gid}`} id={`mask-${gid}`}>
                      {cells.map((c, i) => (
                           <path
                              key={c.cell.id + '-' + i}
                              d={getBlobPath(c.screenX, c.screenY, c.width, BLOCK_SIZE, c.neighbors)}
                              fill="white"
                              stroke="white"
                              strokeWidth="1.5"
                           />
                      ))}
                  </mask>
              ))}
          </defs>
      );
  }, [groups]);

  const activeColors = useMemo(() => new Set(goalMarks.map(m => m.color)), [goalMarks]);
  const flyingOrbs = goalMarks.filter(m => now - m.spawnTime < 500);

  // Piece preview visibility based on upgrades
  const showHoldViewer = (powerUps?.['GOOP_HOLD_VIEWER'] || 0) >= 1;
  const showNextWindow = (powerUps?.['GOOP_WINDOW'] || 0) >= 1;

  // --- Rendering ---
  return (
    <div
        // OPTIMIZATION: 'contain: strict' improves paint performance by isolating the board
        className="w-full h-full bg-slate-950 relative shadow-2xl border-x-4 border-slate-900 overflow-hidden select-none touch-none"
        style={{ touchAction: 'manipulation', contain: 'strict' }}
        onPointerDown={handlers.onPointerDown}
        onPointerMove={handlers.onPointerMove}
        onPointerUp={handlers.onPointerUp}
        onPointerLeave={handlers.onPointerUp}
        // iOS WebKit touch fallback (Pointer Events unreliable on iOS Chrome/Safari)
        onTouchStart={handlers.onTouchStart}
        onTouchMove={handlers.onTouchMove}
        onTouchEnd={handlers.onTouchEnd}
        onTouchCancel={handlers.onTouchCancel}
    >
        {/* OPTIMIZATION: CRT Scanline disabled on mobile */}
        {!isMobile && (
            <div 
                className="absolute inset-0 pointer-events-none z-10 opacity-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] hidden md:block" 
                style={{
                    backgroundSize: "100% 2px, 3px 100%"
                }} 
            />
        )}

        <svg
            width="100%"
            height="100%"
            viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
            preserveAspectRatio="xMidYMin meet"
            className="touch-none"
            style={{
                pointerEvents: 'none', // Let touches pass through to parent div (iOS fix)
                willChange: 'transform', // OPTIMIZATION: Promote to compositor layer
                filter: lightsBrightness < 100
                    ? `brightness(${lightsBrightness / 100}) grayscale(${Math.max(0, (50 - lightsBrightness) / 50)})`
                    : lightsBrightness > 100
                        ? `brightness(${lightsBrightness / 100})`
                        : undefined,
                transition: 'filter 0.05s linear' // Smooth brightness changes
            }}
        >
            {maskDefinitions}

            {/* Soft-body goo filter - creates blobby merge effect (Phase 26) */}
            {/* stdDeviation 12 helps merge seam-straddling blob copies */}
            <defs>
              <filter id="goo-filter" colorInterpolationFilters="sRGB">
                <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
                <feColorMatrix
                  in="blur"
                  mode="matrix"
                  values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 25 -15"
                  result="goo"
                />
                <feComposite in="SourceGraphic" in2="goo" operator="atop" />
              </filter>
              {/* Tank viewport clipPath - masks soft-body blobs to visible area */}
              <clipPath id="tank-viewport-clip">
                <rect x={VIEWBOX.x} y={VIEWBOX.y} width={VIEWBOX.w} height={VIEWBOX.h} />
              </clipPath>
            </defs>

            {/* Background Layers */}
            <rect x={vbX} y={waterTopY} width={vbW} height={waterHeightPx} fill={pressureColor} />
            <line x1={vbX} y1={waterTopY} x2={vbX + vbW} y2={waterTopY} stroke={pressureColor.replace('0.15', '0.6')} strokeWidth="2" strokeDasharray="4 4" />

            {/* Grid & Goals - Skip grid lines on mobile for performance */}
            {!isMobile && Array.from({length: TANK_VIEWPORT_HEIGHT}).map((_, yIdx) => {
                const yPos = yIdx * BLOCK_SIZE;
                return Array.from({length: TANK_VIEWPORT_WIDTH}).map((_, visX) => {
                    const startX = visXToScreenX(visX);
                    const width = visXToScreenX(visX+1) - startX;
                    return (
                        <g key={`bg-${yIdx}-${visX}`}>
                            <line x1={startX} y1={yPos} x2={startX+width} y2={yPos} stroke={COLORS.GRID_EMPTY} strokeWidth="1" opacity={0.2} />
                            <line x1={startX} y1={yPos} x2={startX} y2={yPos+BLOCK_SIZE} stroke={COLORS.GRID_EMPTY} strokeWidth="1" opacity={0.2} />
                        </g>
                    );
                });
            })}
            {/* Crack Connection Lines - render lines between parent/child crack cells */}
            {crackCells && crackCells.filter(c => now - c.spawnTime >= 500).map(cell => {
                // Draw lines to all children (avoids duplicate lines)
                return cell.branchCrackIds.map(childId => {
                    const child = crackCells.find(c => c.id === childId);
                    if (!child || now - child.spawnTime < 500) return null;

                    // Convert cell positions to screen coordinates
                    let visX1 = cell.x - tankRotation;
                    if (visX1 > TANK_WIDTH / 2) visX1 -= TANK_WIDTH;
                    if (visX1 < -TANK_WIDTH / 2) visX1 += TANK_WIDTH;

                    let visX2 = child.x - tankRotation;
                    if (visX2 > TANK_WIDTH / 2) visX2 -= TANK_WIDTH;
                    if (visX2 < -TANK_WIDTH / 2) visX2 += TANK_WIDTH;

                    // Both cells must be at least partially visible
                    if (visX1 < -1 || visX1 > TANK_VIEWPORT_WIDTH ||
                        visX2 < -1 || visX2 > TANK_VIEWPORT_WIDTH) return null;

                    const startX1 = visXToScreenX(visX1);
                    const width1 = visXToScreenX(visX1 + 1) - startX1;
                    const centerX1 = startX1 + width1 / 2;
                    const centerY1 = (cell.y - BUFFER_HEIGHT) * BLOCK_SIZE + BLOCK_SIZE / 2;

                    const startX2 = visXToScreenX(visX2);
                    const width2 = visXToScreenX(visX2 + 1) - startX2;
                    const centerX2 = startX2 + width2 / 2;
                    const centerY2 = (child.y - BUFFER_HEIGHT) * BLOCK_SIZE + BLOCK_SIZE / 2;

                    return (
                        <line
                            key={`crack-line-${cell.id}-${childId}`}
                            x1={centerX1}
                            y1={centerY1}
                            x2={centerX2}
                            y2={centerY2}
                            stroke={cell.color}
                            strokeWidth="2"
                            strokeOpacity={0.7}
                        />
                    );
                });
            })}
            {/* Crack Cell Circles - render circle at each crack cell position */}
            {crackCells && crackCells.filter(c => now - c.spawnTime >= 500).map(cell => {
                let visX = cell.x - tankRotation;
                if (visX > TANK_WIDTH / 2) visX -= TANK_WIDTH;
                if (visX < -TANK_WIDTH / 2) visX += TANK_WIDTH;

                if (visX >= 0 && visX < TANK_VIEWPORT_WIDTH) {
                    const startX = visXToScreenX(visX);
                    const width = visXToScreenX(visX + 1) - startX;
                    const yPos = (cell.y - BUFFER_HEIGHT) * BLOCK_SIZE;
                    const centerX = startX + width / 2;
                    const centerY = yPos + BLOCK_SIZE / 2;
                    return (
                        <circle
                            key={`crack-${cell.id}`}
                            cx={centerX}
                            cy={centerY}
                            r={BLOCK_SIZE / 4}
                            fill={cell.color}
                            stroke="white"
                            strokeWidth="1"
                            strokeOpacity={0.5}
                        />
                    );
                }
                return null;
            })}

            {/* Goal Marks - always render */}
            {goalMarks.filter(m => now - m.spawnTime >= 500).map(mark => {
                let visX = mark.x - tankRotation;
                if (visX > TANK_WIDTH / 2) visX -= TANK_WIDTH;
                if (visX < -TANK_WIDTH / 2) visX += TANK_WIDTH;

                if (visX >= 0 && visX < TANK_VIEWPORT_WIDTH) {
                    const startX = visXToScreenX(visX);
                    const width = visXToScreenX(visX+1) - startX;
                    const yPos = (mark.y - BUFFER_HEIGHT) * BLOCK_SIZE;
                    const centerX = startX + width / 2;
                    const centerY = yPos + BLOCK_SIZE / 2;
                    return (
                        <circle key={`goal-${mark.id}`} cx={centerX} cy={centerY} r={BLOCK_SIZE / 4} fill={mark.color} stroke="white" strokeWidth="1" strokeOpacity={0.5} />
                    );
                }
                return null;
            })}

            {/* Offscreen Indicators */}
            {goalMarks.map(mark => {
                const centerCol = normalizeX(tankRotation + TANK_VIEWPORT_WIDTH / 2);
                let diff = mark.x - centerCol;
                if (diff > TANK_WIDTH / 2) diff -= TANK_WIDTH;
                if (diff < -TANK_WIDTH / 2) diff += TANK_WIDTH;
                
                if (Math.abs(diff) > TANK_VIEWPORT_WIDTH / 2) {
                    const isRight = diff > 0;
                    const yPos = (mark.y - BUFFER_HEIGHT) * BLOCK_SIZE + (BLOCK_SIZE / 2);
                    const xPos = isRight ? (vbX + vbW - 5) : (vbX + 5);
                    return (
                        <g key={`off-${mark.id}`} opacity={0.7}>
                             <path d={isRight ? `M ${xPos} ${yPos - 10} L ${xPos + 10} ${yPos} L ${xPos} ${yPos + 10} Z` : `M ${xPos} ${yPos - 10} L ${xPos - 10} ${yPos} L ${xPos} ${yPos + 10} Z`} fill={mark.color} stroke="white" strokeWidth="1" />
                        </g>
                    );
                }
                return null;
            })}

            {/* Main Goop Groups */}
            <g opacity={normalGoopOpacity}>
            {Array.from(groups.entries()).map(([gid, cells]) => {
                if (cells.length === 0) return null;
                const sample = cells[0];
                const color = sample.color;
                const isHighlighted = gid === highlightedGroupId;
                const isShaking = gid === shakingGroupId || state.prePoppedGoopGroups.has(gid); // Shake pre-popped groups too
                const isSealingGoop = cells.some(c => c.cell.isSealingGoop);
                const isPrePopped = state.prePoppedGoopGroups.has(gid); // LASER effect: pre-popped, waiting for 2nd tap
                const hasWildCells = cells.some(c => c.cell.isWild);

                // Calculate bounds FIRST (before using minX for fillColor)
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                cells.forEach(c => {
                    minX = Math.min(minX, c.screenX);
                    minY = Math.min(minY, c.screenY);
                    maxX = Math.max(maxX, c.screenX + c.width);
                    maxY = Math.max(maxY, c.screenY + BLOCK_SIZE);
                });

                // For background rect, use a single color (first cell's wild color or group color)
                const fillColor = hasWildCells ? getWildColorAtX(minX) : color;

                // Mobile: simplified rendering without masks, but with connected look
                if (isMobile) {
                    const totalDuration = cells[0].cell.groupSize * PER_BLOCK_DURATION;
                    const elapsed = now - cells[0].cell.timestamp;
                    const fillProgress = Math.min(1, elapsed / totalDuration);
                    const isFilled = fillProgress >= 1;

                    // Calculate fill line Y position (fills from bottom to top)
                    const groupHeight = maxY - minY;
                    const fillLineY = maxY - (fillProgress * groupHeight);

                    return (
                        <g key={`group-${gid}`} className={isShaking ? "shake-anim" : ""}>
                            {/* Unfilled background - dim */}
                            {cells.map((c) => (
                                <rect
                                    key={`bg-${c.cell.id}`}
                                    x={c.screenX - 0.5}
                                    y={c.screenY}
                                    width={c.width + 1}
                                    height={BLOCK_SIZE}
                                    fill={c.cell.isWild ? getWildColorAtX(c.screenX) : color}
                                    fillOpacity={0.25}
                                />
                            ))}
                            {/* Filled portion - bright, clips to fill line */}
                            {!isFilled && cells.map((c) => {
                                const cellBottom = c.screenY + BLOCK_SIZE;
                                const cellTop = c.screenY;
                                // Only render fill if this cell is at least partially below fill line
                                if (cellBottom <= fillLineY) return null;
                                const fillTop = Math.max(cellTop, fillLineY);
                                const fillHeight = cellBottom - fillTop;
                                return (
                                    <rect
                                        key={`fill-${c.cell.id}`}
                                        x={c.screenX - 0.5}
                                        y={fillTop}
                                        width={c.width + 1}
                                        height={fillHeight}
                                        fill={c.cell.isWild ? getWildColorAtX(c.screenX) : color}
                                        fillOpacity={0.75}
                                    />
                                );
                            })}
                            {/* When fully filled, show full bright */}
                            {isFilled && cells.map((c) => (
                                <rect
                                    key={`full-${c.cell.id}`}
                                    x={c.screenX - 0.5}
                                    y={c.screenY}
                                    width={c.width + 1}
                                    height={BLOCK_SIZE}
                                    fill={c.cell.isWild ? getWildColorAtX(c.screenX) : color}
                                    fillOpacity={0.85}
                                />
                            ))}
                            {/* Contour - draws connected outline */}
                            {cells.map((c) => (
                                <path
                                    key={`cnt-${c.cell.id}`}
                                    d={getContourPath(c.screenX, c.screenY, c.width, BLOCK_SIZE, c.neighbors)}
                                    fill="none"
                                    stroke={isPrePopped ? "#ff6b6b" : (isSealingGoop ? "white" : (c.cell.isWild ? getWildColorAtX(c.screenX) : color))}
                                    strokeWidth={isPrePopped ? 3 : (isSealingGoop ? 3 : 2)}
                                    strokeDasharray={isPrePopped ? "4 2" : undefined}
                                    className={c.cell.isWild && !isPrePopped && !isSealingGoop ? "wild-stroke" : undefined}
                                />
                            ))}
                            {isHighlighted && <rect x={minX} y={minY} width={maxX - minX} height={maxY - minY} fill="white" fillOpacity={0.3} />}
                        </g>
                    );
                }

                // Desktop: full rendering with masks
                return (
                    <g key={`group-${gid}`} className={isShaking ? "shake-anim" : ""}>
                        <rect x={minX} y={minY} width={maxX - minX} height={maxY - minY} fill={fillColor} fillOpacity={0.2} mask={`url(#mask-${gid})`} />
                        <g opacity={0.9} mask={`url(#mask-${gid})`}>
                            {cells.map((c, i) => {
                                const cellFill = c.cell.isWild ? getWildColorAtX(c.screenX) : color;
                                if (!c.cell || c.isFalling) {
                                    return <rect key={`liq-${c.cell.id}`} x={c.screenX - 0.5} y={c.screenY} width={c.width + 1} height={BLOCK_SIZE} fill={cellFill} />;
                                }
                                const totalDuration = c.cell.groupSize * PER_BLOCK_DURATION;
                                const groupHeight = (c.cell.groupMaxY - c.cell.groupMinY + 1);
                                const timePerRow = totalDuration / Math.max(1, groupHeight);
                                const rowIndex = c.cell.groupMaxY - c.y;
                                const startDelay = rowIndex * timePerRow;
                                const timeIntoRow = (now - c.cell.timestamp) - startDelay;
                                let fillHeight = timeIntoRow >= timePerRow ? BLOCK_SIZE : (timeIntoRow > 0 ? (timeIntoRow / timePerRow) * BLOCK_SIZE : 0);
                                return <rect key={`liq-${c.cell.id}`} x={c.screenX - 0.5} y={c.screenY + (BLOCK_SIZE - fillHeight)} width={c.width + 1} height={fillHeight} fill={cellFill} />;
                            })}
                        </g>
                        {isHighlighted && <rect x={minX} y={minY} width={maxX - minX} height={maxY - minY} fill="white" fillOpacity={0.3} mask={`url(#mask-${gid})`} />}
                        {cells.map((c, i) => (
                             <path
                                key={`cnt-${c.cell.id}`}
                                d={getContourPath(c.screenX, c.screenY, c.width, BLOCK_SIZE, c.neighbors)}
                                fill="none"
                                stroke={isPrePopped ? "#ff6b6b" : (isSealingGoop ? "white" : (c.cell.isWild ? getWildColorAtX(c.screenX) : color))}
                                strokeWidth={isPrePopped ? "3" : (isSealingGoop ? "3" : "2")}
                                strokeDasharray={isPrePopped ? "4 2" : undefined}
                                className={!isMobile && !isPrePopped ? (c.cell.isWild ? "wild-stroke" : (isSealingGoop ? "super-glowing-stroke" : "glow-stroke")) : undefined}
                                style={!isMobile && !isPrePopped && !c.cell.isWild ? { color: isSealingGoop ? 'white' : color } : undefined}
                             />
                        ))}
                    </g>
                );
            })}
            </g>

            {/* Soft-Body Blob Rendering (Phase 26 - Desktop only) */}
            {/* Renders soft-body blobs with goo filter using Catmull-Rom curves */}
            {/* Edge-straddling blobs are rendered twice (once shifted) for seamless wrap */}
            {/* clipPath masks blobs to tank viewport - prevents rendering past edges */}
            {/* Each color gets its own goo filter group so unlike colors don't visually merge */}
            {!isMobile && softBodyPhysics && softBodyPhysics.blobs.length > 0 && (() => {
              // Group blobs by color so each color gets its own goo filter
              const blobsByColor = new Map<string, typeof softBodyPhysics.blobs>();
              for (const blob of softBodyPhysics.blobs) {
                const existing = blobsByColor.get(blob.color) || [];
                existing.push(blob);
                blobsByColor.set(blob.color, existing);
              }

              return Array.from(blobsByColor.entries()).map(([color, blobs]) => (
                <g key={`color-group-${color}`} filter="url(#goo-filter)" clipPath="url(#tank-viewport-clip)">
                  {blobs.map(blob => {
                  const outerPath = getSoftBlobPath(blob);
                  const outerPoints = blob.vertices.map(v => v.pos);

                  // Calculate which positions to render blob at (handles cylindrical wrap)
                  // Physics doesn't wrap, so we render at all positions that overlap viewport
                  const renderOffsets = getBlobRenderOffsets(blob);
                  const transforms = renderOffsets.map(offset =>
                    offset === 0 ? '' : `translate(${offset}, 0)`
                  );

                  // Only show fill animation for locked blobs that aren't full
                  const showFillAnimation = blob.isLocked && blob.fillAmount < 1;

                  if (showFillAnimation) {
                    // Wall thickness for fill animation (8px default)
                    const wallThickness = 8;
                    const insetPoints = getInsetPath(outerPoints, wallThickness);
                    const insetPath = getPath(insetPoints);
                    const bounds = getBounds(insetPoints);
                    const height = bounds.maxY - bounds.minY;
                    const fillTop = bounds.maxY - height * blob.fillAmount;
                    const clipId = `fill-clip-${blob.id}`;
                    const padding = 50;

                    return (
                      <g key={`soft-${blob.id}`}>
                        {transforms.map((transform, idx) => (
                          <g key={`soft-${blob.id}-${idx}`} transform={transform}>
                            {/* Outer blob shape */}
                            <path
                              d={outerPath}
                              fill={blob.color}
                              stroke={blob.color}
                              strokeWidth="2"
                            />
                            {/* Inner cutout (unfilled region) */}
                            <defs>
                              <clipPath id={`${clipId}-${idx}`}>
                                <rect
                                  x={bounds.minX - padding}
                                  y={bounds.minY - padding}
                                  width={bounds.maxX - bounds.minX + padding * 2}
                                  height={fillTop - bounds.minY + padding}
                                />
                              </clipPath>
                            </defs>
                            <path
                              d={insetPath}
                              fill="#1e293b"
                              clipPath={`url(#${clipId}-${idx})`}
                            />
                          </g>
                        ))}
                      </g>
                    );
                  }

                  // Fully filled blob - just render outer shape (with duplicate if straddling)
                  return (
                    <g key={`soft-${blob.id}`}>
                      {transforms.map((transform, idx) => (
                        <path
                          key={`soft-${blob.id}-${idx}`}
                          d={outerPath}
                          fill={blob.color}
                          stroke={blob.color}
                          strokeWidth="2"
                          transform={transform}
                        />
                      ))}
                    </g>
                  );
                  })}
                </g>
              ));
            })()}

            {/* Droplets from popped blobs (NO goo filter - simple circles) */}
            {!isMobile && softBodyPhysics && softBodyPhysics.droplets.length > 0 && (
              <g>
                {softBodyPhysics.droplets.map(droplet => (
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
            )}

            {/* Vertex Debug Rendering (when enabled via debug panel) */}
            {showVertexDebug && !isMobile && softBodyPhysics && softBodyPhysics.blobs.length > 0 && (
              <g>
                {softBodyPhysics.blobs.map(blob => (
                  <g key={`debug-${blob.id}`}>
                    {/* Target position marker */}
                    <circle
                      cx={blob.targetX}
                      cy={blob.targetY}
                      r={4}
                      fill="yellow"
                      stroke="black"
                      strokeWidth={1}
                    />
                    {/* Edge trace lines (Proto-9 style) */}
                    {blob.vertices.map((v, i) => {
                      const next = blob.vertices[(i + 1) % blob.vertices.length];
                      return (
                        <line
                          key={`edge-${blob.id}-${i}`}
                          x1={v.pos.x} y1={v.pos.y}
                          x2={next.pos.x} y2={next.pos.y}
                          stroke="lime" strokeWidth={1} opacity={0.5}
                        />
                      );
                    })}
                    {/* Numbered vertices (Proto-9 style) */}
                    {blob.vertices.map((v, i) => (
                      <g key={`v-${blob.id}-${i}`}>
                        <circle
                          cx={v.pos.x}
                          cy={v.pos.y}
                          r={4}
                          fill="yellow"
                          stroke="black"
                          strokeWidth={1}
                        />
                        <text
                          x={v.pos.x + 6}
                          y={v.pos.y + 3}
                          fontSize={8}
                          fill="yellow"
                          stroke="black"
                          strokeWidth={0.3}
                        >
                          {i}
                        </text>
                      </g>
                    ))}
                    {/* Inner vertices (smaller, gray) */}
                    {blob.innerVertices.map((v, i) => (
                      <circle
                        key={`iv-${blob.id}-${i}`}
                        cx={v.pos.x}
                        cy={v.pos.y}
                        r={3}
                        fill="gray"
                        stroke="white"
                        strokeWidth={1}
                      />
                    ))}
                    {/* Blob state info (Proto-9 style) */}
                    <text
                      x={blob.targetX}
                      y={blob.targetY - 30}
                      fill="#fff"
                      fontSize={10}
                      textAnchor="middle"
                      opacity={0.7}
                    >
                      {blob.isLocked ? `${Math.round(blob.fillAmount * 100)}%` : 'falling'}
                    </text>
                  </g>
                ))}
              </g>
            )}

            {/* Ghost Piece */}
            {activeGoop && activeGoop.state === GoopState.FALLING && (() => {
                const ghostY = getGhostY(grid, activeGoop, tankRotation);
                const isWild = activeGoop.definition.isWild;

                return activeGoop.cells.map((cell, idx) => {
                    const color = activeGoop.definition.cellColors?.[idx] ?? activeGoop.definition.color;
                    const pieceGridX = normalizeX(activeGoop.x + cell.x);
                    const pieceGridY = ghostY + cell.y;
                    if (pieceGridY < BUFFER_HEIGHT) return null;

                    let visX = pieceGridX - tankRotation;
                    if (visX > TANK_WIDTH / 2) visX -= TANK_WIDTH;
                    if (visX < -TANK_WIDTH / 2) visX += TANK_WIDTH;

                    if (visX >= -2 && visX < TANK_VIEWPORT_WIDTH + 2) {
                        const startX = visXToScreenX(visX);
                        const width = visXToScreenX(visX+1) - startX;
                        const yPos = (pieceGridY - BUFFER_HEIGHT) * BLOCK_SIZE;

                        const neighbors = {
                            t: activeGoop.cells.some(o => o.x === cell.x && o.y === cell.y - 1),
                            r: activeGoop.cells.some(o => o.x === cell.x + 1 && o.y === cell.y),
                            b: activeGoop.cells.some(o => o.x === cell.x && o.y === cell.y + 1),
                            l: activeGoop.cells.some(o => o.x === cell.x - 1 && o.y === cell.y),
                        };

                        return (
                            <g key={`ghost-${idx}`}>
                                {/* Transparent fill to help identify color */}
                                <rect
                                    x={startX}
                                    y={yPos}
                                    width={width}
                                    height={BLOCK_SIZE}
                                    fill={isWild ? getWildColorAtX(startX) : color}
                                    fillOpacity={0.2}
                                    rx={4}
                                    ry={4}
                                />
                                {/* Dashed outline */}
                                <path
                                    d={getContourPath(startX, yPos, width, BLOCK_SIZE, neighbors)}
                                    fill="none"
                                    stroke={isWild ? getWildColorAtX(startX) : color}
                                    strokeWidth="1"
                                    strokeDasharray="4 2"
                                    opacity="0.75"
                                    className={isWild ? "wild-stroke" : undefined}
                                />
                            </g>
                        );
                    }
                    return null;
                });
            })()}

            {/* Dump Pieces (GOOP_DUMP falling pieces) */}
            {dumpPieces && dumpPieces.map(piece => {
                // Convert absolute grid X to visual position
                let visX = piece.x - tankRotation;
                if (visX > TANK_WIDTH / 2) visX -= TANK_WIDTH;
                if (visX < -TANK_WIDTH / 2) visX += TANK_WIDTH;

                // Only render if in visible range
                if (visX < -1 || visX > TANK_VIEWPORT_WIDTH) return null;

                // Calculate screen position
                const startX = visXToScreenX(visX);
                const width = visXToScreenX(visX + 1) - startX;
                const yPos = (piece.y - BUFFER_HEIGHT) * BLOCK_SIZE;

                // Don't render if above visible area
                if (yPos < -BLOCK_SIZE) return null;

                return (
                    <g key={`dump-${piece.id}`}>
                        {/* Ghostly fill */}
                        <rect
                            x={startX}
                            y={yPos}
                            width={width}
                            height={BLOCK_SIZE}
                            fill={piece.color}
                            fillOpacity={0.3}
                            rx={4}
                            ry={4}
                        />
                        {/* Dashed outline */}
                        <rect
                            x={startX}
                            y={yPos}
                            width={width}
                            height={BLOCK_SIZE}
                            fill="none"
                            stroke={piece.color}
                            strokeWidth="2"
                            strokeDasharray="4 2"
                            rx={4}
                            ry={4}
                        />
                    </g>
                );
            })}

            {/* Active Piece */}
            {activeGoop && activeGoop.state === GoopState.FALLING && (() => {
                const isWild = activeGoop.definition.isWild;
                const apCells = activeGoop.cells.map((cell, idx) => {
                    const color = activeGoop.definition.cellColors?.[idx] ?? activeGoop.definition.color;
                    const pieceGridX = normalizeX(activeGoop.x + cell.x);
                    const pieceGridY = activeGoop.y + cell.y;

                    let visX = pieceGridX - tankRotation;
                    if (visX > TANK_WIDTH / 2) visX -= TANK_WIDTH;
                    if (visX < -TANK_WIDTH / 2) visX += TANK_WIDTH;

                    if (visX >= -2 && visX < TANK_VIEWPORT_WIDTH + 2) {
                        const startX = visXToScreenX(visX);
                        const width = visXToScreenX(visX+1) - startX;
                        const yPos = (pieceGridY - BUFFER_HEIGHT) * BLOCK_SIZE;

                        const neighbors = {
                            t: activeGoop.cells.some(o => o.x === cell.x && o.y === cell.y - 1),
                            r: activeGoop.cells.some(o => o.x === cell.x + 1 && o.y === cell.y),
                            b: activeGoop.cells.some(o => o.x === cell.x && o.y === cell.y + 1),
                            l: activeGoop.cells.some(o => o.x === cell.x - 1 && o.y === cell.y),
                        };

                        return { screenX: startX, screenY: yPos, width, neighbors, color };
                    }
                    return null;
                }).filter(Boolean) as { screenX: number, screenY: number, width: number, neighbors: any, color: string }[];

                if (apCells.length === 0) return null;

                return (
                    <g>
                         <g opacity={0.8}>
                             {apCells.map((c, i) => (
                                <rect key={i} x={c.screenX} y={c.screenY} width={c.width} height={BLOCK_SIZE} fill={isWild ? getWildColorAtX(c.screenX) : c.color} rx={4} ry={4} />
                             ))}
                         </g>
                         {apCells.map((c, i) => (
                             <path key={`outline-${i}`} d={getContourPath(c.screenX, c.screenY, c.width, BLOCK_SIZE, c.neighbors)} fill="none" stroke="white" strokeWidth="2" className={isWild ? "wild-stroke" : undefined} />
                         ))}
                    </g>
                );
            })()}

            {/* Floating Text */}
            {floatingTexts.map(ft => {
                let visX = ft.x - tankRotation;
                if (visX > TANK_WIDTH / 2) visX -= TANK_WIDTH;
                if (visX < -TANK_WIDTH / 2) visX += TANK_WIDTH;

                if (visX >= -2 && visX < TANK_VIEWPORT_WIDTH + 2) {
                    const startX = visXToScreenX(visX);
                    const width = visXToScreenX(visX+1) - startX;
                    const yPos = (ft.y - BUFFER_HEIGHT) * BLOCK_SIZE;
                    return <text key={ft.id} x={startX + width/2} y={yPos + BLOCK_SIZE/2} fill={ft.color} textAnchor="middle" className="floating-score" fontSize="24">{ft.text}</text>;
                }
                return null;
            })}

            {/* HUD Meters - only visible in PERISCOPE phase at appropriate rank */}
            {state.phase === ScreenType.TankScreen && (
                <>
                    {/* Left meter: Laser Capacitor (drains as player pops) - rank 1+ */}
                    {rank >= 1 && (
                        <g>
                            {/* Cooldown timer above meter */}
                            {complicationCooldowns && complicationCooldowns[TankSystem.LASER] > Date.now() && (
                                <text
                                    x={vbX + 8 + 6}
                                    y={vbH * 0.04 - 4}
                                    fill="white"
                                    fontSize="10"
                                    textAnchor="middle"
                                    fontFamily="monospace"
                                >
                                    {Math.ceil((complicationCooldowns[TankSystem.LASER] - Date.now()) / 1000)}s
                                </text>
                            )}
                            <HudMeter
                                value={laserCharge}
                                colorMode="drain"
                                x={vbX + 8}
                                y={vbH * 0.04}
                                height={vbH * 0.2}
                                width={12}
                            />
                        </g>
                    )}
                    {/* Right meter: Controls Heat (builds while rotating) - rank 3+ */}
                    {rank >= 3 && (
                        <g>
                            {/* Cooldown timer above meter */}
                            {complicationCooldowns && complicationCooldowns[TankSystem.CONTROLS] > Date.now() && (
                                <text
                                    x={vbX + vbW - 20 + 6}
                                    y={vbH * 0.04 - 4}
                                    fill="white"
                                    fontSize="10"
                                    textAnchor="middle"
                                    fontFamily="monospace"
                                >
                                    {Math.ceil((complicationCooldowns[TankSystem.CONTROLS] - Date.now()) / 1000)}s
                                </text>
                            )}
                            <HudMeter
                                value={controlsHeat}
                                colorMode="heat"
                                x={vbX + vbW - 20}
                                y={vbH * 0.04}
                                height={vbH * 0.2}
                                width={12}
                            />
                        </g>
                    )}

                    {/* Active Ability Circles - below controls meter on right side */}
                    {equippedActives.length > 0 && equippedActives.map((activeId, index) => {
                        const upgrade = UPGRADES[activeId as keyof typeof UPGRADES];
                        if (!upgrade) return null;

                        const charge = activeCharges[activeId] || 0;
                        const isReady = charge >= 100;
                        const circleSize = 36;
                        const circleX = vbX + vbW - 26;
                        const circleY = vbH * 0.30 + (index * (circleSize + 8));

                        return (
                            <ActiveAbilityCircle
                                key={activeId}
                                upgradeId={activeId}
                                name={upgrade.name}
                                charge={charge}
                                isReady={isReady}
                                x={circleX}
                                y={circleY}
                                size={circleSize}
                                onClick={() => isReady && onActivateAbility?.(activeId)}
                            />
                        );
                    })}
                </>
            )}
        </svg>

        {/* Hold-to-Swap Visual Indicator (Touch) */}
        {holdState.position && holdState.progress > 0 && (
            <div
                className="absolute z-50 pointer-events-none"
                style={{
                    left: holdState.position.x,
                    top: holdState.position.y,
                    transform: 'translate(-50%, -50%)'
                }}
            >
                <svg width="60" height="60" viewBox="0 0 60 60">
                    {/* Track */}
                    <circle cx="30" cy="30" r="20" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
                    {/* Filling Arc */}
                    <circle
                        cx="30" cy="30" r="20"
                        fill="none"
                        stroke="white"
                        strokeWidth="4"
                        strokeDasharray={`${(holdState.progress / 100) * 125.6} 125.6`} // 2*PI*r approx 125.6
                        transform="rotate(-90 30 30)"
                        strokeLinecap="round"
                    />
                </svg>
            </div>
        )}

        {/* Hold-to-Swap Visual Indicator (Keyboard R key) */}
        {keyboardSwapProgress >= 0 && (
            <div
                className="absolute z-50 pointer-events-none"
                style={{
                    left: '50%',
                    bottom: '15%',
                    transform: 'translate(-50%, 0)'
                }}
            >
                <svg width="60" height="60" viewBox="0 0 60 60">
                    {/* Track */}
                    <circle cx="30" cy="30" r="20" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
                    {/* Filling Arc */}
                    <circle
                        cx="30" cy="30" r="20"
                        fill="none"
                        stroke="white"
                        strokeWidth="4"
                        strokeDasharray={`${(keyboardSwapProgress / 100) * 125.6} 125.6`}
                        transform="rotate(-90 30 30)"
                        strokeLinecap="round"
                    />
                </svg>
            </div>
        )}

        {/* Malfunction Alert Overlay - shows pulsing red alert for active complications */}
        {/* Multiple alerts stack vertically (oldest on top), group centered */}
        {state.complications.length > 0 && (
            <div
                className="absolute inset-0 z-40 flex flex-col items-center justify-center pointer-events-none"
                style={{ gap: '1.5rem' }}
            >
                {[...state.complications]
                    .sort((a, b) => a.startTime - b.startTime) // Oldest first (on top)
                    .map(complication => {
                    // Map TankSystem to display name
                    const typeNames: Record<TankSystem, string> = {
                        [TankSystem.LIGHTS]: 'Lights',
                        [TankSystem.CONTROLS]: 'Controls',
                        [TankSystem.LASER]: 'Laser'
                    };
                    const typeName = typeNames[complication.type] || complication.type;

                    return (
                        <div
                            key={complication.id}
                            className="malfunction-pulse text-center"
                            style={{
                                textShadow: '0 0 20px rgba(239, 68, 68, 0.8), 0 0 40px rgba(239, 68, 68, 0.5)'
                            }}
                        >
                            <div
                                className="text-red-500 font-bold"
                                style={{
                                    fontFamily: "'From Where You Are', sans-serif",
                                    fontSize: 'clamp(2rem, 8vw, 4rem)',
                                    lineHeight: 1.1
                                }}
                            >
                                {typeName}
                            </div>
                            <div
                                className="text-red-500 font-bold"
                                style={{
                                    fontFamily: "'From Where You Are', sans-serif",
                                    fontSize: 'clamp(2rem, 8vw, 4rem)',
                                    lineHeight: 1.1
                                }}
                            >
                                Malfunction
                            </div>
                            <div
                                className="text-red-400 mt-2"
                                style={{
                                    fontFamily: "'Amazon Ember', sans-serif",
                                    fontSize: 'clamp(0.875rem, 3vw, 1.25rem)'
                                }}
                            >
                                Fix at Console
                            </div>
                        </div>
                    );
                })}
            </div>
        )}

        {/* Flying Orbs & UI Overlay - Unchanged */}
        {flyingOrbs.map(orb => {
            const elapsed = now - orb.spawnTime;
            const progress = Math.min(1, elapsed / 500);
            const eased = 1 - (1 - progress) * (1 - progress);
            const colorIndex = palette.indexOf(orb.color);
            const startX = 50 + ((colorIndex - (palette.length - 1) / 2) * 8); 
            const startY = 6; 
            const endCoords = getScreenPercentCoords(orb.x, orb.y);
            const currentX = startX + (endCoords.x - startX) * eased;
            const currentY = startY + (endCoords.y - startY) * eased;
            return <div key={`fly-${orb.id}`} className="absolute w-4 h-4 rounded-full shadow-lg border border-white/50 z-30" style={{ backgroundColor: orb.color, left: `${currentX}%`, top: `${currentY}%`, transform: 'translate(-50%, -50%)', boxShadow: isMobile ? `0 0 4px ${orb.color}` : `0 0 10px ${orb.color}` }} />;
        })}
        
        {/* Piece Previews - side by side at top center (like old color pool) */}
        {state.phase === ScreenType.TankScreen && (showHoldViewer || showNextWindow) && (
            <div style={{
                position: 'absolute',
                top: '8px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10,
                display: 'flex',
                gap: '8px'
            }}>
                <PiecePreview piece={storedGoop ?? null} label="STORED" visible={showHoldViewer} rank={rank} />
                <PiecePreview piece={nextGoop ?? null} label="NEXT" visible={showNextWindow} rank={rank} />
            </div>
        )}
    </div>
  );
};
