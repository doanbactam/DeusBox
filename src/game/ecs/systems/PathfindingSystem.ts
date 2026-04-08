import { query } from 'bitecs';
import type { GameWorld } from '../ECSHost.js';
import Position from '../components/Position.js';
import Velocity from '../components/Velocity.js';
import Pathfinder from '../components/Pathfinder.js';

/** Number of entities to process per frame (round-robin budget) */
const PROCESS_PER_FRAME = 3;

/** Distance threshold to consider "arrived" at target (pixels) */
const ARRIVAL_THRESHOLD = 4;

/**
 * Creates a pathfinding system that processes entities with Pathfinder + Position.
 * Moves entities toward their Pathfinder target by setting Velocity.
 * Processes a fixed number of entities per frame (round-robin) to avoid stalls.
 */
export function createPathfindingSystem(): (world: GameWorld, delta: number) => void {
  let lastIndex = 0;

  return (world: GameWorld, _delta: number): void => {
    const ents = query(world, [Position, Velocity, Pathfinder]);
    if (ents.length === 0) return;

    const count = Math.min(PROCESS_PER_FRAME, ents.length);

    for (let i = 0; i < count; i++) {
      const idx = (lastIndex + i) % ents.length;
      const eid = ents[idx];

      const px = Position.x[eid];
      const py = Position.y[eid];
      const tx = Pathfinder.targetX[eid];
      const ty = Pathfinder.targetY[eid];

      const dx = tx - px;
      const dy = ty - py;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < ARRIVAL_THRESHOLD) {
        // Arrived at target — stop moving
        Velocity.x[eid] = 0;
        Velocity.y[eid] = 0;
        continue;
      }

      // Set velocity toward target
      const speed = Pathfinder.speed[eid];
      if (speed > 0 && dist > 0) {
        Velocity.x[eid] = (dx / dist) * speed;
        Velocity.y[eid] = (dy / dist) * speed;
      }
    }

    // Advance round-robin index
    lastIndex = (lastIndex + count) % ents.length;
  };
}
