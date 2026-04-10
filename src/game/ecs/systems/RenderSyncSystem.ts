import Phaser from 'phaser';
import { query, hasComponent, removeEntity } from 'bitecs';
import type { GameWorld } from '../ECSHost.js';
import Position from '../components/Position.js';
import SpriteRef from '../components/SpriteRef.js';
import Health from '../components/Health.js';
import Combat from '../components/Combat.js';
import MilitaryRole from '../components/MilitaryRole.js';
import Equipment from '../components/Equipment.js';
import Faction from '../components/Faction.js';
import AnimationState from '../components/AnimationState.js';
import { Creature, Dead } from '../components/TagComponents.js';
import { ANIM_IDLE, ANIM_WALK, ANIM_ATTACK, ANIM_DIE } from '../components/AnimationState.js';
import { ROLE_WARRIOR, ROLE_ARCHER, ROLE_MAGE } from './MilitarySystem.js';
import { entityTypes } from '../factories/CreatureFactory.js';

/** Direction keys matching SpriteRef.direction */
const DIR_KEYS = ['s', 'w', 'n', 'e'] as const;
/** Animation state keys */
const ANIM_KEYS = ['idle', 'walk', 'attack', 'die'] as const;

/** Velocity threshold for walk detection */
const WALK_THRESHOLD = 5;

/** Faction → color mapping for indicators */
const FACTION_COLORS: Record<number, number> = {
  0: 0xaaaaaa,
  1: 0x3498db,
  2: 0x2ecc71,
  3: 0xe67e22,
  4: 0x9b59b6,
  5: 0xe74c3c,
};

const HEALTH_BAR_WIDTH = 24;
const HEALTH_BAR_HEIGHT = 3;
const HEALTH_BAR_OFFSET_Y = -16;

/**
 * Creates a render sync system that keeps Phaser sprites in sync with
 * ECS Position data. Uses Phaser animation playback for creature sprites.
 * Draws health bars and faction indicators.
 */
