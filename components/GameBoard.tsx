// --- Imports ---
import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { GameState, PieceState, ComplicationType, GamePhase } from '../types';
import { VISIBLE_WIDTH, VISIBLE_HEIGHT, COLORS, TOTAL_WIDTH, BUFFER_HEIGHT, PER_BLOCK_DURATION } from '../constants';
import { normalizeX, getGhostY, getPaletteForRank } from '../utils/gameLogic';
import { isMobile } from '../utils/device';
import { HudMeter } from './HudMeter';
import { VIEWBOX, BLOCK_SIZE, visXToScreenX } from '../utils/coordinateTransform';
import { useInputHandlers } from '../hooks/useInputHandlers';
import { getBlobPath, getContourPath, buildRenderableGroups } from '../utils/goopRenderer';
import { gameEventBus } from '../core/events/EventBus';
import { GameEventType, SwapHoldPayload } from '../core/events/GameEvents';
import { ActiveAbilityCircle } from './ActiveAbilityCircle';
import { UPGRADES } from '../constants';
import './GameBoard.css';

// --- Props Interface ---
// Input callbacks removed - now handled via EventBus (see Game.tsx subscriptions)
interface GameBoardProps {
  state: GameState;
  rank: number;
  maxTime: number;
  lightsDimmed?: boolean; // LIGHTS complication effect: dim to 10% + grayscale
  laserCapacitor?: number;  // HUD meter: 0-100 (100 = full)
  controlsHeat?: number;    // HUD meter: 0-100 (0 = cool)
  complicationCooldowns?: Record<ComplicationType, number>;  // Cooldown timestamps
  equippedActives?: string[];  // Active ability IDs equipped
  activeCharges?: Record<string, number>;  // Active ID -> charge (0-100)
  onActivateAbility?: (upgradeId: string) => void;  // Called when ability activated
  powerUps?: Record<string, number>;  // Upgrade levels for GOOP_SWAP effect
}

