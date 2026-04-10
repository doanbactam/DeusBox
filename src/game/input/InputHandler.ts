import Phaser from 'phaser';
import { TILE_SIZE } from '@/core/Constants.js';
import { GodPowerType } from '@/core/Types.js';
import type { GodPowers } from '@/god/GodPowers.js';
import type { TerraformTool } from '@/god/TerraformTool.js';
import type { SpawnTool } from '@/god/SpawnTool.js';
import type { DisasterTool } from '@/god/DisasterTool.js';
import { TerraformEffect } from '@/god/effects/TerraformEffect.js';

/** Keyboard shortcut mapping: number key → GodPowerType */
const POWER_SHORTCUTS: Record<string, string> = {
  '1': GodPowerType.TerraformGrass,
  '2': GodPowerType.TerraformDesert,
  '3': GodPowerType.TerraformWater,
  '4': GodPowerType.TerraformMountain,
  '5': GodPowerType.SpawnHuman,
  '6': GodPowerType.SpawnAnimal,
  '7': GodPowerType.FireStrike,
  '8': GodPowerType.LightningStrike,
  '9': GodPowerType.Earthquake,
  '0': GodPowerType.Flood,
};

/** Set of GodPowerType values that are terraform powers. */
const TERRAFORM_POWERS = new Set<string>([
  GodPowerType.TerraformGrass,
  GodPowerType.TerraformForest,
  GodPowerType.TerraformDesert,
  GodPowerType.TerraformWater,
  GodPowerType.TerraformMountain,
]);

/**
 * Central input handler for god powers.
 *
 * Mouse/touch input → world coordinate conversion.
 * Handles tool selection, brush size, drag painting.
 * Keyboard shortcuts: 1-9 for god powers, +/- for brush size.
 * Left click: use active power.
 * Right click: cancel/deselect.
 * Mouse move: update terraform cursor preview.
 */
export class InputHandler {
  private scene: Phaser.Scene;
  private godPowers: GodPowers;
  private terraformTool: TerraformTool;
  private spawnTool: SpawnTool;
  private disasterTool: DisasterTool;

  private activePower: string | null = null;
  private brushSize: number = 3;
  private terraformEffect: TerraformEffect;
  private isPainting: boolean = false;

  constructor(
    scene: Phaser.Scene,
    godPowers: GodPowers,
    terraformTool: TerraformTool,
    spawnTool: SpawnTool,
    disasterTool: DisasterTool,
  ) {
    this.scene = scene;
    this.godPowers = godPowers;
    this.terraformTool = terraformTool;
    this.spawnTool = spawnTool;
    this.disasterTool = disasterTool;

    this.terraformEffect = new TerraformEffect(scene);

    this.registerInputHandlers();
  }

  private registerInputHandlers(): void {
    // Keyboard shortcuts
    const keyboard = this.scene.input.keyboard;
    if (keyboard) {
      keyboard.on('keydown', (event: KeyboardEvent) => {
        this.handleKeyDown(event);
      });
    }

    // Left click: use active power
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown() && this.activePower) {
        this.isPainting = true;
        this.executeActivePower(pointer);
      }
    });

    // Drag painting for terraform
    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isPainting && this.activePower && TERRAFORM_POWERS.has(this.activePower)) {
        this.executeActivePower(pointer);
      }
    });

    // Right click: cancel/deselect
    this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        this.setActivePower(null);
      }
      if (pointer.leftButtonDown() || pointer.wasTouch) {
        this.isPainting = false;
      }
    });

    // Also handle pointerupoutside for safety
    this.scene.input.on('pointerupoutside', () => {
      this.isPainting = false;
    });
  }

  private handleKeyDown(event: KeyboardEvent): void {
    // Number keys: power selection
    const powerType = POWER_SHORTCUTS[event.key];
    if (powerType) {
      // Toggle: press same key again to deselect
      if (this.activePower === powerType) {
        this.setActivePower(null);
      } else {
        this.setActivePower(powerType);
      }
      return;
    }

    // +/= key: increase brush size
    if (event.key === '+' || event.key === '=') {
      this.setBrushSize(this.brushSize + 1);
      return;
    }

    // - key: decrease brush size
    if (event.key === '-') {
      this.setBrushSize(Math.max(1, this.brushSize - 1));
      return;
    }

    // Escape: deselect
    if (event.key === 'Escape') {
      this.setActivePower(null);
      return;
    }
  }

  private executeActivePower(pointer: Phaser.Input.Pointer): void {
    if (!this.activePower) return;

    const tile = this.screenToTile(pointer.x, pointer.y);
    this.godPowers.use(this.activePower, tile.tileX, tile.tileY);
  }

  /**
   * Convert screen coordinates to world tile coordinates.
   */
  screenToTile(screenX: number, screenY: number): { tileX: number; tileY: number } {
    const world = this.screenToWorld(screenX, screenY);
    return {
      tileX: Math.floor(world.x / TILE_SIZE),
      tileY: Math.floor(world.y / TILE_SIZE),
    };
  }

  /**
   * Convert screen coordinates to world pixel coordinates.
   */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const cam = this.scene.cameras.main;
    return {
      x: cam.scrollX + screenX / cam.zoom,
      y: cam.scrollY + screenY / cam.zoom,
    };
  }

  update(): void {
    if (this.activePower && TERRAFORM_POWERS.has(this.activePower)) {
      const pointer = this.scene.input.activePointer;
      const world = this.screenToWorld(pointer.x, pointer.y);
      const power = this.godPowers.getPower(this.activePower);
      const radius = power ? power.range : this.brushSize;
      this.terraformEffect.updatePosition(world.x, world.y, radius);
    } else {
      this.terraformEffect.hide();
    }
  }

  setActivePower(name: string | null): void {
    this.activePower = name;
    this.godPowers.setActivePower(name);

    if (!name) {
      this.terraformEffect.hide();
      this.isPainting = false;
    }
  }

  setBrushSize(size: number): void {
    this.brushSize = Math.max(1, Math.min(20, size));
  }

  getActivePower(): string | null {
    return this.activePower;
  }

  getBrushSize(): number {
    return this.brushSize;
  }

  destroy(): void {
    this.terraformEffect.destroy();
  }
}
