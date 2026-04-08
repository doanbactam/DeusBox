import Phaser from 'phaser';

/**
 * Camera shake effect for earthquake.
 * Shakes camera for duration with decreasing intensity.
 */
export class EarthquakeEffect {
  private scene: Phaser.Scene;
  private destroyed = false;
  private timer: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene, duration: number, intensity: number) {
    this.scene = scene;

    // camera.shake takes duration in ms and intensity 0-1
    const durationSec = duration / 1000;
    scene.cameras.main.shake(durationSec, intensity);

    this.timer = scene.time.delayedCall(duration, () => {
      this.destroy();
    });
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.timer.remove(false);
  }
}
