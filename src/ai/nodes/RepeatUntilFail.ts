import { NodeStatus } from '../NodeStatus.js';
import { BTNode } from '../BehaviorTree.js';

/**
 * Decorator node that repeats its child until it returns FAILURE.
 * Returns SUCCESS when the child fails.
 * Returns RUNNING while the child succeeds.
 */
export class RepeatUntilFail extends BTNode {
  private child: BTNode;

  constructor(child: BTNode) {
    super();
    this.child = child;
  }

  tick(entityId: number, world: unknown): NodeStatus {
    const status = this.child.tick(entityId, world);
    if (status === NodeStatus.Failure) {
      return NodeStatus.Success;
    }
    return NodeStatus.Running;
  }
}
