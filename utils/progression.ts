
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
