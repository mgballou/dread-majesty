import Decimal from 'break_eternity.js';
import type { Content, OverseerId, TierDef, TierId } from '@dm/content';
import { TIER_IDS } from '@dm/content';
import { automatorOf, createState, type GameState } from '@dm/engine';

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
  /**
   * Units priced against the cost curve, if it should diverge from `owned`.
   *
   * Defaults to `owned` when a tier is unset — "all of it was bought" is the honest
   * reading for `stock` and the milestone jumps, which only ever name a few dozen
   * units. It stops being honest once a tier's `owned` count is dominated by what the
   * tier above it produced rather than what was purchased outright (spec: generators
   * produce other generators) — see `deep` and `absurd`, which set this explicitly.
   */
  readonly purchased?: Partial<Record<TierId, number>>;
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
    const owned = spec.owned?.[id];
    // Only overwrite what the spec actually asked for. Writing `?? 0` over every tier
    // wiped the free Minion `createState` grants, and the "souls banked" jumps name no
    // counts at all — so they landed on a board with nothing owned, nothing running
    // and no Evil, which the game cannot be played out of.
    if (owned !== undefined) state.gens[id].owned = new Decimal(owned);

    // `purchased` prices the next unit; `owned` drives everything else. Leaving it at
    // zero quoted a jumped-to board's next purchase at base cost no matter how much it
    // held; setting it equal to `owned` overcorrected the other way — a tier fed by
    // the one above it can hold far more than it ever bought outright, and pricing the
    // next purchase off the full `owned` count quotes a number nothing can pay.
    const purchased = spec.purchased?.[id] ?? owned;
    if (purchased !== undefined) state.gens[id].purchased = new Decimal(purchased);

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
 * Nudged a hair over the exact threshold. The formula floors, so landing on the
 * boundary to the last bit would pay out one soul fewer about half the time, and a
 * jump called "1 soul owed" that owes none is worse than useless. The exponent comes
 * from `content.prestige` rather than a hardcoded shape, so this cannot drift from
 * `scale`/`k`/`exponent` the way it once did — the fixed square root here used to
 * quote a lifetime Evil the live formula no longer agreed with.
 */
function lifetimeForSouls(content: Content, souls: number): Decimal {
  const { k, scale, exponent } = content.prestige;
  return new Decimal(scale).mul(new Decimal(souls).div(k).pow(1 / exponent)).mul(1.000001);
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
    // Automator only, not the whole roster. A board reaching for its first Warren has
    // put its Minions on automatic and moved on — it has not also filled `goad` and
    // `glut`, which together cost more than the Warren it is reaching for. `everyId`
    // below is the other rule: it feeds `owed:`, `deep` and `absurd`, where a fully
    // staffed chain is the point rather than an accident, so it keeps every post. This
    // is the same distinction `automatorOf` exists to make for `milestone:` — the
    // third site this exact `TierId[]` → `OverseerId[]` conversion has quietly
    // widened a roster by mapping every post instead of just the automate one.
    const ids = beneath.flatMap((rung) => {
      const automator = automatorOf(rung);
      return automator ? [automator.id] : [];
    });

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
      const automator = automatorOf(tier);

      list.push({
        id: `milestone:${tier.id}`,
        group: 'Hitting a milestone',
        label: `${tier.plural} at ${first.at} — first milestone, ×${first.multiplier}`,
        build: () =>
          board(content, {
            owned: { ...stocked, [tier.id]: first.at },
            // A tier at its very first milestone — 25 units — has just arrived there.
            // A full three-post roster on it is a materially richer board than "just
            // hit the rung" models: `goad` and `glut` cost 4x and 16x the automator
            // and are no more plausible here than they are at `afford:`. Only the
            // automator joins the beneath tiers' roster.
            appointed: automator ? [...ids, automator.id] : ids,
          }),
      });
    }
  });

  const everything = stock(rungs);
  const everyId = rungs.flatMap((rung) => rung.overseers.map((post) => post.id));

  // Re-denominated for the 2026-08-08 soul curve. The old ladder — 1, 10, 100 — read
  // as early, mid and late under the square-root curve; under the flattened curve 100
  // souls is a few seconds of lifetime Evil, not a late-run figure. 600 and 3,000
  // instead track the first two soul achievements (`souls-500`, `souls-3000`), so each
  // rung still means "just past a goal a player would recognize."
  for (const souls of [1, 600, 3000]) {
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
      // A reset clears the roster along with everything else it owns — an Overseer is
      // power, not a record of having been earned once (spec §3.4), and `apply`'s
      // prestige intent sets every tier's list back to `[]`. `owed:` models the moment
      // just before that reset, when a full roster is still live and about to be
      // spent; `banked:` models the moment after, so it appoints nobody.
      build: () => board(content, { souls }),
    });
  }

  list.push({
    id: 'deep',
    group: 'Far out',
    label: 'Deep run — a million of every tier, 1e30 Evil, 10,000 souls',
    build: () =>
      board(content, {
        owned: everyTierAt(1e6),
        // A million owned came almost entirely from the chain producing it, not from
        // buying it outright. 100 purchased is comfortably under what any tier's own
        // curve can charge against the 1e30 granted — even the steepest tier here,
        // Throne at rate 1.3, prices its 101st unit at roughly 2e23, leaving the board
        // able to keep buying rather than pricing the very next unit as unpayable.
        purchased: everyTierAt(100),
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
        // Same reasoning as `deep`, scaled to the far larger grant: 500 purchased
        // still prices Throne's next unit at roughly 7.5e68 against 1e120 granted.
        purchased: everyTierAt(500),
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
