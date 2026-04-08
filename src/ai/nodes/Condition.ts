import { NodeStatus } from '../NodeStatus.js';
import { BTNode } from '../BehaviorTree.js';

/**
 * Leaf node that evaluates a predicate.
 * Returns SUCCESS if predicate is true, FAILURE otherwise.
 * Never returns RUNNING.
 */
export class Condition extends BTNode {
  private fn: (eid: number, world: unknown) => boolean;

  constructor(fn: (eid: number, world: unknown) => boolean) {
    super();
    this.fn = fn;
  }

  tick(entityId: number, world: unknown): NodeStatus {
    return this.fn(entityId, world) ? NodeStatus.Success : NodeStatus.Failure;
  }
}
