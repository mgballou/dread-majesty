import Decimal from 'break_eternity.js';
import {
  isTierId,
  type Content,
  type OverseerDef,
  type OverseerId,
  type ProducibleId,
  type TierDef,
  type TierId,
} from '@dm/content';
import {
  bulkCost,
  canAfford,
  canAppoint,
  effectiveCycleMs,
  effectiveYield,
  findTier,
  hasAutomator,
  hasPost,
  maxAffordable,
  tierMultiplier,
  type GameState,
} from '@dm/engine';
import type { BuyQuantity } from './quantity.ts';

/**
 * How far ahead a purchase is judged, in seconds.
 *
 * This constant is the whole of the ranking's opinion, and it is a genuine choice
 * rather than a detail: a Minion pays immediately, a Fortress pays through three
 * intermediaries, so *any* comparison between them is a statement about how long the
 * player intends to keep playing. Ten minutes is a session, and the spec tunes every
 * tier above Minions for a payback period of tens of minutes (§5.2), so ten minutes
 * is the horizon at which the tiers are meant to be comparable at all.
 *
 * Push it up and the rail will favour the top of the chain; pull it down and it will
 * never recommend anything but Minions. Both are correct answers to different
 * questions.
 *
 * **The payback-period claim above is retracted.** It cited a target for tiers above
 * Minions that lived in `packages/content/src/v1/generators.ts`; the retune's rewrite
 * of that file's note dropped it and left nothing to re-derive the ten minutes from.
 * The number stands only because nothing has shown it wrong, not because the reasoning
 * above still holds.
 */
export const HORIZON_SECONDS = 600;

/** The two things a rail row can offer. Both are spends, so both are ranked. */
export type RailOptionKind = 'purchase' | 'appoint';

interface RailOptionShape {
  tierId: TierId;
  cost: Decimal;
  affordable: boolean;
  /** Extra Evil this spend yields over the horizon. */
  gain: Decimal;
  /** Extra Evil per Evil spent. The ranking. */
  score: Decimal;
}

export interface RailPurchase extends RailOptionShape {
  kind: 'purchase';
  /** Units this press buys. `'max'` is already resolved here. */
  count: number;
}

export interface RailAppointment extends RailOptionShape {
  kind: 'appoint';
  overseerId: OverseerId;
}

export type RailOption = RailPurchase | RailAppointment;

export interface RailPlan {
  /**
   * Every spend on the rail, purchases and appointments together in one list.
   *
   * One list rather than two, because they are ranked against each other: a tier
   * nobody oversees produces nothing, so hiring somebody and buying another unit are
   * the same kind of question and get the same answer.
   */
  options: RailOption[];
  /** The one spend that wears the accent. Null when nothing is affordable. */
  best: RailOption | null;
  /** What to save toward when nothing is affordable. Never wears the accent. */
  saving: RailOption | null;
}

interface RailPlanInput {
  state: GameState;
  content: Content;
  quantity: BuyQuantity;
  isUnlocked: (tierId: TierId) => boolean;
}

/** Whether the plan lifted a row, and on what grounds. */
export type SpendEmphasis = 'none' | 'best' | 'saving';

/**
 * Whether one row of one panel is the row the plan lifted.
 *
 * Purchases and appointments are ranked together but no longer drawn together: the
 * muster holds one and the miscreants the other. Both ask the same question of the
 * same plan, so both ask it here, and the plan can only ever answer yes once.
 *
 * Keyed on `overseerId` for an appointment, not `tierId` — three posts now share a
 * tier and the plan can only ever lift one of them. Keying on the tier would light up
 * every post of a tier when only one of its three won.
 */
export function spendEmphasis(
  plan: RailPlan,
  kind: RailOptionKind,
  key: TierId | OverseerId,
): SpendEmphasis {
  const matches = (option: RailOption | null): boolean =>
    option !== null &&
    option.kind === kind &&
    (option.kind === 'appoint' ? option.overseerId === key : option.tierId === key);

  if (matches(plan.best)) return 'best';
  if (matches(plan.saving)) return 'saving';
  return 'none';
}

