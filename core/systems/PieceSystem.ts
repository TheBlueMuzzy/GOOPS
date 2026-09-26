/**
 * PieceSystem.ts - Piece operations
 *
 * Handles piece spawning, collision detection, rotation, and movement.
 * All functions are pure.
 *
 * C# Note: Maps to a static class with pure methods.
 */

import { ActivePiece, PieceDefinition, Coordinate, GridCell } from '../../types';
import { TOTAL_WIDTH, TOTAL_HEIGHT, PIECES, VISIBLE_WIDTH } from '../../constants';
import { normalizeX, getPaletteForRank } from './GridSystem';

/**
 * Spawn a new piece
 */
export function spawnPiece(
  definition?: PieceDefinition,
  rank: number = 1
): ActivePiece {
  const def = definition || PIECES[Math.floor(Math.random() * PIECES.length)];
  const palette = getPaletteForRank(rank);
  const color = palette[Math.floor(Math.random() * palette.length)];

  return {
    definition: { ...def, color },
    x: 0, // Set by caller
    y: 0, // Set by caller
    rotation: 0,
    cells: [...def.cells],
    spawnTimestamp: Date.now(),
    startSpawnY: 0, // Set by caller
  };
}

/**
 * Get centered spawn X position
 */
export function getCenteredSpawnX(boardOffset: number): number {
  return normalizeX(boardOffset + Math.floor((VISIBLE_WIDTH - 1) / 2));
}

/**
 * Rotate cells 90 degrees
 */
export function getRotatedCells(cells: Coordinate[], clockwise: boolean): Coordinate[] {
  return cells.map(({ x, y }) => {
    if (clockwise) {
      return { x: -y, y: x };
    } else {
      return { x: y, y: -x };
    }
  });
}

/**
 * Check if piece collides with grid or boundaries
 */
export function checkCollision(
  grid: GridCell[][],
  piece: ActivePiece,
  boardOffset: number
): boolean {
  for (const cell of piece.cells) {
    const x = normalizeX(piece.x + cell.x);
    const y = piece.y + cell.y;

    // Floor check
    if (y + 1 > TOTAL_HEIGHT) return true;

    // Grid cell check with proper sub-pixel handling
    const rStart = Math.floor(y);
    const rEnd = Math.floor(y + 1 - 0.0001);

    for (let r = rStart; r <= rEnd; r++) {
      if (r >= 0 && r < TOTAL_HEIGHT) {
        if (grid[r][x] !== null) return true;
      }
    }
  }
  return false;
}

/**
 * Get the Y position where the piece would land (ghost piece position)
 */
export function getGhostY(
  grid: GridCell[][],
  piece: ActivePiece,
  boardOffset: number
): number {
  const startY = Math.floor(piece.y);
  let y = startY;

  while (y < TOTAL_HEIGHT && !checkCollision(grid, { ...piece, y: y + 1 }, boardOffset)) {
    y += 1;
  }

  return Math.max(startY, y);
}

/**
 * Apply wall kicks for rotation
 * Returns the valid piece position after kicks, or null if no valid position
 */
export function applyWallKicks(
  grid: GridCell[][],
  piece: ActivePiece,
  newCells: Coordinate[],
  newRotation: number,
  boardOffset: number
): ActivePiece | null {
  const kicks = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: -1 },
    { x: 1, y: -1 },
    { x: -1, y: -1 },
    { x: 2, y: 0 },
    { x: -2, y: 0 },
  ];

  const tempPiece = { ...piece, cells: newCells, rotation: newRotation };

  for (const kick of kicks) {
    const kickedPiece = {
      ...tempPiece,
      x: normalizeX(tempPiece.x + kick.x),
      y: tempPiece.y + kick.y,
    };

    if (!checkCollision(grid, kickedPiece, boardOffset)) {
      return kickedPiece;
    }
  }

  return null;
}

/**
 * Move piece horizontally (and board offset for cylindrical movement)
 * Returns new piece and offset, or null if blocked
 */
export function movePieceAndBoard(
  grid: GridCell[][],
  piece: ActivePiece,
  boardOffset: number,
  direction: number // 1 = left, -1 = right
): { piece: ActivePiece; boardOffset: number } | null {
  const newOffset = normalizeX(boardOffset + direction);
  const newPieceX = normalizeX(piece.x + direction);
  const tempPiece = { ...piece, x: newPieceX };

  if (!checkCollision(grid, tempPiece, newOffset)) {
    return { piece: tempPiece, boardOffset: newOffset };
  }

  return null;
}

/**
 * Move piece down by given amount
 * Returns new piece or null if blocked
 */
export function movePieceDown(
  grid: GridCell[][],
  piece: ActivePiece,
  boardOffset: number,
  amount: number
): ActivePiece | null {
  const nextPiece = { ...piece, y: piece.y + amount };

  if (checkCollision(grid, nextPiece, boardOffset)) {
    return null;
  }

  return nextPiece;
}

/**
 * Attempt to place swapped piece, with collision resolution
 */
export function placeSwappedPiece(
  grid: GridCell[][],
  currentPiece: ActivePiece,
  newDefinition: PieceDefinition,
  boardOffset: number
): ActivePiece | null {
  const newPiece: ActivePiece = {
    ...currentPiece,
    definition: newDefinition,
    cells: [...newDefinition.cells],
    rotation: 0,
    spawnTimestamp: Date.now(),
    startSpawnY: 1,
  };

  // Try in-place first
  if (!checkCollision(grid, newPiece, boardOffset)) {
    return newPiece;
  }

  // Try nudges
  const nudges = [
    { x: 0, y: -1 },  // Up
    { x: -1, y: 0 },  // Left
    { x: 1, y: 0 },   // Right
  ];

  for (const nudge of nudges) {
    const nudgedPiece = {
      ...newPiece,
      x: normalizeX(newPiece.x + nudge.x),
      y: newPiece.y + nudge.y,
    };

    if (!checkCollision(grid, nudgedPiece, boardOffset)) {
      return nudgedPiece;
    }
  }

  // Fallback to spawn position
  const spawnPiece = {
    ...newPiece,
    x: getCenteredSpawnX(boardOffset),
    y: 1,
  };

  if (!checkCollision(grid, spawnPiece, boardOffset)) {
    return spawnPiece;
  }

  return null; // Cannot place - game over scenario
}

// Re-export normalizeX for convenience
export { normalizeX };
