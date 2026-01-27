
import { ActivePiece, Coordinate, GridCell, PieceDefinition, GoopShape, BlockData, FallingBlock, GoalMark, PieceState } from '../types';
import { TOTAL_WIDTH, TOTAL_HEIGHT, PIECES, GAME_COLORS, VISIBLE_WIDTH, BUFFER_HEIGHT, COLORS, VISIBLE_HEIGHT } from '../constants';

// Re-export normalizeX from coordinates to maintain API compatibility
export { normalizeX } from './coordinates';
import { normalizeX } from './coordinates';

export const getRotatedCells = (cells: Coordinate[], clockwise: boolean): Coordinate[] => {
  return cells.map(({ x, y }) => {
    if (clockwise) {
      return { x: -y, y: x };
    } else {
      return { x: y, y: -x };
    }
  });
};

export const getPaletteForRank = (rank: number): string[] => {
  const palette = [COLORS.RED, COLORS.BLUE, COLORS.GREEN, COLORS.YELLOW];
  if (rank >= 10) palette.push(COLORS.PURPLE);   // Was rank 20
  if (rank >= 30) palette.push(COLORS.WHITE);    // Unchanged
  if (rank >= 50) palette.push(COLORS.BLACK);    // New max rank color
  return palette;
};

export const spawnPiece = (definition?: PieceDefinition, rank: number = 1): ActivePiece => {
  const def = definition || PIECES[Math.floor(Math.random() * PIECES.length)];
  const palette = getPaletteForRank(rank);
  // Use definition's color if it's a valid game color, otherwise generate random
  const isValidColor = definition?.color && palette.includes(definition.color);
  const color = isValidColor ? definition.color : palette[Math.floor(Math.random() * palette.length)];

  return {
    definition: { ...def, color },
    x: 0, // Set by caller
    y: 0, // Set by caller
    screenX: 0, // Set by caller
    rotation: 0,
    cells: [...def.cells],
    spawnTimestamp: Date.now(),
    startSpawnY: 0, // Set by caller
    state: PieceState.SPAWNED
  };
};

export const createInitialGrid = (rank: number, powerUps?: Record<string, number>): GridCell[][] => {
  const grid = Array(TOTAL_HEIGHT).fill(null).map(() => Array(TOTAL_WIDTH).fill(null));

  // Starting Junk Logic (Section 11.2)
  let junkCount = 0;
  if (rank >= 9) junkCount = 11;      // ~35%
  else if (rank >= 6) junkCount = 8;  // ~25%
  else if (rank >= 3) junkCount = 5;  // ~15%

  if (junkCount > 0) {
      const palette = getPaletteForRank(rank);
      const availableCols = Array.from({ length: TOTAL_WIDTH }, (_, i) => i);

      // Fisher-Yates shuffle to pick unique columns
      for (let i = availableCols.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [availableCols[i], availableCols[j]] = [availableCols[j], availableCols[i]];
      }

      const selectedCols = availableCols.slice(0, junkCount);
      const y = TOTAL_HEIGHT - 1;

      // JUNK_UNIFORMER: bias toward same color (+10% per level)
      const uniformerLevel = powerUps?.['JUNK_UNIFORMER'] || 0;
      const biasChance = uniformerLevel * 0.10; // 0%, 10%, 20%, 30%, 40%
      let anchorColor: string | null = null;

      selectedCols.forEach(x => {
          let color: string;
          if (anchorColor === null) {
              // First block: pick random color as anchor
              color = palette[Math.floor(Math.random() * palette.length)];
              anchorColor = color;
          } else {
              // Subsequent blocks: biasChance to match anchor, else random
              const useAnchor = Math.random() < biasChance;
              color = useAnchor ? anchorColor : palette[Math.floor(Math.random() * palette.length)];
          }

          const groupId = Math.random().toString(36).substr(2, 9);

          grid[y][x] = {
              id: Math.random().toString(36).substr(2, 9),
              groupId: groupId, // Unique group ID for each junk block = Single Unit Globs
              timestamp: Date.now(),
              color: color,
              groupMinY: y,
              groupMaxY: y,
              groupSize: 1
          };
      });
  }

  return grid;
};

