import { query, hasComponent, addComponent } from 'bitecs';
import type { GameWorld } from '../ECSHost.js';
import Needs from '../components/Needs.js';
import Health from '../components/Health.js';
import AIStateComponent from '../components/AIState.js';
import { Dead } from '../components/TagComponents.js';
import { entityTypes } from '../factories/CreatureFactory.js';
import { getWeatherNeedsModifier } from './WeatherSystem.js';

interface NeedsConfig {
  hungerDecay: number;
  restDecay: number;
  socialDecay: number;
  funDecay: number;
}

interface CreatureConfig {
  speed: number;
  maxHealth: number;
  color: string;
  needs: NeedsConfig;
  aiWeights: {
    food: number;
    rest: number;
    social: number;
    fun: number;
  };
}

import creatureData from '@/data/creatures.json';

const configs = creatureData as Record<string, CreatureConfig>;

function getDefaultDecay(): NeedsConfig {
  const types = Object.values(configs);
  const count = types.length;
  let hunger = 0,
    rest = 0,
    social = 0,
    fun = 0;
  for (const t of types) {
    hunger += t.needs.hungerDecay;
    rest += t.needs.restDecay;
    social += t.needs.socialDecay;
    fun += t.needs.funDecay;
  }
  return {
    hungerDecay: hunger / count,
    restDecay: rest / count,
    socialDecay: social / count,
    funDecay: fun / count,
  };
}

const defaultDecay = getDefaultDecay();

const STARVATION_DAMAGE = 2;
const EXHAUSTION_DAMAGE = 1;

export function createNeedsDecaySystem(): (world: GameWorld, delta: number) => void {
  return (world: GameWorld, delta: number): void => {
    const seconds = delta / 1000;
    const hungerMod = getWeatherNeedsModifier('hunger');
    const restMod = getWeatherNeedsModifier('rest');
    const ents = query(world, [Needs, AIStateComponent]);

    for (let i = 0; i < ents.length; i++) {
      const eid = ents[i];

      if (hasComponent(world, eid, Dead)) continue;

      const creatureType = entityTypes.get(eid);
      const decay =
        creatureType && configs[creatureType] ? configs[creatureType].needs : defaultDecay;

      Needs.hunger[eid] = Math.min(100, Needs.hunger[eid] + decay.hungerDecay * seconds * hungerMod);
      Needs.rest[eid] = Math.max(0, Needs.rest[eid] - decay.restDecay * seconds * restMod);
      Needs.social[eid] = Math.max(0, Needs.social[eid] - decay.socialDecay * seconds);
      Needs.fun[eid] = Math.max(0, Needs.fun[eid] - decay.funDecay * seconds);

      if (!hasComponent(world, eid, Health)) continue;

      if (Needs.hunger[eid] >= 95) {
        Health.current[eid] = Math.max(0, Health.current[eid] - STARVATION_DAMAGE * seconds);
        if (Health.current[eid] <= 0) {
          addComponent(world, eid, Dead);
        }
      }

      if (Needs.rest[eid] <= 5) {
        Health.current[eid] = Math.max(0, Health.current[eid] - EXHAUSTION_DAMAGE * seconds);
        if (Health.current[eid] <= 0) {
          addComponent(world, eid, Dead);
        }
      }
    }
  };
}
