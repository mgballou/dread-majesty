import Decimal from 'break_eternity.js';
import type { Content, OverseerId, TierDef, TierId } from '@dm/content';
import { TIER_IDS } from '@dm/content';
import { createState, type GameState } from '@dm/engine';

/**
 * States worth jumping to, built out of the content rather than written down.
 *
 * Every label and every number here is derived from `Content`, so retuning balance
 * moves the jump list with it and a jump can never quietly point at a threshold that
 * stopped existing. A hardcoded list of "2,500 Evil" would be wrong the first time
 * anybody touched `generators.ts`.
 *
 * **This is dev-only.** `DevBar` is the only caller and it renders nothing outside a
 * development build.
 */
export interface Jump {
  readonly id: string;
  /** Which optgroup it sits under. */
  readonly group: string;
  readonly label: string;
  readonly build: () => GameState;
}

/** How many of each lower tier a plausible board holds when you reach the next one. */
const STOCK = 25;

interface Board {
  readonly owned?: Partial<Record<TierId, number>>;
  readonly evil?: Decimal | string;
  readonly lifetimeEvil?: Decimal | string;
  readonly souls?: number;
  readonly appointed?: readonly OverseerId[];
}

/**
 * A whole state, built from nothing.
 *
 * Nothing here mutates a live `GameState` — it builds a new one and the caller swaps
 * it in over the same boundary an imported save crosses. CLAUDE.md's rule that only
 * `step` and `apply` may mutate holds: this object has never been near either.
 */
function board(content: Content, spec: Board): GameState {
  const state = createState(content);

  for (const id of TIER_IDS) {
    const count = spec.owned?.[id];
    // Only overwrite what the spec actually asked for. Writing `?? 0` over every tier
    // wiped the free Minion `createState` grants, and the "souls banked" jumps name no
    // counts at all — so they landed on a board with nothing owned, nothing running
    // and no Evil, which the game cannot be played out of.
    if (count !== undefined) {
      const owned = new Decimal(count);
      state.gens[id].owned = owned;
      // `purchased` prices the next unit; `owned` drives everything else. Setting
      // only `owned` left a jumped-to board pricing its next purchase as if nothing
      // had ever been bought — a "deep run" with a million Minions quoting base cost.
      state.gens[id].purchased = owned;
    }

    // A tier you hold is a tier you have met. The rest latch on the next reconcile.
    state.unlocked[id] = state.gens[id].owned.gt(0);
  }

  for (const tier of content.tiers) {
    state.overseers[tier.id] = tier.overseers
      .filter((post) => spec.appointed?.includes(post.id) ?? false)
      .map((post) => post.id);
  }

  const evil = new Decimal(spec.evil ?? 0);
  state.resources.evil = evil;
  state.lifetimeEvil = new Decimal(spec.lifetimeEvil ?? evil);
  state.souls = new Decimal(spec.souls ?? 0);

  return state;
}

/**
 * Lifetime Evil at which the prestige formula first pays out `souls`.
 *
 * Nudged a hair over the exact threshold. The formula floors a square root, so
 * landing on the boundary to the last bit would pay out one soul fewer about half
 * the time, and a jump called "1 soul owed" that owes none is worse than useless.
 */
function lifetimeForSouls(content: Content, souls: number): Decimal {
  const { k, scale } = content.prestige;
  return new Decimal(scale).mul(new Decimal(souls).div(k).pow(2)).mul(1.000001);
}

/**
 * The jump list, cheapest rung first.
 *
 * Content is authored expensive-first, which is the order the stage draws. A player
 * meets the tiers the other way round, and that is the order to offer them in.
 */
export function jumps(content: Content): readonly Jump[] {
  const rungs = [...content.tiers].reverse();
  const list: Jump[] = [
    {
      id: 'zero',
      group: 'Start',
      label: 'True zero — a fresh save, nothing held',
      build: () => createState(content),
    },
  ];

  rungs.forEach((tier, index) => {
    const beneath = rungs.slice(0, index);
    const stocked = stock(beneath);
    const ids = beneath.flatMap((rung) => rung.overseers.map((post) => post.id));

    list.push({
      id: `afford:${tier.id}`,
      group: 'Reaching a tier',
      label: `Afford the first ${tier.name} — ${tier.baseCost} Evil banked`,
      build: () => board(content, { owned: stocked, evil: tier.baseCost, appointed: ids }),
    });

    for (const post of tier.overseers) {
      list.push({
        id: `appoint:${post.id}`,
        group: 'Appointing an Overseer',
        label: `Afford the ${post.name} — ${post.cost} Evil banked`,
        build: () =>
          board(content, {
            owned: { ...stocked, [tier.id]: STOCK },
            evil: post.cost,
            appointed: ids,
          }),
      });
    }

    const first = content.milestones[0];
    if (first) {
      list.push({
        id: `milestone:${tier.id}`,
        group: 'Hitting a milestone',
        label: `${tier.plural} at ${first.at} — first milestone, ×${first.multiplier}`,
        build: () =>
          board(content, {
            owned: { ...stocked, [tier.id]: first.at },
            appointed: [...ids, ...tier.overseers.map((post) => post.id)],
          }),
      });
    }
  });

  const everything = stock(rungs);
  const everyId = rungs.flatMap((rung) => rung.overseers.map((post) => post.id));

  for (const souls of [1, 10, 100]) {
    list.push({
      id: `owed:${souls}`,
      group: 'Prestige',
      label: `${souls} soul${souls === 1 ? '' : 's'} owed, none yet taken`,
      build: () =>
        board(content, {
          owned: everything,
          lifetimeEvil: lifetimeForSouls(content, souls),
          evil: lifetimeForSouls(content, souls),
          appointed: everyId,
        }),
    });

    list.push({
      id: `banked:${souls}`,
      group: 'Prestige',
      label: `${souls} soul${souls === 1 ? '' : 's'} banked, board freshly reset`,
      build: () => board(content, { souls, appointed: everyId }),
    });
  }

  list.push({
    id: 'deep',
    group: 'Far out',
    label: 'Deep run — a million of every tier, 1e30 Evil, 10,000 souls',
    build: () =>
      board(content, {
        owned: everyTierAt(1e6),
        evil: '1e30',
        lifetimeEvil: '1e40',
        souls: 10_000,
        appointed: everyId,
      }),
  });

  list.push({
    id: 'absurd',
    group: 'Far out',
    label: 'Absurd — 1e80 of every tier, for testing the formatter',
    build: () =>
      board(content, {
        owned: everyTierAt(1e80),
        evil: '1e120',
        lifetimeEvil: '1e140',
        souls: 1e9,
        appointed: everyId,
      }),
  });

  return list;
}

function stock(tiers: readonly TierDef[]): Partial<Record<TierId, number>> {
  const owned: Partial<Record<TierId, number>> = {};
  for (const tier of tiers) owned[tier.id] = STOCK;
  return owned;
}

function everyTierAt(count: number): Partial<Record<TierId, number>> {
  const owned: Partial<Record<TierId, number>> = {};
  for (const id of TIER_IDS) owned[id] = count;
  return owned;
}
