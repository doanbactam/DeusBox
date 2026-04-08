import Phaser from 'phaser';
import { TILE_SIZE } from '@/core/Constants.js';

/**
 * Brush cursor preview — shows which tiles will be affected.
 * Semi-transparent circle overlay at mouse position.
 */
export class TerraformEffect {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private destroyed = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(100);
    this.graphics.setVisible(false);
  }

  updatePosition(worldX: number, worldY: number, radius: number): void {
    if (this.destroyed) return;

    this.graphics.clear();
    this.graphics.setVisible(true);

    const radiusPx = radius * TILE_SIZE;

    // Fill circle
    this.graphics.fillStyle(0xffffff, 0.15);
    this.graphics.fillCircle(worldX, worldY, radiusPx);

    // Stroke circle outline
    this.graphics.lineStyle(1, 0xffffff, 0.4);
    this.graphics.strokeCircle(worldX, worldY, radiusPx);
  }

  hide(): void {
    this.graphics.clear();
    this.graphics.setVisible(false);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.graphics.destroy();
  }
}
