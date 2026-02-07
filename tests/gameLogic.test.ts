import { describe, it, expect } from 'vitest';
import {
  getRotatedCells,
  getPaletteForRank,
  checkCollision,
  getGhostY,
  findContiguousGroup,
  getFloatingBlocks,
  calculateHeightBonus,
  calculateOffScreenBonus,
  calculateMultiplier,
  calculateAdjacencyBonus,
} from '../utils/gameLogic';
import { TANK_WIDTH, TANK_HEIGHT, COLORS } from '../constants';
import { TankCell, ActivePiece, GoopShape, GoopState } from '../types';

// Helper to create an empty grid
const createEmptyGrid = (): TankCell[][] => {
  return Array(TANK_HEIGHT).fill(null).map(() => Array(TANK_WIDTH).fill(null));
};

// Helper to create a mock piece
const createMockPiece = (x: number, y: number, cells: { x: number; y: number }[]): ActivePiece => ({
  definition: { type: GoopShape.T, color: COLORS.RED, cells },
  x,
  y,
  screenX: x,
  rotation: 0,
  cells,
  rotationCenter: {
    x: Math.round(cells.reduce((s, c) => s + c.x, 0) / cells.length),
    y: Math.round(cells.reduce((s, c) => s + c.y, 0) / cells.length),
  },
  spawnTimestamp: Date.now(),
  startSpawnY: 0,
  state: GoopState.FALLING,
});

// Helper to place a cell on the grid
const placeCell = (
  grid: TankCell[][],
  x: number,
  y: number,
  color: string,
  goopGroupId: string
): void => {
  grid[y][x] = {
    id: `cell-${x}-${y}`,
    goopGroupId,
    timestamp: Date.now(),
    color,
    groupMinY: y,
    groupMaxY: y,
    groupSize: 1,
  };
};

describe('getRotatedCells', () => {
  // Helper to normalize -0 to 0 for comparison
  const normalize = (n: number) => (n === 0 ? 0 : n);

  it('rotates origin-centered cells clockwise correctly', () => {
    const cells = [{ x: 0, y: -1 }, { x: 0, y: 0 }, { x: 0, y: 1 }]; // Vertical line centered at origin
    const rotated = getRotatedCells(cells, true).map(c => ({ x: normalize(c.x), y: normalize(c.y) }));

    // Centroid is (0,0), so rotation around origin: (x,y) -> (-y,x)
    expect(rotated[0]).toEqual({ x: 1, y: 0 });
    expect(rotated[1]).toEqual({ x: 0, y: 0 });
    expect(rotated[2]).toEqual({ x: -1, y: 0 });
  });

  it('rotates origin-centered cells counter-clockwise correctly', () => {
    const cells = [{ x: 0, y: -1 }, { x: 0, y: 0 }, { x: 0, y: 1 }]; // Vertical line centered at origin
    const rotated = getRotatedCells(cells, false).map(c => ({ x: normalize(c.x), y: normalize(c.y) }));

    // Centroid is (0,0), so rotation around origin: (x,y) -> (y,-x)
    expect(rotated[0]).toEqual({ x: -1, y: 0 });
    expect(rotated[1]).toEqual({ x: 0, y: 0 });
    expect(rotated[2]).toEqual({ x: 1, y: 0 });
  });

  it('rotating 4 times clockwise returns to original (origin-centered)', () => {
    const original = [{ x: 0, y: -1 }, { x: 0, y: 0 }, { x: 0, y: 1 }];
    const center = { x: 0, y: 0 }; // Fixed integer center
    let cells = original;

    for (let i = 0; i < 4; i++) {
      cells = getRotatedCells(cells, true, center);
    }

    const normalized = cells.map(c => ({ x: normalize(c.x), y: normalize(c.y) }));
    expect(normalized).toEqual(original);
  });

  it('rotates off-center cells around fixed integer center (corrupted T_I_C shape)', () => {
    // Corrupted T_I_C: cells at (0,2),(0,3),(1,0),(1,1) — centroid at (0.5, 1.5), rounds to (1,2)
    const cells = [{ x: 0, y: 2 }, { x: 0, y: 3 }, { x: 1, y: 0 }, { x: 1, y: 1 }];
    const center = { x: 1, y: 2 }; // Rounded from (0.5, 1.5)
    const rotated = getRotatedCells(cells, true, center);

    // With integer center, results should be exact integers
    rotated.forEach(c => {
      expect(Number.isInteger(c.x)).toBe(true);
      expect(Number.isInteger(c.y)).toBe(true);
    });
  });

  it('rotating 4 times returns EXACTLY to original with fixed center (off-center cells)', () => {
    const original = [{ x: 0, y: 2 }, { x: 0, y: 3 }, { x: 1, y: 0 }, { x: 1, y: 1 }];
    const center = { x: 1, y: 2 }; // Rounded from (0.5, 1.5)
    let cells = original;

    for (let i = 0; i < 4; i++) {
      cells = getRotatedCells(cells, true, center);
    }

    // With fixed integer center: zero drift, exact return
    expect(cells).toEqual(original);
  });

  it('I-bar with fixed center rotates 4 times and returns exactly to original', () => {
    // Standard I-bar: cells at (-1,0),(0,0),(1,0),(2,0) — centroid at (0.5, 0), rounds to (1, 0)
    const original = [{ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }];
    const center = { x: 1, y: 0 }; // Rounded from (0.5, 0)
    let cells = original;

    for (let i = 0; i < 4; i++) {
      cells = getRotatedCells(cells, true, center);
    }

    // Integer center + integer cells = exact return after 4 rotations
    expect(cells).toEqual(original);
  });

  it('I-bar rotates around fixed center (not origin)', () => {
    // Standard I-bar: cells at (-1,0),(0,0),(1,0),(2,0) — centroid at (0.5, 0)
    const cells = [{ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }];
    const center = { x: 1, y: 0 };
    const rotated = getRotatedCells(cells, true, center);

    // Should produce a vertical bar centered at x=1
    const rotCx = rotated.reduce((s, c) => s + c.x, 0) / rotated.length;
    expect(rotCx).toBe(1); // All cells should have x=1 after rotating vertical
  });
});

