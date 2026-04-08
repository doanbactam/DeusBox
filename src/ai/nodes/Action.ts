import { NodeStatus } from '../NodeStatus.js';
import { BTNode } from '../BehaviorTree.js';

/**
 * Leaf node that executes an action function.
 * The action function returns NodeStatus to indicate result.
 */
export class Action extends BTNode {
  private fn: (eid: number, world: unknown) => NodeStatus;

  constructor(fn: (eid: number, world: unknown) => NodeStatus) {
    super();
    this.fn = fn;
  }

  tick(entityId: number, world: unknown): NodeStatus {
    return this.fn(entityId, world);
  }
}
