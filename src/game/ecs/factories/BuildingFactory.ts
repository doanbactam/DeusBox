import { addEntity, addComponent } from 'bitecs';
import type { GameWorld } from '../ECSHost.js';
import Position from '../components/Position.js';
import Health from '../components/Health.js';
import SpriteRef from '../components/SpriteRef.js';
import Faction from '../components/Faction.js';
import Structure from '../components/Structure.js';
import ResourceSource from '../components/ResourceSource.js';
import { Building, Selectable, Resource } from '../components/TagComponents.js';
import { hashTextureKey } from '../systems/RenderSyncSystem.js';
import { resourceTypeToIndex } from '../systems/ResourceSystem.js';
import { eventBus } from '@/core/EventBus.js';
import { ResourceType } from '@/core/Types.js';

import buildingData from '@/data/buildings.json';

interface BuildingConfig {
  size: { x: number; y: number };
  color: string;
  cost: Record<string, number>;
  provides: string;
  capacity?: number;
  productionRate?: number;
  healthBonus?: number;
  movementBonus?: number;
}

type BuildingType = keyof typeof buildingData;

/** Building type name list for index mapping. */
const BUILDING_TYPE_LIST = Object.keys(buildingData);

/**
 * Spawns a building entity with relevant components.
 * Data is loaded from buildings.json.
 *
 * @returns The entity ID of the spawned building.
 */
export function spawnBuilding(
  world: GameWorld,
  type: string,
  x: number,
  y: number,
  factionId: number = 0,
): number {
  const config = (buildingData as Record<string, BuildingConfig>)[type];
  if (!config) {
    console.warn(`[BuildingFactory] Unknown building type: ${type}`);
    return -1;
  }

  const eid = addEntity(world);

  // Position
  addComponent(world, eid, Position);
  Position.x[eid] = x;
  Position.y[eid] = y;

  // Health — buildings use healthBonus if specified, else default 200
  const buildingHealth = config.healthBonus ?? 200;
  addComponent(world, eid, Health);
  Health.current[eid] = buildingHealth;
  Health.max[eid] = buildingHealth;

  // Sprite reference
  const textureKey = `building_${type}`;
  addComponent(world, eid, SpriteRef);
  SpriteRef.textureKey[eid] = hashTextureKey(textureKey);

  // Faction
  addComponent(world, eid, Faction);
  Faction.id[eid] = factionId;
  Faction.reputation[eid] = 50;

  // Structure component
  addComponent(world, eid, Structure);
  Structure.type[eid] = BUILDING_TYPE_LIST.indexOf(type);
  Structure.factionId[eid] = factionId;
  Structure.level[eid] = 1;
  Structure.health[eid] = buildingHealth;
  Structure.maxHealth[eid] = buildingHealth;

  // Tag components
  addComponent(world, eid, Building);
  addComponent(world, eid, Selectable);

  // Farm: add ResourceSource for food production
  if (config.provides === 'food') {
    addComponent(world, eid, ResourceSource);
    ResourceSource.type[eid] = resourceTypeToIndex(ResourceType.Food);
    ResourceSource.amount[eid] = 500;
    ResourceSource.harvestTime[eid] = 1 / (config.productionRate ?? 1);
    addComponent(world, eid, Resource);
  }

  // Fire spawn event
  eventBus.emit('entity:spawned', { entityId: eid, type });

  return eid;
}
