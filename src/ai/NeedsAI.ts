import { BTNode } from '@/ai/BehaviorTree.js';
import { Selector, Sequence, Action, Condition } from '@/ai/nodes/index.js';
import {
  wanderAction,
  seekFoodAction,
  eatAction,
  restAction,
  socializeAction,
  fleeAction,
  isHealthLow,
  isHungry,
  isTired,
  isLonely,
  isBored,
} from '@/ai/Actions.js';

/**
 * Constructs the creature behavior tree with Maslow-like priority:
 *   1. Survival: if health < 30% → flee
 *   2. Hunger: if hunger > 80 → seek food → eat
 *   3. Rest: if rest < 20 → rest
 *   4. Social: if social < 40 → socialize
 *   5. Fun: if fun < 30 → wander
 *   6. Default: wander (idle behavior)
 */
export function buildCreatureBehaviorTree(): BTNode {
  return new Selector([
    // Priority 1: Flee if health is low
    new Sequence([new Condition(isHealthLow), new Action(fleeAction)]),

    // Priority 2: Eat if hungry
    new Sequence([new Condition(isHungry), new Action(seekFoodAction), new Action(eatAction)]),

    // Priority 3: Rest if tired
    new Sequence([new Condition(isTired), new Action(restAction)]),

    // Priority 4: Socialize if lonely
    new Sequence([new Condition(isLonely), new Action(socializeAction)]),

    // Priority 5: Wander if bored (or default idle)
    new Selector([
      new Sequence([new Condition(isBored), new Action(wanderAction)]),
      // Default fallback: wander
      new Action(wanderAction),
    ]),
  ]);
}
