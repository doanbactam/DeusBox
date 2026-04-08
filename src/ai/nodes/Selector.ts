import { NodeStatus } from '../NodeStatus.js';
import { BTNode } from '../BehaviorTree.js';

/**
 * Selector node: runs children in order.
 * Returns SUCCESS on first child that succeeds.
 * Returns FAILURE if all children fail.
 * Returns RUNNING if a child is running.
 */
export class Selector extends BTNode {
  private children: BTNode[];

  constructor(children: BTNode[]) {
    super();
    this.children = children;
  }

  tick(entityId: number, world: unknown): NodeStatus {
    for (const child of this.children) {
      const status = child.tick(entityId, world);
      if (status === NodeStatus.Success || status === NodeStatus.Running) {
        return status;
      }
    }
    return NodeStatus.Failure;
  }
}
