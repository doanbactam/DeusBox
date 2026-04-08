import { TileType, type Point } from '@/core/Types.js';
import { CHUNK_SIZE, TILE_SIZE } from '@/core/Constants.js';
import { TileMap } from '@/world/TileMap.js';
import { ChunkRenderer } from '@/world/ChunkRenderer.js';
import { eventBus } from '@/core/EventBus.js';

/**
 * Paints biome tiles at target location with configurable brush radius.
 * Converts between TileType and biome mapping.
 * Uses TileMap.setTile() and fires tile:changed events.
 * Refreshes affected chunks via ChunkRenderer.refreshChunk().
 */
export class TerraformTool {
  private tileMap: TileMap;
  private chunkRenderer: ChunkRenderer;

  constructor(tileMap: TileMap, chunkRenderer: ChunkRenderer) {
    this.tileMap = tileMap;
    this.chunkRenderer = chunkRenderer;
  }

  /**
   * Paint a circular area of tiles around (centerX, centerY) with brush radius.
   */
  paint(tileType: TileType, centerX: number, centerY: number, radius: number): void {
    const affectedChunks = new Set<string>();

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;

        const tx = centerX + dx;
        const ty = centerY + dy;

        if (!this.tileMap.isInBounds(tx, ty)) continue;

        const prevType = this.tileMap.getTile(tx, ty);
        if (prevType === tileType) continue;

        this.tileMap.setTile(tx, ty, tileType);

        eventBus.emit('tile:changed', {
          tileX: tx,
          tileY: ty,
          fromType: prevType,
          toType: tileType,
        });

        // Track which chunks need refreshing
        const chunkX = Math.floor(tx / CHUNK_SIZE);
        const chunkY = Math.floor(ty / CHUNK_SIZE);
        affectedChunks.add(`${chunkX},${chunkY}`);
      }
    }

    // Refresh all affected chunks immediately
    for (const key of affectedChunks) {
      const parts = key.split(',');
      const chunkX = parseInt(parts[0]!);
      const chunkY = parseInt(parts[1]!);
      this.chunkRenderer.refreshChunk(chunkX, chunkY);
    }
  }

  /**
   * Get tiles that would be affected (for preview/cursor).
   */
  getAffectedTiles(centerX: number, centerY: number, radius: number): Point[] {
    const result: Point[] = [];

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;

        const tx = centerX + dx;
        const ty = centerY + dy;

        if (this.tileMap.isInBounds(tx, ty)) {
          result.push({ x: tx, y: ty });
        }
      }
    }

    return result;
  }
}

/** Convert a world pixel position to the center pixel of the containing tile. */
export function tileCenterPixel(tileX: number, tileY: number): { x: number; y: number } {
  return {
    x: tileX * TILE_SIZE + TILE_SIZE / 2,
    y: tileY * TILE_SIZE + TILE_SIZE / 2,
  };
}