describe('getPaletteForRank', () => {
  it('returns 4 colors for rank 0-9', () => {
    const palette = getPaletteForRank(1);
    expect(palette).toHaveLength(4);
    expect(palette).toContain(COLORS.RED);
    expect(palette).toContain(COLORS.BLUE);
    expect(palette).toContain(COLORS.GREEN);
    expect(palette).toContain(COLORS.YELLOW);
  });

  it('still returns 4 colors at rank 9', () => {
    const palette = getPaletteForRank(9);
    expect(palette).toHaveLength(4);
  });

  it('adds PURPLE at rank 10', () => {
    const palette = getPaletteForRank(10);
    expect(palette).toHaveLength(5);
    expect(palette).toContain(COLORS.PURPLE);
  });

  it('still has 5 colors at rank 20 (no new color, multi-color pieces unlock)', () => {
    const palette = getPaletteForRank(20);
    expect(palette).toHaveLength(5);
    expect(palette).toContain(COLORS.PURPLE);
  });

  it('adds WHITE at rank 30', () => {
    const palette = getPaletteForRank(30);
    expect(palette).toHaveLength(6);
    expect(palette).toContain(COLORS.WHITE);
  });

  it('adds BLACK at rank 50 (max rank)', () => {
    const palette = getPaletteForRank(50);
    expect(palette).toHaveLength(7);
    expect(palette).toContain(COLORS.BLACK);
  });

  it('has all 7 colors at rank 50', () => {
    const palette = getPaletteForRank(50);
    expect(palette).toHaveLength(7);
    expect(palette).toContain(COLORS.RED);
    expect(palette).toContain(COLORS.BLUE);
    expect(palette).toContain(COLORS.GREEN);
    expect(palette).toContain(COLORS.YELLOW);
    expect(palette).toContain(COLORS.PURPLE);
    expect(palette).toContain(COLORS.WHITE);
    expect(palette).toContain(COLORS.BLACK);
  });
});

