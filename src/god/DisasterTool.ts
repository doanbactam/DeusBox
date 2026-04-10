import Phaser from 'phaser';
import { query } from 'bitecs';
import type { GameWorld } from '@/game/ecs/ECSHost.js';
import { TileType } from '@/core/Types.js';
import { TILE_SIZE } from '@/core/Constants.js';
import { TileMap } from '@/world/TileMap.js';
import { eventBus } from '@/core/EventBus.js';
import Position from '@/game/ecs/components/Position.js';
import Health from '@/game/ecs/components/Health.js';
import { FireEffect } from './effects/FireEffect.js';
import { LightningEffect } from './effects/LightningEffect.js';
import { EarthquakeEffect } from './effects/EarthquakeEffect.js';

// ── Types ────────────────────────────────────────────────────────────────

interface ActiveDisaster {
  type: string;
  centerX: number;
  centerY: number;
  radius: number;
  duration: number;
  elapsed: number;
  spreadTimer: number;
  affectedTiles: Set<string>;
  effects: Array<{ destroy: () => void }>;
}

// Tile types that fire can spread to
const FLAMMABLE_TILES = new Set<string>([TileType.Grass, TileType.Forest, TileType.DenseForest]);

const FIRE_SPREAD_INTERVAL = 1000; // ms between spread ticks

/**
 * Creates disasters at target location:
 * - Fire: spreads to adjacent grass/forest tiles over time, damages entities
 * - Lightning: instant damage to area
 * - Earthquake: terrain destruction, screen shake
 * - Flood: water expands from source
 */
export class DisasterTool {
  private scene: Phaser.Scene;
  private world: GameWorld;
  private tileMap: TileMap;
  private activeDisasters: ActiveDisaster[] = [];

  constructor(scene: Phaser.Scene, world: GameWorld, tileMap: TileMap) {
    this.scene = scene;
    this.world = world;
    this.tileMap = tileMap;
  }

  // ── Fire ─────────────────────────────────────────────────────────────

  startFire(centerX: number, centerY: number, radius: number, duration: number): void {
    const disaster: ActiveDisaster = {
      type: 'fire',
      centerX,
      centerY,
      radius,
      duration,
      elapsed: 0,
      spreadTimer: 0,
      affectedTiles: new Set(),
      effects: [],
    };

    // Ignite initial area
    this.igniteArea(disaster, centerX, centerY, radius);

    this.activeDisasters.push(disaster);

    eventBus.emit('disaster:start', {
      type: 'fire',
      centerX,
      centerY,
      radius,
    });
  }