export const checkCollision = (grid: GridCell[][], piece: ActivePiece, boardOffset: number): boolean => {
  for (const cell of piece.cells) {
    const x = normalizeX(piece.x + cell.x);
    const y = piece.y + cell.y;

    // Floor Check:
    // A block at y spans [y, y+1).
    // It hits the floor if the bottom edge (y + 1) is > TOTAL_HEIGHT.
    if (y + 1 > TOTAL_HEIGHT) return true;

    // Grid Cell Check:
    // We must check all integer grid rows that this block overlaps.
    // A block at y spans [y, y+1).
    // Using a strict epsilon to ensure we detect collision as soon as we cross the boundary.

    const rStart = Math.floor(y);
    const rEnd = Math.floor(y + 1 - 0.0001);

    for (let r = rStart; r <= rEnd; r++) {
        if (r >= 0 && r < TOTAL_HEIGHT) {
           if (grid[r][x] !== null) return true;
        }
    }
  }
  return false;
};

export const getGhostY = (grid: GridCell[][], piece: ActivePiece, boardOffset: number): number => {
  const startY = Math.floor(piece.y);
  let y = startY;

  // Search downwards for the first invalid position
  while (y < TOTAL_HEIGHT && !checkCollision(grid, { ...piece, y: y + 1 }, boardOffset)) {
    y += 1;
  }
  
  return Math.max(startY, y);
};

export const findContiguousGroup = (grid: GridCell[][], startX: number, startY: number): Coordinate[] => {
  const startCell = grid[startY][startX];
  if (!startCell) return [];

  const group: Coordinate[] = [];
  const visited = new Set<string>();
  const queue: Coordinate[] = [{ x: startX, y: startY }];
  
  const targetGroupId = startCell.groupId;

  while (queue.length > 0) {
    const { x, y } = queue.shift()!;
    const key = `${x},${y}`;
    
    if (visited.has(key)) continue;
    visited.add(key);
    group.push({ x, y });

    const neighbors = [
      { x: normalizeX(x + 1), y: y },
      { x: normalizeX(x - 1), y: y },
      { x: x, y: y + 1 },
      { x: x, y: y - 1 }
    ];

    for (const n of neighbors) {
      if (n.y >= 0 && n.y < TOTAL_HEIGHT) {
        const neighborCell = grid[n.y][n.x];
        if (neighborCell && neighborCell.groupId === targetGroupId) {
           if (!visited.has(`${n.x},${n.y}`)) {
             queue.push(n);
           }
        }
      }
    }
  }

  return group;
};

