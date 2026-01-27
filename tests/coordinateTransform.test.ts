
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
import { TANK_VIEWPORT_WIDTH, TANK_WIDTH, BUFFER_HEIGHT } from '../constants';

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
      const centerCol = TANK_VIEWPORT_WIDTH / 2;
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
      const screenX = visXToScreenX(TANK_VIEWPORT_WIDTH - 1);
      expect(screenX).toBeGreaterThan(0);
    });
  });

  describe('svgToVisual', () => {
    it('converts center of viewport correctly', () => {
      const svgX = 0; // Center
      const svgY = 30 * 8; // Middle row (8 blocks from top)
      const { visX, visY } = svgToVisual(svgX, svgY);

      expect(Math.abs(visX - TANK_VIEWPORT_WIDTH / 2)).toBeLessThan(0.001);
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
      // 5 + 28 = 33, wrapped to TANK_WIDTH (30) = 3
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
      const centerCol = Math.floor(TANK_VIEWPORT_WIDTH / 2);
      const { x } = gridToPercentage(centerCol, 10, 0);
      expect(Math.abs(x - 50)).toBeLessThan(5);
    });
  });

  describe('isInVisibleRange', () => {
    it('returns true for valid columns', () => {
      expect(isInVisibleRange(0)).toBe(true);
      expect(isInVisibleRange(5)).toBe(true);
      expect(isInVisibleRange(TANK_VIEWPORT_WIDTH - 1)).toBe(true);
    });

    it('returns false for out-of-range columns', () => {
      expect(isInVisibleRange(-1)).toBe(false);
      expect(isInVisibleRange(TANK_VIEWPORT_WIDTH)).toBe(false);
      expect(isInVisibleRange(100)).toBe(false);
    });
  });

  // ============================================================================
  // Edge case tests added in Phase 13 for comprehensive coverage
  // ============================================================================

  describe('visualToGrid edge cases', () => {
    it('handles offset exactly at TANK_WIDTH boundary', () => {
      const { col } = visualToGrid(5, 10, TANK_WIDTH);
      // 5 + 30 = 35, wrapped to TANK_WIDTH (30) = 5
      expect(col).toBe(5);
    });

    it('handles large negative offset (-30)', () => {
      const { col } = visualToGrid(5, 10, -30);
      // 5 + (-30) = -25, wrapped: ((-25 % 30) + 30) % 30 = 5
      expect(col).toBe(5);
    });

    it('handles large negative offset (-60)', () => {
      const { col } = visualToGrid(5, 10, -60);
      // 5 + (-60) = -55, wrapped: ((-55 % 30) + 30) % 30 = 5
      expect(col).toBe(5);
    });

    it('handles large positive offset (60)', () => {
      const { col } = visualToGrid(5, 10, 60);
      // 5 + 60 = 65, wrapped to 30 = 5
      expect(col).toBe(5);
    });

    it('handles large positive offset (90)', () => {
      const { col } = visualToGrid(5, 10, 90);
      // 5 + 90 = 95, wrapped to 30 = 5
      expect(col).toBe(5);
    });
  });

  describe('svgToVisual edge cases', () => {
    it('handles SVG x at left VIEWBOX boundary', () => {
      const { visX } = svgToVisual(VIEWBOX.x, 0);
      // At left edge, visX should be approximately 0
      expect(visX).toBeGreaterThanOrEqual(-0.5);
      expect(visX).toBeLessThan(1);
    });

    it('handles SVG x at right VIEWBOX boundary', () => {
      const { visX } = svgToVisual(VIEWBOX.x + VIEWBOX.w, 0);
      // At right edge, visX should be approximately TANK_VIEWPORT_WIDTH
      expect(visX).toBeGreaterThan(TANK_VIEWPORT_WIDTH - 1);
      expect(visX).toBeLessThanOrEqual(TANK_VIEWPORT_WIDTH + 0.5);
    });

    it('handles SVG y at top bound (y=0)', () => {
      const { visY } = svgToVisual(0, 0);
      // y=0 maps to BUFFER_HEIGHT
      expect(visY).toBe(BUFFER_HEIGHT);
    });

    it('handles SVG y at bottom bound', () => {
      const { visY } = svgToVisual(0, VIEWBOX.h);
      // y at max height maps to BUFFER_HEIGHT + visible rows
      expect(visY).toBeCloseTo(BUFFER_HEIGHT + VIEWBOX.h / 30, 1);
    });
  });

  describe('precision tests', () => {
    it('maintains precision for fractional column values', () => {
      const fractionalValues = [0.25, 0.5, 0.75, 3.33, 6.67, 9.99];
      for (const visX of fractionalValues) {
        const screenX = visXToScreenX(visX);
        const recovered = screenXToVisX(screenX);
        expect(Math.abs(recovered - visX)).toBeLessThan(0.001);
      }
    });

    it('maintains precision at extreme screen X values', () => {
      // Test values near the edges
      const edgeValues = [0.001, 0.01, TANK_VIEWPORT_WIDTH - 0.01, TANK_VIEWPORT_WIDTH - 0.001];
      for (const visX of edgeValues) {
        const screenX = visXToScreenX(visX);
        const recovered = screenXToVisX(screenX);
        expect(Math.abs(recovered - visX)).toBeLessThan(0.001);
      }
    });
  });
});
