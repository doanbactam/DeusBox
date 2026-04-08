import Phaser from 'phaser';
import { query, hasComponent } from 'bitecs';
import type { GameWorld } from '@/game/ecs/ECSHost.js';
import Position from '@/game/ecs/components/Position.js';
import { Creature } from '@/game/ecs/components/TagComponents.js';
import { AIState } from '@/core/Types.js';

const AI_STATE_NAMES: Record<string, string> = {
  [AIState.Idle]: 'Idle',
  [AIState.Wandering]: 'Wandering',
  [AIState.Seeking]: 'Seeking',
  [AIState.Working]: 'Working',
  [AIState.Fighting]: 'Fighting',
  [AIState.Fleeing]: 'Fleeing',
  [AIState.Resting]: 'Resting',
  [AIState.Eating]: 'Eating',
  [AIState.Socializing]: 'Socializing',
  [AIState.Dead]: 'Dead',
};

export class TopBar {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Rectangle;
  private popText: Phaser.GameObjects.Text;
  private infoText: Phaser.GameObjects.Text;
  private frameCounter: number = 0;
  private updateInterval: number = 30;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const { width } = scene.scale;

    this.container = scene.add.container(10, 10);
    this.container.setScrollFactor(0);
    this.container.setDepth(1000);

    // Background panel
    this.background = scene.add.rectangle(0, 0, 200, 50, 0x000000, 0.6);
    this.background.setOrigin(0, 0);
    this.container.add(this.background);

    // Population text
    this.popText = scene.add.text(8, 6, 'Population: 0', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#2ecc71',
    });
    this.container.add(this.popText);

    // Selected entity info
    this.infoText = scene.add.text(8, 26, '', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#95a5a6',
    });
    this.container.add(this.infoText);
  }

  update(world: GameWorld): void {
    this.frameCounter++;
    if (this.frameCounter % this.updateInterval !== 0) return;

    // Count creatures
    const creatures = query(world, [Position, Creature]);
    const population = creatures.length;
    this.popText.setText(`Population: ${population}`);

    // Resize background if needed
    const textWidth = this.popText.width;
    this.background.setSize(Math.max(200, textWidth + 20), 50);
  }

  static getAIStateName(stateValue: number): string {
    // AIState values are stored via `as unknown as number` from string enum.
    // For string enums cast to Float32Array, runtime value may be NaN or the enum string.
    // We try direct lookup first, then iterate.
    if (Number.isNaN(stateValue)) return 'Idle';
    const name = AI_STATE_NAMES[stateValue];
    if (name) return name;

    // Fallback: iterate enum values
    for (const [key, val] of Object.entries(AI_STATE_NAMES)) {
      if (key === String(stateValue)) return val;
    }
    return 'Unknown';
  }

  destroy(): void {
    this.container.destroy();
  }
}