describe('checkCollision', () => {
  it('returns false for piece in empty space', () => {
    const grid = createEmptyGrid();
    const piece = createMockPiece(15, 10, [{ x: 0, y: 0 }]);

    expect(checkCollision(grid, piece, 0)).toBe(false);
  });

  it('returns true when piece hits floor', () => {
    const grid = createEmptyGrid();
    const piece = createMockPiece(15, TANK_HEIGHT - 0.5, [{ x: 0, y: 0 }]);

    expect(checkCollision(grid, piece, 0)).toBe(true);
  });

  it('returns true when piece overlaps existing block', () => {
    const grid = createEmptyGrid();
    placeCell(grid, 15, 10, COLORS.RED, 'group1');

    const piece = createMockPiece(15, 10, [{ x: 0, y: 0 }]);

    expect(checkCollision(grid, piece, 0)).toBe(true);
  });

  it('handles cylindrical wrapping', () => {
    const grid = createEmptyGrid();
    placeCell(grid, 0, 10, COLORS.RED, 'group1');

    // Piece at x=29 with cell offset x=1 should wrap to x=0
    const piece = createMockPiece(29, 10, [{ x: 1, y: 0 }]);

    expect(checkCollision(grid, piece, 0)).toBe(true);
  });
});

describe('findContiguousGroup', () => {
  it('returns empty array for empty cell', () => {
    const grid = createEmptyGrid();
    const group = findContiguousGroup(grid, 5, 5);

    expect(group).toHaveLength(0);
  });

  it('finds single cell group', () => {
    const grid = createEmptyGrid();
    placeCell(grid, 5, 5, COLORS.RED, 'group1');

    const group = findContiguousGroup(grid, 5, 5);

    expect(group).toHaveLength(1);
    expect(group[0]).toEqual({ x: 5, y: 5 });
  });

  it('finds horizontally connected cells', () => {
    const grid = createEmptyGrid();
    placeCell(grid, 5, 5, COLORS.RED, 'group1');
    placeCell(grid, 6, 5, COLORS.RED, 'group1');
    placeCell(grid, 7, 5, COLORS.RED, 'group1');

    const group = findContiguousGroup(grid, 5, 5);

    expect(group).toHaveLength(3);
  });

  it('finds vertically connected cells', () => {
    const grid = createEmptyGrid();
    placeCell(grid, 5, 5, COLORS.RED, 'group1');
    placeCell(grid, 5, 6, COLORS.RED, 'group1');
    placeCell(grid, 5, 7, COLORS.RED, 'group1');

    const group = findContiguousGroup(grid, 5, 5);

    expect(group).toHaveLength(3);
  });

  it('handles cylindrical wrapping for groups', () => {
    const grid = createEmptyGrid();
    placeCell(grid, 0, 5, COLORS.RED, 'group1');
    placeCell(grid, 29, 5, COLORS.RED, 'group1'); // Wraps around

    const group = findContiguousGroup(grid, 0, 5);

    expect(group).toHaveLength(2);
  });

  it('does not include different goopGroupIds', () => {
    const grid = createEmptyGrid();
    placeCell(grid, 5, 5, COLORS.RED, 'group1');
    placeCell(grid, 6, 5, COLORS.RED, 'group2'); // Same color, different group

    const group = findContiguousGroup(grid, 5, 5);

    expect(group).toHaveLength(1);
  });
});

describe('getFloatingBlocks (Sticky Gravity)', () => {
  it('returns empty for supported blocks', () => {
    const grid = createEmptyGrid();
    // Block on the floor
    placeCell(grid, 5, TANK_HEIGHT - 1, COLORS.RED, 'group1');

    const { looseGoop } = getFloatingBlocks(grid);

    expect(looseGoop).toHaveLength(0);
  });

  it('detects floating single block', () => {
    const grid = createEmptyGrid();
    // Block floating in mid-air
    placeCell(grid, 5, 10, COLORS.RED, 'group1');

    const { looseGoop } = getFloatingBlocks(grid);

    expect(looseGoop).toHaveLength(1);
    expect(looseGoop[0].x).toBe(5);
    expect(looseGoop[0].y).toBe(10);
  });

  it('keeps block supported by another group', () => {
    const grid = createEmptyGrid();
    // Support block on floor
    placeCell(grid, 5, TANK_HEIGHT - 1, COLORS.RED, 'group1');
    // Block sitting on top (different group)
    placeCell(grid, 5, TANK_HEIGHT - 2, COLORS.BLUE, 'group2');

    const { looseGoop } = getFloatingBlocks(grid);

    expect(looseGoop).toHaveLength(0);
  });

  it('entire group falls together (sticky gravity)', () => {
    const grid = createEmptyGrid();
    // Floating group of 3 connected blocks
    placeCell(grid, 5, 10, COLORS.RED, 'group1');
    placeCell(grid, 6, 10, COLORS.RED, 'group1');
    placeCell(grid, 5, 11, COLORS.RED, 'group1');

    const { looseGoop } = getFloatingBlocks(grid);

    expect(looseGoop).toHaveLength(3);
  });

  it('removes floating blocks from grid', () => {
    const grid = createEmptyGrid();
    placeCell(grid, 5, 10, COLORS.RED, 'group1');

    const { grid: newGrid } = getFloatingBlocks(grid);

    expect(newGrid[10][5]).toBeNull();
  });
});

