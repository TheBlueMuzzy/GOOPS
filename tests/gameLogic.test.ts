import { describe, it, expect } from 'vitest';
import {
  getRotatedCells,
  getPaletteForRank,
  checkCollision,
  findContiguousGroup,
  getFloatingBlocks,
  calculateHeightBonus,
  calculateOffScreenBonus,
  calculateMultiplier,
  calculateAdjacencyBonus,
} from '../utils/gameLogic';
import { TOTAL_WIDTH, TOTAL_HEIGHT, COLORS } from '../constants';
import { GridCell, ActivePiece, PieceType, PieceState } from '../types';

// Helper to create an empty grid
const createEmptyGrid = (): GridCell[][] => {
  return Array(TOTAL_HEIGHT).fill(null).map(() => Array(TOTAL_WIDTH).fill(null));
};

// Helper to create a mock piece
const createMockPiece = (x: number, y: number, cells: { x: number; y: number }[]): ActivePiece => ({
  definition: { type: PieceType.T, color: COLORS.RED, cells },
  x,
  y,
  screenX: x,
  rotation: 0,
  cells,
  spawnTimestamp: Date.now(),
  startSpawnY: 0,
  state: PieceState.FALLING,
});

// Helper to place a cell on the grid
const placeCell = (
  grid: GridCell[][],
  x: number,
  y: number,
  color: string,
  groupId: string
): void => {
  grid[y][x] = {
    id: `cell-${x}-${y}`,
    groupId,
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

  it('rotates cells clockwise correctly', () => {
    const cells = [{ x: 0, y: -1 }, { x: 0, y: 0 }, { x: 0, y: 1 }]; // Vertical line
    const rotated = getRotatedCells(cells, true).map(c => ({ x: normalize(c.x), y: normalize(c.y) }));

    // Clockwise: (x, y) -> (-y, x)
    expect(rotated[0]).toEqual({ x: 1, y: 0 });
    expect(rotated[1]).toEqual({ x: 0, y: 0 });
    expect(rotated[2]).toEqual({ x: -1, y: 0 });
  });

  it('rotates cells counter-clockwise correctly', () => {
    const cells = [{ x: 0, y: -1 }, { x: 0, y: 0 }, { x: 0, y: 1 }]; // Vertical line
    const rotated = getRotatedCells(cells, false).map(c => ({ x: normalize(c.x), y: normalize(c.y) }));

    // Counter-clockwise: (x, y) -> (y, -x)
    expect(rotated[0]).toEqual({ x: -1, y: 0 });
    expect(rotated[1]).toEqual({ x: 0, y: 0 });
    expect(rotated[2]).toEqual({ x: 1, y: 0 });
  });

  it('rotating 4 times clockwise returns to original', () => {
    const original = [{ x: 1, y: 0 }, { x: 0, y: 1 }];
    let cells = original;

    for (let i = 0; i < 4; i++) {
      cells = getRotatedCells(cells, true);
    }

    // Normalize and compare
    const normalized = cells.map(c => ({ x: normalize(c.x), y: normalize(c.y) }));
    expect(normalized).toEqual(original);
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

  it('adds ORANGE at rank 10', () => {
    const palette = getPaletteForRank(10);
    expect(palette).toHaveLength(5);
    expect(palette).toContain(COLORS.ORANGE);
  });

  it('adds PURPLE at rank 20', () => {
    const palette = getPaletteForRank(20);
    expect(palette).toHaveLength(6);
    expect(palette).toContain(COLORS.PURPLE);
  });

  it('adds WHITE at rank 30', () => {
    const palette = getPaletteForRank(30);
    expect(palette).toHaveLength(7);
    expect(palette).toContain(COLORS.WHITE);
  });

  it('has all 7 colors at rank 39', () => {
    const palette = getPaletteForRank(39);
    expect(palette).toHaveLength(7);
    expect(palette).toContain(COLORS.RED);
    expect(palette).toContain(COLORS.BLUE);
    expect(palette).toContain(COLORS.GREEN);
    expect(palette).toContain(COLORS.YELLOW);
    expect(palette).toContain(COLORS.ORANGE);
    expect(palette).toContain(COLORS.PURPLE);
    expect(palette).toContain(COLORS.WHITE);
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
    const piece = createMockPiece(15, TOTAL_HEIGHT - 0.5, [{ x: 0, y: 0 }]);

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

  it('does not include different groupIds', () => {
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
    placeCell(grid, 5, TOTAL_HEIGHT - 1, COLORS.RED, 'group1');

    const { falling } = getFloatingBlocks(grid);

    expect(falling).toHaveLength(0);
  });

  it('detects floating single block', () => {
    const grid = createEmptyGrid();
    // Block floating in mid-air
    placeCell(grid, 5, 10, COLORS.RED, 'group1');

    const { falling } = getFloatingBlocks(grid);

    expect(falling).toHaveLength(1);
    expect(falling[0].x).toBe(5);
    expect(falling[0].y).toBe(10);
  });

  it('keeps block supported by another group', () => {
    const grid = createEmptyGrid();
    // Support block on floor
    placeCell(grid, 5, TOTAL_HEIGHT - 1, COLORS.RED, 'group1');
    // Block sitting on top (different group)
    placeCell(grid, 5, TOTAL_HEIGHT - 2, COLORS.BLUE, 'group2');

    const { falling } = getFloatingBlocks(grid);

    expect(falling).toHaveLength(0);
  });

  it('entire group falls together (sticky gravity)', () => {
    const grid = createEmptyGrid();
    // Floating group of 3 connected blocks
    placeCell(grid, 5, 10, COLORS.RED, 'group1');
    placeCell(grid, 6, 10, COLORS.RED, 'group1');
    placeCell(grid, 5, 11, COLORS.RED, 'group1');

    const { falling } = getFloatingBlocks(grid);

    expect(falling).toHaveLength(3);
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
      const lowBonus = calculateHeightBonus(TOTAL_HEIGHT - 1);

      expect(highBonus).toBeGreaterThan(lowBonus);
    });

    it('returns 0 or positive', () => {
      expect(calculateHeightBonus(TOTAL_HEIGHT - 1)).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateOffScreenBonus', () => {
    it('returns 0 for visible blocks', () => {
      const bonus = calculateOffScreenBonus(5, 0); // x=5 with offset 0 is visible
      expect(bonus).toBe(0);
    });

    it('returns 50 for off-screen blocks', () => {
      // Block far from viewport center
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
