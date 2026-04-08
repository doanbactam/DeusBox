import { NodeStatus } from '../NodeStatus.js';
import { BTNode } from '../BehaviorTree.js';

/**
 * Decorator node that inverts the child's result.
 * SUCCESS ↔ FAILURE, RUNNING stays RUNNING.
 */
export class Inverter extends BTNode {
  private child: BTNode;

  constructor(child: BTNode) {
    super();
    this.child = child;
  }

  tick(entityId: number, world: unknown): NodeStatus {
    const status = this.child.tick(entityId, world);
    if (status === NodeStatus.Success) return NodeStatus.Failure;
    if (status === NodeStatus.Failure) return NodeStatus.Success;
    return NodeStatus.Running;
  }
}