export const updateGroups = (grid: GridCell[][]): GridCell[][] => {
    const newGrid = grid.map(row => [...row]);
    const visited = new Set<string>();

    // Helper to find contiguous group (by color, or all wild cells together)
    const findColorGroup = (gx: number, gy: number, color: string, isWild: boolean): Coordinate[] => {
        const g: Coordinate[] = [];
        const q: Coordinate[] = [{x: gx, y: gy}];
        const v = new Set<string>();

        while(q.length > 0) {
            const curr = q.shift()!;
            const key = `${curr.x},${curr.y}`;
            if(v.has(key)) continue;
            v.add(key);
            g.push(curr);

            const nbs = [
                { x: normalizeX(curr.x + 1), y: curr.y },
                { x: normalizeX(curr.x - 1), y: curr.y },
                { x: curr.x, y: curr.y + 1 },
                { x: curr.x, y: curr.y - 1 }
            ];

            for(const n of nbs) {
                if(n.y >= 0 && n.y < TOTAL_HEIGHT) {
                    const c = newGrid[n.y][n.x];
                    if (!c || v.has(`${n.x},${n.y}`)) continue;
                    // Wild cells group together regardless of color
                    // Non-wild cells group by matching color
                    const sameGroup = isWild ? c.isWild : (c.color === color && !c.isWild);
                    if (sameGroup) {
                        q.push(n);
                    }
                }
            }
        }
        return g;
    };

    for (let y = 0; y < TOTAL_HEIGHT; y++) {
        for (let x = 0; x < TOTAL_WIDTH; x++) {
            const cell = newGrid[y][x];
            if (cell && !visited.has(`${x},${y}`)) {
                const group = findColorGroup(x, y, cell.color, !!cell.isWild);
                
                let minY = TOTAL_HEIGHT;
                let maxY = -1;
                
                group.forEach(pt => {
                    if (pt.y < minY) minY = pt.y;
                    if (pt.y > maxY) maxY = pt.y;
                });

                const newGroupSize = group.length;

                // Determine if this is a "changed" group (merge happened) or "unchanged"
                // It is unchanged if all current members have the same groupId and groupSize as the detected group
                let isUnchanged = true;
                const referenceId = cell.groupId;
                const referenceSize = cell.groupSize;
                
                if (referenceSize !== newGroupSize) {
                    isUnchanged = false;
                } else {
                    for (const pt of group) {
                        const member = newGrid[pt.y][pt.x];
                        if (!member || member.groupId !== referenceId || member.groupSize !== referenceSize) {
                            isUnchanged = false;
                            break;
                        }
                    }
                }

                const groupIdToUse = isUnchanged ? referenceId : Math.random().toString(36).substr(2, 9);
                // If changed (merged), reset timestamp to now to trigger fresh animation
                const timestampToUse = isUnchanged ? cell.timestamp : Date.now();
                
                group.forEach(pt => {
                    visited.add(`${pt.x},${pt.y}`);
                    const c = newGrid[pt.y][pt.x]!;
                    newGrid[pt.y][pt.x] = {
                        ...c,
                        groupId: groupIdToUse,
                        timestamp: timestampToUse,
                        groupMinY: minY,
                        groupMaxY: maxY,
                        groupSize: newGroupSize
                    };
                });
            }
        }
    }
    return newGrid;
};

// Returns updated grid AND any consumed goal marks AND destroyed goal marks (wrong color)
export const mergePiece = (
    grid: GridCell[][], 
    piece: ActivePiece, 
    goalMarks: GoalMark[]
): { grid: GridCell[][], consumedGoals: string[], destroyedGoals: string[] } => {
  
  const newGrid = grid.map(row => [...row]);
  const groupId = Math.random().toString(36).substr(2, 9);
  const now = Date.now();
  
  let minY = TOTAL_HEIGHT;
  let maxY = -1;
  const consumedGoals: string[] = [];
  const destroyedGoals: string[] = [];
  
  // Calculate bounds first
  piece.cells.forEach(cell => {
      const y = Math.floor(piece.y + cell.y);
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
  });

  const groupSize = piece.cells.length;

  const pieceIsWild = piece.definition.isWild;

  piece.cells.forEach((cell, idx) => {
    const x = normalizeX(piece.x + cell.x);
    const y = Math.floor(piece.y + cell.y);
    const cellColor = piece.definition.cellColors?.[idx] ?? piece.definition.color;

    if (y >= 0 && y < TOTAL_HEIGHT) {
      // Check for Goal Interaction (per-cell color matching, or wild matches any)
      const hitGoal = goalMarks.find(g => g.x === x && g.y === y);

      let isMatch = false;
      if (hitGoal && (hitGoal.color === cellColor || pieceIsWild)) {
          consumedGoals.push(hitGoal.id);
          isMatch = true;
      }
      // Non-matching color: crack persists (visible through goop)

      newGrid[y][x] = {
        id: Math.random().toString(36).substr(2, 9),
        groupId,
        timestamp: now,
        color: cellColor,
        groupMinY: minY,
        groupMaxY: maxY,
        groupSize,
        isGlowing: isMatch,
        isWild: pieceIsWild
      };
    }
  });
  
  return { grid: updateGroups(newGrid), consumedGoals, destroyedGoals };
};

