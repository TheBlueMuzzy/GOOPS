
import { TANK_WIDTH } from '../constants';

export const normalizeX = (x: number): number => {
  return ((x % TANK_WIDTH) + TANK_WIDTH) % TANK_WIDTH;
};

// Converts a screen-space coordinate (viewport relative) to a grid coordinate (tank absolute)
export const getGridX = (screenX: number, tankRotation: number): number => {
    return normalizeX(Math.round(screenX) + tankRotation);
};

// Converts a grid coordinate (tank absolute) to a screen-space coordinate (viewport relative)
export const getScreenX = (gridX: number, tankRotation: number): number => {
    let diff = gridX - tankRotation;
    // Normalize to closest path (-TOTAL/2 to +TOTAL/2)
    while (diff > TANK_WIDTH / 2) diff -= TANK_WIDTH;
    while (diff <= -TANK_WIDTH / 2) diff += TANK_WIDTH;
    return diff;
};
