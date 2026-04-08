import { query } from 'bitecs';
import type { GameWorld } from '../ECSHost.js';
import Position from '../components/Position.js';
import AIStateComponent from '../components/AIState.js';
import { buildCreatureBehaviorTree } from '@/ai/NeedsAI.js';
import type { AIContext } from '@/ai/Actions.js';
import type { TileMap } from '@/world/TileMap.js';
import { AIState } from '@/core/Types.js';

/** AI tick interval in milliseconds (~1 second) */
const AI_TICK_INTERVAL = 1000;

/** Map of entity ID to its behavior tree instance */
const behaviorTrees = new Map<number, ReturnType<typeof buildCreatureBehaviorTree>>();

/**
 * Get or create a behavior tree for the given entity.
 */
function getBehaviorTree(eid: number): ReturnType<typeof buildCreatureBehaviorTree> {
  let tree = behaviorTrees.get(eid);
  if (!tree) {
    tree = buildCreatureBehaviorTree();
    behaviorTrees.set(eid, tree);
  }
  return tree;
}

/**
 * Creates the AI system that runs behavior trees for all entities with AIStateComponent.
 * Throttled: each entity's AI ticks every ~1 second (controlled by AIStateComponent.timer).
 *
 * @param tileMap - The world tile map, needed for pathfinding context.
 */
export function createAISystem(tileMap: TileMap): (world: GameWorld, delta: number) => void {
  const context: AIContext = { world: null as unknown as GameWorld, tileMap };

  return (world: GameWorld, delta: number): void => {
    context.world = world;
    const ents = query(world, [Position, AIStateComponent]);

    for (let i = 0; i < ents.length; i++) {
      const eid = ents[i];

      // Skip dead entities
      if (AIStateComponent.state[eid] === (AIState.Dead as unknown as number)) {
        continue;
      }

      // Throttle: accumulate time, only tick when interval exceeded
      AIStateComponent.timer[eid] += delta;
      if (AIStateComponent.timer[eid] < AI_TICK_INTERVAL) {
        continue;
      }
      AIStateComponent.timer[eid] = 0;

      // Tick the behavior tree
      const tree = getBehaviorTree(eid);
      tree.tick(eid, context);
    }
  };
}
