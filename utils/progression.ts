
import { RankDetails } from '../types';

// Linear Delta XP Curve
// Each rank requires more XP than the last, but the INCREASE is linear (not exponential)
// Formula: XP to next rank = 1500 + (rank - 1) * 500
//
// Rank 2: 1,500 XP | Rank 5: 9,000 XP | Rank 10: 31,500 XP | Rank 100: 2,574,000 XP
//
// This gives fast tutorial progression (ranks 1-5) while maintaining long-term goals

const MAX_RANK = 100;

// Returns the cumulative score required to REACH a specific rank
export const getScoreForRank = (rank: number): number => {
  if (rank <= 1) return 0;

  // Linear delta formula (closed form):
  // Total XP = (rank - 1) * (1000 + 250 * rank)
  //
  // Derived from: sum of [1500 + (i-1) * 500] for i = 1 to (rank-1)
  return (rank - 1) * (1000 + 250 * rank);
};

// Returns the XP needed to go from current rank to next rank
export const getXpToNextRank = (rank: number): number => {
  if (rank <= 0) return 1500;
  if (rank >= MAX_RANK) return 0;

  // XP to next = 1500 + (rank - 1) * 500
  return 1500 + (rank - 1) * 500;
};

// Returns the score for 50% progress through a rank
export const getScoreForMidRank = (rank: number): number => {
  if (rank <= 0) return 0;
  if (rank >= MAX_RANK) return getScoreForRank(MAX_RANK);

  const currentBase = getScoreForRank(rank);
  const nextBase = getScoreForRank(rank + 1);
  return Math.floor(currentBase + (nextBase - currentBase) * 0.5);
};

// --- Milestone Functions ---

// Returns all milestone ranks [10, 20, 30, ... 100]
export const getMilestoneRanks = (): number[] => {
  const milestones: number[] = [];
  for (let r = 10; r <= MAX_RANK; r += 10) {
    milestones.push(r);
  }
  return milestones;
};

// Returns the next milestone rank after currentRank, or null if at/past max
export const getNextMilestone = (currentRank: number): number | null => {
  const nextMilestone = Math.ceil((currentRank + 1) / 10) * 10;
  return nextMilestone <= MAX_RANK ? nextMilestone : null;
};

// Returns milestones crossed when going from fromRank to toRank
// e.g., getMilestonesInRange(8, 12) returns [10]
// e.g., getMilestonesInRange(18, 32) returns [20, 30]
export const getMilestonesInRange = (fromRank: number, toRank: number): number[] => {
  if (toRank <= fromRank) return [];

  const crossed: number[] = [];
  const milestones = getMilestoneRanks();

  for (const milestone of milestones) {
    if (milestone > fromRank && milestone <= toRank) {
      crossed.push(milestone);
    }
  }

  return crossed;
};

// --- Rank Calculation ---

export const calculateRankDetails = (totalScore: number): RankDetails => {
  // Rank 0 = fresh start (no XP earned yet)
  if (totalScore <= 0) {
    return {
      rank: 0,
      progress: 0,
      toNextRank: getScoreForRank(1) || 1500, // XP needed for rank 1
      totalScore: 0,
      isMaxRank: false
    };
  }

  let rank = 1;

  // Iterative check is fast enough for 100 ranks
  while (rank < MAX_RANK && totalScore >= getScoreForRank(rank + 1)) {
    rank++;
  }

  const currentRankScoreBase = getScoreForRank(rank);
  const nextRankScoreBase = getScoreForRank(rank + 1);
  
  const progress = totalScore - currentRankScoreBase;
  const toNextRank = nextRankScoreBase - currentRankScoreBase;
  
  return {
    rank,
    progress,
    toNextRank,
    totalScore,
    isMaxRank: rank >= MAX_RANK
  };
};
