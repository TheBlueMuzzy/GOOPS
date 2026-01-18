
import { TOTAL_WIDTH } from '../constants';

export const normalizeX = (x: number): number => {
  return ((x % TOTAL_WIDTH) + TOTAL_WIDTH) % TOTAL_WIDTH;
};

// Converts a screen-space coordinate (viewport relative) to a grid coordinate (tank absolute)
export const getGridX = (screenX: number, boardOffset: number): number => {
    return normalizeX(Math.round(screenX) + boardOffset);
};

// Converts a grid coordinate (tank absolute) to a screen-space coordinate (viewport relative)
export const getScreenX = (gridX: number, boardOffset: number): number => {
    let diff = gridX - boardOffset;
    // Normalize to closest path (-TOTAL/2 to +TOTAL/2)
    while (diff > TOTAL_WIDTH / 2) diff -= TOTAL_WIDTH;
    while (diff <= -TOTAL_WIDTH / 2) diff += TOTAL_WIDTH;
    return diff;
};
