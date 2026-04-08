import { NodeStatus } from './NodeStatus.js';

/**
 * Base class for all behavior tree nodes.
 * Each node implements tick() which returns a NodeStatus.
 */
export abstract class BTNode {
  abstract tick(entityId: number, world: unknown): NodeStatus;
}
