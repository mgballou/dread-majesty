import Decimal from 'break_eternity.js';
import { useId, type ReactNode } from 'react';
import type { Content, TierDef, TierId } from '@dm/content';
import { nextCost, type GameState } from '@dm/engine';
import type { GatedControl } from '../../game/onboarding.ts';
import { Banner } from '../Banner.tsx';
import { formatWhole } from '../format.ts';
import { TierRow, type RailScreenCopy } from './TierRow.tsx';
import { QuantityChip } from './QuantityChip.tsx';
import { spendEmphasis, type RailPlan, type RailPurchase, type SpendEmphasis } from './railPlan.ts';
import type { BuyQuantity } from './quantity.ts';
import '../controls.css';
import './BuyRail.css';

interface BuyRailProps {
  content: Content;
  /** Read-only here. Only `step` and `apply` may move it, and both live in the engine. */
  state: GameState;
  /** Ranked spends. Computed once above, because two panels now read the same one. */
  plan: RailPlan;
  /**
   * The setting, held above rather than here.
   *
   * It prices every row and it prices the plan, and the plan is worked out a level up
   * — one owner, or the rail would quietly show a price the ranking never saw.
   */
  quantity: BuyQuantity;
  onQuantity: (quantity: BuyQuantity) => void;
  /** Passed in rather than read off the state, so the rail owes nothing to its shape. */
  isUnlocked: (tierId: TierId) => boolean;
  /**
   * Whether onboarding is holding this control back.
   *
   * A predicate of the same shape as `isUnlocked` above it, so the rail owes nothing to
   * how onboarding decides. Absent means nothing is gated, which is every state of the
   * game after the first run.
   */
  isGated?: (control: GatedControl) => boolean;
  onPurchase: (tierId: TierId, quantity: BuyQuantity) => void;
  copy: RailScreenCopy;
}

/**
 * Every generator the player has met, at secondary weight, with exactly one purchase
 * lifted out.
 *
 * The genre ships five equal buttons in a scrolling list and calls it a shop.
 * `ui-sensibility.md` §3 forbids it: a set of actions gets real tiers, and one of them
 * is primary. So the rail carries the whole list — a player who wants to spend
 * elsewhere is one press away — and the accent goes to whichever single spend returns
 * the most Evil per Evil spent.
 *
 * **This panel lifts its own.** `railPlan` still ranks purchases and appointments by
 * one measure, because they are the same question, but each panel now accents the best
 * of its own kind. The deck shows one panel at a time, so a single winner across both
 * left whichever panel you were looking at with no accent at all — which is how the
 * gold came to look like it was vanishing and jumping about. One accent per region, and
 * the region is the open panel.
 *
 * The quantity chip is a setting, not the action, so it never wears the accent. It
 * sits on its own strip at the head of the list rather than beside the title: it acts
 * on every row beneath it, and a control that changes what a list means belongs with
 * the list, not in the furniture above it.
 *
 * **Nothing above the signpost can move, so nothing on the rail jumps when a tier
 * arrives.** The old rail held a blank slot for every tier still to come, which read as
 * a hole and was the thing it was meant to prevent. What replaces it keeps the property
 * by position rather than by matched heights: the met tiers run in chain order, the one
 * signpost row is always last, and a tier arriving turns the signpost into a real row
 * and appends a new signpost beneath it. Every row above stays where it was, and the
 * signpost is a full row tall so the rail does not shrink either.
 */
