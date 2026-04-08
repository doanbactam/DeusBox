import Phaser from 'phaser';
import type { GameWorld } from '@/game/ecs/ECSHost.js';
import { spawnCreature } from '@/game/ecs/factories/CreatureFactory.js';
import { spawnBuilding } from '@/game/ecs/factories/BuildingFactory.js';
import { SpawnEffect } from './effects/SpawnEffect.js';

/**
 * Spawns creatures/buildings at click position.
 * Delegates to CreatureFactory and BuildingFactory.
 */
export class SpawnTool {
  private world: GameWorld;
  private scene: Phaser.Scene;

  constructor(world: GameWorld, scene: Phaser.Scene) {
    this.world = world;
    this.scene = scene;
  }

  spawnCreature(type: string, x: number, y: number, factionId: number = 0): number {
    const eid = spawnCreature(this.world, type, x, y, factionId);

    if (eid >= 0) {
      new SpawnEffect(this.scene, x, y);
    }

    return eid;
  }

  spawnBuilding(type: string, x: number, y: number, factionId: number = 0): number {
    const eid = spawnBuilding(this.world, type, x, y, factionId);

    if (eid >= 0) {
      new SpawnEffect(this.scene, x, y);
    }

    return eid;
  }
}
