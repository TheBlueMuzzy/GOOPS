// ============================================================================
// Soft-Body Physics Hook
// Manages blob lifecycle and physics integration for game use
// ============================================================================

import { useRef, useCallback, useEffect } from 'react';
import {
  SoftBlob,
  PhysicsParams,
  DEFAULT_PHYSICS,
  Vec2,
  AttractionSpring,
  Droplet,
} from '../core/softBody/types';
import {
  stepPhysics,
  Bounds,
  applyOutwardImpulse,
  updateAttractionSprings,
  applyAttractionSprings,
  applyBlobCollisions,
} from '../core/softBody/physics';
import {
  createBlobFromCells,
  PHYSICS_GRID_OFFSET,
  PHYSICS_CELL_SIZE,
} from '../core/softBody/blobFactory';

// =============================================================================
// Constants
// =============================================================================

/** Fill rate for locked blobs (per second) */
const FILL_RATE = 0.5;

/** Impulse strength when blob fills to 100% (scaled x0.6 from Proto 4) */
const PULSE_AMPLITUDE = 2.4;

// =============================================================================
// Types
// =============================================================================

export interface UseSoftBodyPhysicsOptions {
  /** Whether physics simulation is active */
  enabled: boolean;
  /** Optional physics parameter overrides */
  params?: Partial<PhysicsParams>;
  /** Optional boundary constraints */
  bounds?: Bounds;
}

export interface UseSoftBodyPhysicsReturn {
  /** Current array of blobs (mutable ref - read-only for rendering) */
  blobs: SoftBlob[];
  /** Create a new blob from grid cells */
  createBlob: (
    cells: Vec2[],
    color: string,
    id: string,
    isLocked: boolean,
    tankRotation?: number
  ) => SoftBlob;
  /** Remove a blob by ID */
  removeBlob: (id: string) => void;
  /** Update a blob's target position */
  updateBlobTarget: (id: string, targetX: number, targetY: number) => void;
  /** Lock a blob in place (transitions from falling to locked state) */
  lockBlob: (id: string) => void;
  /** Run one physics step (call from game loop) */
  step: (dt: number) => void;
  /** Clear all blobs */
  clearBlobs: () => void;
  /** Get a blob by ID */
  getBlob: (id: string) => SoftBlob | undefined;
  /** Shift all blob positions when tank rotation changes */
  shiftBlobsForRotation: (newRotation: number) => void;
  /** Current array of droplets (pop effect particles) */
  droplets: Droplet[];
  /** Create droplets from a popping blob */
  createDropletsForPop: (blob: SoftBlob) => void;
}

// =============================================================================
// Default Bounds
// =============================================================================

/**
 * Default physics bounds based on game grid dimensions.
 * Viewport is 12 columns x 16 rows.
 */
function getDefaultBounds(): Bounds {
  return {
    minX: PHYSICS_GRID_OFFSET.x,
    maxX: PHYSICS_GRID_OFFSET.x + 12 * PHYSICS_CELL_SIZE,
    minY: PHYSICS_GRID_OFFSET.y,
    maxY: PHYSICS_GRID_OFFSET.y + 16 * PHYSICS_CELL_SIZE,
  };
}

// =============================================================================
// Hook
// =============================================================================

/**
 * React hook for managing soft-body physics simulation.
 *
 * Uses refs for mutable state to avoid re-renders on every physics tick.
 * The step() function should be called from the game's animation loop.
 *
 * @example
 * ```tsx
 * const { blobs, createBlob, step } = useSoftBodyPhysics({ enabled: true });
 *
 * // In game loop:
 * useEffect(() => {
 *   const animate = () => {
 *     step(0.016);
 *     requestAnimationFrame(animate);
 *   };
 *   requestAnimationFrame(animate);
 * }, [step]);
 *
 * // Create a blob:
 * createBlob([{x: 0, y: 0}], '#ff0000', 'blob-1', false);
 * ```
 */