describe('Scoring Functions', () => {
  describe('calculateHeightBonus', () => {
    it('gives higher bonus for lower Y (higher on screen)', () => {
      const highBonus = calculateHeightBonus(0);
      const lowBonus = calculateHeightBonus(TANK_HEIGHT - 1);

      expect(highBonus).toBeGreaterThan(lowBonus);
    });

    it('returns 0 or positive', () => {
      expect(calculateHeightBonus(TANK_HEIGHT - 1)).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateOffScreenBonus', () => {
    it('returns 0 for visible blocks', () => {
      const bonus = calculateOffScreenBonus(5, 0); // x=5 with offset 0 is visible
      expect(bonus).toBe(0);
    });

    it('returns 50 for off-screen blocks', () => {
      // Block far from tankViewport center
      const bonus = calculateOffScreenBonus(25, 0); // x=25 with offset 0 is off-screen
      expect(bonus).toBe(50);
    });
  });

  describe('calculateMultiplier', () => {
    it('returns 1 for combo 0', () => {
      expect(calculateMultiplier(0)).toBe(1);
    });

    it('increases by 0.1 per combo', () => {
      expect(calculateMultiplier(1)).toBe(1.1);
      expect(calculateMultiplier(5)).toBe(1.5);
      expect(calculateMultiplier(10)).toBe(2);
    });
  });

  describe('calculateAdjacencyBonus', () => {
    it('returns 0 for isolated group', () => {
      const grid = createEmptyGrid();
      placeCell(grid, 5, 5, COLORS.RED, 'group1');

      const bonus = calculateAdjacencyBonus(grid, [{ x: 5, y: 5 }]);

      expect(bonus).toBe(0);
    });

    it('gives bonus for adjacent different-group blocks', () => {
      const grid = createEmptyGrid();
      placeCell(grid, 5, 5, COLORS.RED, 'group1');
      placeCell(grid, 6, 5, COLORS.BLUE, 'group2'); // Adjacent, different group

      const bonus = calculateAdjacencyBonus(grid, [{ x: 5, y: 5 }]);

      expect(bonus).toBe(5); // 1 neighbor * 5
    });
  });
});

describe('getGhostY', () => {
  it('lands piece on top of existing blocks', () => {
    const grid = createEmptyGrid();
    // Place blocks at row 17
    placeCell(grid, 5, 17, COLORS.RED, 'group1');
    placeCell(grid, 6, 17, COLORS.RED, 'group1');

    // Piece above the blocks
    const piece = createMockPiece(5, 10, [{ x: 0, y: 0 }, { x: 1, y: 0 }]);

    const ghostY = getGhostY(grid, piece, 0);

    // Should land at row 16 (one above the blocks at 17)
    expect(ghostY).toBe(16);
  });

  it('retreats upward when piece starts inside collision (physics overshoot)', () => {
    const grid = createEmptyGrid();
    // Place blocks at row 17
    placeCell(grid, 5, 17, COLORS.RED, 'group1');
    placeCell(grid, 6, 17, COLORS.RED, 'group1');

    // Piece already overlapping at row 17 (simulates physics overshoot)
    const piece = createMockPiece(5, 17, [{ x: 0, y: 0 }, { x: 1, y: 0 }]);

    const ghostY = getGhostY(grid, piece, 0);

    // Should retreat to row 16 (one above the blocks), not stay at 17
    expect(ghostY).toBe(16);
  });

  it('lands on floor when no obstacles', () => {
    const grid = createEmptyGrid();
    const piece = createMockPiece(5, 0, [{ x: 0, y: 0 }]);

    const ghostY = getGhostY(grid, piece, 0);

    expect(ghostY).toBe(TANK_HEIGHT - 1);
  });
});