/**
 * What the rail should say, and which single row should be lifted out of it.
 *
 * **"Best" means: the most extra Evil per Evil spent, counted over `HORIZON_SECONDS`
 * and following the spend all the way down the chain.** A Warren produces no Evil
 * at all; it produces Minions, which produce Evil, which is why "what does this tier
 * yield" is the wrong question and the honest one is "what reaches the bottom of the
 * chain because I bought this". Units of a tier arrive steadily over the horizon and
 * each one then produces for whatever is left of it, so one rung down costs a factor
 * of `H / depth` — the integral, not the endpoint. That is the whole of the maths.
 *
 * Milestone crossings fall out for free: the marginal rate is measured as the tier's
 * whole output after the purchase minus its whole output before, so the buy that
 * lands on 25 units and doubles the tier scores as the doubling it is. Milestone
 * distance is on every row for exactly this reason (spec §5.3) — the rail is
 * arithmetic without it.
 *
 * **An appointment is scored on the same measure.** A tier nobody oversees stops
 * dead after every cycle (spec §5.6), so the honest value of hiring its Overseer is
 * that tier's *whole* contribution over the horizon, not a marginal slice of it —
 * the same sum as a purchase with every owned unit counted as newly arrived. That
 * puts the two on one axis, which is the point: the harness has the Minion Overseer
 * affordable at 9m 57s and the first Warren at 10m 53s, and for that under a minute
 * the appointment really is the best thing to spend on. A rail that could not lift it
 * would be lifting the wrong thing, and §3 gives it only one chance to be right.
 *
 * **What it gets wrong, plainly:**
 *
 * - *The horizon is an assumption, not a fact.* See `HORIZON_SECONDS`. A player
 *   about to close the tab and a player settling in for the evening want different
 *   answers, and this gives them the same one.
 * - *It holds every other tier still.* Buying Warrens raises the Minion count, which
 *   walks the Minion tier toward its own milestones. That second-order gain is real
 *   and is not counted, so the ranking understates the higher tiers.
 * - *It ignores cycle phase.* A tier one second from a payout is worth marginally
 *   more than one that just paid, which is the buy-before-the-tick micro-decision the
 *   spec deliberately keeps (§4.2). The rail does not see it.
 * - *It is greedy, not optimal.* Spending Evil now is Evil not compounding into a
 *   bigger purchase later. Nothing here reasons about saving up, beyond naming what
 *   to save toward when the purse is empty.
 * - *It cannot value an unlock.* The first unit of a new tier opens a rung of the
 *   chain, which is worth more than its production for a long while afterwards.
 * - *It credits an appointment with everything the player could have roused by
 *   hand.* Somebody tapping perfectly loses nothing by staying unappointed, so for
 *   them the appointment is worth its convenience and no Evil at all. The measure
 *   assumes an idle tier stays idle, which is what happens in practice and what
 *   happens for certain while the tab is shut (§5.6).
 * - *It ignores the cycle an unappointed tier is already running.* That cycle pays
 *   out whether or not anybody is hired, so the appointment is credited with a
 *   little it did not earn. One cycle against a ten-minute horizon.
 * - *A quicken or a swell over a tier nobody automates is scored as though the tier
 *   ran anyway.* The same blind spot as the automator's own, applied to the other two
 *   posts: an idle tier produces nothing to speed up or fatten, so the difference the
 *   sum counts is a difference nobody without an automator ever collects.
 *
 * None of that makes it "the most expensive thing you can afford" wearing a better
 * name. It is a real measure with stated blind spots, and every one of them is a
 * reason to keep the full list rendered for players who want to disagree.
 */
