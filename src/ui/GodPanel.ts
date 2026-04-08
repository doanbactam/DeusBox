import Phaser from 'phaser';
import powerData from '@/data/godpowers.json';

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

const CATEGORY_ORDER = ['terraform', 'spawn', 'destroy', 'create'];
const CATEGORY_LABELS: Record<string, string> = {
  terraform: 'TERRAFORM',
  spawn: 'SPAWN',
  destroy: 'DESTROY',
  create: 'CREATE',
};

const BUTTON_SIZE = 36;
const BUTTON_GAP = 4;
const CATEGORY_GAP = 12;

interface PowerButton {
  key: string;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Text;
  shortcutLabel: Phaser.GameObjects.Text;
}

export class GodPanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Rectangle;
  private buttons: PowerButton[] = [];
  private activePower: string | null = null;
  private onPowerSelect: (powerName: string | null) => void;
  private categoryLabels: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene, onPowerSelect: (name: string | null) => void) {
    this.scene = scene;
    this.onPowerSelect = onPowerSelect;

    const { width, height } = scene.scale;

    // Build buttons grouped by category
    const entries = Object.entries(powerData) as Array<[string, GodPowerDefinition]>;
    const grouped = new Map<string, Array<[string, GodPowerDefinition]>>();

    for (const [key, def] of entries) {
      const cat = def.category;
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat)!.push([key, def]);
    }

    // Calculate total width
    let totalButtons = 0;
    let categoryCount = 0;
    for (const cat of CATEGORY_ORDER) {
      const items = grouped.get(cat);
      if (items && items.length > 0) {
        totalButtons += items.length;
        categoryCount++;
      }
    }

    const totalWidth =
      totalButtons * (BUTTON_SIZE + BUTTON_GAP) -
      BUTTON_GAP +
      (categoryCount - 1) * CATEGORY_GAP +
      24;

    this.container = scene.add.container(width / 2, height - 10);
    this.container.setScrollFactor(0);
    this.container.setDepth(1000);

    // Background panel
    this.background = scene.add.rectangle(0, 0, totalWidth, BUTTON_SIZE + 28, 0x000000, 0.7);
    this.background.setOrigin(0.5, 1);
    this.container.add(this.background);

    // Position buttons from left to right
    let xOffset = -totalWidth / 2 + 12;
    let shortcutIndex = 1;

    for (const cat of CATEGORY_ORDER) {
      const items = grouped.get(cat);
      if (!items || items.length === 0) continue;

      // Category label
      const catLabel = scene.add.text(xOffset, -BUTTON_SIZE - 14, CATEGORY_LABELS[cat] ?? cat, {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#7f8c8d',
      });
      catLabel.setOrigin(0, 0.5);
      this.container.add(catLabel);
      this.categoryLabels.push(catLabel);

      for (const [key, def] of items) {
        const btnContainer = scene.add.container(xOffset + BUTTON_SIZE / 2, -BUTTON_SIZE / 2 - 2);
        btnContainer.setScrollFactor(0);

        // Parse hex color
        const colorNum = parseInt(def.color.replace('#', ''), 16);

        const bg = scene.add.rectangle(0, 0, BUTTON_SIZE - 2, BUTTON_SIZE - 2, colorNum, 0.7);
        bg.setOrigin(0.5, 0.5);
        bg.setStrokeStyle(1, 0x666666);

        const icon = scene.add.text(0, -2, def.icon, {
          fontFamily: 'monospace',
          fontSize: '16px',
          color: '#ffffff',
          fontStyle: 'bold',
        });
        icon.setOrigin(0.5, 0.5);

        // Shortcut number
        const shortcutText =
          shortcutIndex <= 9 ? String(shortcutIndex) : shortcutIndex === 10 ? '0' : '';
        const shortcutLabel = scene.add.text(
          BUTTON_SIZE / 2 - 4,
          -BUTTON_SIZE / 2 + 4,
          shortcutText,
          {
            fontFamily: 'monospace',
            fontSize: '8px',
            color: '#aaaaaa',
          },
        );
        shortcutLabel.setOrigin(0.5, 0.5);

        btnContainer.add([bg, icon, shortcutLabel]);
        btnContainer.setSize(BUTTON_SIZE - 2, BUTTON_SIZE - 2);
        btnContainer.setInteractive({ useHandCursor: true });

        const powerKey = key;
        btnContainer.on('pointerdown', () => {
          if (this.activePower === powerKey) {
            this.setActivePower(null);
          } else {
            this.setActivePower(powerKey);
          }
        });

        btnContainer.on('pointerover', () => {
          bg.setAlpha(1.0);
        });

        btnContainer.on('pointerout', () => {
          const isActive = this.activePower === powerKey;
          bg.setAlpha(isActive ? 1.0 : 0.7);
        });

        this.buttons.push({ key, container: btnContainer, bg, icon, shortcutLabel });
        this.container.add(btnContainer);

        xOffset += BUTTON_SIZE + BUTTON_GAP;
        shortcutIndex++;
      }

      xOffset += CATEGORY_GAP - BUTTON_GAP;
    }
  }

  setActivePower(name: string | null): void {
    this.activePower = name;
    this.onPowerSelect(name);
    this.updateHighlights();
  }

  getActivePower(): string | null {
    return this.activePower;
  }

  private updateHighlights(): void {
    for (const btn of this.buttons) {
      const isActive = btn.key === this.activePower;
      if (isActive) {
        btn.bg.setStrokeStyle(2, 0xf1c40f);
        btn.bg.setAlpha(1.0);
      } else {
        btn.bg.setStrokeStyle(1, 0x666666);
        btn.bg.setAlpha(0.7);
      }
    }
  }

  /** Handle keyboard shortcut by index (1-9, 0 for 10th). */
  handleShortcut(index: number): boolean {
    if (index < 0 || index >= this.buttons.length) return false;
    const btn = this.buttons[index];
    if (this.activePower === btn.key) {
      this.setActivePower(null);
    } else {
      this.setActivePower(btn.key);
    }
    return true;
  }

  destroy(): void {
    this.container.destroy();
  }
}
