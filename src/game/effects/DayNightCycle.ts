import Phaser from 'phaser';

/**
 * Day/night cycle overlay that tints the game view over time.
 * Full cycle = 300 seconds of game time.
 * Phases: Dawn (6:00) → Day (12:00) → Dusk (18:00) → Night (0:00).
 */
export class DayNightCycle {
  private overlay: Phaser.GameObjects.Rectangle;
  private dayDuration: number = 300; // seconds for full cycle
  private currentTime: number = 0; // 0-300, wraps

  constructor(scene: Phaser.Scene) {
    const { width, height } = scene.scale;

    this.overlay = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0);
    this.overlay.setScrollFactor(0);
    this.overlay.setDepth(900);
    this.overlay.setOrigin(0.5, 0.5);

    // Start at dawn (6:00)
    this.currentTime = (6 / 24) * this.dayDuration;
  }

  update(delta: number, speedMultiplier: number): void {
    // Convert delta (ms) to seconds and apply speed
    const secondsDelta = (delta / 1000) * speedMultiplier;
    this.currentTime += secondsDelta;

    // Wrap around
    if (this.currentTime >= this.dayDuration) {
      this.currentTime -= this.dayDuration;
    }

    this.applyTint();
  }

  getTimeOfDay(): 'dawn' | 'day' | 'dusk' | 'night' {
    const hour = this.getHour();
    if (hour >= 5 && hour < 8) return 'dawn';
    if (hour >= 8 && hour < 17) return 'day';
    if (hour >= 17 && hour < 20) return 'dusk';
    return 'night';
  }

  getHour(): number {
    return (this.currentTime / this.dayDuration) * 24;
  }

  getGameTime(): number {
    return this.currentTime;
  }

  setGameTime(time: number): void {
    this.currentTime = time % this.dayDuration;
    this.applyTint();
  }

  private applyTint(): void {
    const hour = this.getHour();
    let color: number;
    let alpha: number;

    if (hour >= 5 && hour < 8) {
      // Dawn: warm yellow-orange tint
      color = 0xffa500;
      // Fade in from 0 to 0.1
      const progress = (hour - 5) / 3;
      alpha = progress * 0.1;
    } else if (hour >= 8 && hour < 17) {
      // Day: no tint
      color = 0x000000;
      alpha = 0;
    } else if (hour >= 17 && hour < 20) {
      // Dusk: warm orange-red tint
      color = 0xff4500;
      const progress = (hour - 17) / 3;
      alpha = 0.05 + progress * 0.1;
    } else {
      // Night: dark blue tint
      color = 0x000088;
      alpha = 0.3;

      // Smooth transition into night (20-22) and out of night (4-5)
      if (hour >= 20 && hour < 22) {
        const progress = (hour - 20) / 2;
        alpha = 0.15 + progress * 0.15;
      } else if (hour >= 22 || hour < 4) {
        alpha = 0.3;
      } else if (hour >= 4 && hour < 5) {
        const progress = (hour - 4) / 1;
        alpha = 0.3 - progress * 0.2;
      }
    }

    this.overlay.setFillStyle(color, alpha);
  }

  /** Handle resize to keep overlay covering the viewport. */
  resize(width: number, height: number): void {
    this.overlay.setPosition(width / 2, height / 2);
    this.overlay.setSize(width, height);
  }

  destroy(): void {
    this.overlay.destroy();
  }
}
