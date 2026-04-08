import { NodeStatus } from '../NodeStatus.js';
import { BTNode } from '../BehaviorTree.js';

/**
 * Sequence node: runs children in order.
 * Returns FAILURE on first child that fails.
 * Returns SUCCESS if all children succeed.
 * Returns RUNNING if a child is running.
 */
export class Sequence extends BTNode {
  private children: BTNode[];

  constructor(children: BTNode[]) {
    super();
    this.children = children;
  }

  tick(entityId: number, world: unknown): NodeStatus {
    for (const child of this.children) {
      const status = child.tick(entityId, world);
      if (status === NodeStatus.Failure || status === NodeStatus.Running) {
        return status;
      }
    }
    return NodeStatus.Success;
  }
}
