import { describe, it, expect } from 'vitest';
import { normalizeX, getGridX, getScreenX } from '../utils/coordinates';
import { TANK_WIDTH } from '../constants';

describe('normalizeX', () => {
  it('returns same value for x within bounds', () => {
    expect(normalizeX(0)).toBe(0);
    expect(normalizeX(15)).toBe(15);
    expect(normalizeX(29)).toBe(29);
  });

  it('wraps positive overflow', () => {
    expect(normalizeX(30)).toBe(0);
    expect(normalizeX(31)).toBe(1);
    expect(normalizeX(60)).toBe(0);
    expect(normalizeX(45)).toBe(15);
  });

  it('wraps negative values', () => {
    expect(normalizeX(-1)).toBe(29);
    expect(normalizeX(-2)).toBe(28);
    expect(normalizeX(-30)).toBe(0);
    expect(normalizeX(-31)).toBe(29);
  });
});

describe('getGridX', () => {
  it('converts screen coordinate to grid coordinate with offset', () => {
    // With offset 0, screen = grid
    expect(getGridX(5, 0)).toBe(5);

    // With offset 10, screen 5 = grid 15
    expect(getGridX(5, 10)).toBe(15);

    // With wrapping
    expect(getGridX(5, 28)).toBe(3); // 5 + 28 = 33, wraps to 3
  });
});

describe('getScreenX', () => {
  it('converts grid coordinate to screen coordinate with offset', () => {
    // With offset 0, grid = screen
    expect(getScreenX(5, 0)).toBe(5);

    // With offset 10, grid 15 = screen 5
    expect(getScreenX(15, 10)).toBe(5);
  });

  it('handles wrap-around correctly', () => {
    // Grid 2 with offset 28 should show as nearby, not far away
    // diff = 2 - 28 = -26, which should normalize to +4
    expect(getScreenX(2, 28)).toBe(4);

    // Grid 28 with offset 2 should show as nearby
    // diff = 28 - 2 = 26, should normalize to -4
    expect(getScreenX(28, 2)).toBe(-4);
  });
});
