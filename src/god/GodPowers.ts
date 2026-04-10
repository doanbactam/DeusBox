import Phaser from 'phaser';
import { query } from 'bitecs';
import type { GameWorld } from '@/game/ecs/ECSHost.js';
import { TileType, GodPowerType } from '@/core/Types.js';
import { TILE_SIZE } from '@/core/Constants.js';
import { TileMap } from '@/world/TileMap.js';
import { eventBus } from '@/core/EventBus.js';
import Position from '@/game/ecs/components/Position.js';
import Health from '@/game/ecs/components/Health.js';
import { TerraformTool } from './TerraformTool.js';
import { SpawnTool } from './SpawnTool.js';
import { DisasterTool } from './DisasterTool.js';

import powerData from '@/data/godpowers.json';

// ── Types ────────────────────────────────────────────────────────────────

export interface GodPowerDefinition {
  name: string;
  category: string;
  icon: string;
  cooldown: number;
  range: number;
  duration?: number;
  damage?: number;
  healAmount?: number;
  color: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function enumToJsonKey(enumValue: string): string {
  return enumValue.charAt(0).toLowerCase() + enumValue.slice(1);
}

const TERRAFORM_TILE_MAP: Partial<Record<string, TileType>> = {
  [GodPowerType.TerraformGrass]: TileType.Grass,
  [GodPowerType.TerraformForest]: TileType.Forest,
  [GodPowerType.TerraformDesert]: TileType.Desert,
  [GodPowerType.TerraformWater]: TileType.ShallowWater,
  [GodPowerType.TerraformMountain]: TileType.Mountain,
};

const ANIMAL_TYPES = ['wolf', 'deer', 'chicken', 'bear'] as const;

// ── GodPowers Registry ───────────────────────────────────────────────────

/**
 * Registry of all god powers loaded from godpowers.json.
 * Manages cooldowns per power and delegates execution to tools.
 * Holds references to world, tileMap, and scene so callers only need
 * to provide the power name and target coordinates.
 */
export class GodPowers {
  private powers: Map<string, GodPowerDefinition>;
  private cooldowns: Map<string, number>;
  private activePower: string | null = null;
  private world: GameWorld;
  private tileMap: TileMap;
  private scene: Phaser.Scene;
  private terraformTool: TerraformTool;
  private spawnTool: SpawnTool;
  private disasterTool: DisasterTool;

  constructor(
    world: GameWorld,
    tileMap: TileMap,
    scene: Phaser.Scene,
    terraformTool: TerraformTool,
    spawnTool: SpawnTool,
    disasterTool: DisasterTool,
  ) {
    this.world = world;
    this.tileMap = tileMap;
    this.scene = scene;
    this.terraformTool = terraformTool;
    this.spawnTool = spawnTool;
    this.disasterTool = disasterTool;

    this.powers = new Map();
    this.cooldowns = new Map();

    // Load power definitions from JSON
    const entries = Object.entries(powerData) as Array<[string, GodPowerDefinition]>;
    for (const [key, config] of entries) {
      this.powers.set(key, config);
      this.cooldowns.set(key, 0);
    }
  }

  getPower(name: string): GodPowerDefinition | undefined {
    const key = enumToJsonKey(name);
    return this.powers.get(key);
  }

  canUse(name: string, currentTime: number): boolean {
    const key = enumToJsonKey(name);
    const power = this.powers.get(key);
    if (!power) return false;
    if (power.cooldown <= 0) return true;
    const lastUsed = this.cooldowns.get(key) ?? 0;
    return currentTime - lastUsed >= power.cooldown;
  }

  /**
   * Execute a god power at the given tile coordinates.
   * All tool references, world, tileMap, and scene are resolved internally.
   */
  use(name: string, tileX: number, tileY: number): boolean {
    const key = enumToJsonKey(name);
    const power = this.powers.get(key);
    if (!power) return false;

    const now = this.scene.time.now;
    if (!this.canUse(name, now)) return false;

    const range = power.range;
    const pixelX = tileX * TILE_SIZE + TILE_SIZE / 2;
    const pixelY = tileY * TILE_SIZE + TILE_SIZE / 2;

    switch (power.category) {
      // ── Terraform ────────────────────────────────────────────────────
      case 'terraform': {
        const tileType = TERRAFORM_TILE_MAP[name];
        if (tileType) {
          this.terraformTool.paint(tileType, tileX, tileY, range);
        }
        break;
      }

      // ── Spawn ────────────────────────────────────────────────────────
      case 'spawn': {
        if (name === GodPowerType.SpawnHuman) {
          this.spawnTool.spawnCreature('human', pixelX, pixelY, 1);
        } else if (name === GodPowerType.SpawnElf) {
          this.spawnTool.spawnCreature('elf', pixelX, pixelY, 2);
        } else if (name === GodPowerType.SpawnDwarf) {
          this.spawnTool.spawnCreature('dwarf', pixelX, pixelY, 3);
        } else if (name === GodPowerType.SpawnOrc) {
          this.spawnTool.spawnCreature('orc', pixelX, pixelY, 4);
        } else if (name === GodPowerType.SpawnAnimal) {
          const animal = ANIMAL_TYPES[Math.floor(Math.random() * ANIMAL_TYPES.length)];
          this.spawnTool.spawnCreature(animal, pixelX, pixelY, 0);
        }
        break;
      }

      // ── Destroy (disasters) ──────────────────────────────────────────
      case 'destroy': {
        if (name === GodPowerType.FireStrike) {
          this.disasterTool.startFire(tileX, tileY, range, power.duration ?? 5000);
        } else if (name === GodPowerType.LightningStrike) {
          this.disasterTool.startLightning(tileX, tileY, range, power.damage ?? 50);
        } else if (name === GodPowerType.Earthquake) {
          this.disasterTool.startEarthquake(
            tileX,
            tileY,
            range,
            power.duration ?? 3000,
            power.damage ?? 30,
          );
        } else if (name === GodPowerType.Meteor) {
          this.disasterTool.startMeteor(tileX, tileY, range, power.damage ?? 80);
        } else if (name === GodPowerType.Tornado) {
          this.disasterTool.startTornado(tileX, tileY, range, power.duration ?? 6000, power.damage ?? 20);
        } else if (name === GodPowerType.Flood) {
          this.disasterTool.startFlood(tileX, tileY, range, power.duration ?? 8000);
        }
        break;
      }

      // ── Create (heal / bless) ────────────────────────────────────────
      case 'create': {
        if (name === GodPowerType.Bless) {
          this.blessEntities(pixelX, pixelY, range, power.healAmount ?? 100);
        } else {
          this.healEntities(pixelX, pixelY, range, power.healAmount ?? 50);
        }
        break;
      }
    }

    // Update cooldown
    this.cooldowns.set(key, now);
    return true;
  }

