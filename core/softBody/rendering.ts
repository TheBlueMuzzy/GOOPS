// ============================================================================
// Soft-Body Rendering Utilities
// Ported directly from Proto 9 - DO NOT MODIFY without checking prototype
// ============================================================================

import { Vec2, Vertex, SoftBlob } from './types';

// =============================================================================
// Catmull-Rom Spline Interpolation
// =============================================================================

/**
 * Convert Catmull-Rom control points to cubic Bezier control points.
 * This creates smooth curves that pass through all vertices.
 */
function catmullRomToBezier(
  p0: Vec2,
  p1: Vec2,
  p2: Vec2,
  p3: Vec2
): { cp1: Vec2; cp2: Vec2 } {
  return {
    cp1: { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 },
    cp2: { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 },
  };
}

/**
 * Generate smooth SVG path from points using Catmull-Rom interpolation.
 * Creates organic, blobby shapes instead of jagged polygons.
 */
export function getPath(points: Vec2[]): string {
  const n = points.length;
  if (n < 3) return '';

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    const { cp1, cp2 } = catmullRomToBezier(p0, p1, p2, p3);
    path += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${p2.x} ${p2.y}`;
  }

  return path + ' Z';
}

/**
 * Generate smooth SVG path from blob vertices.
 */
export function getBlobPath(vertices: Vertex[]): string {
  return getPath(vertices.map(v => v.pos));
}

/**
 * Generate smooth SVG path from a SoftBlob.
 */
export function getSoftBlobPath(blob: SoftBlob): string {
  return getBlobPath(blob.vertices);
}

// =============================================================================
// Inset Path for Fill Animation
// =============================================================================

/**
 * Get bounding box of points.
 */
export function getBounds(points: Vec2[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  return { minX, maxX, minY, maxY };
}

/**
 * Create inset path for fill animation wall effect.
 * Moves each vertex inward along its normal by insetAmount,
 * respecting local width to avoid self-intersection.
 */
export function getInsetPath(points: Vec2[], insetAmount: number): Vec2[] {
  const n = points.length;
  if (n < 3) return points;

  // Calculate local width at each vertex (distance to opposite side)
  const localWidths: number[] = [];
  for (let i = 0; i < n; i++) {
    const curr = points[i];
    let minDist = Infinity;

    for (let j = 0; j < n; j++) {
      const diff = Math.abs(j - i);
      const wrapDiff = n - diff;
      // Skip nearby vertices (within 2 indices)
      if (diff <= 2 || wrapDiff <= 2) continue;

      const other = points[j];
      const dx = other.x - curr.x;
      const dy = other.y - curr.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) minDist = dist;
    }

    localWidths[i] = minDist === Infinity ? 100 : minDist;
  }

  // Create inset points
  const insetPoints: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const curr = points[i];
    const next = points[(i + 1) % n];

    // Edge vectors
    const e1x = curr.x - prev.x;
    const e1y = curr.y - prev.y;
    const e2x = next.x - curr.x;
    const e2y = next.y - curr.y;

    // Edge lengths
    const len1 = Math.sqrt(e1x * e1x + e1y * e1y);
    const len2 = Math.sqrt(e2x * e2x + e2y * e2y);

    if (len1 < 0.0001 || len2 < 0.0001) {
      insetPoints.push({ ...curr });
      continue;
    }

    // Inward normals (CCW winding: rotate edges -90 degrees)
    const n1x = -e1y / len1;
    const n1y = e1x / len1;
    const n2x = -e2y / len2;
    const n2y = e2x / len2;

    // Average normal
    let avgNx = n1x + n2x;
    let avgNy = n1y + n2y;
    const avgLen = Math.sqrt(avgNx * avgNx + avgNy * avgNy);

    if (avgLen < 0.0001) {
      // Parallel edges, use either normal
      avgNx = n1x;
      avgNy = n1y;
    } else {
      avgNx /= avgLen;
      avgNy /= avgLen;
    }

    // Miter factor for sharp corners
    const dot = n1x * avgNx + n1y * avgNy;
    const miterFactor = dot > 0.1 ? 1 / dot : 1;

    // Limit inset to 40% of local width
    const maxInset = localWidths[i] * 0.4;
    const actualInset = Math.min(insetAmount, maxInset) * Math.min(miterFactor, 2);

    insetPoints.push({
      x: curr.x + avgNx * actualInset,
      y: curr.y + avgNy * actualInset,
    });
  }

  return insetPoints;
}

// =============================================================================
// Filter Matrix Generation
// =============================================================================

export interface FilterParams {
  enabled: boolean;
  stdDeviation: number;
  alphaMultiplier: number;
  alphaOffset: number;
}

export const DEFAULT_FILTER: FilterParams = {
  enabled: true,
  stdDeviation: 8,
  alphaMultiplier: 20,
  alphaOffset: -12,
};

export const FILTER_PRESETS = {
  none: { enabled: false, stdDeviation: 8, alphaMultiplier: 20, alphaOffset: -12 },
  subtle: { enabled: true, stdDeviation: 5, alphaMultiplier: 15, alphaOffset: -6 },
  medium: { enabled: true, stdDeviation: 8, alphaMultiplier: 20, alphaOffset: -12 },
  aggressive: { enabled: true, stdDeviation: 12, alphaMultiplier: 25, alphaOffset: -9 },
};

/**
 * Generate SVG filter matrix values string.
 */
export function getFilterMatrix(params: FilterParams): string {
  return `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${params.alphaMultiplier} ${params.alphaOffset}`;
}