/**
 * Process wild piece conversions after a piece locks:
 * - If piece is wild: mark ENTIRE adjacent goop groups as wild
 * - If piece is NOT wild: convert ENTIRE adjacent wild groups to piece's color
 * Affects whole connected groups, not just immediate neighbors.
 */
export const processWildConversions = (
    grid: GridCell[][],
    piece: ActivePiece
): GridCell[][] => {
    const newGrid = grid.map(row => [...row]);
    const pieceIsWild = piece.definition.isWild;
    const pieceColor = piece.definition.color;

    // Get all piece cell positions
    const pieceCells: { x: number; y: number }[] = [];
    piece.cells.forEach(cell => {
        const x = normalizeX(piece.x + cell.x);
        const y = Math.floor(piece.y + cell.y);
        if (y >= 0 && y < TOTAL_HEIGHT) {
            pieceCells.push({ x, y });
        }
    });

    // Collect groupIds of adjacent groups to convert
    const groupIdsToConvert = new Set<string>();

    // For each piece cell, check neighbors
    pieceCells.forEach(({ x, y }) => {
        const neighbors = [
            { x: normalizeX(x + 1), y: y },
            { x: normalizeX(x - 1), y: y },
            { x: x, y: y + 1 },
            { x: x, y: y - 1 }
        ];

        neighbors.forEach(n => {
            if (n.y >= 0 && n.y < TOTAL_HEIGHT) {
                const neighborCell = newGrid[n.y][n.x];
                if (!neighborCell) return;

                // Skip cells that are part of the piece itself
                const isPartOfPiece = pieceCells.some(pc => pc.x === n.x && pc.y === n.y);
                if (isPartOfPiece) return;

                if (pieceIsWild) {
                    // Wild piece landed: collect groupIds to mark as wild
                    if (!neighborCell.isWild) {
                        groupIdsToConvert.add(neighborCell.groupId);
                    }
                } else {
                    // Non-wild piece landed: collect wild groupIds to convert
                    if (neighborCell.isWild) {
                        groupIdsToConvert.add(neighborCell.groupId);
                    }
                }
            }
        });
    });

    // Apply conversion to entire groups
    if (groupIdsToConvert.size > 0) {
        for (let y = 0; y < TOTAL_HEIGHT; y++) {
            for (let x = 0; x < TOTAL_WIDTH; x++) {
                const cell = newGrid[y][x];
                if (cell && groupIdsToConvert.has(cell.groupId)) {
                    if (pieceIsWild) {
                        // Mark entire group as wild
                        newGrid[y][x] = { ...cell, isWild: true };
                    } else {
                        // Convert entire wild group to piece's color
                        newGrid[y][x] = { ...cell, color: pieceColor, isWild: false };
                    }
                }
            }
        }
    }

    return updateGroups(newGrid);
};

