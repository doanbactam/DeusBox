import { MAX_ENTITIES } from '@/core/Constants.js';

const Structure = {
  type: new Float32Array(MAX_ENTITIES), // building type index
  factionId: new Float32Array(MAX_ENTITIES),
  level: new Float32Array(MAX_ENTITIES),
  health: new Float32Array(MAX_ENTITIES),
  maxHealth: new Float32Array(MAX_ENTITIES),
};

export default Structure;
