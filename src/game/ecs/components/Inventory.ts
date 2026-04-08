import { MAX_ENTITIES } from '@/core/Constants.js';

const Inventory = {
  wood: new Float32Array(MAX_ENTITIES),
  food: new Float32Array(MAX_ENTITIES),
  stone: new Float32Array(MAX_ENTITIES),
  gold: new Float32Array(MAX_ENTITIES),
  iron: new Float32Array(MAX_ENTITIES),
};

export default Inventory;
