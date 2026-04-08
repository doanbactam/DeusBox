import { MAX_ENTITIES } from '@/core/Constants.js';

const ResourceSource = {
  type: new Float32Array(MAX_ENTITIES), // ResourceType enum index
  amount: new Float32Array(MAX_ENTITIES), // remaining amount
  harvestTime: new Float32Array(MAX_ENTITIES), // seconds to harvest one unit
};

export default ResourceSource;
