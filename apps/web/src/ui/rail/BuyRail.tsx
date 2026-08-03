import Decimal from 'break_eternity.js';
import type { ReactNode } from 'react';
import type { Content, TierDef, TierId } from '@dm/content';
import { nextCost, type GameState } from '@dm/engine';
import { Banner } from '../Banner.tsx';
import { formatNumber } from '../format.ts';
import { TierRow, type RailScreenCopy } from './TierRow.tsx';
import { QuantityToggle } from './QuantityToggle.tsx';
import { spendEmphasis, type RailPlan, type RailPurchase } from './railPlan.ts';
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
 * **That spend may not be here.** `railPlan` still ranks purchases and appointments
 * against each other, because they are the same question, but appointments are drawn
 * in the miscreants panel now. When the plan lifts one of those, this panel lifts
 * nothing at all and the shut tab beside it says so in a word. One thing is advised on
 * the screen, always, and it is never two.
 *
 * The quantity toggle is a setting, not the action, so it never wears the accent. It
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
  onPurchase,
  copy,
}: BuyRailProps): ReactNode {
  const purchases = new Map<TierId, RailPurchase>();
  for (const option of plan.options) {
    if (option.kind === 'purchase') purchases.set(option.tierId, option);
  }

  // Content runs top of the chain down. The rail climbs, so the first rung a player
  // ever sees sits at the top and the tiers arrive underneath it in order.
  const rungs = [...content.tiers].reverse();
  const met = rungs.filter((tier) => isUnlocked(tier.id));
  const upcoming = rungs.find((tier) => !isUnlocked(tier.id));

  return (
    <div className="muster">
      <div className="muster__setting">
        <QuantityToggle quantity={quantity} onChange={onQuantity} copy={copy.rail} />
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
              emphasis={spendEmphasis(plan, 'purchase', tier.id)}
              quantity={quantity}
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
            cost: copy.rail.cost(formatNumber(cost)),
          })}
        </p>
      </div>
    </li>
  );
}
