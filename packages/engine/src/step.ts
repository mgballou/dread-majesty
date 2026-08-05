import Decimal from 'break_eternity.js';
import type { Content, ProducibleId, TierId } from '@dm/content';
import { isResourceId, isTierId } from '@dm/content';
import { achievementMultiplier } from './achievements.ts';
import { effectiveCycleMs, effectiveYield, hasAutomator } from './roster.ts';
import { smiteWeight } from './smite.ts';
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
  // Spent before anything is produced, so a slice that ends the buff does not also
  // get paid at the raised rate. The countdowns are the only clock the engine has.
  state.smiteActiveMs = Math.max(0, state.smiteActiveMs - dtMs);
  state.smiteCooldownMs = Math.max(0, state.smiteCooldownMs - dtMs);

  const owned = snapshotCounts(state, content);
  const delta: Partial<Record<ProducibleId, Decimal>> = {};
  const completions: Partial<Record<TierId, number>> = {};

  for (const tier of content.tiers) {
    const gen = state.gens[tier.id];
    const appointed = hasAutomator(state, tier);

    // What gates the timer is who is watching the tier (spec §5.6). An appointed
    // tier's timer is a world clock: it advances and wraps whether or not the tier
    // owns anything, so an idle tier cannot bank hours of progress and then pay it
    // all out the instant one unit is bought. A tier nobody oversees does not run at
    // all until the `rouse` intent starts it.
    if (!appointed && !gen.running) continue;

    // Once per tier per slice, not once per branch below — this is the hot path.
    const cycleMs = effectiveCycleMs(state, tier);

    gen.progressMs += dtMs;
    let cycles = Math.floor(gen.progressMs / cycleMs);

    if (appointed) {
      if (cycles > 0) gen.progressMs -= cycles * cycleMs;
    } else if (cycles > 0) {
      // A roused tier pays exactly one cycle and stops. Progress goes to zero rather
      // than carrying the remainder, so leaving a rouse unclaimed banks nothing and
      // an hour away is worth no more than a second.
      cycles = 1;
      gen.progressMs = 0;
      gen.running = false;
    }

    const count = owned[tier.id];
    if (cycles <= 0 || count === undefined || count.lte(0)) continue;

    const amount = count
      .mul(effectiveYield(state, tier))
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
  // Ascending, so the first threshold the count has not reached ends the walk. That
  // matters: the shipping ladder runs to sixty-odd rungs and this is called per tier
  // per slice, 36,000 times to catch up an hour.
  for (const milestone of content.milestones) {
    if (owned.lt(milestone.at)) break;
    multiplier = multiplier.mul(milestone.multiplier);
  }
  return multiplier.mul(globalMultiplier(state, content));
}

/**
 * Applies to every tier: the souls the player holds, times whatever their earned
 * achievements grant.
 *
 * The achievement term is 1 for all shipping content today. It is here so that
 * turning achievements into a power source is a content edit and not an engine
 * change. See spec §10.4.
 */
export function globalMultiplier(state: GameState, content: Content): Decimal {
  const fromSouls = new Decimal(1).add(state.souls.mul(content.prestige.perSoul));
  const fromSmite = state.smiteActiveMs > 0 ? smiteWeight(state, content) : 1;
  return fromSouls.mul(achievementMultiplier(state, content)).mul(fromSmite);
}
