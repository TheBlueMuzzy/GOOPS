/**
 * Goop rendering utilities for GameBoard.
 * Pure functions for SVG path generation and group building.
 */

import { GridCell, FallingBlock } from '../types';
import { TANK_VIEWPORT_WIDTH, TANK_VIEWPORT_HEIGHT, TANK_WIDTH, TANK_HEIGHT, BUFFER_HEIGHT } from '../constants';
import { BLOCK_SIZE, visXToScreenX } from './coordinateTransform';
import { normalizeX } from './gameLogic';

/** Corner radius for blob shapes */
export const CORNER_RADIUS = 8;

/** Neighbor connectivity for a cell */
export interface Neighbors {
    t: boolean;  // top
    r: boolean;  // right
    b: boolean;  // bottom
    l: boolean;  // left
}

/** A cell prepared for rendering with screen coordinates */
export interface RenderableCell {
    visX: number;
    y: number;
    screenX: number;
    screenY: number;
    width: number;
    cell: GridCell;
    color: string;
    neighbors: Neighbors;
    isFalling?: boolean;
}

/**
 * Generate SVG path for a blob shape with rounded corners.
 * Connected edges (neighbors) get sharp corners, exposed edges get rounded.
 */
export function getBlobPath(
    x: number,
    y: number,
    w: number,
    h: number,
    neighbors: Neighbors,
    radius: number = CORNER_RADIUS
): string {
    let d = "";
    if (!neighbors.t && !neighbors.l) d += `M ${x} ${y + radius} Q ${x} ${y} ${x + radius} ${y} `;
    else d += `M ${x} ${y} `;

    if (!neighbors.t && !neighbors.r) d += `L ${x + w - radius} ${y} Q ${x + w} ${y} ${x + w} ${y + radius} `;
    else d += `L ${x + w} ${y} `;

    if (!neighbors.b && !neighbors.r) d += `L ${x + w} ${y + h - radius} Q ${x + w} ${y + h} ${x + w - radius} ${y + h} `;
    else d += `L ${x + w} ${y + h} `;

    if (!neighbors.b && !neighbors.l) d += `L ${x + radius} ${y + h} Q ${x} ${y + h} ${x} ${y + h - radius} `;
    else d += `L ${x} ${y + h} `;

    d += "Z";
    return d;
}

/**
 * Generate SVG path for group outline (exposed edges only).
 * Creates contour lines around the outside of a group.
 */
export function getContourPath(
    x: number,
    y: number,
    w: number,
    h: number,
    n: Neighbors,
    radius: number = CORNER_RADIUS
): string {
    const r = radius;
    let d = "";
    if (!n.t) {
        const start = n.l ? x : x + r;
        const end = n.r ? x + w : x + w - r;
        d += `M ${start} ${y} L ${end} ${y} `;
    }
    if (!n.r) {
        const start = n.t ? y : y + r;
        const end = n.b ? y + h : y + h - r;
        d += `M ${x + w} ${start} L ${x + w} ${end} `;
    }
    if (!n.b) {
        const start = n.l ? x : x + r;
        const end = n.r ? x + w : x + w - r;
        d += `M ${end} ${y + h} L ${start} ${y + h} `;
    }
    if (!n.l) {
        const start = n.t ? y : y + r;
        const end = n.b ? y + h : y + h - r;
        d += `M ${x} ${end} L ${x} ${start} `;
    }
    if (!n.t && !n.l) d += `M ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} `;
    if (!n.t && !n.r) d += `M ${x + w - r} ${y} Q ${x + w} ${y} ${x + w} ${y + r} `;
    if (!n.b && !n.r) d += `M ${x + w} ${y + h - r} Q ${x + w} ${y + h} ${x + w - r} ${y + h} `;
    if (!n.b && !n.l) d += `M ${x + r} ${y + h} Q ${x} ${y + h} ${x} ${y + h - r} `;
    return d;
}

/**
 * Build renderable groups from grid and falling blocks.
 * Returns a map of groupId → RenderableCell[] for rendering.
 */
export function buildRenderableGroups(
    grid: (GridCell | null)[][],
    tankRotation: number,
    fallingBlocks: FallingBlock[]
): Map<string, RenderableCell[]> {
    const map = new Map<string, RenderableCell[]>();

    // 1. Static Grid
    for (let y = BUFFER_HEIGHT; y < BUFFER_HEIGHT + TANK_VIEWPORT_HEIGHT; y++) {
        for (let visX = 0; visX < TANK_VIEWPORT_WIDTH; visX++) {
            const gridX = normalizeX(visX + tankRotation);
            const cell = grid[y][gridX];
            if (!cell) continue;

            const startX = visXToScreenX(visX);
            const endX = visXToScreenX(visX + 1);
            const width = endX - startX;
            if (width <= 0) continue;
            const yPos = (y - BUFFER_HEIGHT) * BLOCK_SIZE;

            const neighbors: Neighbors = {
                t: y > 0 && grid[y - 1][gridX]?.groupId === cell.groupId,
                b: y < TANK_HEIGHT - 1 && grid[y + 1][gridX]?.groupId === cell.groupId,
                l: grid[y][normalizeX(gridX - 1)]?.groupId === cell.groupId,
                r: grid[y][normalizeX(gridX + 1)]?.groupId === cell.groupId,
            };

            if (!map.has(cell.groupId)) map.set(cell.groupId, []);
            map.get(cell.groupId)!.push({
                visX, y, screenX: startX, screenY: yPos, width, cell, color: cell.color, neighbors
            });
        }
    }

    // 2. Falling Blocks
    const fallingMap = new Map<string, FallingBlock[]>();
    fallingBlocks.forEach(b => {
        if (!fallingMap.has(b.data.groupId)) fallingMap.set(b.data.groupId, []);
        fallingMap.get(b.data.groupId)!.push(b);
    });

    fallingMap.forEach((blocks, gid) => {
        const coords = new Set<string>();
        blocks.forEach(b => coords.add(`${Math.round(b.x)},${Math.round(b.y)}`));

        blocks.forEach(block => {
            if (block.y < BUFFER_HEIGHT - 1) return;
            let visX = block.x - tankRotation;
            if (visX > TANK_WIDTH / 2) visX -= TANK_WIDTH;
            if (visX < -TANK_WIDTH / 2) visX += TANK_WIDTH;

            if (visX >= 0 && visX < TANK_VIEWPORT_WIDTH) {
                const startX = visXToScreenX(visX);
                const endX = visXToScreenX(visX + 1);
                const width = endX - startX;
                const yPos = (block.y - BUFFER_HEIGHT) * BLOCK_SIZE;

                const bx = Math.round(block.x);
                const by = Math.round(block.y);
                const neighbors: Neighbors = {
                    t: coords.has(`${bx},${by - 1}`),
                    r: coords.has(`${normalizeX(bx + 1)},${by}`),
                    b: coords.has(`${bx},${by + 1}`),
                    l: coords.has(`${normalizeX(bx - 1)},${by}`),
                };

                if (!map.has(gid)) map.set(gid, []);
                map.get(gid)!.push({
                    visX, y: block.y, screenX: startX, screenY: yPos, width,
                    cell: block.data, color: block.data.color, neighbors, isFalling: true
                });
            }
        });
    });

    return map;
}
