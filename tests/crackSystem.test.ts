import { describe, it, expect } from 'vitest';
import { GoalManager } from '../core/GoalManager';
import { Crack } from '../types';
import { COLORS } from '../constants';

const goalManager = new GoalManager();

// Helper to create a crack cell
const createCrack = (
  id: string,
  x: number,
  y: number,
  color: string = COLORS.RED,
  parentIds: string[] = [],
  childIds: string[] = []
): Crack => ({
  id,
  x,
  y,
  color,
  parentIds,
  childIds,
  lastGrowthCheck: Date.now(),
  growthInterval: 3000,
  spawnTime: Date.now()
});

describe('GoalManager Crack System', () => {
  describe('countCracks', () => {
    it('returns 0 for empty array', () => {
      expect(goalManager.countCracks([])).toBe(0);
    });

    it('returns 1 for single isolated crack', () => {
      const cracks = [createCrack('c1', 5, 5)];
      expect(goalManager.countCracks(cracks)).toBe(1);
    });

    it('returns 1 for two connected cracks (parent-child)', () => {
      const c1 = createCrack('c1', 5, 5, COLORS.RED, [], ['c2']);
      const c2 = createCrack('c2', 5, 6, COLORS.RED, ['c1'], []);
      expect(goalManager.countCracks([c1, c2])).toBe(1);
    });

    it('returns 2 for two unconnected cracks', () => {
      const c1 = createCrack('c1', 5, 5, COLORS.RED);
      const c2 = createCrack('c2', 10, 10, COLORS.BLUE);
      expect(goalManager.countCracks([c1, c2])).toBe(2);
    });

    it('returns 1 for chain of 3 connected cracks', () => {
      const c1 = createCrack('c1', 5, 5, COLORS.RED, [], ['c2']);
      const c2 = createCrack('c2', 5, 6, COLORS.RED, ['c1'], ['c3']);
      const c3 = createCrack('c3', 5, 7, COLORS.RED, ['c2'], []);
      expect(goalManager.countCracks([c1, c2, c3])).toBe(1);
    });

    it('handles branching correctly (Y-shape)', () => {
      // Root -> two children
      const root = createCrack('root', 5, 5, COLORS.RED, [], ['left', 'right']);
      const left = createCrack('left', 4, 5, COLORS.RED, ['root'], []);
      const right = createCrack('right', 6, 5, COLORS.RED, ['root'], []);
      expect(goalManager.countCracks([root, left, right])).toBe(1);
    });

    it('handles merge correctly (cells with multiple parents)', () => {
      // Two roots merge into one child
      const r1 = createCrack('r1', 4, 5, COLORS.RED, [], ['merged']);
      const r2 = createCrack('r2', 6, 5, COLORS.RED, [], ['merged']);
      const merged = createCrack('merged', 5, 5, COLORS.RED, ['r1', 'r2'], []);
      expect(goalManager.countCracks([r1, r2, merged])).toBe(1);
    });

    it('returns 3 for three disconnected cracks', () => {
      const c1 = createCrack('c1', 0, 0);
      const c2 = createCrack('c2', 10, 10);
      const c3 = createCrack('c3', 20, 15);
      expect(goalManager.countCracks([c1, c2, c3])).toBe(3);
    });
  });

  describe('getConnectedComponent', () => {
    it('returns single cell for isolated crack', () => {
      const c1 = createCrack('c1', 5, 5);
      const component = goalManager.getConnectedComponent('c1', [c1]);
      expect(component).toHaveLength(1);
      expect(component[0].id).toBe('c1');
    });

    it('returns empty array for non-existent id', () => {
      const c1 = createCrack('c1', 5, 5);
      const component = goalManager.getConnectedComponent('nonexistent', [c1]);
      expect(component).toHaveLength(0);
    });

    it('returns all connected cells for chain', () => {
      const c1 = createCrack('c1', 5, 5, COLORS.RED, [], ['c2']);
      const c2 = createCrack('c2', 5, 6, COLORS.RED, ['c1'], ['c3']);
      const c3 = createCrack('c3', 5, 7, COLORS.RED, ['c2'], []);
      const component = goalManager.getConnectedComponent('c1', [c1, c2, c3]);
      expect(component).toHaveLength(3);
    });

    it('only returns connected cells, not unconnected ones', () => {
      const c1 = createCrack('c1', 5, 5, COLORS.RED, [], ['c2']);
      const c2 = createCrack('c2', 5, 6, COLORS.RED, ['c1'], []);
      const c3 = createCrack('c3', 15, 15, COLORS.BLUE); // Unconnected
      const component = goalManager.getConnectedComponent('c1', [c1, c2, c3]);
      expect(component).toHaveLength(2);
      expect(component.find(c => c.id === 'c3')).toBeUndefined();
    });

    it('traverses in both directions (parent and child)', () => {
      const c1 = createCrack('c1', 5, 5, COLORS.RED, [], ['c2']);
      const c2 = createCrack('c2', 5, 6, COLORS.RED, ['c1'], ['c3']);
      const c3 = createCrack('c3', 5, 7, COLORS.RED, ['c2'], []);

      // Starting from middle should still find all 3
      const component = goalManager.getConnectedComponent('c2', [c1, c2, c3]);
      expect(component).toHaveLength(3);

      // Starting from end should also find all 3
      const componentFromEnd = goalManager.getConnectedComponent('c3', [c1, c2, c3]);
      expect(componentFromEnd).toHaveLength(3);
    });
  });

  describe('isLeafCell', () => {
    it('returns true for crack with no children', () => {
      const c1 = createCrack('c1', 5, 5, COLORS.RED, ['parent'], []);
      expect(goalManager.isLeafCell('c1', [c1])).toBe(true);
    });

    it('returns false for crack with children', () => {
      const c1 = createCrack('c1', 5, 5, COLORS.RED, [], ['child']);
      expect(goalManager.isLeafCell('c1', [c1])).toBe(false);
    });

    it('returns true for non-existent id', () => {
      const c1 = createCrack('c1', 5, 5);
      expect(goalManager.isLeafCell('nonexistent', [c1])).toBe(true);
    });

    it('returns true for root crack with no children', () => {
      const root = createCrack('root', 5, 5, COLORS.RED, [], []);
      expect(goalManager.isLeafCell('root', [root])).toBe(true);
    });
  });
});
