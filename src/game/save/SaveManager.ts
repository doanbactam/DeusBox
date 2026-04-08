import { query, hasComponent, removeEntity, getAllEntities } from 'bitecs';
import { WORLD_TILES_X, WORLD_TILES_Y } from '@/core/Constants.js';
import type { SaveGameData, SaveSlot, SavedEntity } from './SaveData.js';
import type { GameWorld } from '@/game/ecs/ECSHost.js';
import Position from '@/game/ecs/components/Position.js';
import Health from '@/game/ecs/components/Health.js';
import Needs from '@/game/ecs/components/Needs.js';
import Faction from '@/game/ecs/components/Faction.js';
import AIStateComponent from '@/game/ecs/components/AIState.js';
import Reproduction from '@/game/ecs/components/Reproduction.js';
import Structure from '@/game/ecs/components/Structure.js';
import { Creature, Building, Dead } from '@/game/ecs/components/TagComponents.js';
import { entityTypes } from '@/game/ecs/factories/CreatureFactory.js';
import { destroyEntitySprite } from '@/game/ecs/systems/RenderSyncSystem.js';

const SAVE_VERSION = '1.0.0';

export class SaveManager {
  private static SAVE_PREFIX = 'deusbox_save_';

  static save(slot: number, gameData: SaveGameData): boolean {
    try {
      const entities = SaveManager.serializeEntities(gameData.world);
      const tiles = SaveManager.serializeTiles(gameData.tileMap);

      const saveSlot: SaveSlot = {
        version: SAVE_VERSION,
        timestamp: Date.now(),
        seed: gameData.seed,
        gameTime: gameData.gameTime,
        speedMultiplier: gameData.speedMultiplier,
        camera: { ...gameData.camera },
        tiles: { data: tiles },
        entities,
      };

      const json = JSON.stringify(saveSlot);
      localStorage.setItem(`${SaveManager.SAVE_PREFIX}${slot}`, json);
      console.log(`[SaveManager] Game saved to slot ${slot} (${entities.length} entities)`);
      return true;
    } catch (err) {
      console.error('[SaveManager] Save failed:', err);
      return false;
    }
  }

  static load(slot: number): SaveSlot | null {
    try {
      const json = localStorage.getItem(`${SaveManager.SAVE_PREFIX}${slot}`);
      if (!json) return null;
      const saveSlot: SaveSlot = JSON.parse(json);
      console.log(`[SaveManager] Loaded save from slot ${slot}`);
      return saveSlot;
    } catch (err) {
      console.error('[SaveManager] Load failed:', err);
      return null;
    }
  }

  static hasSave(slot: number): boolean {
    return localStorage.getItem(`${SaveManager.SAVE_PREFIX}${slot}`) !== null;
  }

  static deleteSave(slot: number): void {
    localStorage.removeItem(`${SaveManager.SAVE_PREFIX}${slot}`);
    console.log(`[SaveManager] Deleted save slot ${slot}`);
  }

  static getSaveInfo(slot: number): { timestamp: number; gameTime: number } | null {
    const json = localStorage.getItem(`${SaveManager.SAVE_PREFIX}${slot}`);
    if (!json) return null;
    try {
      const data: SaveSlot = JSON.parse(json);
      return { timestamp: data.timestamp, gameTime: data.gameTime };
    } catch {
      return null;
    }
  }

  static listSaves(): Array<{
    slot: number;
    info: { timestamp: number; gameTime: number } | null;
  }> {
    const saves: Array<{ slot: number; info: { timestamp: number; gameTime: number } | null }> = [];
    for (let i = 1; i <= 3; i++) {
      saves.push({ slot: i, info: SaveManager.getSaveInfo(i) });
    }
    return saves;
  }

  // ── Serialization helpers ──────────────────────────────────────────────

  private static serializeEntities(world: GameWorld): SavedEntity[] {
    const entities: SavedEntity[] = [];
    const allEnts = getAllEntities(world);

    for (const eid of allEnts) {
      if (hasComponent(world, eid, Dead)) continue;
      if (!hasComponent(world, eid, Position)) continue;

      const isCreature = hasComponent(world, eid, Creature);
      const isBuilding = hasComponent(world, eid, Building);

      if (!isCreature && !isBuilding) continue;

      const saved: SavedEntity = {
        id: eid,
        type: isCreature ? 'creature' : 'building',
        x: Position.x[eid],
        y: Position.y[eid],
        health: { current: 0, max: 0 },
        faction: { id: 0, reputation: 50 },
      };

      if (hasComponent(world, eid, Health)) {
        saved.health = { current: Health.current[eid], max: Health.max[eid] };
      }

      if (hasComponent(world, eid, Faction)) {
        saved.faction = { id: Faction.id[eid], reputation: Faction.reputation[eid] };
      }

      if (isCreature) {
        saved.creatureType = entityTypes.get(eid) ?? 'human';

        if (hasComponent(world, eid, Needs)) {
          saved.needs = {
            hunger: Needs.hunger[eid],
            rest: Needs.rest[eid],
            social: Needs.social[eid],
            fun: Needs.fun[eid],
          };
        }

        if (hasComponent(world, eid, AIStateComponent)) {
          saved.aiState = AIStateComponent.state[eid];
        }

        if (hasComponent(world, eid, Reproduction)) {
          saved.age = Reproduction.age[eid];
        }
      }

      if (isBuilding && hasComponent(world, eid, Structure)) {
        const buildingTypeList = Object.keys(
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          (globalThis as Record<string, unknown>).__buildingData ?? {},
        );
        saved.buildingType = buildingTypeList[Math.floor(Structure.type[eid])] ?? 'house';
      }

      entities.push(saved);
    }

    return entities;
  }

  private static serializeTiles(tileMap: import('@/world/TileMap.js').TileMap): string {
    const size = WORLD_TILES_X * WORLD_TILES_Y;
    const raw = new Uint8Array(size);

    for (let y = 0; y < WORLD_TILES_Y; y++) {
      for (let x = 0; x < WORLD_TILES_X; x++) {
        raw[y * WORLD_TILES_X + x] = SaveManager.tileTypeToIndex(tileMap.getTile(x, y));
      }
    }

    return SaveManager.uint8ToBase64(raw);
  }

  private static tileTypeToIndex(tileType: string): number {
    const values = [
      'DeepWater',
      'ShallowWater',
      'Sand',
      'Grass',
      'Forest',
      'DenseForest',
      'Mountain',
      'Snow',
      'Desert',
      'Tundra',
      'Lava',
      'Void',
    ];
    const idx = values.indexOf(tileType);
    return idx >= 0 ? idx : values.length - 1;
  }

  private static uint8ToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]!);
    }
    return btoa(binary);
  }

  static base64ToUint8(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  /** Remove all entities and their sprites from the world. */
  static clearWorld(world: GameWorld, sprites: Map<number, Phaser.GameObjects.Sprite>): void {
    const allEnts = getAllEntities(world);
    for (const eid of allEnts) {
      destroyEntitySprite(world, sprites, eid);
    }
    entityTypes.clear();
  }
}
