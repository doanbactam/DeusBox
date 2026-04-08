import Phaser from 'phaser';

const MIN_BRUSH = 1;
const MAX_BRUSH = 8;

export class BrushSizeSelector {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Rectangle;
  private sizeText: Phaser.GameObjects.Text;
  private brushSize: number = 3;
  private onChange: (size: number) => void;

  constructor(scene: Phaser.Scene, x: number, y: number, onChange: (size: number) => void) {
    this.scene = scene;
    this.onChange = onChange;

    this.container = scene.add.container(x, y);
    this.container.setScrollFactor(0);
    this.container.setDepth(1000);

    // Background
    this.background = scene.add.rectangle(0, 0, 90, 32, 0x000000, 0.6);
    this.background.setOrigin(0.5, 0.5);
    this.container.add(this.background);

    // Minus button
    const minusBtn = scene.add.rectangle(-30, 0, 24, 24, 0x333333, 0.8);
    minusBtn.setOrigin(0.5, 0.5);
    minusBtn.setStrokeStyle(1, 0x666666);
    const minusLabel = scene.add.text(-30, 0, '-', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ecf0f1',
    });
    minusLabel.setOrigin(0.5, 0.5);

    const minusContainer = scene.add.container(-30, 0);
    minusContainer.setSize(24, 24);
    minusContainer.setInteractive({ useHandCursor: true });
    minusContainer.add([minusBtn, minusLabel]);

    minusContainer.on('pointerdown', () => {
      this.setSize(this.brushSize - 1);
    });

    this.container.add(minusContainer);

    // Size display
    this.sizeText = scene.add.text(0, 0, `R: ${this.brushSize}`, {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#ecf0f1',
    });
    this.sizeText.setOrigin(0.5, 0.5);
    this.container.add(this.sizeText);

    // Plus button
    const plusBtn = scene.add.rectangle(30, 0, 24, 24, 0x333333, 0.8);
    plusBtn.setOrigin(0.5, 0.5);
    plusBtn.setStrokeStyle(1, 0x666666);
    const plusLabel = scene.add.text(30, 0, '+', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ecf0f1',
    });
    plusLabel.setOrigin(0.5, 0.5);

    const plusContainer = scene.add.container(30, 0);
    plusContainer.setSize(24, 24);
    plusContainer.setInteractive({ useHandCursor: true });
    plusContainer.add([plusBtn, plusLabel]);

    plusContainer.on('pointerdown', () => {
      this.setSize(this.brushSize + 1);
    });

    this.container.add(plusContainer);
  }

  setSize(size: number): void {
    this.brushSize = Math.max(MIN_BRUSH, Math.min(MAX_BRUSH, size));
    this.sizeText.setText(`R: ${this.brushSize}`);
    this.onChange(this.brushSize);
  }

  getSize(): number {
    return this.brushSize;
  }

  destroy(): void {
    this.container.destroy();
  }
}
