import { MAX_ENTITIES } from '@/core/Constants.js';

const Combat = {
  attackPower: new Float32Array(MAX_ENTITIES),
  attackRange: new Float32Array(MAX_ENTITIES),
  attackCooldown: new Float32Array(MAX_ENTITIES),
  lastAttackTime: new Float32Array(MAX_ENTITIES),
  target: new Float32Array(MAX_ENTITIES), // target entity ID, -1 if none
};

export default Combat;
