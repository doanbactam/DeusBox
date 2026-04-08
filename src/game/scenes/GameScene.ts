import Phaser from 'phaser';
import { addEntity, addComponent, getAllEntities } from 'bitecs';
import { WORLD_TILES_X, WORLD_TILES_Y, TILE_SIZE } from '@/core/Constants.js';
import { eventBus } from '@/core/EventBus.js';
import { BiomeManager } from '@/world/BiomeManager.js';
import { WorldGenerator } from '@/world/WorldGenerator.js';
import { TilesetManager } from '@/world/TilesetManager.js';
import { ChunkRenderer } from '@/world/ChunkRenderer.js';
import { CameraController } from '@/game/camera/CameraController.js';
import { ECSHost } from '@/game/ecs/ECSHost.js';
import { createTimeSystem } from '@/game/ecs/systems/TimeSystem.js';
import { createMovementSystem } from '@/game/ecs/systems/MovementSystem.js';
import { createRenderSyncSystem } from '@/game/ecs/systems/RenderSyncSystem.js';
import { createAISystem } from '@/game/ecs/systems/AISystem.js';
import { createNeedsDecaySystem } from '@/game/ecs/systems/NeedsDecaySystem.js';
import { createPathfindingSystem } from '@/game/ecs/systems/PathfindingSystem.js';
import { createResourceSystem, resourceTypeToIndex } from '@/game/ecs/systems/ResourceSystem.js';
import { createFactionSystem } from '@/game/ecs/systems/FactionSystem.js';
import { createBuildingSystem } from '@/game/ecs/systems/BuildingSystem.js';
import { createReproductionSystem } from '@/game/ecs/systems/ReproductionSystem.js';
import { createCombatSystem } from '@/game/ecs/systems/CombatSystem.js';
import { spawnCreature } from '@/game/ecs/factories/CreatureFactory.js';
import { TileMap } from '@/world/TileMap.js';
import { TerraformTool } from '@/god/TerraformTool.js';
import { SpawnTool } from '@/god/SpawnTool.js';
import { DisasterTool } from '@/god/DisasterTool.js';
import { GodPowers } from '@/god/GodPowers.js';
import { InputHandler } from '@/game/input/InputHandler.js';
import Position from '@/game/ecs/components/Position.js';
import ResourceSource from '@/game/ecs/components/ResourceSource.js';
import { Resource } from '@/game/ecs/components/TagComponents.js';
import { TileType, ResourceType } from '@/core/Types.js';

export class GameScene extends Phaser.Scene {
  private frameCount = 0;
  private chunkRenderer: ChunkRenderer | null = null;
  private cameraController: CameraController | null = null;
  private ecsHost: ECSHost;
  private sprites: Map<number, Phaser.GameObjects.Sprite> = new Map();
  private inputHandler: InputHandler | null = null;
  private disasterTool: DisasterTool | null = null;
  private tileMap: TileMap | null = null;

  constructor() {
    super('Game');
    this.ecsHost = ECSHost.getInstance();
  }

