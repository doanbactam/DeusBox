import { query, hasComponent } from 'bitecs';
import type { GameWorld } from '../ECSHost.js';
import Position from '../components/Position.js';
import Faction from '../components/Faction.js';
import { Dead } from '../components/TagComponents.js';
import { TILE_SIZE } from '@/core/Constants.js';

/** Reputation change rate per second when near same-faction entities. */
const ALLY_REPUTATION_BOOST = 0.5;
/** Reputation change rate per second when near different-faction entities. */
const ENEMY_REPUTATION_PENALTY = 0.3;
/** Maximum reputation value. */
const MAX_REPUTATION = 100;
/** Minimum reputation value. */
const MIN_REPUTATION = 0;
/** Range to check for nearby faction entities. */
const FACTION_RANGE = TILE_SIZE * 6;

/**
 * Creates the faction system that tracks faction relationships.
 * Same-faction creatures cooperate; different factions may be hostile
 * based on reputation. Reputation changes based on proximity interactions.
 */
export function createFactionSystem(): (world: GameWorld, delta: number) => void {
  return (world: GameWorld, delta: number): void => {
    const seconds = delta / 1000;
    const ents = query(world, [Position, Faction]);

    for (let i = 0; i < ents.length; i++) {
      const eid = ents[i];
      if (hasComponent(world, eid, Dead)) continue;

      const factionId = Faction.id[eid];
      const ex = Position.x[eid];
      const ey = Position.y[eid];

      for (let j = i + 1; j < ents.length; j++) {
        const otherEid = ents[j];
        if (hasComponent(world, otherEid, Dead)) continue;

        const dx = Position.x[otherEid] - ex;
        const dy = Position.y[otherEid] - ey;
        const distSq = dx * dx + dy * dy;

        if (distSq < FACTION_RANGE * FACTION_RANGE) {
          const sameFaction = Faction.id[otherEid] === factionId;

          if (sameFaction) {
            // Cooperate: boost reputation
            Faction.reputation[eid] = Math.min(
              MAX_REPUTATION,
              Faction.reputation[eid] + ALLY_REPUTATION_BOOST * seconds,
            );
            Faction.reputation[otherEid] = Math.min(
              MAX_REPUTATION,
              Faction.reputation[otherEid] + ALLY_REPUTATION_BOOST * seconds,
            );
          } else {
            // Hostility: reduce reputation
            Faction.reputation[eid] = Math.max(
              MIN_REPUTATION,
              Faction.reputation[eid] - ENEMY_REPUTATION_PENALTY * seconds,
            );
            Faction.reputation[otherEid] = Math.max(
              MIN_REPUTATION,
              Faction.reputation[otherEid] - ENEMY_REPUTATION_PENALTY * seconds,
            );
          }
        }
      }
    }
  };
}

/**
 * Checks if two factions are hostile toward each other.
 * Factions are hostile when reputation is below 25.
 */
export function areFactionsHostile(factionA: number, factionB: number, world: GameWorld): boolean {
  if (factionA === factionB) return false;

  // Check reputation of any entity in either faction
  const ents = query(world, [Faction]);
  for (let i = 0; i < ents.length; i++) {
    const eid = ents[i];
    const fid = Faction.id[eid];
    if (fid === factionA || fid === factionB) {
      if (Faction.reputation[eid] < 25) return true;
    }
  }
  return false;
}
