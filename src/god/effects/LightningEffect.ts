import Phaser from 'phaser';

/**
 * Bright flash + bolt line from top of screen to target.
 * Uses Phaser Graphics to draw a jagged line.
 * Quick flash (100ms) + lingering glow (500ms).
 */
export class LightningEffect {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private flash: Phaser.GameObjects.Rectangle;
  private destroyed = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;

    // Draw jagged bolt from top of world to target
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(1000);

    this.graphics.lineStyle(3, 0xffffff, 1);
    this.graphics.beginPath();

    const camera = scene.cameras.main;
    const startY = camera.scrollY;

    this.graphics.moveTo(x, startY);

    const segments = 8;
    const totalDy = y - startY;
    const dy = totalDy / segments;

    for (let i = 1; i <= segments; i++) {
      const offsetX = (Math.random() - 0.5) * 60;
      this.graphics.lineTo(x + offsetX, startY + dy * i);
    }
    this.graphics.strokePath();

    // Draw a secondary thinner bolt for visual richness
    this.graphics.lineStyle(1, 0xccddff, 0.6);
    this.graphics.beginPath();
    this.graphics.moveTo(x + 2, startY);
    for (let i = 1; i <= segments; i++) {
      const offsetX = (Math.random() - 0.5) * 40;
      this.graphics.lineTo(x + 2 + offsetX, startY + dy * i);
    }
    this.graphics.strokePath();

    // Bright flash at impact point
    this.flash = scene.add.rectangle(x, y, 200, 200, 0xffffff, 0.7);
    this.flash.setDepth(999);

    // Quick flash fade (100ms)
    scene.tweens.add({
      targets: this.flash,
      alpha: 0,
      duration: 100,
      ease: 'Power2',
    });

    // Lingering bolt glow (500ms)
    scene.tweens.add({
      targets: this.graphics,
      alpha: 0,
      duration: 500,
      ease: 'Power2',
      onComplete: () => this.destroy(),
    });
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    if (this.graphics.active) {
      this.graphics.destroy();
    }
    if (this.flash.active) {
      this.flash.destroy();
    }
  }
}
