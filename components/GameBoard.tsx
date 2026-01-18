
import React, { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { GameState, FallingBlock, GridCell, PieceState } from '../types';
import { VISIBLE_WIDTH, VISIBLE_HEIGHT, COLORS, TOTAL_WIDTH, TOTAL_HEIGHT, BUFFER_HEIGHT, PER_BLOCK_DURATION } from '../constants';
import { normalizeX, getGhostY, getPaletteForRank } from '../utils/gameLogic';
import { gameEventBus } from '../core/events/EventBus';
import { GameEventType } from '../core/events/GameEvents';
import { isMobile } from '../utils/device';

interface GameBoardProps {
  state: GameState;
  rank: number;
  maxTime: number; 
  onBlockTap: (x: number, y: number) => void;
  
  onRotate: (dir: number) => void;
  onDragInput: (dir: number) => void; // 0 = stop, 1 = left, -1 = right
  onSwipeUp: () => void;
  onSoftDrop: (active: boolean) => void;
  onSwap: () => void;
}

const BLOCK_SIZE = 30; 
const RADIUS = 8; 
const HOLD_DURATION = 1000; // 1.0s for hold-to-swap
const HOLD_DELAY = 250;     // 0.25s delay before hold starts

// Helper interface for renderable items
interface RenderableCell {
    visX: number;
    y: number; 
    screenX: number;
    screenY: number;
    width: number;
    cell: GridCell; 
    color: string;
    neighbors: { t: boolean, r: boolean, b: boolean, l: boolean };
    isFalling?: boolean;
}

export const GameBoard: React.FC<GameBoardProps> = ({ 
    state, rank, maxTime, onBlockTap, 
    onRotate, onDragInput, onSwipeUp, onSoftDrop, onSwap 
}) => {
  const { grid, boardOffset, activePiece, fallingBlocks, floatingTexts, timeLeft, goalMarks } = state;
  const [highlightedGroupId, setHighlightedGroupId] = useState<string | null>(null);
  const [shakingGroupId, setShakingGroupId] = useState<string | null>(null);
  
  // Hold-to-Swap Visual State
  const [holdProgress, setHoldProgress] = useState(0);
  const [holdPosition, setHoldPosition] = useState<{x: number, y: number} | null>(null);

  const palette = useMemo(() => getPaletteForRank(rank), [rank]);

  // --- PRESSURE CALCULATION ---
  const pressureRatio = useMemo(() => {
    if (timeLeft <= 0) return 1;
    return Math.max(0, 1 - (timeLeft / maxTime));
  }, [timeLeft, maxTime]);

  const pressureHue = Math.max(0, 120 * (1 - pressureRatio)); 
  const pressureColor = `hsla(${pressureHue}, 100%, 50%, 0.15)`; 

  const waterHeightBlocks = 1 + (pressureRatio * (VISIBLE_HEIGHT - 1));

  // --- CYLINDRICAL PROJECTION LOGIC ---
  const ANGLE_PER_COL = (2 * Math.PI) / TOTAL_WIDTH; 
  const CYL_RADIUS = BLOCK_SIZE / ANGLE_PER_COL; 

  const maxAngle = (VISIBLE_WIDTH / 2) * ANGLE_PER_COL;
  const projectedHalfWidth = CYL_RADIUS * Math.sin(maxAngle);
  
  const vbX = -projectedHalfWidth;
  const vbY = 0;
  const vbW = projectedHalfWidth * 2;
  const vbH = VISIBLE_HEIGHT * BLOCK_SIZE;

  const waterHeightPx = waterHeightBlocks * BLOCK_SIZE;
  const waterTopY = vbH - waterHeightPx;

  const getScreenX = useCallback((visX: number) => {
      const centerCol = VISIBLE_WIDTH / 2;
      const offsetFromCenter = visX - centerCol;
      const angle = offsetFromCenter * ANGLE_PER_COL;
      return CYL_RADIUS * Math.sin(angle);
  }, [ANGLE_PER_COL, CYL_RADIUS]);

  const getGridXFromScreen = (screenX: number) => {
      const sinVal = Math.max(-1, Math.min(1, screenX / CYL_RADIUS));
      const angle = Math.asin(sinVal);
      const offsetFromCenter = angle / ANGLE_PER_COL;
      return (VISIBLE_WIDTH / 2) + offsetFromCenter;
  };

  const getScreenPercentCoords = useCallback((gridX: number, gridY: number) => {
      let visX = gridX - boardOffset;
      if (visX > TOTAL_WIDTH / 2) visX -= TOTAL_WIDTH;
      if (visX < -TOTAL_WIDTH / 2) visX += TOTAL_WIDTH;
      
      const svgX = getScreenX(visX);
      const svgY = (gridY - BUFFER_HEIGHT) * BLOCK_SIZE + (BLOCK_SIZE / 2);
      
      const pctX = ((svgX - vbX) / vbW) * 100;
      const pctY = ((svgY - vbY) / vbH) * 100;
      
      return { x: pctX, y: pctY };
  }, [boardOffset, getScreenX, vbX, vbY, vbW, vbH]);

  // --- UNIFIED INPUT HANDLING ---
  const pointerRef = useRef<{
      startX: number;
      startY: number;
      startTime: number;
      isDragLocked: boolean;
      lockedAxis: 'H' | 'V' | null;
      activePointerId: number;
      actionConsumed: boolean; // True if hold-swap triggered
  } | null>(null);
  
  const holdIntervalRef = useRef<number | null>(null);

  // Helper to normalize input to Viewport Coords for block picking
  const getViewportCoords = (clientX: number, clientY: number, target: Element) => {
      const container = target as HTMLElement;
      const rect = container.getBoundingClientRect();
      const borderLeft = container.clientLeft || 0;
      const borderTop = container.clientTop || 0;

      const relX = clientX - rect.left - borderLeft;
      const relY = clientY - rect.top - borderTop;
      
      const contentW = container.clientWidth;
      const contentH = container.clientHeight;
      
      const scaleX = contentW / vbW;
      const scaleY = contentH / vbH;
      const scale = Math.min(scaleX, scaleY);
      const renderedW = vbW * scale;
      const offsetX = (contentW - renderedW) / 2;
      
      const svgX = vbX + (relX - offsetX) / scale;
      const svgY = vbY + relY / scale;

      const rawVisX = getGridXFromScreen(svgX);
      const rawVisY = svgY / BLOCK_SIZE + BUFFER_HEIGHT;

      return { vx: rawVisX, vy: rawVisY, svgX, svgY, relX, contentW, relY };
  };

  const getHitData = (vx: number, vy: number) => {
      if (vx >= 0 && vx < VISIBLE_WIDTH) {
          const visX = Math.floor(vx);
          const gridX = normalizeX(visX + boardOffset);
          const gridY = Math.floor(vy);
          if (gridY >= 0 && gridY < TOTAL_HEIGHT) {
              const cell = grid[gridY][gridX];
              return { type: 'BLOCK', x: gridX, y: gridY, cell };
          }
      }
      return { type: 'EMPTY' };
  };

  const clearHold = () => {
      if (holdIntervalRef.current) {
          clearInterval(holdIntervalRef.current);
          holdIntervalRef.current = null;
      }
      setHoldProgress(0);
      setHoldPosition(null);
  };

  // Cleanup hold interval on unmount to prevent memory leak
  useEffect(() => {
      return () => {
          if (holdIntervalRef.current) {
              clearInterval(holdIntervalRef.current);
          }
      };
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
      if (pointerRef.current) return; // Ignore multitouch for gameplay controls
      e.currentTarget.setPointerCapture(e.pointerId);
      
      const { relX, relY, vx, vy } = getViewportCoords(e.clientX, e.clientY, e.currentTarget);

      pointerRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          startTime: Date.now(),
          isDragLocked: false,
          lockedAxis: null,
          activePointerId: e.pointerId,
          actionConsumed: false
      };

      // Start Hold Timer
      setHoldPosition({ x: relX, y: relY });
      setHoldProgress(0);
      
      const startHoldTime = Date.now();
      holdIntervalRef.current = window.setInterval(() => {
          const now = Date.now();
          const totalElapsed = now - startHoldTime;

          // Don't start filling/logic until delay has passed
          if (totalElapsed < HOLD_DELAY) return;

          const effectiveElapsed = totalElapsed - HOLD_DELAY;
          const progress = Math.min(100, (effectiveElapsed / HOLD_DURATION) * 100);
          setHoldProgress(progress);

          if (progress >= 100) {
              // Trigger Swap
              if (pointerRef.current) pointerRef.current.actionConsumed = true;
              onSwap();
              clearHold();
              // Haptic feedback if available
              if (navigator.vibrate) navigator.vibrate(50);
          }
      }, 16);

      // Visual feedback for tapping blocks
      const hit = getHitData(vx, vy);
      
      if (hit.type === 'BLOCK' && hit.cell) {
          const totalDuration = hit.cell.groupSize * PER_BLOCK_DURATION;
          const elapsed = Date.now() - hit.cell.timestamp;
          const thresholdY = (TOTAL_HEIGHT - 1) - (pressureRatio * (VISIBLE_HEIGHT - 1));
          
          if (hit.cell.groupMinY < thresholdY) {
              setShakingGroupId(hit.cell.groupId);
              gameEventBus.emit(GameEventType.ACTION_REJECTED);
              setTimeout(() => setShakingGroupId(prev => prev === hit.cell!.groupId ? null : prev), 300);
          } else if (elapsed < totalDuration) {
              setShakingGroupId(hit.cell.groupId);
              gameEventBus.emit(GameEventType.ACTION_REJECTED);
              setTimeout(() => setShakingGroupId(prev => prev === hit.cell!.groupId ? null : prev), 300);
          } else {
              setHighlightedGroupId(hit.cell.groupId);
          }
      }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      if (!pointerRef.current || pointerRef.current.activePointerId !== e.pointerId) return;
      
      const { startX, startY, isDragLocked } = pointerRef.current;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // Thresholds
      const DRAG_LOCK_THRESHOLD = 10;
      
      if (!isDragLocked) {
          if (absDx > DRAG_LOCK_THRESHOLD || absDy > DRAG_LOCK_THRESHOLD) {
              // Movement detected: Cancel Hold-to-Swap
              clearHold();
              pointerRef.current.isDragLocked = true;
              setHighlightedGroupId(null); // Cancel click highlight
              
              if (absDx > absDy) {
                  pointerRef.current.lockedAxis = 'H';
              } else {
                  pointerRef.current.lockedAxis = 'V';
                  // Vertical Drag Start
                  if (dy > 0) {
                      onSoftDrop(true); // Drag Down = Continuous Drop
                  }
              }
          }
      }

      if (pointerRef.current.isDragLocked) {
          const axis = pointerRef.current.lockedAxis;
          
          if (axis === 'H') {
              // Horizontal Drag (Joystick)
              if (dx < -20) {
                  onDragInput(1);
              } else if (dx > 20) {
                  onDragInput(-1);
              } else {
                  onDragInput(0); // Deadzone
              }
          } else if (axis === 'V') {
              // Vertical Drag
              if (dy > 20) {
                  onSoftDrop(true);
              } else {
                  onSoftDrop(false);
              }
          }
      }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
      if (!pointerRef.current || pointerRef.current.activePointerId !== e.pointerId) return;
      
      const { startTime, isDragLocked, actionConsumed } = pointerRef.current;
      const dt = Date.now() - startTime;
      const dx = e.clientX - pointerRef.current.startX;
      const dy = e.clientY - pointerRef.current.startY;
      
      // Cleanup
      clearHold();
      onSoftDrop(false);
      onDragInput(0);
      setHighlightedGroupId(null);
      pointerRef.current = null;
      e.currentTarget.releasePointerCapture(e.pointerId);

      // If hold action triggered swap, ignore tap logic
      if (actionConsumed) return;

      // Gesture Resolution
      if (!isDragLocked) {
          // TAP (Hit nothing or movement < threshold)
          const { vx, vy, relX, contentW } = getViewportCoords(e.clientX, e.clientY, e.currentTarget);
          const hit = getHitData(vx, vy);

          if (hit.type === 'BLOCK' && hit.cell) {
              onBlockTap(hit.x!, hit.y!);
          } else {
              // Empty Space Logic
              // Left half = Rotate CCW (same as Q)
              // Right half = Rotate CW (same as E)
              if (relX < contentW / 2) {
                  onRotate(-1); 
              } else {
                  onRotate(1);
              }
          }
      } else {
          // SWIPE (Quick movement)
          if (dt < 300) {
              if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 50) {
                  if (dy < 0) {
                      // Swipe Up -> Console
                      onSwipeUp();
                  } else {
                      // Swipe Down -> Fast Drop Pulse
                      onSoftDrop(true);
                      setTimeout(() => onSoftDrop(false), 150);
                  }
              }
          }
      }
  };

  // OPTIMIZATION: Simplify animations based on isMobile
  const style = useMemo(() => `
    .glow-stroke {
        stroke-width: 2px;
        opacity: 0.9;
        ${!isMobile ? `
        filter: drop-shadow(0 0 3px currentColor);
        animation: pulseGlow 2s infinite alternate;
        ` : ''}
    }
    .super-glowing-stroke {
        stroke-width: 3px;
        opacity: 1;
        ${!isMobile ? `
        filter: drop-shadow(0 0 5px white);
        animation: superGlowStroke 1.5s infinite alternate;
        ` : ''}
    }
    /* Only apply heavy filters on non-mobile */
    ${!isMobile ? `
    @keyframes pulseGlow {
        from { filter: drop-shadow(0 0 2px currentColor); }
        to { filter: drop-shadow(0 0 6px currentColor); }
    }
    @keyframes superGlowStroke {
        0%, 100% { filter: drop-shadow(0 0 4px white) drop-shadow(0 0 8px white); opacity: 0.8; stroke-width: 3px; }
        50% { filter: drop-shadow(0 0 8px white) drop-shadow(0 0 15px white); opacity: 1; stroke-width: 4px; }
    }
    ` : ''}
    .shake-anim {
        animation: shake 0.3s cubic-bezier(.36,.07,.19,.97) both;
    }
  `, []);

  const now = Date.now();

  const getBlobPath = (x: number, y: number, w: number, h: number, neighbors: {t:boolean, r:boolean, b:boolean, l:boolean}) => {
      let d = "";
      if (!neighbors.t && !neighbors.l) d += `M ${x} ${y + RADIUS} Q ${x} ${y} ${x + RADIUS} ${y} `;
      else d += `M ${x} ${y} `;
      
      if (!neighbors.t && !neighbors.r) d += `L ${x + w - RADIUS} ${y} Q ${x + w} ${y} ${x + w} ${y + RADIUS} `;
      else d += `L ${x + w} ${y} `;

      if (!neighbors.b && !neighbors.r) d += `L ${x + w} ${y + h - RADIUS} Q ${x + w} ${y + h} ${x + w - RADIUS} ${y + h} `;
      else d += `L ${x + w} ${y + h} `;

      if (!neighbors.b && !neighbors.l) d += `L ${x + RADIUS} ${y + h} Q ${x} ${y + h} ${x} ${y + h - RADIUS} `;
      else d += `L ${x} ${y + h} `;
      
      d += "Z";
      return d;
  };

  const getContourPath = (x: number, y: number, w: number, h: number, n: {t:boolean, r:boolean, b:boolean, l:boolean}) => {
      const r = RADIUS;
      let d = "";
      if (!n.t) {
          const start = n.l ? x : x + r;
          const end = n.r ? x + w : x + w - r;
          d += `M ${start} ${y} L ${end} ${y} `;
      }
      if (!n.r) {
          const start = n.t ? y : y + r;
          const end = n.b ? y + h : y + h - r;
          d += `M ${x + w} ${start} L ${x + w} ${end} `;
      }
      if (!n.b) {
          const start = n.l ? x : x + r;
          const end = n.r ? x + w : x + w - r;
          d += `M ${end} ${y + h} L ${start} ${y + h} `;
      }
      if (!n.l) {
          const start = n.t ? y : y + r;
          const end = n.b ? y + h : y + h - r;
          d += `M ${x} ${end} L ${x} ${start} `;
      }
      if (!n.t && !n.l) d += `M ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} `; 
      if (!n.t && !n.r) d += `M ${x + w - r} ${y} Q ${x + w} ${y} ${x + w} ${y + r} `; 
      if (!n.b && !n.r) d += `M ${x + w} ${y + h - r} Q ${x + w} ${y + h} ${x + w - r} ${y + h} `; 
      if (!n.b && !n.l) d += `M ${x + r} ${y + h} Q ${x} ${y + h} ${x} ${y + h - r} `; 
      return d;
  };

  // --- Render Groups Preparation ---
  const groups = useMemo(() => {
      const map = new Map<string, RenderableCell[]>();

      // 1. Static Grid
      for (let y = BUFFER_HEIGHT; y < BUFFER_HEIGHT + VISIBLE_HEIGHT; y++) {
          for (let visX = 0; visX < VISIBLE_WIDTH; visX++) {
              const gridX = normalizeX(visX + boardOffset);
              const cell = grid[y][gridX];
              if (!cell) continue;

              const startX = getScreenX(visX);
              const endX = getScreenX(visX + 1);
              const width = endX - startX;
              if (width <= 0) continue;
              const yPos = (y - BUFFER_HEIGHT) * BLOCK_SIZE;

              const neighbors = {
                  t: y > 0 && grid[y - 1][gridX]?.groupId === cell.groupId,
                  b: y < TOTAL_HEIGHT - 1 && grid[y + 1][gridX]?.groupId === cell.groupId,
                  l: grid[y][normalizeX(gridX - 1)]?.groupId === cell.groupId,
                  r: grid[y][normalizeX(gridX + 1)]?.groupId === cell.groupId,
              };

              if (!map.has(cell.groupId)) map.set(cell.groupId, []);
              map.get(cell.groupId)!.push({
                  visX, y, screenX: startX, screenY: yPos, width, cell, color: cell.color, neighbors
              });
          }
      }

      // 2. Falling Blocks
      const fallingMap = new Map<string, FallingBlock[]>();
      fallingBlocks.forEach(b => {
          if (!fallingMap.has(b.data.groupId)) fallingMap.set(b.data.groupId, []);
          fallingMap.get(b.data.groupId)!.push(b);
      });

      fallingMap.forEach((blocks, gid) => {
           const coords = new Set<string>();
           blocks.forEach(b => coords.add(`${Math.round(b.x)},${Math.round(b.y)}`));

           blocks.forEach(block => {
                if (block.y < BUFFER_HEIGHT - 1) return;
                let visX = block.x - boardOffset;
                if (visX > TOTAL_WIDTH / 2) visX -= TOTAL_WIDTH;
                if (visX < -TOTAL_WIDTH / 2) visX += TOTAL_WIDTH;

                if (visX >= 0 && visX < VISIBLE_WIDTH) {
                    const startX = getScreenX(visX);
                    const endX = getScreenX(visX + 1);
                    const width = endX - startX;
                    const yPos = (block.y - BUFFER_HEIGHT) * BLOCK_SIZE;

                    const bx = Math.round(block.x);
                    const by = Math.round(block.y);
                    const neighbors = {
                        t: coords.has(`${bx},${by - 1}`),
                        r: coords.has(`${normalizeX(bx + 1)},${by}`),
                        b: coords.has(`${bx},${by + 1}`),
                        l: coords.has(`${normalizeX(bx - 1)},${by}`),
                    };

                    if (!map.has(gid)) map.set(gid, []);
                    map.get(gid)!.push({
                        visX, y: block.y, screenX: startX, screenY: yPos, width, 
                        cell: block.data, color: block.data.color, neighbors, isFalling: true
                    });
                }
           });
      });

      return map;
  }, [grid, boardOffset, fallingBlocks, vbX, vbY, vbW, vbH]);

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

  return (
    <div 
        // OPTIMIZATION: 'contain: strict' improves paint performance by isolating the board
        className="w-full h-full bg-slate-950 relative shadow-2xl border-x-4 border-slate-900 overflow-hidden select-none touch-none"
        style={{ touchAction: 'none', contain: 'strict' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
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
        
        <style>{style}</style>
        <svg 
            width="100%" 
            height="100%"
            viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
            preserveAspectRatio="xMidYMin meet"
            className="touch-none"
            style={{ willChange: 'transform' }} // OPTIMIZATION: Promote to compositor layer
        >
            {maskDefinitions}

            {/* Background Layers */}
            <rect x={vbX} y={waterTopY} width={vbW} height={waterHeightPx} fill={pressureColor} />
            <line x1={vbX} y1={waterTopY} x2={vbX + vbW} y2={waterTopY} stroke={pressureColor.replace('0.15', '0.6')} strokeWidth="2" strokeDasharray="4 4" />

            {/* Grid & Goals - Skip grid lines on mobile for performance */}
            {!isMobile && Array.from({length: VISIBLE_HEIGHT}).map((_, yIdx) => {
                const yPos = yIdx * BLOCK_SIZE;
                return Array.from({length: VISIBLE_WIDTH}).map((_, visX) => {
                    const startX = getScreenX(visX);
                    const width = getScreenX(visX+1) - startX;
                    return (
                        <g key={`bg-${yIdx}-${visX}`}>
                            <line x1={startX} y1={yPos} x2={startX+width} y2={yPos} stroke={COLORS.GRID_EMPTY} strokeWidth="1" opacity={0.2} />
                            <line x1={startX} y1={yPos} x2={startX} y2={yPos+BLOCK_SIZE} stroke={COLORS.GRID_EMPTY} strokeWidth="1" opacity={0.2} />
                        </g>
                    );
                });
            })}
            {/* Goal Marks - always render */}
            {goalMarks.filter(m => now - m.spawnTime >= 500).map(mark => {
                let visX = mark.x - boardOffset;
                if (visX > TOTAL_WIDTH / 2) visX -= TOTAL_WIDTH;
                if (visX < -TOTAL_WIDTH / 2) visX += TOTAL_WIDTH;

                if (visX >= 0 && visX < VISIBLE_WIDTH) {
                    const startX = getScreenX(visX);
                    const width = getScreenX(visX+1) - startX;
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
                const centerCol = normalizeX(boardOffset + VISIBLE_WIDTH / 2);
                let diff = mark.x - centerCol;
                if (diff > TOTAL_WIDTH / 2) diff -= TOTAL_WIDTH;
                if (diff < -TOTAL_WIDTH / 2) diff += TOTAL_WIDTH;
                
                if (Math.abs(diff) > VISIBLE_WIDTH / 2) {
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
            {Array.from(groups.entries()).map(([gid, cells]) => {
                if (cells.length === 0) return null;
                const sample = cells[0];
                const color = sample.color;
                const isHighlighted = gid === highlightedGroupId;
                const isShaking = gid === shakingGroupId;
                const isGlowing = cells.some(c => c.cell.isGlowing);

                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                cells.forEach(c => {
                    minX = Math.min(minX, c.screenX);
                    minY = Math.min(minY, c.screenY);
                    maxX = Math.max(maxX, c.screenX + c.width);
                    maxY = Math.max(maxY, c.screenY + BLOCK_SIZE);
                });

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
                                    fill={color}
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
                                        fill={color}
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
                                    fill={color}
                                    fillOpacity={0.85}
                                />
                            ))}
                            {/* Contour - draws connected outline */}
                            {cells.map((c) => (
                                <path
                                    key={`cnt-${c.cell.id}`}
                                    d={getContourPath(c.screenX, c.screenY, c.width, BLOCK_SIZE, c.neighbors)}
                                    fill="none"
                                    stroke={isGlowing ? "white" : color}
                                    strokeWidth={isGlowing ? 3 : 2}
                                />
                            ))}
                            {isHighlighted && <rect x={minX} y={minY} width={maxX - minX} height={maxY - minY} fill="white" fillOpacity={0.3} />}
                        </g>
                    );
                }

                // Desktop: full rendering with masks
                return (
                    <g key={`group-${gid}`} className={isShaking ? "shake-anim" : ""}>
                        <rect x={minX} y={minY} width={maxX - minX} height={maxY - minY} fill={color} fillOpacity={0.2} mask={`url(#mask-${gid})`} />
                        <g opacity={0.9} mask={`url(#mask-${gid})`}>
                            {cells.map((c, i) => {
                                if (!c.cell || c.isFalling) {
                                    return <rect key={`liq-${c.cell.id}`} x={c.screenX - 0.5} y={c.screenY} width={c.width + 1} height={BLOCK_SIZE} fill={color} />;
                                }
                                const totalDuration = c.cell.groupSize * PER_BLOCK_DURATION;
                                const groupHeight = (c.cell.groupMaxY - c.cell.groupMinY + 1);
                                const timePerRow = totalDuration / Math.max(1, groupHeight);
                                const rowIndex = c.cell.groupMaxY - c.y;
                                const startDelay = rowIndex * timePerRow;
                                const timeIntoRow = (now - c.cell.timestamp) - startDelay;
                                let fillHeight = timeIntoRow >= timePerRow ? BLOCK_SIZE : (timeIntoRow > 0 ? (timeIntoRow / timePerRow) * BLOCK_SIZE : 0);
                                return <rect key={`liq-${c.cell.id}`} x={c.screenX - 0.5} y={c.screenY + (BLOCK_SIZE - fillHeight)} width={c.width + 1} height={fillHeight} fill={color} />;
                            })}
                        </g>
                        {isHighlighted && <rect x={minX} y={minY} width={maxX - minX} height={maxY - minY} fill="white" fillOpacity={0.3} mask={`url(#mask-${gid})`} />}
                        {cells.map((c, i) => (
                             <path
                                key={`cnt-${c.cell.id}`}
                                d={getContourPath(c.screenX, c.screenY, c.width, BLOCK_SIZE, c.neighbors)}
                                fill="none"
                                stroke={isGlowing ? "white" : color}
                                strokeWidth={isGlowing ? "3" : "2"}
                                className={!isMobile ? (isGlowing ? "super-glowing-stroke" : "glow-stroke") : undefined}
                                style={!isMobile ? { color: isGlowing ? 'white' : color } : undefined}
                             />
                        ))}
                    </g>
                );
            })}

            {/* Ghost Piece */}
            {activePiece && activePiece.state === PieceState.FALLING && (() => {
                const ghostY = getGhostY(grid, activePiece, boardOffset);
                const color = activePiece.definition.color;
                
                return activePiece.cells.map((cell, idx) => {
                    const pieceGridX = normalizeX(activePiece.x + cell.x);
                    const pieceGridY = ghostY + cell.y;
                    if (pieceGridY < BUFFER_HEIGHT) return null;

                    let visX = pieceGridX - boardOffset;
                    if (visX > TOTAL_WIDTH / 2) visX -= TOTAL_WIDTH;
                    if (visX < -TOTAL_WIDTH / 2) visX += TOTAL_WIDTH;

                    if (visX >= -2 && visX < VISIBLE_WIDTH + 2) {
                        const startX = getScreenX(visX);
                        const width = getScreenX(visX+1) - startX;
                        const yPos = (pieceGridY - BUFFER_HEIGHT) * BLOCK_SIZE;

                        const neighbors = {
                            t: activePiece.cells.some(o => o.x === cell.x && o.y === cell.y - 1),
                            r: activePiece.cells.some(o => o.x === cell.x + 1 && o.y === cell.y),
                            b: activePiece.cells.some(o => o.x === cell.x && o.y === cell.y + 1),
                            l: activePiece.cells.some(o => o.x === cell.x - 1 && o.y === cell.y),
                        };

                        return (
                            <path
                                key={`ghost-${idx}`}
                                d={getContourPath(startX, yPos, width, BLOCK_SIZE, neighbors)}
                                fill="none"
                                stroke={color}
                                strokeWidth="1"
                                strokeDasharray="4 2"
                                opacity="0.3"
                            />
                        );
                    }
                    return null;
                });
            })()}

            {/* Active Piece */}
            {activePiece && activePiece.state === PieceState.FALLING && (() => {
                const color = activePiece.definition.color;
                
                const apCells = activePiece.cells.map(cell => {
                    const pieceGridX = normalizeX(activePiece.x + cell.x);
                    const pieceGridY = activePiece.y + cell.y;
                    
                    let visX = pieceGridX - boardOffset;
                    if (visX > TOTAL_WIDTH / 2) visX -= TOTAL_WIDTH;
                    if (visX < -TOTAL_WIDTH / 2) visX += TOTAL_WIDTH;

                    if (visX >= -2 && visX < VISIBLE_WIDTH + 2) {
                        const startX = getScreenX(visX);
                        const width = getScreenX(visX+1) - startX;
                        const yPos = (pieceGridY - BUFFER_HEIGHT) * BLOCK_SIZE;
                        
                        const neighbors = {
                            t: activePiece.cells.some(o => o.x === cell.x && o.y === cell.y - 1),
                            r: activePiece.cells.some(o => o.x === cell.x + 1 && o.y === cell.y),
                            b: activePiece.cells.some(o => o.x === cell.x && o.y === cell.y + 1),
                            l: activePiece.cells.some(o => o.x === cell.x - 1 && o.y === cell.y),
                        };

                        return { screenX: startX, screenY: yPos, width, neighbors };
                    }
                    return null;
                }).filter(Boolean) as { screenX: number, screenY: number, width: number, neighbors: any }[];

                if (apCells.length === 0) return null;
                
                return (
                    <g>
                         <g opacity={0.8}>
                             {apCells.map((c, i) => (
                                <rect key={i} x={c.screenX} y={c.screenY} width={c.width} height={BLOCK_SIZE} fill={color} rx={4} ry={4} />
                             ))}
                         </g>
                         {apCells.map((c, i) => (
                             <path key={`outline-${i}`} d={getContourPath(c.screenX, c.screenY, c.width, BLOCK_SIZE, c.neighbors)} fill="none" stroke="white" strokeWidth="2" />
                         ))}
                    </g>
                );
            })()}

            {/* Floating Text */}
            {floatingTexts.map(ft => {
                let visX = ft.x - boardOffset;
                if (visX > TOTAL_WIDTH / 2) visX -= TOTAL_WIDTH;
                if (visX < -TOTAL_WIDTH / 2) visX += TOTAL_WIDTH;

                if (visX >= -2 && visX < VISIBLE_WIDTH + 2) {
                    const startX = getScreenX(visX);
                    const width = getScreenX(visX+1) - startX;
                    const yPos = (ft.y - BUFFER_HEIGHT) * BLOCK_SIZE;
                    return <text key={ft.id} x={startX + width/2} y={yPos + BLOCK_SIZE/2} fill={ft.color} textAnchor="middle" className="floating-score" fontSize="24">{ft.text}</text>;
                }
                return null;
            })}
        </svg>

        {/* Hold-to-Swap Visual Indicator */}
        {holdPosition && holdProgress > 0 && (
            <div 
                className="absolute z-50 pointer-events-none"
                style={{ 
                    left: holdPosition.x, 
                    top: holdPosition.y,
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
                        strokeDasharray={`${(holdProgress / 100) * 125.6} 125.6`} // 2*PI*r approx 125.6
                        transform="rotate(-90 30 30)"
                        strokeLinecap="round"
                    />
                </svg>
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
        
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-4 p-2 pl-4 bg-slate-900/80 rounded-full border border-slate-700/50 backdrop-blur-md z-20 pointer-events-none shadow-lg">
            <span className="text-lg font-mono font-black text-yellow-400 leading-none drop-shadow-md">{state.goalsCleared}/{state.goalsTarget}</span>
            <div className="w-px h-6 bg-slate-700/50" />
            <div className="flex items-center gap-2">
                {palette.map(color => {
                    const isActive = activeColors.has(color);
                    return <div key={color} className="w-5 h-5 rounded-full border-2 border-slate-700/50 relative flex items-center justify-center" style={{ borderColor: isActive ? 'transparent' : color }}><div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${isActive ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`} style={{ backgroundColor: color, boxShadow: isMobile ? `0 0 4px ${color}` : `0 0 6px ${color}` }} />{isActive && <div className="w-1 h-1 rounded-full bg-slate-800" />}</div>;
                })}
            </div>
        </div>
    </div>
  );
};
