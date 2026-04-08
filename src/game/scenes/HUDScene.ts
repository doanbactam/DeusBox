import Phaser from 'phaser';
import { hasComponent } from 'bitecs';
import { TILE_SIZE } from '@/core/Constants.js';
import { TimeControls } from '@/ui/TimeControls.js';
import { TopBar } from '@/ui/TopBar.js';
import { GodPanel } from '@/ui/GodPanel.js';
import { BrushSizeSelector } from '@/ui/BrushSizeSelector.js';
import { Minimap } from '@/ui/Minimap.js';
import { EntityInfoPanel } from '@/ui/EntityInfoPanel.js';
import Position from '@/game/ecs/components/Position.js';
import { Selectable } from '@/game/ecs/components/TagComponents.js';

export class HUDScene extends Phaser.Scene {
  private timeControls: TimeControls | null = null;
  private topBar: TopBar | null = null;
  private godPanel: GodPanel | null = null;
  private brushSelector: BrushSizeSelector | null = null;
  private minimap: Minimap | null = null;
  private entityInfoPanel: EntityInfoPanel | null = null;
  private fpsText: Phaser.GameObjects.Text | null = null;
  private speedMultiplier: number = 1;

  constructor() {
    super('HUD');
  }

  create(): void {
    console.log('[HUDScene] HUD initialized');

    // Prevent HUD from capturing game keyboard input
    this.input.keyboard!.enabled = false;

    const { width, height } = this.scale;

    // 1. Time Controls (top-center)
    this.timeControls = new TimeControls(this, width / 2, 22, (multiplier: number) =>
      this.onSpeedChange(multiplier),
    );

    // 2. Top Bar (top-left)
    this.topBar = new TopBar(this);

    // 3. God Panel (bottom-center)
    this.godPanel = new GodPanel(this, (powerName: string | null) => {
      this.onPowerSelect(powerName);
    });

    // 4. Brush Size Selector (bottom-center, next to GodPanel)
    this.brushSelector = new BrushSizeSelector(this, width / 2 + 160, height - 26, (size: number) =>
      this.onBrushSizeChange(size),
    );

    // 5. Minimap (bottom-left)
    this.minimap = new Minimap(this, this.getTileMap(), 10, height - 194, 180);

    // 6. Entity Info Panel (right side, middle)
    this.entityInfoPanel = new EntityInfoPanel(this, width - PANEL_WIDTH - 10, height / 2 - 130);

    // 7. FPS counter (top-left, below TopBar)
    this.fpsText = this.add.text(10, 64, 'FPS: --', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#95a5a6',
    });
    this.fpsText.setScrollFactor(0);
    this.fpsText.setDepth(1000);

    // 8. Listen for entity selection clicks on GameScene
    this.setupEntitySelection();