export function createRenderSyncSystem(
  scene: Phaser.Scene,
  sprites: Map<number, Phaser.GameObjects.Sprite>,
): (world: GameWorld, delta: number) => void {
  const trackedEntities = new Set<number>();
  const equipOverlays = new Map<number, Phaser.GameObjects.Sprite[]>();
  const lastAnimKey = new Map<number, string>();
  const healthBars = new Map<number, Phaser.GameObjects.Graphics>();

  return (world: GameWorld): void => {
    const ents = query(world, [Position, SpriteRef]);

    // Update existing and detect new entities
    const currentEntities = new Set<number>();
    for (let i = 0; i < ents.length; i++) {
      const eid = ents[i]!;
      currentEntities.add(eid);

      let sprite = sprites.get(eid);
      if (!sprite) {
        // Determine initial texture — use first idle frame
        const textureKey = getCreatureAnimTexture(world, eid);

        sprite = scene.add.sprite(Position.x[eid], Position.y[eid], textureKey);
        sprite.setOrigin(0.5, 0.5);
        sprite.setDepth(eid);

        // Smaller sprites for creatures vs buildings
        if (hasComponent(world, eid, Creature)) {
          sprite.setScale(2);
        }

        sprites.set(eid, sprite);

        // Play initial idle animation for creatures
        if (hasComponent(world, eid, Creature)) {
          const type = entityTypes.get(eid) ?? 'human';
          const animKey = `idle_s_${type}`;
          if (scene.anims.exists(animKey)) {
            sprite.play(animKey);
            lastAnimKey.set(eid, animKey);
          }
        }
      }

      // Sync position
      sprite.setPosition(Position.x[eid], Position.y[eid]);

      // ── Animation playback for creatures ────────────────────────────
      if (hasComponent(world, eid, Creature)) {
        const type = entityTypes.get(eid) ?? 'human';
        const dir = SpriteRef.direction[eid] ?? 0;

        // Determine animation state
        let animState = ANIM_IDLE;

        if (hasComponent(world, eid, AnimationState)) {
          animState = AnimationState.state[eid];
        } else {
          // Fallback: derive from velocity/combat/health
          const isDead = Health.current[eid] <= 0;
          const isFighting = Combat.target[eid] >= 0;
          // Use speed from velocity if available
          // (Velocity component may not be queried here, so use AnimationState as primary)
          if (isDead) animState = ANIM_DIE;
          else if (isFighting) animState = ANIM_ATTACK;
          // Default idle — walk detected by AnimationSystem
        }

        SpriteRef.animState[eid] = animState;

        const animKey = `${ANIM_KEYS[animState]}_${DIR_KEYS[dir]}_${type}`;

        // Only play if animation changed
        if (scene.anims.exists(animKey) && lastAnimKey.get(eid) !== animKey) {
          sprite.play(animKey);
          lastAnimKey.set(eid, animKey);
        }

        // Death: fade out using AnimationState deathProgress
        if (animState === ANIM_DIE && hasComponent(world, eid, AnimationState)) {
          const progress = AnimationState.deathProgress[eid];
          sprite.setAlpha(1 - progress);
          const baseScale = 2;
          sprite.setScale(baseScale * (1 - progress * 0.3));
        }
      }

      // ── Health bar + faction indicator for creatures ───────────────
      if (hasComponent(world, eid, Creature) && hasComponent(world, eid, Health)) {
        const hp = Health.current[eid];
        const maxHp = Health.max[eid];
        const isDead = hasComponent(world, eid, Dead) || hp <= 0;

        let gfx = healthBars.get(eid);
        if (!gfx) {
          gfx = scene.add.graphics();
          gfx.setDepth(eid + 0.8);
          healthBars.set(eid, gfx);
        }

        gfx.clear();
        if (!isDead) {
          const barX = Position.x[eid] - HEALTH_BAR_WIDTH / 2;
          const barY = Position.y[eid] + HEALTH_BAR_OFFSET_Y;
          const ratio = Math.max(0, hp / maxHp);

          gfx.fillStyle(0x111111, 0.8);
          gfx.fillRect(barX - 1, barY - 1, HEALTH_BAR_WIDTH + 2, HEALTH_BAR_HEIGHT + 2);

          const barColor = ratio > 0.6 ? 0x2ecc71 : ratio > 0.3 ? 0xf39c12 : 0xe74c3c;
          gfx.fillStyle(barColor, 1);
          gfx.fillRect(barX, barY, HEALTH_BAR_WIDTH * ratio, HEALTH_BAR_HEIGHT);

          const factionId = hasComponent(world, eid, Faction) ? Math.floor(Faction.id[eid]) : 0;
          const fColor = FACTION_COLORS[factionId] ?? 0xaaaaaa;
          gfx.fillStyle(fColor, 1);
          gfx.fillCircle(Position.x[eid], barY - 3, 2);
        }
      }

      // Equipment overlay rendering
      if (hasComponent(world, eid, Equipment)) {
        const weapon = Equipment.weapon[eid];
        const armor = Equipment.armor[eid];

        const desiredTextures: string[] = [];
        if (armor === 1) desiredTextures.push('armor_leather');
        else if (armor === 2) desiredTextures.push('armor_chain');
        else if (armor === 3) desiredTextures.push('armor_plate');

        if (weapon === 1) desiredTextures.push('equip_sword');
        else if (weapon === 2) desiredTextures.push('equip_bow');
        else if (weapon === 3) desiredTextures.push('equip_staff');

        const currentOverlays = equipOverlays.get(eid);
        const needsUpdate = !currentOverlays
          || currentOverlays.length !== desiredTextures.length
          || currentOverlays.some((s, idx) => s.texture.key !== desiredTextures[idx]);

        if (needsUpdate) {
          if (currentOverlays) {
            for (const overlay of currentOverlays) overlay.destroy();
          }

          const newOverlays: Phaser.GameObjects.Sprite[] = [];
          for (const tex of desiredTextures) {
            if (scene.textures.exists(tex)) {
              const overlay = scene.add.sprite(Position.x[eid], Position.y[eid], tex);
              overlay.setOrigin(0.5, 0.5);
              overlay.setDepth(eid + 0.5);
              overlay.setScale(sprite!.scaleX);
              newOverlays.push(overlay);
            }
          }
          equipOverlays.set(eid, newOverlays);
        } else if (currentOverlays) {
          for (const overlay of currentOverlays) {
            overlay.setPosition(Position.x[eid], Position.y[eid]);
          }
        }
      }
    }

    // Remove sprites for entities that no longer exist
    for (const trackedEid of trackedEntities) {
      if (!currentEntities.has(trackedEid)) {
        const sprite = sprites.get(trackedEid);
        if (sprite) {
          sprite.destroy();
          sprites.delete(trackedEid);
        }
        const overlays = equipOverlays.get(trackedEid);
        if (overlays) {
          for (const overlay of overlays) overlay.destroy();
          equipOverlays.delete(trackedEid);
        }
        const hpBar = healthBars.get(trackedEid);
        if (hpBar) {
          hpBar.destroy();
          healthBars.delete(trackedEid);
        }
        lastAnimKey.delete(trackedEid);
      }
    }

    trackedEntities.clear();
    for (const eid of currentEntities) {
      trackedEntities.add(eid);
    }
  };
}

/** Get the first frame texture for a creature's idle south animation */
function getCreatureAnimTexture(world: GameWorld, eid: number): string {
  if (hasComponent(world, eid, Creature)) {
    const type = entityTypes.get(eid) ?? 'human';
    const key = `creature_${type}_s_0_idle`;
    // Check if animation frame texture exists
    const scene = Phaser.Scene.prototype;
    // Return base texture key as fallback
    const baseKey = getTextureKeyFromHash(SpriteRef.textureKey[eid]);
    return baseKey;
  }
  return getTextureKeyFromHash(SpriteRef.textureKey[eid]);
}

/**
 * Simple hash-to-string lookup for texture keys.
 */
const textureKeyMap = new Map<number, string>();
let nextTextureHash = 1;

export function hashTextureKey(key: string): number {
  for (const [hash, name] of textureKeyMap) {
    if (name === key) return hash;
  }
  const hash = nextTextureHash++;
  textureKeyMap.set(hash, key);
  return hash;
}

function getTextureKeyFromHash(hash: number): string {
  return textureKeyMap.get(hash) ?? '__white';
}

/**
 * Call before entity removal to clean up the sprite.
 */
export function destroyEntitySprite(
  world: GameWorld,
  sprites: Map<number, Phaser.GameObjects.Sprite>,
  eid: number,
): void {
  const sprite = sprites.get(eid);
  if (sprite) {
    sprite.destroy();
    sprites.delete(eid);
  }
  removeEntity(world, eid);
}
