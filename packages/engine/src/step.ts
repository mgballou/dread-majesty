import Decimal from 'break_eternity.js';
import type { Content, ProducibleId, TierId } from '@dm/content';
import { isResourceId, isTierId } from '@dm/content';
import type { GameState, StepReport } from './types.ts';

/** The live slice. Every online tick is exactly this long. */
export const BASE_DT_MS = 100;

/**
 * Advance the simulation by one slice.
 *
 * Read from a snapshot taken at slice start, write into a delta, commit at the end.
 * Nothing produced within a slice can affect anything else within that same slice,
 * so tier iteration order does not matter and there is no tie-break rule to get
 * wrong. See spec §4.1.
 *
 * Mutates `state` in place — deliberately. Allocating a fresh nested state 36,000
 * times to catch up an hour offline is real garbage for no gain. `step` and `apply`
 * are the only functions permitted to do this.
 *
 * @param dtMs Integer milliseconds. Fractions break exact cycle completion.
 */
export function step(state: GameState, content: Content, dtMs: number): StepReport {
  const owned = snapshotCounts(state, content);
  const delta: Partial<Record<ProducibleId, Decimal>> = {};
  const completions: Partial<Record<TierId, number>> = {};

  for (const tier of content.tiers) {
    const gen = state.gens[tier.id];

    // The cycle timer is a world clock. It advances and wraps whether or not the
    // tier owns anything, so an idle tier cannot bank hours of progress and then
    // pay it all out the instant one unit is bought.
    gen.progressMs += dtMs;
    const cycles = Math.floor(gen.progressMs / tier.cycleMs);
    if (cycles > 0) gen.progressMs -= cycles * tier.cycleMs;

    const count = owned[tier.id];
    if (cycles <= 0 || count === undefined || count.lte(0)) continue;

    const amount = count
      .mul(new Decimal(tier.yield))
      .mul(cycles)
      .mul(tierMultiplier(state, content, count));

    delta[tier.produces] = (delta[tier.produces] ?? new Decimal(0)).add(amount);
    completions[tier.id] = cycles;
    gen.lifetimeProduced = gen.lifetimeProduced.add(amount);
  }

  commit(state, delta);
  return { produced: delta, completions };
}

function snapshotCounts(state: GameState, content: Content): Partial<Record<TierId, Decimal>> {
  const owned: Partial<Record<TierId, Decimal>> = {};
  for (const tier of content.tiers) owned[tier.id] = state.gens[tier.id].owned;
  return owned;
}

function commit(state: GameState, delta: Partial<Record<ProducibleId, Decimal>>): void {
  for (const [id, amount] of Object.entries(delta)) {
    if (amount === undefined) continue;

    if (isTierId(id)) {
      state.gens[id].owned = state.gens[id].owned.add(amount);
      continue;
    }

    if (!isResourceId(id)) continue;
    state.resources[id] = state.resources[id].add(amount);
    if (id === 'evil') state.lifetimeEvil = state.lifetimeEvil.add(amount);
  }
}

/**
 * Milestone doublings for a tier at the given owned count, times the global soul
 * multiplier. Takes the count rather than the tier because milestones key on the
 * count alone — per-tier upgrades in M3 will change that.
 */
export function tierMultiplier(state: GameState, content: Content, owned: Decimal): Decimal {
  let multiplier = new Decimal(1);
  for (const threshold of content.milestones) {
    if (owned.gte(threshold)) multiplier = multiplier.mul(content.milestoneMultiplier);
  }
  return multiplier.mul(globalMultiplier(state, content));
}

/** Applies to every tier. The only thing prestige buys. */
export function globalMultiplier(state: GameState, content: Content): Decimal {
  return new Decimal(1).add(state.souls.mul(content.prestige.perSoul));
}