  create(): void {
    console.log('[GameScene] Initializing procedural world...');

    const worldWidth = WORLD_TILES_X * TILE_SIZE;
    const worldHeight = WORLD_TILES_Y * TILE_SIZE;

    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

    // 1. Biome manager
    const biomeManager = new BiomeManager();

    // 2. Generate world
    console.time('[GameScene] World generation');
    const worldGenerator = new WorldGenerator(biomeManager);
    const tileMap = worldGenerator.generate(42);
    console.timeEnd('[GameScene] World generation');

    // 3. Tileset manager
    const tilesetManager = new TilesetManager();

    // 4. Chunk renderer
    this.chunkRenderer = new ChunkRenderer(this, tileMap, tilesetManager);

    // 5. Camera controller
    this.cameraController = new CameraController(this);

    // 6. Center camera on world
    this.cameraController.centerOn(worldWidth / 2, worldHeight / 2);
    this.cameraController.setZoom(2);

    // Initial chunk load
    this.chunkRenderer.update(this.cameras.main);

    // Store tileMap reference for god powers
    this.tileMap = tileMap;

    // ── ECS Initialization ────────────────────────────────────────────

    // Register systems in order: Time → NeedsDecay → AI → Pathfinding → Movement → RenderSync
    this.ecsHost.registerSystem(createTimeSystem());
    this.ecsHost.registerSystem(createNeedsDecaySystem());
    this.ecsHost.registerSystem(createAISystem(tileMap));
    this.ecsHost.registerSystem(createPathfindingSystem());
    this.ecsHost.registerSystem(createMovementSystem(worldWidth, worldHeight));
    this.ecsHost.registerSystem(createRenderSyncSystem(this, this.sprites));

    // Wave 6 systems: Resource → Faction → Building → Reproduction → Combat
    this.ecsHost.registerSystem(createResourceSystem());
    this.ecsHost.registerSystem(createFactionSystem());
    this.ecsHost.registerSystem(createBuildingSystem(tileMap));
    this.ecsHost.registerSystem(createReproductionSystem(this, this.sprites));
    this.ecsHost.registerSystem(createCombatSystem(this.sprites));

    // Spawn test creatures around the center of the world
    const cx = worldWidth / 2;
    const cy = worldHeight / 2;

    // 5 humans
    for (let i = 0; i < 5; i++) {
      spawnCreature(
        this.ecsHost.world,
        'human',
        cx + (Math.random() - 0.5) * 400,
        cy + (Math.random() - 0.5) * 400,
        1,
      );
    }

    // 3 elves
    for (let i = 0; i < 3; i++) {
      spawnCreature(
        this.ecsHost.world,
        'elf',
        cx + (Math.random() - 0.5) * 400,
        cy + (Math.random() - 0.5) * 400,
        2,
      );
    }

    // 2 wolves
    for (let i = 0; i < 2; i++) {
      spawnCreature(
        this.ecsHost.world,
        'wolf',
        cx + (Math.random() - 0.5) * 500,
        cy + (Math.random() - 0.5) * 500,
        0,
      );
    }

    const entityCount = getAllEntities(this.ecsHost.world).length;
    console.log(`[GameScene] ECS initialized with ${entityCount} entities`);

    // ── Spawn terrain resource entities ──────────────────────────────────
    spawnTerrainResources(this.ecsHost.world, tileMap, cx, cy, 60);
    console.log('[GameScene] Terrain resources spawned');

    // ── God Powers Initialization ────────────────────────────────────────

    const terraformTool = new TerraformTool(tileMap, this.chunkRenderer);
    const spawnTool = new SpawnTool(this.ecsHost.world, this);
    this.disasterTool = new DisasterTool(this, this.ecsHost.world, tileMap);

    const godPowers = new GodPowers(
      this.ecsHost.world,
      tileMap,
      this,
      terraformTool,
      spawnTool,
      this.disasterTool,
    );

    this.inputHandler = new InputHandler(
      this,
      godPowers,
      terraformTool,
      spawnTool,
      this.disasterTool,
    );

    console.log('[GameScene] God powers system initialized');

    eventBus.emit('scene:change', { scene: 'Game' });
    console.log('[GameScene] World ready — 256x256 tiles, procedural biomes, creatures spawned');
  }

  update(time: number, delta: number): void {
    this.frameCount++;

    if (this.frameCount % 120 === 0) {
      const fps = this.game.loop.actualFps;
      console.log(
        `[GameScene] Frame ${this.frameCount} | FPS: ${fps.toFixed(0)} | Delta: ${delta.toFixed(1)}ms`,
      );
    }

    // Run ECS systems
    this.ecsHost.tick(delta);

    // Update god powers input
    if (this.inputHandler) {
      this.inputHandler.update();
    }

    // Process active disasters
    if (this.disasterTool) {
      this.disasterTool.update(delta);
    }

    // Update camera
    if (this.cameraController) {
      this.cameraController.update(time, delta);
    }

    // Update chunks (load/unload based on camera viewport)
    if (this.chunkRenderer) {
      this.chunkRenderer.update(this.cameras.main);
    }
  }
}

/**
 * Spawns ResourceSource entities at terrain-appropriate locations.
 * Forest/DenseForest → Wood, Grass → Food, Mountain → Stone.
 */
function spawnTerrainResources(
  world: ReturnType<typeof ECSHost.getInstance>['world'],
  tileMap: TileMap,
  centerX: number,
  centerY: number,
  count: number,
): void {
  for (let i = 0; i < count; i++) {
    const x = centerX + (Math.random() - 0.5) * 1000;
    const y = centerY + (Math.random() - 0.5) * 1000;
    const tileX = Math.floor(x / TILE_SIZE);
    const tileY = Math.floor(y / TILE_SIZE);
    const tile = tileMap.getTile(tileX, tileY);

    let resourceTypeIndex = -1;
    let amount = 0;

    switch (tile) {
      case TileType.Forest:
      case TileType.DenseForest:
        resourceTypeIndex = resourceTypeToIndex(ResourceType.Wood);
        amount = 50 + Math.random() * 50;
        break;
      case TileType.Grass:
        resourceTypeIndex = resourceTypeToIndex(ResourceType.Food);
        amount = 30 + Math.random() * 30;
        break;
      case TileType.Mountain:
        resourceTypeIndex = resourceTypeToIndex(ResourceType.Stone);
        amount = 40 + Math.random() * 40;
        break;
      default:
        continue;
    }

    const eid = addEntity(world);
    addComponent(world, eid, Position);
    Position.x[eid] = x;
    Position.y[eid] = y;

    addComponent(world, eid, ResourceSource);
    ResourceSource.type[eid] = resourceTypeIndex;
    ResourceSource.amount[eid] = amount;
    ResourceSource.harvestTime[eid] = 2;

    addComponent(world, eid, Resource);
  }
}