    // Handle resize
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.handleResize(gameSize.width, gameSize.height);
    });
  }

  private setupEntitySelection(): void {
    const gameScene = this.scene.get('Game');
    const gameInput = gameScene.input;

    // Listen for pointer down on GameScene to select entities
    gameInput.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Only select on left click without active god power
      if (!pointer.leftButtonDown()) return;

      const inputHandler = this.getInputHandler();
      if (inputHandler && inputHandler.getActivePower()) return;

      // Convert screen coords to world coords
      const cam = gameScene.cameras.main;
      const worldX = cam.scrollX + pointer.x / cam.zoom;
      const worldY = cam.scrollY + pointer.y / cam.zoom;

      // Find closest entity within selection radius
      const world = this.getECSWorld();
      if (!world) return;

      const sprites = this.getSpritesMap();
      if (!sprites) return;

      const SELECT_RADIUS = 20;
      let closestEid: number | null = null;
      let closestDist = SELECT_RADIUS;

      for (const [eid, sprite] of sprites) {
        if (!hasComponent(world, eid, Selectable)) continue;

        const dx = sprite.x - worldX;
        const dy = sprite.y - worldY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < closestDist) {
          closestDist = dist;
          closestEid = eid;
        }
      }

      if (closestEid !== null) {
        this.entityInfoPanel?.selectEntity(closestEid, world);
      } else {
        this.entityInfoPanel?.deselect();
      }
    });
  }

  private onSpeedChange(multiplier: number): void {
    this.speedMultiplier = multiplier;
    const gameScene = this.scene.get('Game');

    if (multiplier === 0) {
      gameScene.scene.pause('Game');
    } else {
      if (gameScene.scene.isPaused('Game')) {
        gameScene.scene.resume('Game');
      }
    }
  }

  private onPowerSelect(powerName: string | null): void {
    const inputHandler = this.getInputHandler();
    if (inputHandler) {
      // Convert json key to enum key for InputHandler
      if (powerName) {
        const enumName = powerName.charAt(0).toUpperCase() + powerName.slice(1);
        inputHandler.setActivePower(enumName);
      } else {
        inputHandler.setActivePower(null);
      }
    }
  }

  private onBrushSizeChange(size: number): void {
    const inputHandler = this.getInputHandler();
    if (inputHandler) {
      inputHandler.setBrushSize(size);
    }
  }

  private getECSWorld() {
    const gameScene = this.scene.get('Game') as unknown as {
      ecsHost?: { world: import('@/game/ecs/ECSHost.js').GameWorld };
    };
    return gameScene.ecsHost?.world ?? null;
  }

  private getTileMap(): import('@/world/TileMap.js').TileMap {
    const gameScene = this.scene.get('Game') as unknown as {
      tileMap: import('@/world/TileMap.js').TileMap;
    };
    return gameScene.tileMap;
  }

  private getSpritesMap(): Map<number, Phaser.GameObjects.Sprite> | null {
    const gameScene = this.scene.get('Game') as unknown as {
      sprites: Map<number, Phaser.GameObjects.Sprite>;
    };
    return gameScene.sprites ?? null;
  }

  private getInputHandler(): import('@/game/input/InputHandler.js').InputHandler | null {
    const gameScene = this.scene.get('Game') as unknown as {
      inputHandler: import('@/game/input/InputHandler.js').InputHandler | null;
    };
    return gameScene.inputHandler ?? null;
  }

  private handleResize(width: number, height: number): void {
    // Reposition time controls
    if (this.timeControls) {
      this.timeControls.destroy();
      this.timeControls = new TimeControls(this, width / 2, 22, (multiplier: number) =>
        this.onSpeedChange(multiplier),
      );
    }

    // Reposition minimap
    if (this.minimap) {
      this.minimap.setPosition(10, height - 194);
    }

    // Reposition entity info panel
    if (this.entityInfoPanel) {
      this.entityInfoPanel.setPosition(width - PANEL_WIDTH - 10, height / 2 - 130);
    }

    // Reposition brush selector
    if (this.brushSelector) {
      this.brushSelector.destroy();
      this.brushSelector = new BrushSizeSelector(
        this,
        width / 2 + 160,
        height - 26,
        (size: number) => this.onBrushSizeChange(size),
      );
    }
  }

  update(_time: number, delta: number): void {
    const world = this.getECSWorld();
    const gameScene = this.scene.get('Game');
    const camera = gameScene.cameras.main;

    // 1. Update time controls (time display)
    if (this.timeControls) {
      this.timeControls.update(delta);
    }

    // 2. Update top bar (entity count)
    if (this.topBar && world) {
      this.topBar.update(world);
    }

    // 3. Update minimap (viewport + creatures)
    if (this.minimap && world) {
      this.minimap.update(camera, world);
    }

    // 4. Update entity info panel (if entity selected)
    if (this.entityInfoPanel && world) {
      this.entityInfoPanel.update(world);
    }

    // 5. Update FPS counter
    if (this.fpsText) {
      const fps = this.game.loop.actualFps;
      this.fpsText.setText(`FPS: ${Math.round(fps)}`);
    }
  }
}

const PANEL_WIDTH = 180;