  getActivePower(): string | null {
    return this.activePower;
  }

  setActivePower(name: string | null): void {
    this.activePower = name;
  }

  getCooldownProgress(name: string, currentTime: number): number {
    const key = enumToJsonKey(name);
    const power = this.powers.get(key);
    if (!power) return 0;
    if (power.cooldown <= 0) return 1;

    const lastUsed = this.cooldowns.get(key) ?? 0;
    const elapsed = currentTime - lastUsed;
    return Math.min(1, elapsed / power.cooldown);
  }

  /** Get all power keys (JSON keys). */
  getAllPowerKeys(): string[] {
    return Array.from(this.powers.keys());
  }

  /** Map a JSON key back to GodPowerType enum value. */
  static jsonKeyToEnum(jsonKey: string): string {
    return jsonKey.charAt(0).toUpperCase() + jsonKey.slice(1);
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private healEntities(pixelX: number, pixelY: number, range: number, healAmount: number): void {
    const rangePixels = range * TILE_SIZE;
    const ents = query(this.world, [Position, Health]);

    for (const eid of ents) {
      const dx = Position.x[eid] - pixelX;
      const dy = Position.y[eid] - pixelY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= rangePixels) {
        Health.current[eid] = Math.min(Health.max[eid], Health.current[eid] + healAmount);
      }
    }

    // Green sparkle VFX at heal position
    this.createHealEffect(pixelX, pixelY);
  }

  private blessEntities(pixelX: number, pixelY: number, range: number, healAmount: number): void {
    const rangePixels = range * TILE_SIZE;
    const ents = query(this.world, [Position, Health]);

    for (const eid of ents) {
      const dx = Position.x[eid] - pixelX;
      const dy = Position.y[eid] - pixelY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= rangePixels) {
        Health.current[eid] = Health.max[eid];
        Health.max[eid] = Math.min(Health.max[eid] * 1.2, 500);
        Health.current[eid] = Health.max[eid];
      }
    }

    this.createBlessEffect(pixelX, pixelY, rangePixels);
  }

  private createBlessEffect(x: number, y: number, radius: number): void {
    const BLESS_KEY = '__god_pixel_bless';
    if (!this.scene.textures.exists(BLESS_KEY)) {
      const canvas = this.scene.textures.createCanvas(BLESS_KEY, 4, 4);
      if (canvas) {
        const ctx = canvas.getContext();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 4, 4);
        canvas.refresh();
      }
    }

    const emitter = this.scene.add.particles(x, y, BLESS_KEY, {
      speed: { min: 40, max: 100 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.8, end: 0 },
      lifespan: { min: 400, max: 800 },
      tint: [0xf1c40f, 0xffffff, 0xf39c12],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    emitter.setDepth(500);
    emitter.explode(40);

    this.scene.time.delayedCall(1000, () => {
      emitter.destroy();
    });
  }

  private createHealEffect(x: number, y: number): void {
    const HEAL_PIXEL_KEY = '__god_pixel_heal';
    if (!this.scene.textures.exists(HEAL_PIXEL_KEY)) {
      const canvas = this.scene.textures.createCanvas(HEAL_PIXEL_KEY, 4, 4);
      if (canvas) {
        const ctx = canvas.getContext();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 4, 4);
        canvas.refresh();
      }
    }

    const emitter = this.scene.add.particles(x, y, HEAL_PIXEL_KEY, {
      speed: { min: 20, max: 60 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.6, end: 0 },
      lifespan: { min: 200, max: 500 },
      tint: 0x44ff44,
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    emitter.setDepth(500);
    emitter.explode(20);

    this.scene.time.delayedCall(800, () => {
      emitter.destroy();
    });
  }
}
