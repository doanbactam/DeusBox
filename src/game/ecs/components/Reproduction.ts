import { MAX_ENTITIES } from '@/core/Constants.js';

const Reproduction = {
  age: new Float32Array(MAX_ENTITIES),
  maturityAge: new Float32Array(MAX_ENTITIES),
  cooldown: new Float32Array(MAX_ENTITIES),
  pregnant: new Float32Array(MAX_ENTITIES), // 0 or 1
};

export default Reproduction;
