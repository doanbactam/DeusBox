import Phaser from 'phaser';
import { query, hasComponent, addComponent } from 'bitecs';
import type { GameWorld } from '../ECSHost.js';
import Position from '../components/Position.js';
import Health from '../components/Health.js';
import Faction from '../components/Faction.js';
import Needs from '../components/Needs.js';
import Reproduction from '../components/Reproduction.js';
import { Creature, Dead, Humanoid, Animal } from '../components/TagComponents.js';
import { spawnCreature, entityTypes } from '../factories/CreatureFactory.js';
import { destroyEntitySprite } from '../systems/RenderSyncSystem.js';
import { TILE_SIZE } from '@/core/Constants.js';

/** Maximum entities per faction. */
const FACTION_POP_CAP = 50;
/** Social need threshold to allow reproduction. */
const SOCIAL_THRESHOLD = 30;
/** Natural death probability per second after 3x maturity age. */
const NATURAL_DEATH_RATE = 0.001;
/** Cooldown reduction rate (seconds per second of game time). */
const COOLDOWN_RATE = 1;

/**
 * Creates the reproduction system.
 * Mature creatures with social needs satisfied can reproduce.
 * Aging increments each tick; natural death occurs at very old ages.
 * Population is capped per faction.
 */
export function createReproductionSystem(
  _scene: Phaser.Scene,
  sprites: Map<number, Phaser.GameObjects.Sprite>,
): (world: GameWorld, delta: number) => void {
  return (world: GameWorld, delta: number): void => {
    const seconds = delta / 1000;
    const deadEntities: number[] = [];

    // ── Count faction populations ────────────────────────────────────
    const factionCounts = new Map<number, number>();
    const allCreatures = query(world, [Faction, Reproduction]);
    for (let i = 0; i < allCreatures.length; i++) {
      const eid = allCreatures[i];
      if (hasComponent(world, eid, Dead)) continue;
      const fid = Math.floor(Faction.id[eid]);
      factionCounts.set(fid, (factionCounts.get(fid) ?? 0) + 1);
    }

    // ── Age, reproduce, natural death ────────────────────────────────
    const reproducers = query(world, [Position, Reproduction, Faction, Needs, Health]);
    for (let i = 0; i < reproducers.length; i++) {
      const eid = reproducers[i];
      if (hasComponent(world, eid, Dead)) continue;
      if (!hasComponent(world, eid, Creature)) continue;

      // Aging
      Reproduction.age[eid] += seconds;

      // Cooldown tick
      if (Reproduction.cooldown[eid] > 0) {
        Reproduction.cooldown[eid] = Math.max(
          0,
          Reproduction.cooldown[eid] - COOLDOWN_RATE * seconds,
        );
      }

      // Natural death: low probability after 3x maturity age
      const maturityAge = Reproduction.maturityAge[eid];
      if (maturityAge > 0 && Reproduction.age[eid] > maturityAge * 3) {
        if (Math.random() < NATURAL_DEATH_RATE * seconds) {
          addComponent(world, eid, Dead);
          Health.current[eid] = 0;
          deadEntities.push(eid);
          continue;
        }
      }

      // Reproduction check
      if (Reproduction.pregnant[eid] === 0) {
        const isMature = Reproduction.age[eid] >= maturityAge;
        const cooldownReady = Reproduction.cooldown[eid] <= 0;
        const socialSatisfied = Needs.social[eid] > SOCIAL_THRESHOLD;
        const fid = Math.floor(Faction.id[eid]);
        const underPopCap = (factionCounts.get(fid) ?? 0) < FACTION_POP_CAP;

        if (isMature && cooldownReady && socialSatisfied && underPopCap) {
          // Determine offspring type from parent
          const parentType = entityTypes.get(eid) ?? 'human';

          // Spawn offspring near parent
          const offsetX = (Math.random() - 0.5) * TILE_SIZE * 2;
          const offsetY = (Math.random() - 0.5) * TILE_SIZE * 2;
          const childEid = spawnCreature(
            world,
            parentType,
            Position.x[eid] + offsetX,
            Position.y[eid] + offsetY,
            fid,
          );

          if (childEid >= 0) {
            // Set parent cooldown
            Reproduction.cooldown[eid] = maturityAge * 0.5;

            // Update faction count
            factionCounts.set(fid, (factionCounts.get(fid) ?? 0) + 1);
          }
        }
      }
    }

    // ── Cleanup dead entities ────────────────────────────────────────
    for (const eid of deadEntities) {
      destroyEntitySprite(world, sprites, eid);
    }
  };
}