export function railPlan({ state, content, quantity, isUnlocked }: RailPlanInput): RailPlan {
  const options: RailOption[] = [];

  for (const tier of content.tiers) {
    if (!isUnlocked(tier.id)) continue;

    const purchase = purchaseOption({ state, content, tier, quantity });
    if (purchase) options.push(purchase);

    options.push(...appointOptions({ state, content, tier }));
  }

  const best = pick(options.filter((option) => option.affordable));

  return {
    options,
    best,
    saving: best ? null : pick(options),
  };
}

interface PurchaseInput {
  state: GameState;
  content: Content;
  tier: TierDef;
  quantity: BuyQuantity;
}

function purchaseOption({ state, content, tier, quantity }: PurchaseInput): RailPurchase | null {
  const count = resolveCount({ state, content, tierId: tier.id, quantity });
  const cost = bulkCost(state, content, tier.id, count) ?? new Decimal(0);
  if (cost.lte(0)) return null;

  const gain = marginalEvil({ state, content, tier, count });

  return {
    kind: 'purchase',
    tierId: tier.id,
    count,
    cost,
    affordable: canAfford(state, content, tier.id, cost),
    gain,
    score: gain.div(cost),
  };
}

interface AppointInput {
  state: GameState;
  content: Content;
  tier: TierDef;
}

/**
 * Filling one post, priced by what the tier produces before and after.
 *
 * One measure for all three kinds. The automator is worth the tier's *whole* output,
 * because an unappointed tier stops dead after every cycle (spec §5.6); a quicken or
 * a swell is worth the difference its factor makes to a tier that is running. That
 * puts the three on one axis, which is what lets §3's single accent land on the
 * right one.
 *
 * A quicken or a swell over a tier nobody automates is scored as though the tier ran
 * anyway. It is the same blind spot the header already owns for the automator: the
 * measure assumes an idle tier stays idle, which is what happens while the tab is
 * shut, and a player tapping perfectly loses nothing either way.
 *
 * Nothing for a post already filled — the option has to disappear once it is taken,
 * or the rail keeps offering a thing that cannot be bought and the ranking keeps
 * weighing it.
 */
function appointOptions({ state, content, tier }: AppointInput): RailAppointment[] {
  const options: RailAppointment[] = [];

  for (const post of tier.overseers) {
    if (hasPost(state, tier.id, post.id)) continue;

    const cost = new Decimal(post.cost);
    if (cost.lte(0)) continue;

    const owned = state.gens[tier.id].owned;
    const weighted = owned.mul(tierMultiplier(state, content, owned));
    const before =
      post.effect.kind === 'automate' && !hasAutomator(state, tier)
        ? new Decimal(0)
        : horizonEvil({ state, content, tier, weighted });

    const after = horizonEvil({
      state,
      content,
      tier,
      weighted,
      cycleMs: effectiveCycleMs(state, tier) / factorOf(post, 'quicken'),
      perCycle: effectiveYield(state, tier).mul(factorOf(post, 'swell')),
    });

    const gain = Decimal.max(0, after.sub(before));

    options.push({
      kind: 'appoint',
      tierId: tier.id,
      overseerId: post.id,
      cost,
      affordable: canAppoint(state, content, post.id),
      gain,
      score: gain.div(cost),
    });
  }

  return options;
}

/** What this post multiplies, if it is of the kind asked about. One otherwise. */
function factorOf(post: OverseerDef, kind: 'quicken' | 'swell'): number {
  return post.effect.kind === kind ? post.effect.factor : 1;
}

/** Highest score wins. Ties go to whichever content lists first, so it is stable. */
function pick(options: RailOption[]): RailOption | null {
  let winner: RailOption | null = null;
  for (const option of options) {
    if (!winner || option.score.gt(winner.score)) winner = option;
  }
  return winner;
}

interface CountInput {
  state: GameState;
  content: Content;
  tierId: TierId;
  quantity: BuyQuantity;
}