// --- Component ---
export const GameBoard: React.FC<GameBoardProps> = ({
    state, rank, maxTime, lightsDimmed,
    laserCapacitor = 100, controlsHeat = 0, complicationCooldowns,
    equippedActives = [], activeCharges = {}, onActivateAbility,
    powerUps
}) => {
  const { grid, boardOffset, activePiece, fallingBlocks, floatingTexts, timeLeft, goalMarks } = state;

  const palette = useMemo(() => getPaletteForRank(rank), [rank]);

  // --- Derived Values ---
  const pressureRatio = useMemo(() => {
    if (timeLeft <= 0) return 1;
    return Math.max(0, 1 - (timeLeft / maxTime));
  }, [timeLeft, maxTime]);

  const pressureHue = Math.max(0, 120 * (1 - pressureRatio));
  const pressureColor = `hsla(${pressureHue}, 100%, 50%, 0.15)`;

  const waterHeightBlocks = 1 + (pressureRatio * (VISIBLE_HEIGHT - 1));

  // ViewBox values from module-level constants (no useMemo needed - these never change)
  const { x: vbX, y: vbY, w: vbW, h: vbH } = VIEWBOX;

  const waterHeightPx = waterHeightBlocks * BLOCK_SIZE;
  const waterTopY = vbH - waterHeightPx;

  // Use imported coordinate transform functions (pure functions, no hooks needed)
  const getScreenPercentCoords = useCallback((gridX: number, gridY: number) => {
      let visX = gridX - boardOffset;
      if (visX > TOTAL_WIDTH / 2) visX -= TOTAL_WIDTH;
      if (visX < -TOTAL_WIDTH / 2) visX += TOTAL_WIDTH;

      const svgX = visXToScreenX(visX);
      const svgY = (gridY - BUFFER_HEIGHT) * BLOCK_SIZE + (BLOCK_SIZE / 2);

      const pctX = ((svgX - vbX) / vbW) * 100;
      const pctY = ((svgY - vbY) / vbH) * 100;

      return { x: pctX, y: pctY };
  }, [boardOffset]); // Only boardOffset changes - vbX/vbY/vbW/vbH are constants

  // --- INPUT HANDLING (via hook) ---
  // Events are now emitted via EventBus, subscribed in Game.tsx
  const { handlers, holdState, highlightedGroupId, shakingGroupId } = useInputHandlers({
      callbacks: {}, // Callbacks optional - events emitted regardless
      boardOffset,
      grid,
      pressureRatio,
      powerUps  // For GOOP_SWAP: reduces hold-to-swap duration
  });

  // --- KEYBOARD SWAP HOLD (via EventBus) ---
  // Keyboard R key hold emits events from Game.tsx, we show the visual here
  const [keyboardSwapProgress, setKeyboardSwapProgress] = useState(-1);
  useEffect(() => {
      const unsub = gameEventBus.on<SwapHoldPayload>(GameEventType.INPUT_SWAP_HOLD, (p) => {
          setKeyboardSwapProgress(p?.progress ?? -1);
      });
      return unsub;
  }, []);

  const now = Date.now();

  // --- Render Groups Preparation (via utility function) ---
  const groups = useMemo(
      () => buildRenderableGroups(grid, boardOffset, fallingBlocks),
      [grid, boardOffset, fallingBlocks]
  );

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

  // --- Rendering ---
  return (
    <div 
        // OPTIMIZATION: 'contain: strict' improves paint performance by isolating the board
        className="w-full h-full bg-slate-950 relative shadow-2xl border-x-4 border-slate-900 overflow-hidden select-none touch-none"
        style={{ touchAction: 'none', contain: 'strict' }}
        onPointerDown={handlers.onPointerDown}
        onPointerMove={handlers.onPointerMove}
        onPointerUp={handlers.onPointerUp}
        onPointerLeave={handlers.onPointerUp}
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
            className={`touch-none ${lightsDimmed ? 'lights-dimmed' : ''}`}
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
            {/* Goal Marks - always render */}
            {goalMarks.filter(m => now - m.spawnTime >= 500).map(mark => {
                let visX = mark.x - boardOffset;
                if (visX > TOTAL_WIDTH / 2) visX -= TOTAL_WIDTH;
                if (visX < -TOTAL_WIDTH / 2) visX += TOTAL_WIDTH;

                if (visX >= 0 && visX < VISIBLE_WIDTH) {
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
                const isShaking = gid === shakingGroupId || state.primedGroups.has(gid); // Shake primed groups too
                const isGlowing = cells.some(c => c.cell.isGlowing);
                const isPrimed = state.primedGroups.has(gid); // LASER effect: primed for 2nd tap

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
                                    stroke={isPrimed ? "#ff6b6b" : (isGlowing ? "white" : color)}
                                    strokeWidth={isPrimed ? 3 : (isGlowing ? 3 : 2)}
                                    strokeDasharray={isPrimed ? "4 2" : undefined}
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
                                stroke={isPrimed ? "#ff6b6b" : (isGlowing ? "white" : color)}
                                strokeWidth={isPrimed ? "3" : (isGlowing ? "3" : "2")}
                                strokeDasharray={isPrimed ? "4 2" : undefined}
                                className={!isMobile && !isPrimed ? (isGlowing ? "super-glowing-stroke" : "glow-stroke") : undefined}
                                style={!isMobile && !isPrimed ? { color: isGlowing ? 'white' : color } : undefined}
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
                        const startX = visXToScreenX(visX);
                        const width = visXToScreenX(visX+1) - startX;
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
                        const startX = visXToScreenX(visX);
                        const width = visXToScreenX(visX+1) - startX;
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
                    const startX = visXToScreenX(visX);
                    const width = visXToScreenX(visX+1) - startX;
                    const yPos = (ft.y - BUFFER_HEIGHT) * BLOCK_SIZE;
                    return <text key={ft.id} x={startX + width/2} y={yPos + BLOCK_SIZE/2} fill={ft.color} textAnchor="middle" className="floating-score" fontSize="24">{ft.text}</text>;
                }
                return null;
            })}

            {/* HUD Meters - only visible in PERISCOPE phase at appropriate rank */}
            {state.phase === GamePhase.PERISCOPE && (
                <>
                    {/* Left meter: Laser Capacitor (drains as player pops) - rank 1+ */}
                    {rank >= 1 && (
                        <g>
                            {/* Cooldown timer above meter */}
                            {complicationCooldowns && complicationCooldowns[ComplicationType.LASER] > Date.now() && (
                                <text
                                    x={vbX + 8 + 6}
                                    y={vbH * 0.04 - 4}
                                    fill="white"
                                    fontSize="10"
                                    textAnchor="middle"
                                    fontFamily="monospace"
                                >
                                    {Math.ceil((complicationCooldowns[ComplicationType.LASER] - Date.now()) / 1000)}s
                                </text>
                            )}
                            <HudMeter
                                value={laserCapacitor}
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
                            {complicationCooldowns && complicationCooldowns[ComplicationType.CONTROLS] > Date.now() && (
                                <text
                                    x={vbX + vbW - 20 + 6}
                                    y={vbH * 0.04 - 4}
                                    fill="white"
                                    fontSize="10"
                                    textAnchor="middle"
                                    fontFamily="monospace"
                                >
                                    {Math.ceil((complicationCooldowns[ComplicationType.CONTROLS] - Date.now()) / 1000)}s
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
                    // Map ComplicationType to display name
                    const typeNames: Record<ComplicationType, string> = {
                        [ComplicationType.LIGHTS]: 'Lights',
                        [ComplicationType.CONTROLS]: 'Controls',
                        [ComplicationType.LASER]: 'Laser'
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