export function useSoftBodyPhysics(
  options: UseSoftBodyPhysicsOptions
): UseSoftBodyPhysicsReturn {
  const { enabled, params: paramOverrides, bounds } = options;

  // Mutable blob array (avoids re-renders on physics ticks)
  const blobsRef = useRef<SoftBlob[]>([]);

  // Attraction springs for merge tendrils between same-color blobs
  const attractionSpringsRef = useRef<AttractionSpring[]>([]);

  // Droplets for pop effect (particles that scatter when blob pops)
  const dropletsRef = useRef<Droplet[]>([]);
  const dropletIdCounter = useRef(0);

  // Physics parameters (merged with defaults)
  // Use the passed params directly, merging with defaults for any missing values
  const paramsRef = useRef<PhysicsParams>({
    ...DEFAULT_PHYSICS,
    ...paramOverrides,
  });

  // Boundary constraints
  const boundsRef = useRef<Bounds>(bounds ?? getDefaultBounds());

  // Update params if they change - check each param individually for changes
  useEffect(() => {
    if (paramOverrides) {
      paramsRef.current = { ...DEFAULT_PHYSICS, ...paramOverrides };
    }
  }, [
    paramOverrides?.damping,
    paramOverrides?.stiffness,
    paramOverrides?.pressure,
    paramOverrides?.iterations,
    paramOverrides?.homeStiffness,
    paramOverrides?.innerHomeStiffness,
    paramOverrides?.returnSpeed,
    paramOverrides?.viscosity,
    paramOverrides?.gravity,
    paramOverrides?.attractionRadius,
    paramOverrides?.attractionRestLength,
    paramOverrides?.attractionStiffness,
    paramOverrides?.goopiness,
    paramOverrides?.tendrilEndRadius,
    paramOverrides?.tendrilSkinniness,
    paramOverrides?.wallThickness,
    // Droplet params (were missing - caused sliders to not work)
    paramOverrides?.dropletCount,
    paramOverrides?.dropletSpeed,
    paramOverrides?.dropletLifetime,
    paramOverrides?.dropletSize,
    paramOverrides?.dropletGravity,
  ]);

  // Update bounds if they change
  useEffect(() => {
    if (bounds) {
      boundsRef.current = bounds;
    }
  }, [bounds]);

  /**
   * Create a new blob from grid cells and add to simulation.
   */
  const createBlob = useCallback(
    (
      cells: Vec2[],
      color: string,
      id: string,
      isLocked: boolean,
      tankRotation: number = 0
    ): SoftBlob => {
      const blob = createBlobFromCells(cells, color, id, isLocked, tankRotation);
      blobsRef.current = [...blobsRef.current, blob];
      return blob;
    },
    []
  );

  /**
   * Remove a blob by ID.
   */
  const removeBlob = useCallback((id: string) => {
    blobsRef.current = blobsRef.current.filter((b) => b.id !== id);
  }, []);

  /**
   * Update a blob's target position (for following game state).
   */
  const updateBlobTarget = useCallback(
    (id: string, targetX: number, targetY: number) => {
      const blob = blobsRef.current.find((b) => b.id === id);
      if (blob) {
        blob.targetX = targetX;
        blob.targetY = targetY;
      }
    },
    []
  );

  /**
   * Lock a blob in place (transition from falling to locked state).
   * Starts the fill animation.
   */
  const lockBlob = useCallback((id: string) => {
    const blob = blobsRef.current.find((b) => b.id === id);
    if (blob) {
      blob.isLocked = true;
      blob.isFalling = false;
      blob.isLoose = false;
      blob.fillAmount = 0; // Start fill animation
    }
  }, []);

  /**
   * Run one physics simulation step.
   * Should be called from the game's animation loop.
   *
   * Includes:
   * - Core physics (integration, home force, springs, pressure, boundaries)
   * - Fill animation for locked blobs
   * - Ready-to-pop impulse when fill reaches 100%
   * - Attraction springs for merge tendrils
   *
   * @param dt - Delta time in seconds (capped at 33ms for stability)
   */
  const step = useCallback(
    (dt: number) => {
      if (!enabled) return;

      const blobs = blobsRef.current;
      const params = paramsRef.current;
      const hasBlobs = blobs.length > 0;

      // Blob physics only runs when there are blobs
      if (hasBlobs) {
        // 1. Core physics step
        stepPhysics(blobs, dt, params, boundsRef.current);

        // 2. Fill animation for locked blobs
        for (const blob of blobs) {
          if (blob.isLocked && blob.fillAmount < 1) {
            blob.fillAmount = Math.min(1, blob.fillAmount + FILL_RATE * dt);

            // Check for ready-to-pop impulse
            const isFull = blob.fillAmount >= 1;
            if (isFull && !blob.wasFullLastFrame) {
              applyOutwardImpulse(blob, PULSE_AMPLITUDE);
            }
            blob.wasFullLastFrame = isFull;
          }
        }

        // 3. Attraction springs (merge tendrils between same-color blobs)
        attractionSpringsRef.current = updateAttractionSprings(
          blobs,
          attractionSpringsRef.current,
          params
        );
        applyAttractionSprings(blobs, attractionSpringsRef.current, params);

        // 4. Blob collisions (push different colors apart)
        applyBlobCollisions(blobs, PHYSICS_CELL_SIZE);
      }

      // 5. Update droplets (pop effect particles) - runs even with no blobs
      const dropletGravity = params.dropletGravity;
      const physBounds = boundsRef.current;

      for (const droplet of dropletsRef.current) {
        // Apply gravity
        droplet.vel.y += dropletGravity * dt;

        // Apply velocity
        droplet.pos.x += droplet.vel.x * dt;
        droplet.pos.y += droplet.vel.y * dt;

        // Side bounds: kill droplet
        if (
          droplet.pos.x + droplet.radius < physBounds.minX ||
          droplet.pos.x - droplet.radius > physBounds.maxX
        ) {
          droplet.lifetime = 0;
        }
        // Top: kill if escapes
        if (droplet.pos.y + droplet.radius < physBounds.minY) {
          droplet.lifetime = 0;
        }
        // Floor: bounce with damping
        if (droplet.pos.y + droplet.radius > physBounds.maxY) {
          droplet.pos.y = physBounds.maxY - droplet.radius;
          droplet.vel.y *= -0.3; // 30% rebound
        }

        // Decrease lifetime and fade
        droplet.lifetime -= dt;
        droplet.opacity = Math.max(0, droplet.lifetime / droplet.maxLifetime);

        // Shrink as it fades
        droplet.radius *= 0.995;
      }

      // Remove dead droplets
      dropletsRef.current = dropletsRef.current.filter(
        (d) => d.lifetime > 0 && d.opacity > 0.01
      );
    },
    [enabled]
  );

  /**
   * Clear all blobs and droplets from the simulation.
   */
  const clearBlobs = useCallback(() => {
    blobsRef.current = [];
    attractionSpringsRef.current = [];
    dropletsRef.current = [];
  }, []);

  /**
   * Create droplets from a popping blob.
   * Spawns particles at random vertex positions with radial velocity.
   * Ported from Proto-9 popBlob() lines 1889-1944.
   */
  const createDropletsForPop = useCallback((blob: SoftBlob) => {
    const params = paramsRef.current;
    const centerX = blob.targetX;
    const centerY = blob.targetY;

    for (let i = 0; i < params.dropletCount; i++) {
      // Pick a random vertex position
      const vertIndex = Math.floor(Math.random() * blob.vertices.length);
      const vert = blob.vertices[vertIndex];

      // Direction: outward from center with some randomness
      const dx = vert.pos.x - centerX;
      const dy = vert.pos.y - centerY;
      const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.8; // Add spread

      // Random speed variation (50%-130%)
      const speed = params.dropletSpeed * (0.5 + Math.random() * 0.8);

      const droplet: Droplet = {
        id: `droplet-${dropletIdCounter.current++}`,
        pos: { x: vert.pos.x, y: vert.pos.y },
        vel: {
          x: Math.cos(angle) * speed,
          y: Math.sin(angle) * speed - 50, // Slight upward bias for "pop" feel
        },
        radius: params.dropletSize * (0.5 + Math.random() * 0.7), // 50%-120%
        color: blob.color,
        opacity: 1,
        lifetime: params.dropletLifetime * (0.7 + Math.random() * 0.6), // 70%-130%
        maxLifetime: params.dropletLifetime,
      };

      dropletsRef.current.push(droplet);
    }
  }, []);

  /**
   * Get a blob by ID.
   */
  const getBlob = useCallback((id: string): SoftBlob | undefined => {
    return blobsRef.current.find((b) => b.id === id);
  }, []);

  /**
   * Shift all blob vertex positions when tank rotation changes.
   * This keeps blobs visually aligned with their grid cells as the tank rotates.
   *
   * IMPORTANT: We do NOT wrap positions here. Wrapping individual vertices
   * causes the "explosion" bug where some vertices wrap to +X while others
   * stay at -X, tearing the blob apart. Instead, we let blobs drift freely
   * in X space, and the rendering system handles showing them at the correct
   * viewport position by applying translate transforms.
   *
   * @param newRotation - The new tank rotation value
   */
  const shiftBlobsForRotation = useCallback((newRotation: number) => {
    for (const blob of blobsRef.current) {
      // Calculate rotation delta from when blob was created
      const delta = newRotation - blob.createdAtRotation;

      // Convert rotation delta to pixel offset (negative because rotating right
      // means visual positions move left)
      const pixelOffset = -delta * PHYSICS_CELL_SIZE;

      // Shift all vertices (NO WRAPPING - let them drift freely)
      for (const v of blob.vertices) {
        v.pos.x += pixelOffset;
        v.oldPos.x += pixelOffset;
      }
      for (const v of blob.innerVertices) {
        v.pos.x += pixelOffset;
        v.oldPos.x += pixelOffset;
      }

      // Update target position (NO WRAPPING)
      blob.targetX += pixelOffset;

      // Update createdAtRotation to new value (so next shift is relative to this)
      blob.createdAtRotation = newRotation;
    }
  }, []);

  return {
    blobs: blobsRef.current,
    createBlob,
    removeBlob,
    updateBlobTarget,
    lockBlob,
    step,
    clearBlobs,
    getBlob,
    shiftBlobsForRotation,
    droplets: dropletsRef.current,
    createDropletsForPop,
  };
}