/**
 * The units one press buys.
 *
 * A max-buy with an empty purse resolves to one rather than zero, so the row still
 * shows a real price instead of a dash. It is disabled either way — the cost is the
 * thing the player is reading.
 *
 * Known cost: on `'max'` this walks the cost curve, and `bulkCost` then walks it
 * again for the same units. Deep into a run that is two loops of up to
 * `MAX_AFFORDABLE_CAP` per tier, per state change. `BuyRail` memoises the whole plan
 * against the version counter so it happens once a change rather than once a render,
 * which is enough today. A selector returning the count and its total together would
 * halve it, and that belongs in the engine beside `maxAffordable`, not here.
 */
export function resolveCount({ state, content, tierId, quantity }: CountInput): number {
  if (quantity !== 'max') return quantity;
  return Math.max(1, maxAffordable(state, content, tierId));
}

interface MarginalInput {
  state: GameState;
  content: Content;
  tier: TierDef;
  count: number;
}

/** Extra Evil over the horizon from adding `count` units of `tier`. */
function marginalEvil({ state, content, tier, count }: MarginalInput): Decimal {
  const owned = state.gens[tier.id].owned;
  const after = owned.add(count);

  const weightedBefore = owned.mul(tierMultiplier(state, content, owned));
  const weightedAfter = after.mul(tierMultiplier(state, content, after));

  return horizonEvil({ state, content, tier, weighted: weightedAfter.sub(weightedBefore) });
}

interface HorizonInput {
  state: GameState;
  content: Content;
  tier: TierDef;
  /** Milestone-weighted units of `tier` that start turning. */
  weighted: Decimal;
  /** The cycle to price against. Defaults to what the tier runs on today. */
  cycleMs?: number;
  /** The per-unit yield to price against. Defaults to what the tier yields today. */
  perCycle?: Decimal;
}

/**
 * Evil reaching the bottom of the chain over the horizon from `weighted` units of a
 * tier turning that were not turning before.
 *
 * The one sum every spend is measured by. A purchase hands it the units it adds; an
 * automator hands it every unit the tier already holds, because none of them was
 * producing; a quicken or a swell hands it an override of the cycle or the yield, so
 * the same units are priced at the rate the post would put them on.
 */
function horizonEvil({ state, content, tier, weighted, cycleMs, perCycle }: HorizonInput): Decimal {
  const each = perCycle ?? effectiveYield(state, tier);
  const every = cycleMs ?? effectiveCycleMs(state, tier);
  const perSecond = weighted.mul(each).div(every / 1000);

  return perSecond
    .mul(evilPerUnit({ state, content, producible: tier.produces }))
    .mul(HORIZON_SECONDS)
    .div(depth(content, tier.id));
}

interface UnitValueInput {
  state: GameState;
  content: Content;
  producible: ProducibleId;
}

/**
 * Evil produced over the horizon by one extra unit of a producible, at today's
 * multipliers.
 *
 * Evil is worth itself. A generator is worth its rate times what it makes, times the
 * horizon, divided by how many rungs it sits above Evil — which is the closed form of
 * nesting one integral per rung.
 */
function evilPerUnit({ state, content, producible }: UnitValueInput): Decimal {
  if (!isTierId(producible)) return new Decimal(1);

  const tier = findTier(content, producible);
  if (!tier) return new Decimal(0);

  const owned = state.gens[producible].owned;
  const perSecond = effectiveYield(state, tier)
    .mul(tierMultiplier(state, content, owned))
    .div(effectiveCycleMs(state, tier) / 1000);

  return perSecond
    .mul(evilPerUnit({ state, content, producible: tier.produces }))
    .mul(HORIZON_SECONDS)
    .div(depth(content, producible));
}

/** Rungs between a producible and Evil. Minions are 1, Warrens 2, and so on. */
function depth(content: Content, producible: ProducibleId): number {
  let steps = 0;
  let current: ProducibleId = producible;

  while (isTierId(current) && steps <= content.tiers.length) {
    const tier = findTier(content, current);
    if (!tier) break;
    steps += 1;
    current = tier.produces;
  }

  return Math.max(1, steps);
}
