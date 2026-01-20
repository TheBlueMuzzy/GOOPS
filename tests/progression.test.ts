import { describe, it, expect } from 'vitest';
import { getScoreForRank, getXpToNextRank, calculateRankDetails } from '../utils/progression';

describe('getScoreForRank', () => {
  it('returns 0 for rank 1', () => {
    expect(getScoreForRank(1)).toBe(0);
  });

  it('returns 0 for rank 0 or negative', () => {
    expect(getScoreForRank(0)).toBe(0);
    expect(getScoreForRank(-1)).toBe(0);
  });

  it('returns correct XP for early ranks (linear delta curve)', () => {
    // Formula: (rank - 1) * (1000 + 250 * rank)
    expect(getScoreForRank(2)).toBe(1500);   // 1 * 1500
    expect(getScoreForRank(3)).toBe(3500);   // 2 * 1750
    expect(getScoreForRank(4)).toBe(6000);   // 3 * 2000
    expect(getScoreForRank(5)).toBe(9000);   // 4 * 2250
  });

  it('returns correct XP for mid ranks', () => {
    // Rank 10: (10-1) * (1000 + 250*10) = 9 * 3500 = 31500
    expect(getScoreForRank(10)).toBe(31500);
    // Rank 20: (20-1) * (1000 + 250*20) = 19 * 6000 = 114000
    expect(getScoreForRank(20)).toBe(114000);
  });

  it('returns correct XP for max rank', () => {
    // Rank 100: (100-1) * (1000 + 250*100) = 99 * 26000 = 2,574,000
    expect(getScoreForRank(100)).toBe(2574000);
  });
});

describe('getXpToNextRank', () => {
  it('returns 1500 for rank 1', () => {
    expect(getXpToNextRank(1)).toBe(1500);
  });

  it('returns correct increments (linear delta)', () => {
    // Formula: 1500 + (rank - 1) * 500
    expect(getXpToNextRank(1)).toBe(1500);  // 1500 + 0
    expect(getXpToNextRank(2)).toBe(2000);  // 1500 + 500
    expect(getXpToNextRank(3)).toBe(2500);  // 1500 + 1000
    expect(getXpToNextRank(4)).toBe(3000);  // 1500 + 1500
    expect(getXpToNextRank(10)).toBe(6000); // 1500 + 4500
  });

  it('returns 0 for max rank', () => {
    expect(getXpToNextRank(100)).toBe(0);
  });
});

describe('calculateRankDetails', () => {
  it('returns rank 0 for 0 score (fresh start)', () => {
    const details = calculateRankDetails(0);
    expect(details.rank).toBe(0);
    expect(details.progress).toBe(0);
    expect(details.toNextRank).toBe(1500);
  });

  it('returns rank 0 for negative score', () => {
    const details = calculateRankDetails(-100);
    expect(details.rank).toBe(0);
  });

  it('returns rank 2 at exactly 1500 XP', () => {
    const details = calculateRankDetails(1500);
    expect(details.rank).toBe(2);
    expect(details.progress).toBe(0);
    expect(details.toNextRank).toBe(2000);
  });

  it('calculates progress within a rank', () => {
    // At 2500 XP: rank 2 (needs 1500), progress = 1000 of 2000 to rank 3
    const details = calculateRankDetails(2500);
    expect(details.rank).toBe(2);
    expect(details.progress).toBe(1000);
    expect(details.toNextRank).toBe(2000);
  });

  it('returns rank 10 at 31500 XP', () => {
    const details = calculateRankDetails(31500);
    expect(details.rank).toBe(10);
    expect(details.progress).toBe(0);
  });

  it('handles max rank', () => {
    const details = calculateRankDetails(2574000);
    expect(details.rank).toBe(100);
    expect(details.isMaxRank).toBe(true);
  });

  it('caps at max rank even with excessive score', () => {
    const details = calculateRankDetails(10000000);
    expect(details.rank).toBe(100);
    expect(details.isMaxRank).toBe(true);
  });
});