export const getFloatingBlocks = (grid: GridCell[][], columnsToCheck?: number[]): { grid: GridCell[][], falling: FallingBlock[] } => {
    // Implements "Sticky Gravity": 
    // An entire connected Group falls only if NO block in that group is supported.
    // A block is supported if it is on the floor (y=MAX) or on top of a supported group.

    const newGrid = grid.map(row => [...row]);
    const falling: FallingBlock[] = [];
    
    // 1. Map all Groups
    const groups = new Map<string, Coordinate[]>();
    const groupIds = new Set<string>();
    
    for (let y = 0; y < TOTAL_HEIGHT; y++) {
        for (let x = 0; x < TOTAL_WIDTH; x++) {
            const cell = newGrid[y][x];
            if (cell) {
                if (!groups.has(cell.groupId)) {
                    groups.set(cell.groupId, []);
                    groupIds.add(cell.groupId);
                }
                groups.get(cell.groupId)!.push({ x, y });
            }
        }
    }

    // 2. Iteratively determine support
    const supportedGroupIds = new Set<string>();
    let changed = true;

    while (changed) {
        changed = false;
        
        for (const gid of groupIds) {
            if (supportedGroupIds.has(gid)) continue;
            
            const blocks = groups.get(gid)!;
            let isSupported = false;
            
            for (const b of blocks) {
                // Ground support
                if (b.y === TOTAL_HEIGHT - 1) {
                    isSupported = true;
                    break;
                }
                
                // Stack support (from a different, supported group)
                const belowY = b.y + 1;
                if (belowY < TOTAL_HEIGHT) {
                    const belowCell = newGrid[belowY][b.x];
                    if (belowCell && belowCell.groupId !== gid && supportedGroupIds.has(belowCell.groupId)) {
                        isSupported = true;
                        break;
                    }
                }
            }
            
            if (isSupported) {
                supportedGroupIds.add(gid);
                changed = true;
            }
        }
    }

    // 3. Mark unsupported groups as falling
    for (const gid of groupIds) {
        if (!supportedGroupIds.has(gid)) {
            const blocks = groups.get(gid)!;
            for (const b of blocks) {
                falling.push({
                    data: newGrid[b.y][b.x]!,
                    x: b.x,
                    y: b.y,
                    velocity: 0
                });
                newGrid[b.y][b.x] = null;
            }
        }
    }
    
    return { grid: newGrid, falling };
};

export const updateFallingBlocks = (
    blocks: FallingBlock[], 
    grid: GridCell[][], 
    dt: number,
    gameSpeed: number
): { active: FallingBlock[], landed: FallingBlock[] } => {
    
    const active: FallingBlock[] = [];
    const landed: FallingBlock[] = [];
    const FALL_SPEED = 0.02 * dt; 
    
    const sortedBlocks = [...blocks].sort((a, b) => b.y - a.y);
    
    for (const block of sortedBlocks) {
        const nextY = block.y + FALL_SPEED;
        
        if (nextY >= TOTAL_HEIGHT - 1) {
            landed.push({ ...block, y: TOTAL_HEIGHT - 1 });
            continue;
        }
        
        const checkRow = Math.floor(nextY + 1);
        const col = block.x;
        
        if (grid[checkRow] && grid[checkRow][col]) {
             landed.push({ ...block, y: Math.floor(nextY) });
        } else {
             active.push({ ...block, y: nextY });
        }
    }
    
    return { active, landed };
};

export const calculateHeightBonus = (y: number): number => {
    return Math.max(0, (TOTAL_HEIGHT - y) * 10);
};

export const calculateOffScreenBonus = (x: number, boardOffset: number): number => {
    const center = normalizeX(boardOffset + VISIBLE_WIDTH / 2);
    let dist = Math.abs(x - center);
    if (dist > TOTAL_WIDTH / 2) dist = TOTAL_WIDTH - dist;
    
    if (dist > VISIBLE_WIDTH / 2) {
        return 50;
    }
    return 0;
};

export const calculateMultiplier = (combo: number): number => {
    return 1 + (combo * 0.1);
};

export const calculateAdjacencyBonus = (grid: GridCell[][], group: Coordinate[]): number => {
    let neighborsCount = 0;
    const groupKeys = new Set(group.map(g => `${g.x},${g.y}`));
    
    group.forEach(({x, y}) => {
         const nbs = [
            { x: normalizeX(x + 1), y },
            { x: normalizeX(x - 1), y },
            { x, y: y + 1 },
            { x, y: y - 1 }
        ];
        
        nbs.forEach(n => {
            if (n.y >= 0 && n.y < TOTAL_HEIGHT) {
                if (grid[n.y][n.x] && !groupKeys.has(`${n.x},${n.y}`)) {
                    neighborsCount++;
                }
            }
        });
    });
    
    return neighborsCount * 5;
};

// --- Goal Mark Logic ---

