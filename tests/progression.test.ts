import { describe, it, expect } from 'vitest';
import { getScoreForRank, getXpToNextRank, calculateRankDetails, getMilestoneRanks, getNextMilestone, getMilestonesInRange } from '../utils/progression';

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

describe('getMilestoneRanks', () => {
  it('returns all milestone ranks from 10 to 100', () => {
    const milestones = getMilestoneRanks();
    expect(milestones).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  });

  it('returns exactly 10 milestones', () => {
    expect(getMilestoneRanks().length).toBe(10);
  });
});

describe('getNextMilestone', () => {
  it('returns 10 for ranks below 10', () => {
    expect(getNextMilestone(0)).toBe(10);
    expect(getNextMilestone(1)).toBe(10);
    expect(getNextMilestone(5)).toBe(10);
    expect(getNextMilestone(9)).toBe(10);
  });

  it('returns next milestone for ranks at a milestone', () => {
    expect(getNextMilestone(10)).toBe(20);
    expect(getNextMilestone(20)).toBe(30);
    expect(getNextMilestone(90)).toBe(100);
  });

  it('returns next milestone for ranks between milestones', () => {
    expect(getNextMilestone(11)).toBe(20);
    expect(getNextMilestone(15)).toBe(20);
    expect(getNextMilestone(19)).toBe(20);
  });

  it('returns null for max rank', () => {
    expect(getNextMilestone(100)).toBe(null);
  });

  it('returns null for ranks past max', () => {
    expect(getNextMilestone(101)).toBe(null);
    expect(getNextMilestone(150)).toBe(null);
  });
});

describe('getMilestonesInRange', () => {
  it('returns empty array when toRank <= fromRank', () => {
    expect(getMilestonesInRange(10, 10)).toEqual([]);
    expect(getMilestonesInRange(15, 10)).toEqual([]);
  });

  it('returns single milestone when crossing one', () => {
    expect(getMilestonesInRange(8, 12)).toEqual([10]);
    expect(getMilestonesInRange(9, 10)).toEqual([10]);
  });

  it('returns multiple milestones when crossing several', () => {
    expect(getMilestonesInRange(18, 32)).toEqual([20, 30]);
    expect(getMilestonesInRange(5, 35)).toEqual([10, 20, 30]);
  });

  it('returns empty array when no milestones crossed', () => {
    expect(getMilestonesInRange(1, 5)).toEqual([]);
    expect(getMilestonesInRange(11, 19)).toEqual([]);
  });

  it('includes milestone at toRank but not fromRank', () => {
    // At rank 10, crossing to exactly 20 should include 20
    expect(getMilestonesInRange(10, 20)).toEqual([20]);
    // Starting AT 10, going to 11 should NOT include 10
    expect(getMilestonesInRange(10, 11)).toEqual([]);
  });

  it('handles jumping from 0 to high rank', () => {
    expect(getMilestonesInRange(0, 50)).toEqual([10, 20, 30, 40, 50]);
  });
});
