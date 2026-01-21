
import { describe, it, expect } from 'vitest';
import {
  VIEWBOX,
  visXToScreenX,
  screenXToVisX,
  svgToVisual,
  visualToGrid,
  gridToPercentage,
  isInVisibleRange,
} from '../utils/coordinateTransform';
import { VISIBLE_WIDTH, TOTAL_WIDTH, BUFFER_HEIGHT } from '../constants';

describe('coordinateTransform', () => {
  describe('VIEWBOX', () => {
    it('has expected structure', () => {
      expect(VIEWBOX).toHaveProperty('x');
      expect(VIEWBOX).toHaveProperty('y');
      expect(VIEWBOX).toHaveProperty('w');
      expect(VIEWBOX).toHaveProperty('h');
    });

    it('has symmetric x bounds', () => {
      // x is negative half-width, w is total width
      // So w should equal -2 * x (since x is negative)
      expect(VIEWBOX.x).toBeLessThan(0);
      expect(VIEWBOX.w).toBeGreaterThan(0);
      expect(Math.abs(VIEWBOX.w + VIEWBOX.x * 2)).toBeLessThan(0.001);
    });

    it('y starts at 0', () => {
      expect(VIEWBOX.y).toBe(0);
    });
  });

  describe('visXToScreenX and screenXToVisX', () => {
    it('center column maps to screen x=0', () => {
      const centerCol = VISIBLE_WIDTH / 2;
      const screenX = visXToScreenX(centerCol);
      expect(Math.abs(screenX)).toBeLessThan(0.001);
    });

    it('roundtrip conversion preserves value', () => {
      const testValues = [0, 3, 6, 9, 11.5];
      for (const visX of testValues) {
        const screenX = visXToScreenX(visX);
        const recovered = screenXToVisX(screenX);
        expect(Math.abs(recovered - visX)).toBeLessThan(0.001);
      }
    });

    it('left edge maps to negative screen x', () => {
      const screenX = visXToScreenX(0);
      expect(screenX).toBeLessThan(0);
    });

    it('right edge maps to positive screen x', () => {
      const screenX = visXToScreenX(VISIBLE_WIDTH - 1);
      expect(screenX).toBeGreaterThan(0);
    });
  });

  describe('svgToVisual', () => {
    it('converts center of viewport correctly', () => {
      const svgX = 0; // Center
      const svgY = 30 * 8; // Middle row (8 blocks from top)
      const { visX, visY } = svgToVisual(svgX, svgY);

      expect(Math.abs(visX - VISIBLE_WIDTH / 2)).toBeLessThan(0.001);
      expect(Math.abs(visY - (8 + BUFFER_HEIGHT))).toBeLessThan(0.001);
    });
  });

  describe('visualToGrid', () => {
    it('converts visual to grid with zero offset', () => {
      const { col, row } = visualToGrid(5, 10, 0);
      expect(col).toBe(5);
      expect(row).toBe(10);
    });

    it('applies board offset correctly', () => {
      const { col, row } = visualToGrid(5, 10, 10);
      expect(col).toBe(15); // 5 + 10
      expect(row).toBe(10);
    });

    it('wraps around cylinder width', () => {
      const { col } = visualToGrid(5, 10, 28);
      // 5 + 28 = 33, wrapped to TOTAL_WIDTH (30) = 3
      expect(col).toBe(3);
    });

    it('handles negative offset wrapping', () => {
      const { col } = visualToGrid(2, 10, -5);
      // 2 + (-5) = -3, wrapped = 30 - 3 = 27
      expect(col).toBe(27);
    });
  });

  describe('gridToPercentage', () => {
    it('returns values in 0-100 range for visible columns', () => {
      const { x, y } = gridToPercentage(5, 10, 0);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(100);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(100);
    });

    it('center column maps to approximately 50%', () => {
      const centerCol = Math.floor(VISIBLE_WIDTH / 2);
      const { x } = gridToPercentage(centerCol, 10, 0);
      expect(Math.abs(x - 50)).toBeLessThan(5);
    });
  });

  describe('isInVisibleRange', () => {
    it('returns true for valid columns', () => {
      expect(isInVisibleRange(0)).toBe(true);
      expect(isInVisibleRange(5)).toBe(true);
      expect(isInVisibleRange(VISIBLE_WIDTH - 1)).toBe(true);
    });

    it('returns false for out-of-range columns', () => {
      expect(isInVisibleRange(-1)).toBe(false);
      expect(isInVisibleRange(VISIBLE_WIDTH)).toBe(false);
      expect(isInVisibleRange(100)).toBe(false);
    });
  });
});
