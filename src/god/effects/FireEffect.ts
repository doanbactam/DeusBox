import Phaser from 'phaser';

const PIXEL_TEXTURE_KEY = '__god_pixel_fire';

function ensurePixelTexture(scene: Phaser.Scene): void {
  if (!scene.textures.exists(PIXEL_TEXTURE_KEY)) {
    const canvas = scene.textures.createCanvas(PIXEL_TEXTURE_KEY, 4, 4);
    if (canvas) {
      const ctx = canvas.getContext();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 4, 4);
      canvas.refresh();
    }
  }
}

/**
 * Pixel particle fire animation.
 * Small orange/red rectangles that flicker upward.
 * Auto-destroys after duration.
 */
export class FireEffect {
  private scene: Phaser.Scene;
  private emitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private destroyed = false;

  constructor(scene: Phaser.Scene, x: number, y: number, duration: number) {
    this.scene = scene;
    ensurePixelTexture(scene);

    this.emitter = scene.add.particles(x, y, PIXEL_TEXTURE_KEY, {
      speed: { min: 10, max: 40 },
      angle: { min: 250, max: 290 },
      scale: { start: 0.8, end: 0 },
      lifespan: { min: 300, max: 800 },
      tint: 0xff6600,
      blendMode: Phaser.BlendModes.ADD,
      frequency: 30,
      maxParticles: 30,
    });

    this.emitter.setDepth(500);

    scene.time.delayedCall(duration, () => this.destroy());
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    if (this.emitter) {
      this.emitter.stop();
      const ref = this.emitter;
      this.scene.time.delayedCall(1000, () => {
        if (ref.active) {
          ref.destroy();
        }
      });
      this.emitter = null;
    }
  }
}
