import { describe, it, expect } from 'vitest';
import { getScoreForRank, getXpToNextRank, calculateRankDetails, getMilestoneRanks, getNextMilestone, getMilestonesInRange } from '../utils/progression';

describe('getScoreForRank', () => {
  it('returns 3500 for rank 1 (flattened curve)', () => {
    expect(getScoreForRank(1)).toBe(3500);
  });

  it('returns 0 for rank 0 or negative', () => {
    expect(getScoreForRank(0)).toBe(0);
    expect(getScoreForRank(-1)).toBe(0);
  });

  it('returns correct XP for early ranks (flattened curve)', () => {
    // Formula: rank * (3375 + 125 * rank)
    expect(getScoreForRank(1)).toBe(3500);    // 1 * 3500
    expect(getScoreForRank(2)).toBe(7250);    // 2 * 3625
    expect(getScoreForRank(3)).toBe(11250);   // 3 * 3750
    expect(getScoreForRank(4)).toBe(15500);   // 4 * 3875
    expect(getScoreForRank(5)).toBe(20000);   // 5 * 4000
  });

  it('returns correct XP for mid ranks', () => {
    // Rank 10: 10 * (3375 + 1250) = 46250
    expect(getScoreForRank(10)).toBe(46250);
    // Rank 20: 20 * (3375 + 2500) = 117500
    expect(getScoreForRank(20)).toBe(117500);
  });

  it('returns correct XP for max rank', () => {
    // Rank 50: 50 * (3375 + 6250) = 481,250
    expect(getScoreForRank(50)).toBe(481250);
  });
});

describe('getXpToNextRank', () => {
  it('returns 3500 for rank 0', () => {
    expect(getXpToNextRank(0)).toBe(3500);
  });

  it('returns correct increments (linear growth)', () => {
    // Formula: 3500 + 250 * rank
    expect(getXpToNextRank(1)).toBe(3750);   // 3500 + 250
    expect(getXpToNextRank(2)).toBe(4000);   // 3500 + 500
    expect(getXpToNextRank(3)).toBe(4250);   // 3500 + 750
    expect(getXpToNextRank(4)).toBe(4500);   // 3500 + 1000
    expect(getXpToNextRank(10)).toBe(6000);  // 3500 + 2500
  });

  it('returns 0 for max rank', () => {
    expect(getXpToNextRank(50)).toBe(0);
  });
});

describe('calculateRankDetails', () => {
  it('returns rank 0 for 0 score (fresh start)', () => {
    const details = calculateRankDetails(0);
    expect(details.rank).toBe(0);
    expect(details.progress).toBe(0);
    expect(details.toNextRank).toBe(3500);
  });

  it('returns rank 0 for negative score', () => {
    const details = calculateRankDetails(-100);
    expect(details.rank).toBe(0);
  });

  it('returns rank 0 for scores below 3500', () => {
    const details = calculateRankDetails(3499);
    expect(details.rank).toBe(0);
    expect(details.progress).toBe(3499);
    expect(details.toNextRank).toBe(3500);
  });

  it('returns rank 1 at exactly 3500 XP', () => {
    const details = calculateRankDetails(3500);
    expect(details.rank).toBe(1);
    expect(details.progress).toBe(0);
    expect(details.toNextRank).toBe(3750); // 7250 - 3500
  });

  it('calculates progress within a rank', () => {
    // At 5000 XP: rank 1 (needs 3500), progress = 1500 of 3750 to rank 2
    const details = calculateRankDetails(5000);
    expect(details.rank).toBe(1);
    expect(details.progress).toBe(1500);
    expect(details.toNextRank).toBe(3750);
  });

  it('returns rank 10 at 46250 XP', () => {
    const details = calculateRankDetails(46250);
    expect(details.rank).toBe(10);
    expect(details.progress).toBe(0);
  });

  it('handles max rank', () => {
    const details = calculateRankDetails(481250);
    expect(details.rank).toBe(50);
    expect(details.isMaxRank).toBe(true);
  });

  it('caps at max rank even with excessive score', () => {
    const details = calculateRankDetails(10000000);
    expect(details.rank).toBe(50);
    expect(details.isMaxRank).toBe(true);
  });
});

describe('getMilestoneRanks', () => {
  it('returns all milestone ranks from 10 to 50', () => {
    const milestones = getMilestoneRanks();
    expect(milestones).toEqual([10, 20, 30, 40, 50]);
  });

  it('returns exactly 5 milestones', () => {
    expect(getMilestoneRanks().length).toBe(5);
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
    expect(getNextMilestone(40)).toBe(50);
  });

  it('returns next milestone for ranks between milestones', () => {
    expect(getNextMilestone(11)).toBe(20);
    expect(getNextMilestone(15)).toBe(20);
    expect(getNextMilestone(19)).toBe(20);
  });

  it('returns null for max rank', () => {
    expect(getNextMilestone(50)).toBe(null);
  });

  it('returns null for ranks past max', () => {
    expect(getNextMilestone(51)).toBe(null);
    expect(getNextMilestone(100)).toBe(null);
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

  it('handles jumping from 0 to max rank', () => {
    expect(getMilestonesInRange(0, 50)).toEqual([10, 20, 30, 40, 50]);
  });
});