export function BuyRail({
  content,
  state,
  plan,
  quantity,
  onQuantity,
  isUnlocked,
  isGated,
  onPurchase,
  copy,
}: BuyRailProps): ReactNode {
  const quantityLabelId = useId();

  const purchases = new Map<TierId, RailPurchase>();
  for (const option of plan.options) {
    if (option.kind === 'purchase') purchases.set(option.tierId, option);
  }

  // Content runs top of the chain down. The rail climbs, so the first rung a player
  // ever sees sits at the top and the tiers arrive underneath it in order.
  const rungs = [...content.tiers].reverse();
  const met = rungs.filter((tier) => isUnlocked(tier.id));
  const upcoming = rungs.find((tier) => !isUnlocked(tier.id));

  const lifted = liftedPurchase(plan, isGated);

  return (
    <div className="muster">
      <div className="muster__setting">
        <span className="muster__setting-name" id={quantityLabelId}>
          {copy.rail.quantity}
        </span>
        <QuantityChip
          quantity={quantity}
          onChange={onQuantity}
          labelledBy={quantityLabelId}
          copy={copy.rail}
        />
      </div>

      <ul className="rail" aria-label={copy.rail.list}>
        {met.map((tier) => {
          const purchase = purchases.get(tier.id);
          if (!purchase) return null;

          return (
            <TierRow
              key={tier.id}
              tier={tier}
              state={state}
              content={content}
              purchase={purchase}
              emphasis={purchaseEmphasis({ plan, tierId: tier.id, lifted })}
              quantity={quantity}
              isGated={isGated?.({ kind: 'buy', tierId: tier.id }) === true}
              onPurchase={onPurchase}
              copy={copy}
            />
          );
        })}

        {upcoming !== undefined && (
          <UpcomingRow tier={upcoming} state={state} content={content} copy={copy} />
        )}
      </ul>
    </div>
  );
}

/**
 * Which tier's purchase should carry the rail's one accent, gating folded in.
 *
 * `railPlan` picks `best.purchase` with no idea onboarding exists, so its pick can be
 * the very row a beat is holding back — the thing ui-sensibility §3 forbids, a control
 * wearing the accent that cannot be pressed. When that happens the accent falls to the
 * next affordable, non-gated purchase by the same score the plan already computed, or
 * to nothing if the gated pick was the only affordable one. `railPlan` itself is
 * untouched; this only re-reads the ranked list it already produced.
 */
function liftedPurchase(
  plan: RailPlan,
  isGated?: (control: GatedControl) => boolean,
): TierId | null {
  const best = plan.best.purchase;
  if (best && isGated?.({ kind: 'buy', tierId: best.tierId }) !== true) return best.tierId;

  let winner: RailPurchase | null = null;
  for (const option of plan.options) {
    if (option.kind !== 'purchase' || !option.affordable) continue;
    if (isGated?.({ kind: 'buy', tierId: option.tierId }) === true) continue;
    if (winner === null || option.score.gt(winner.score)) winner = option;
  }

  return winner?.tierId ?? null;
}

/**
 * A row's emphasis, with the gate applied.
 *
 * `spendEmphasis` alone cannot see the gate. `lifted` is `liftedPurchase`'s answer once
 * gating is folded in: the row it names carries the accent regardless of what the plan
 * itself picked, and the plan's own pick is downgraded to nothing wherever the two
 * disagree — never left reading as best twice, never left blank when a legitimate row
 * is waiting to take it.
 */
function purchaseEmphasis({
  plan,
  tierId,
  lifted,
}: {
  plan: RailPlan;
  tierId: TierId;
  lifted: TierId | null;
}): SpendEmphasis {
  if (tierId === lifted) return 'best';
  const emphasis = spendEmphasis(plan, 'purchase', tierId);
  return emphasis === 'best' ? 'none' : emphasis;
}

interface UpcomingRowProps {
  tier: TierDef;
  state: GameState;
  content: Content;
  copy: RailScreenCopy;
}

/**
 * The one row for the tier after the ones the player has met.
 *
 * A signpost, not a spend: it names the tier and what the first of them costs, and it
 * carries no button, because there is nothing here to press yet. One named row beats
 * three identical blanks — an absence is a state, and a state says what comes next
 * (ui-sensibility §2.8, §9).
 */
function UpcomingRow({ tier, state, content, copy }: UpcomingRowProps): ReactNode {
  const cost = nextCost(state, content, tier.id) ?? new Decimal(tier.baseCost);

  return (
    <li className="rail__slot rail__row rail__row--upcoming">
      <span className="rail__upcoming-art" aria-hidden="true" />

      <div className="rail__body">
        <Banner as="h3" weight="secondary" className="rail__name">
          {copy.rail.upcomingTitle}
        </Banner>
        <p className="rail__line">
          {copy.rail.upcoming({
            tier: tier.plural,
            cost: copy.rail.cost(formatWhole(cost)),
          })}
        </p>
      </div>
    </li>
  );
}