  private igniteArea(disaster: ActiveDisaster, cx: number, cy: number, radius: number): void {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const tx = cx + dx;
        const ty = cy + dy;
        const key = `${tx},${ty}`;

        if (disaster.affectedTiles.has(key)) continue;
        if (!this.tileMap.isInBounds(tx, ty)) continue;

        const tile = this.tileMap.getTile(tx, ty);
        if (!FLAMMABLE_TILES.has(tile)) continue;

        disaster.affectedTiles.add(key);

        // Create fire effect at tile center
        const pixelX = tx * TILE_SIZE + TILE_SIZE / 2;
        const pixelY = ty * TILE_SIZE + TILE_SIZE / 2;
        const fireEffect = new FireEffect(this.scene, pixelX, pixelY, disaster.duration);
        disaster.effects.push(fireEffect);

        // Convert tile to sand (burnt ground)
        this.tileMap.setTile(tx, ty, TileType.Sand);
        eventBus.emit('tile:changed', {
          tileX: tx,
          tileY: ty,
          fromType: tile,
          toType: TileType.Sand,
        });

        // Damage entities on this tile
        this.damageEntitiesAtTile(tx, ty, 10);
      }
    }
  }

  private spreadFire(disaster: ActiveDisaster): void {
    // Collect current burning tile positions (tiles adjacent to already-affected ones)
    const frontier: Array<{ x: number; y: number }> = [];

    for (const key of disaster.affectedTiles) {
      const parts = key.split(',');
      const tx = parseInt(parts[0]!);
      const ty = parseInt(parts[1]!);

      // Check 4-directional neighbors
      const neighbors = [
        { x: tx - 1, y: ty },
        { x: tx + 1, y: ty },
        { x: tx, y: ty - 1 },
        { x: tx, y: ty + 1 },
      ];

      for (const n of neighbors) {
        const nKey = `${n.x},${n.y}`;
        if (disaster.affectedTiles.has(nKey)) continue;

        // Stay within radius of center
        const distSq =
          (n.x - disaster.centerX) * (n.x - disaster.centerX) +
          (n.y - disaster.centerY) * (n.y - disaster.centerY);
        if (distSq > (disaster.radius + 1) * (disaster.radius + 1)) continue;

        if (this.tileMap.isInBounds(n.x, n.y)) {
          const tile = this.tileMap.getTile(n.x, n.y);
          if (FLAMMABLE_TILES.has(tile)) {
            frontier.push(n);
          }
        }
      }
    }

    // Ignite frontier tiles (random subset for natural feel)
    for (const tile of frontier) {
      if (Math.random() < 0.5) {
        this.igniteSingleTile(disaster, tile.x, tile.y);
      }
    }
  }

  private igniteSingleTile(disaster: ActiveDisaster, tx: number, ty: number): void {
    const key = `${tx},${ty}`;
    if (disaster.affectedTiles.has(key)) return;
    if (!this.tileMap.isInBounds(tx, ty)) return;

    const tile = this.tileMap.getTile(tx, ty);
    if (!FLAMMABLE_TILES.has(tile)) return;

    disaster.affectedTiles.add(key);

    const pixelX = tx * TILE_SIZE + TILE_SIZE / 2;
    const pixelY = ty * TILE_SIZE + TILE_SIZE / 2;
    const fireEffect = new FireEffect(
      this.scene,
      pixelX,
      pixelY,
      Math.max(500, disaster.duration - disaster.elapsed),
    );
    disaster.effects.push(fireEffect);

    this.tileMap.setTile(tx, ty, TileType.Sand);
    eventBus.emit('tile:changed', {
      tileX: tx,
      tileY: ty,
      fromType: tile,
      toType: TileType.Sand,
    });

    this.damageEntitiesAtTile(tx, ty, 10);
  }

  // ── Lightning ────────────────────────────────────────────────────────

  startLightning(centerX: number, centerY: number, radius: number, damage: number): void {
    const pixelX = centerX * TILE_SIZE + TILE_SIZE / 2;
    const pixelY = centerY * TILE_SIZE + TILE_SIZE / 2;

    new LightningEffect(this.scene, pixelX, pixelY);

    // Damage entities in radius
    this.damageEntitiesInArea(pixelX, pixelY, radius * TILE_SIZE, damage);

    eventBus.emit('disaster:start', {
      type: 'lightning',
      centerX,
      centerY,
      radius,
    });
  }

  // ── Earthquake ───────────────────────────────────────────────────────

  startEarthquake(
    centerX: number,
    centerY: number,
    radius: number,
    duration: number,
    damage: number,
  ): void {
    new EarthquakeEffect(this.scene, duration, 0.01);

    // Damage entities in area
    const pixelX = centerX * TILE_SIZE + TILE_SIZE / 2;
    const pixelY = centerY * TILE_SIZE + TILE_SIZE / 2;
    this.damageEntitiesInArea(pixelX, pixelY, radius * TILE_SIZE, damage);

    // Destructive terrain changes near center
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const tx = centerX + dx;
        const ty = centerY + dy;
        if (!this.tileMap.isInBounds(tx, ty)) continue;

        const prev = this.tileMap.getTile(tx, ty);
        if (prev === TileType.Grass || prev === TileType.Forest || prev === TileType.DenseForest) {
          this.tileMap.setTile(tx, ty, TileType.Sand);
          eventBus.emit('tile:changed', {
            tileX: tx,
            tileY: ty,
            fromType: prev,
            toType: TileType.Sand,
          });
        }
      }
    }

    eventBus.emit('disaster:start', {
      type: 'earthquake',
      centerX,
      centerY,
      radius,
    });
  }

  // ── Flood ────────────────────────────────────────────────────────────

  startFlood(centerX: number, centerY: number, radius: number, duration: number): void {
    const disaster: ActiveDisaster = {
      type: 'flood',
      centerX,
      centerY,
      radius,
      duration,
      elapsed: 0,
      spreadTimer: 0,
      affectedTiles: new Set(),
      effects: [],
    };

    // Initial water at center
    this.expandFlood(disaster, 1);

    this.activeDisasters.push(disaster);

    eventBus.emit('disaster:start', {
      type: 'flood',
      centerX,
      centerY,
      radius,
    });
  }

  private expandFlood(disaster: ActiveDisaster, currentRadius: number): void {
    const r = Math.min(currentRadius, disaster.radius);

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;

        const tx = disaster.centerX + dx;
        const ty = disaster.centerY + dy;
        const key = `${tx},${ty}`;

        if (disaster.affectedTiles.has(key)) continue;
        if (!this.tileMap.isInBounds(tx, ty)) continue;

        const prev = this.tileMap.getTile(tx, ty);
        if (prev === TileType.DeepWater || prev === TileType.ShallowWater) continue;

        disaster.affectedTiles.add(key);
        this.tileMap.setTile(tx, ty, TileType.ShallowWater);
        eventBus.emit('tile:changed', {
          tileX: tx,
          tileY: ty,
          fromType: prev,
          toType: TileType.ShallowWater,
        });
      }
    }
  }

  // ── Meteor ──────────────────────────────────────────────────────────

  startMeteor(centerX: number, centerY: number, radius: number, damage: number): void {
    const pixelX = centerX * TILE_SIZE + TILE_SIZE / 2;
    const pixelY = centerY * TILE_SIZE + TILE_SIZE / 2;

    new LightningEffect(this.scene, pixelX, pixelY);
    new EarthquakeEffect(this.scene, 1500, 0.015);

    this.damageEntitiesInArea(pixelX, pixelY, radius * TILE_SIZE, damage);

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const tx = centerX + dx;
        const ty = centerY + dy;
        if (!this.tileMap.isInBounds(tx, ty)) continue;
        const prev = this.tileMap.getTile(tx, ty);
        const dist = Math.sqrt(dx * dx + dy * dy);
        const newTile = dist < radius * 0.4 ? TileType.Lava : TileType.Sand;
        if (prev !== newTile) {
          this.tileMap.setTile(tx, ty, newTile);
          eventBus.emit('tile:changed', { tileX: tx, tileY: ty, fromType: prev, toType: newTile });
        }
      }
    }

    eventBus.emit('disaster:start', { type: 'meteor', centerX, centerY, radius });
  }

  // ── Tornado ─────────────────────────────────────────────────────────

  startTornado(centerX: number, centerY: number, radius: number, duration: number, damage: number): void {
    const disaster: ActiveDisaster = {
      type: 'tornado',
      centerX,
      centerY,
      radius,
      duration,
      elapsed: 0,
      spreadTimer: 0,
      affectedTiles: new Set(),
      effects: [],
    };

    this.activeDisasters.push(disaster);
    eventBus.emit('disaster:start', { type: 'tornado', centerX, centerY, radius });
  }

  private updateTornado(d: ActiveDisaster, delta: number): void {
    const progress = d.elapsed / d.duration;
    const angle = progress * Math.PI * 8;
    const spiralRadius = d.radius * progress;
    const cx = d.centerX + Math.cos(angle) * spiralRadius;
    const cy = d.centerY + Math.sin(angle) * spiralRadius;
    const pixelX = cx * TILE_SIZE + TILE_SIZE / 2;
    const pixelY = cy * TILE_SIZE + TILE_SIZE / 2;

    this.damageEntitiesInArea(pixelX, pixelY, TILE_SIZE * 2, 5);

    const tx = Math.floor(cx);
    const ty = Math.floor(cy);
    if (this.tileMap.isInBounds(tx, ty)) {
      const prev = this.tileMap.getTile(tx, ty);
      if (FLAMMABLE_TILES.has(prev)) {
        this.tileMap.setTile(tx, ty, TileType.Sand);
        eventBus.emit('tile:changed', { tileX: tx, tileY: ty, fromType: prev, toType: TileType.Sand });
      }
    }
  }

  // ── Update loop ─────────────────────────────────────────────────────

  update(delta: number): void {
    for (let i = this.activeDisasters.length - 1; i >= 0; i--) {
      const d = this.activeDisasters[i]!;
      d.elapsed += delta;

      if (d.type === 'fire') {
        d.spreadTimer += delta;
        if (d.spreadTimer >= FIRE_SPREAD_INTERVAL) {
          d.spreadTimer -= FIRE_SPREAD_INTERVAL;
          this.spreadFire(d);
        }
      } else if (d.type === 'tornado') {
        this.updateTornado(d, delta);
      } else if (d.type === 'flood') {
        const progress = d.elapsed / d.duration;
        const currentRadius = Math.floor(d.radius * progress);
        this.expandFlood(d, currentRadius);
      }

      if (d.elapsed >= d.duration) {
        this.endDisaster(d);
        this.activeDisasters.splice(i, 1);
      }
    }
  }

  private endDisaster(disaster: ActiveDisaster): void {
    for (const effect of disaster.effects) {
      effect.destroy();
    }
    disaster.effects.length = 0;

    eventBus.emit('disaster:end', { type: disaster.type });
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  private damageEntitiesInArea(
    pixelX: number,
    pixelY: number,
    radiusPx: number,
    damage: number,
  ): void {
    const ents = query(this.world, [Position, Health]);
    for (const eid of ents) {
      const dx = Position.x[eid] - pixelX;
      const dy = Position.y[eid] - pixelY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= radiusPx) {
        Health.current[eid] = Math.max(0, Health.current[eid] - damage);
        eventBus.emit('damage:dealt', {
          entityId: eid,
          amount: damage,
          source: 'disaster',
        });
      }
    }
  }

  private damageEntitiesAtTile(tileX: number, tileY: number, damage: number): void {
    const pixelX = tileX * TILE_SIZE + TILE_SIZE / 2;
    const pixelY = tileY * TILE_SIZE + TILE_SIZE / 2;
    const halfTile = TILE_SIZE / 2;

    const ents = query(this.world, [Position, Health]);
    for (const eid of ents) {
      const dx = Position.x[eid] - pixelX;
      const dy = Position.y[eid] - pixelY;
      if (Math.abs(dx) <= halfTile && Math.abs(dy) <= halfTile) {
        Health.current[eid] = Math.max(0, Health.current[eid] - damage);
        eventBus.emit('damage:dealt', {
          entityId: eid,
          amount: damage,
          source: 'fire',
        });
      }
    }
  }
}