export const spawnGoalMark = (
    grid: GridCell[][],
    existingMarks: GoalMark[],
    rank: number,
    timeLeft: number,
    maxTime: number,
    crackDownActive: boolean = false  // CRACK_DOWN: restrict to bottom 4 rows
): GoalMark | null => {
    const palette = getPaletteForRank(rank);

    // Filter colors that already have a goal mark (Active colors are unavailable)
    const activeColors = new Set(existingMarks.map(m => m.color));
    const availableColors = palette.filter(c => !activeColors.has(c));

    if (availableColors.length === 0) return null;

    const color = availableColors[Math.floor(Math.random() * availableColors.length)];

    let spawnY: number;

    if (crackDownActive) {
        // CRACK_DOWN active: restrict to bottom 4 rows (TOTAL_HEIGHT - 4 to TOTAL_HEIGHT - 1)
        const minY = TOTAL_HEIGHT - 4;  // Row 15 (0-indexed)
        const maxY = TOTAL_HEIGHT - 1;  // Row 18
        spawnY = minY + Math.floor(Math.random() * (maxY - minY + 1));
    } else {
        // Normal spawning: Calculate Pressure Line Y index
        const pressureRatio = Math.max(0, 1 - (timeLeft / maxTime));
        const waterHeightBlocks = 1 + (pressureRatio * (VISIBLE_HEIGHT - 1));
        const pressureLineY = Math.floor(TOTAL_HEIGHT - waterHeightBlocks);

        // Valid Y range: [pressureLineY, TOTAL_HEIGHT - 1]
        spawnY = Math.max(BUFFER_HEIGHT, Math.min(TOTAL_HEIGHT - 1, pressureLineY));
    }

    // Try finding a valid empty spot (up to 20 attempts) at this specific Y
    for (let i = 0; i < 20; i++) {
        const x = Math.floor(Math.random() * TOTAL_WIDTH);
        const y = spawnY;

        // Ensure empty grid cell
        if (!grid[y][x] && !existingMarks.some(m => m.x === x && m.y === y)) {
            return {
                id: Math.random().toString(36).substr(2, 9),
                x,
                y,
                color,
                spawnTime: Date.now()
            };
        }
    }

    return null;
};

export const spawnGoalBurst = (
    grid: GridCell[][],
    existingMarks: GoalMark[],
    rank: number,
    timeLeft: number,
    maxTime: number
): GoalMark[] => {
    const palette = getPaletteForRank(rank);
    const newMarks: GoalMark[] = [];
    const currentMarks = [...existingMarks];

    // Calculate Pressure Line Y
    const pressureRatio = Math.max(0, 1 - (timeLeft / maxTime));
    const waterHeightBlocks = 1 + (pressureRatio * (VISIBLE_HEIGHT - 1));
    const pressureLineY = Math.floor(TOTAL_HEIGHT - waterHeightBlocks);
    
    // Spawn area: Above pressure line (y < pressureLineY), but within buffer/visible
    let minSpawnY = BUFFER_HEIGHT;
    let maxSpawnY = Math.max(BUFFER_HEIGHT, pressureLineY - 1);

    for (const color of palette) {
        // Try to find a spot for this color
        // 20 attempts per color
        for (let i = 0; i < 20; i++) {
            const x = Math.floor(Math.random() * TOTAL_WIDTH);
            const y = Math.floor(minSpawnY + Math.random() * (maxSpawnY - minSpawnY + 1));
            
            if (y < BUFFER_HEIGHT || y >= TOTAL_HEIGHT) continue;

            const hasBlock = grid[y][x] !== null;
            const hasMark = currentMarks.some(m => m.x === x && m.y === y);
            const inNewMarks = newMarks.some(m => m.x === x && m.y === y);

            if (!hasBlock && !hasMark && !inNewMarks) {
                const mark = {
                    id: Math.random().toString(36).substr(2, 9),
                    x,
                    y,
                    color,
                    spawnTime: Date.now()
                };
                newMarks.push(mark);
                break;
            }
        }
    }
    return newMarks;
};
