/**
 * GridSystem.ts - Grid operations
 *
 * Handles all grid manipulation: creation, merging pieces,
 * finding groups, updating group metadata, detecting floating blocks.
 *
 * All functions are pure: (grid, args) => newGrid
 *
 * C# Note: Maps to a static class or service with pure methods.
 */

import {
  GridCell, ActivePiece, Coordinate, BlockData, FallingBlock, GoalMark
} from '../../types';
import { TOTAL_WIDTH, TOTAL_HEIGHT, COLORS } from '../../constants';

/**
 * Normalize X coordinate for cylindrical wrapping
 */
export function normalizeX(x: number): number {
  return ((x % TOTAL_WIDTH) + TOTAL_WIDTH) % TOTAL_WIDTH;
}

/**
 * Get color palette based on player rank
 */
export function getPaletteForRank(rank: number): string[] {
  const palette = [COLORS.RED, COLORS.BLUE, COLORS.GREEN, COLORS.YELLOW];
  if (rank >= 2) palette.push(COLORS.TEAL);
  if (rank >= 5) palette.push(COLORS.WHITE);
  if (rank >= 8) palette.push(COLORS.ORANGE);
  return palette;
}

/**
 * Create empty grid
 */
export function createEmptyGrid(): GridCell[][] {
  return Array(TOTAL_HEIGHT).fill(null).map(() => Array(TOTAL_WIDTH).fill(null));
}

/**
 * Create initial grid with optional starting junk based on rank
 */
export function createInitialGrid(rank: number): GridCell[][] {
  const grid = createEmptyGrid();

  // Starting junk based on rank
  let junkCount = 0;
  if (rank >= 9) junkCount = 11;      // ~35%
  else if (rank >= 6) junkCount = 8;  // ~25%
  else if (rank >= 3) junkCount = 5;  // ~15%

  if (junkCount > 0) {
    const palette = getPaletteForRank(rank);
    const availableCols = Array.from({ length: TOTAL_WIDTH }, (_, i) => i);

    // Fisher-Yates shuffle
    for (let i = availableCols.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [availableCols[i], availableCols[j]] = [availableCols[j], availableCols[i]];
    }

    const selectedCols = availableCols.slice(0, junkCount);
    const y = TOTAL_HEIGHT - 1;

    selectedCols.forEach(x => {
      const color = palette[Math.floor(Math.random() * palette.length)];
      const groupId = generateId();

      grid[y][x] = {
        id: generateId(),
        groupId,
        timestamp: Date.now(),
        color,
        groupMinY: y,
        groupMaxY: y,
        groupSize: 1,
      };
    });
  }

  return grid;
}

/**
 * Find contiguous group by groupId starting from a cell
 */
export function findContiguousGroup(
  grid: GridCell[][],
  startX: number,
  startY: number
): Coordinate[] {
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
      { x: normalizeX(x + 1), y },
      { x: normalizeX(x - 1), y },
      { x, y: y + 1 },
      { x, y: y - 1 },
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
}

/**
 * Update group metadata for all cells in the grid.
 * Recalculates groupId, groupSize, groupMinY, groupMaxY based on color adjacency.
 */
export function updateGroups(grid: GridCell[][]): GridCell[][] {
  const newGrid = grid.map(row => [...row]);
  const visited = new Set<string>();

  // Find color-contiguous group
  const findColorGroup = (gx: number, gy: number, color: string): Coordinate[] => {
    const g: Coordinate[] = [];
    const q: Coordinate[] = [{ x: gx, y: gy }];
    const v = new Set<string>();

    while (q.length > 0) {
      const curr = q.shift()!;
      const key = `${curr.x},${curr.y}`;
      if (v.has(key)) continue;
      v.add(key);
      g.push(curr);

      const nbs = [
        { x: normalizeX(curr.x + 1), y: curr.y },
        { x: normalizeX(curr.x - 1), y: curr.y },
        { x: curr.x, y: curr.y + 1 },
        { x: curr.x, y: curr.y - 1 },
      ];

      for (const n of nbs) {
        if (n.y >= 0 && n.y < TOTAL_HEIGHT) {
          const c = newGrid[n.y][n.x];
          if (c && c.color === color && !v.has(`${n.x},${n.y}`)) {
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
        const group = findColorGroup(x, y, cell.color);

        let minY = TOTAL_HEIGHT;
        let maxY = -1;

        group.forEach(pt => {
          if (pt.y < minY) minY = pt.y;
          if (pt.y > maxY) maxY = pt.y;
        });

        const newGroupSize = group.length;

        // Check if group is unchanged (same members, same size)
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

        const groupIdToUse = isUnchanged ? referenceId : generateId();
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
            groupSize: newGroupSize,
          };
        });
      }
    }
  }

  return newGrid;
}

/**
 * Merge a piece into the grid, returning new grid and any consumed goals
 */
export function mergePiece(
  grid: GridCell[][],
  piece: ActivePiece,
  goalMarks: GoalMark[]
): { grid: GridCell[][], consumedGoals: string[] } {
  const newGrid = grid.map(row => [...row]);
  const groupId = generateId();
  const now = Date.now();
  const consumedGoals: string[] = [];

  // Calculate bounds
  let minY = TOTAL_HEIGHT;
  let maxY = -1;

  piece.cells.forEach(cell => {
    const y = Math.floor(piece.y + cell.y);
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  });

  const groupSize = piece.cells.length;

  piece.cells.forEach(cell => {
    const x = normalizeX(piece.x + cell.x);
    const y = Math.floor(piece.y + cell.y);

    if (y >= 0 && y < TOTAL_HEIGHT) {
      // Check for goal consumption
      const hitGoal = goalMarks.find(g => g.x === x && g.y === y);
      const isMatch = hitGoal && hitGoal.color === piece.definition.color;

      if (isMatch) {
        consumedGoals.push(hitGoal!.id);
      }

      newGrid[y][x] = {
        id: generateId(),
        groupId,
        timestamp: now,
        color: piece.definition.color,
        groupMinY: minY,
        groupMaxY: maxY,
        groupSize,
        isGlowing: isMatch,
      };
    }
  });

  return { grid: updateGroups(newGrid), consumedGoals };
}

/**
 * Remove cells from grid and return floating blocks
 * Implements "sticky gravity" - entire groups fall together
 */
export function getFloatingBlocks(
  grid: GridCell[][],
  columnsToCheck?: number[]
): { grid: GridCell[][], falling: FallingBlock[] } {
  const newGrid = grid.map(row => [...row]);
  const falling: FallingBlock[] = [];

  // Map all groups
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

  // Iteratively determine support
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

        // Stack support from different supported group
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

  // Mark unsupported groups as falling
  for (const gid of groupIds) {
    if (!supportedGroupIds.has(gid)) {
      const blocks = groups.get(gid)!;
      for (const b of blocks) {
        falling.push({
          data: newGrid[b.y][b.x]!,
          x: b.x,
          y: b.y,
          velocity: 0,
        });
        newGrid[b.y][b.x] = null;
      }
    }
  }

  return { grid: newGrid, falling };
}

/**
 * Clear cells at given coordinates
 */
export function clearCells(
  grid: GridCell[][],
  cells: Coordinate[]
): GridCell[][] {
  const newGrid = grid.map(row => [...row]);
  cells.forEach(({ x, y }) => {
    newGrid[y][x] = null;
  });
  return newGrid;
}

// Helper to generate unique IDs
function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}
