import Phaser from 'phaser';

const PIXEL_TEXTURE_KEY = '__god_pixel_spawn';

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
 * Sparkle burst on entity creation.
 * Small white particles that expand outward and fade.
 */
export class SpawnEffect {
  private scene: Phaser.Scene;
  private emitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private destroyed = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    ensurePixelTexture(scene);

    this.emitter = scene.add.particles(x, y, PIXEL_TEXTURE_KEY, {
      speed: { min: 30, max: 80 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.6, end: 0 },
      lifespan: { min: 200, max: 500 },
      tint: 0xffffff,
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });

    this.emitter.setDepth(500);
    this.emitter.explode(15);

    scene.time.delayedCall(800, () => this.destroy());
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    if (this.emitter) {
      this.emitter.destroy();
      this.emitter = null;
    }
  }
}
