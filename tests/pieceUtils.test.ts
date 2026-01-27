import { describe, it, expect } from 'vitest';
import { coordKey, isConnected, findBestSplit, splitPiece } from '../utils/pieceUtils';
import { GoopShape } from '../types';

describe('coordKey', () => {
  it('creates consistent string keys', () => {
    expect(coordKey({ x: 0, y: 0 })).toBe('0,0');
    expect(coordKey({ x: 1, y: 2 })).toBe('1,2');
    expect(coordKey({ x: -1, y: 3 })).toBe('-1,3');
  });
});

describe('isConnected', () => {
  it('returns true for empty array', () => {
    expect(isConnected([])).toBe(true);
  });

  it('returns true for single cell', () => {
    expect(isConnected([{ x: 0, y: 0 }])).toBe(true);
  });

  it('returns true for horizontally adjacent cells (I-piece shape)', () => {
    // I-piece: 4 cells in a row
    const cells = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ];
    expect(isConnected(cells)).toBe(true);
  });

  it('returns true for vertically adjacent cells', () => {
    const cells = [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 2 },
    ];
    expect(isConnected(cells)).toBe(true);
  });

  it('returns true for L-shaped connected cells', () => {
    const cells = [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ];
    expect(isConnected(cells)).toBe(true);
  });

  it('returns false for disconnected cells', () => {
    const cells = [
      { x: 0, y: 0 },
      { x: 2, y: 0 }, // Gap at x=1
    ];
    expect(isConnected(cells)).toBe(false);
  });

  it('returns false for diagonally adjacent only (not 4-connected)', () => {
    const cells = [
      { x: 0, y: 0 },
      { x: 1, y: 1 }, // Diagonal, not orthogonally adjacent
    ];
    expect(isConnected(cells)).toBe(false);
  });

  it('returns false for two separate groups', () => {
    const cells = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 5, y: 5 },
      { x: 5, y: 6 },
    ];
    expect(isConnected(cells)).toBe(false);
  });
});

describe('findBestSplit', () => {
  it('returns null for single cell', () => {
    expect(findBestSplit([{ x: 0, y: 0 }])).toBe(null);
  });

  it('returns null for empty array', () => {
    expect(findBestSplit([])).toBe(null);
  });

  it('finds 2+2 split for I-piece (4 linear cells)', () => {
    // I-piece: horizontal line
    const cells = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ];
    const split = findBestSplit(cells);
    expect(split).not.toBe(null);

    const [groupA, groupB] = split!;
    // Should be balanced: 2+2
    expect(groupA.length).toBe(2);
    expect(groupB.length).toBe(2);

    // Both groups should form connected regions
    expect(isConnected(groupA.map(i => cells[i]))).toBe(true);
    expect(isConnected(groupB.map(i => cells[i]))).toBe(true);
  });

  it('finds 2+2 split for O-piece (2x2 square)', () => {
    // O-piece: square
    const cells = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ];
    const split = findBestSplit(cells);
    expect(split).not.toBe(null);

    const [groupA, groupB] = split!;
    expect(groupA.length).toBe(2);
    expect(groupB.length).toBe(2);

    expect(isConnected(groupA.map(i => cells[i]))).toBe(true);
    expect(isConnected(groupB.map(i => cells[i]))).toBe(true);
  });

  it('finds 3+1 split for T-piece', () => {
    // T-piece: 3 cells in row + 1 below middle
    const cells = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 1, y: 1 },
    ];
    const split = findBestSplit(cells);
    expect(split).not.toBe(null);

    const [groupA, groupB] = split!;
    // T-piece can only be split 3+1 while keeping both groups connected
    expect(Math.abs(groupA.length - groupB.length)).toBeLessThanOrEqual(2);
    expect(groupA.length + groupB.length).toBe(4);

    expect(isConnected(groupA.map(i => cells[i]))).toBe(true);
    expect(isConnected(groupB.map(i => cells[i]))).toBe(true);
  });

  it('finds 2+2 split for S-piece', () => {
    // S-piece: zigzag
    const cells = [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ];
    const split = findBestSplit(cells);
    expect(split).not.toBe(null);

    const [groupA, groupB] = split!;
    expect(groupA.length).toBe(2);
    expect(groupB.length).toBe(2);

    expect(isConnected(groupA.map(i => cells[i]))).toBe(true);
    expect(isConnected(groupB.map(i => cells[i]))).toBe(true);
  });

  it('finds 2+2 split for Z-piece', () => {
    // Z-piece: zigzag (opposite of S)
    const cells = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ];
    const split = findBestSplit(cells);
    expect(split).not.toBe(null);

    const [groupA, groupB] = split!;
    expect(groupA.length).toBe(2);
    expect(groupB.length).toBe(2);

    expect(isConnected(groupA.map(i => cells[i]))).toBe(true);
    expect(isConnected(groupB.map(i => cells[i]))).toBe(true);
  });

  it('handles 2-cell piece (minimum valid split)', () => {
    const cells = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ];
    const split = findBestSplit(cells);
    expect(split).not.toBe(null);

    const [groupA, groupB] = split!;
    expect(groupA.length).toBe(1);
    expect(groupB.length).toBe(1);
  });
});

describe('splitPiece', () => {
  it('returns piece with cellColors array', () => {
    const definition = {
      type: GoopShape.I,
      cells: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
      ],
      color: 'red', // Original color
    };

    const split = splitPiece(definition, 'blue', 'green');

    expect(split.type).toBe(GoopShape.I);
    expect(split.color).toBe('blue'); // Fallback color
    expect(split.cellColors).toBeDefined();
    expect(split.cellColors!.length).toBe(4);

    // Should have exactly 2 of each color (balanced split)
    const blueCount = split.cellColors!.filter(c => c === 'blue').length;
    const greenCount = split.cellColors!.filter(c => c === 'green').length;
    expect(blueCount).toBe(2);
    expect(greenCount).toBe(2);
  });

  it('preserves piece type and cells', () => {
    const definition = {
      type: GoopShape.T,
      cells: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 1, y: 1 },
      ],
      color: 'yellow',
    };

    const split = splitPiece(definition, 'red', 'blue');

    expect(split.type).toBe(GoopShape.T);
    expect(split.cells).toEqual(definition.cells);
    expect(split.cellColors!.length).toBe(4);
  });

  it('handles T-piece with 3+1 split', () => {
    const definition = {
      type: GoopShape.T,
      cells: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 1, y: 1 },
      ],
      color: 'yellow',
    };

    const split = splitPiece(definition, 'red', 'blue');

    const redCount = split.cellColors!.filter(c => c === 'red').length;
    const blueCount = split.cellColors!.filter(c => c === 'blue').length;

    // T-piece can only split 3+1 or 1+3
    expect([redCount, blueCount].sort()).toEqual([1, 3]);
  });

  it('does not modify the original definition', () => {
    const definition = {
      type: GoopShape.I,
      cells: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
      ],
      color: 'red',
    };

    const original = { ...definition };
    splitPiece(definition, 'blue', 'green');

    expect(definition.type).toBe(original.type);
    expect(definition.color).toBe(original.color);
    expect(definition.cellColors).toBeUndefined(); // Original unchanged
  });
});
