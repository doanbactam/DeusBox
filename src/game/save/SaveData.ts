/** Typed interfaces for game save data. */

export interface SaveSlot {
  version: string;
  timestamp: number;
  seed: number;
  gameTime: number;
  speedMultiplier: number;
  camera: { x: number; y: number; zoom: number };
  tiles: { data: string }; // base64-encoded Uint8Array
  entities: SavedEntity[];
}

export interface SavedEntity {
  id: number;
  type: string; // 'creature' or 'building'
  creatureType?: string;
  buildingType?: string;
  x: number;
  y: number;
  health: { current: number; max: number };
  needs?: { hunger: number; rest: number; social: number; fun: number };
  faction: { id: number; reputation: number };
  aiState?: number;
  age?: number;
}

export interface SaveGameData {
  seed: number;
  gameTime: number;
  speedMultiplier: number;
  camera: { x: number; y: number; zoom: number };
  world: import('@/game/ecs/ECSHost.js').GameWorld;
  tileMap: import('@/world/TileMap.js').TileMap;
  sprites: Map<number, Phaser.GameObjects.Sprite>;
}
