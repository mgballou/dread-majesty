import Decimal from 'break_eternity.js';
import { useMemo, type ReactNode } from 'react';
import type { Content, TierDef, TierId } from '@dm/content';
import { nextCost, type GameState } from '@dm/engine';
import { Banner } from '../Banner.tsx';
import { formatNumber } from '../format.ts';
import { Panel } from '../Panel.tsx';
import { TierRow, type RowEmphasis, type RailScreenCopy } from './TierRow.tsx';
import { QuantityToggle } from './QuantityToggle.tsx';
import { railPlan, type RailAppointment, type RailPlan, type RailPurchase } from './railPlan.ts';
import { useBuyQuantity } from './useBuyQuantity.ts';
import type { BuyQuantity } from './quantity.ts';
import '../controls.css';
import './BuyRail.css';

interface BuyRailProps {
  content: Content;
  /** Read-only here. Only `step` and `apply` may move it, and both live in the engine. */
  state: GameState;
  /** Bumps whenever the state moved. This is what re-renders the rail. */
  version: number;
  /** Passed in rather than read off the state, so the rail owes nothing to its shape. */
  isUnlocked: (tierId: TierId) => boolean;
  onPurchase: (tierId: TierId, quantity: BuyQuantity) => void;
  onAppoint: (tierId: TierId) => void;
  copy: RailScreenCopy;
}

/**
 * Every generator the player has met, at secondary weight, with exactly one spend
 * lifted out.
 *
 * The genre ships five equal buttons in a scrolling list and calls it a shop.
 * `ui-sensibility.md` §3 forbids it: a set of actions gets real tiers, and one of
 * them is primary. So the rail carries the whole list — a player who wants to spend
 * elsewhere is one press away — and the accent goes to whichever single spend returns
 * the most Evil per Evil spent. That may be a purchase or it may be hiring an
 * Overseer; both are ranked on one measure, and `railPlan.ts` says what that measure
 * gets wrong.
 *
 * The quantity toggle is a setting, not the action, so it never wears the accent.
 *
 * **Nothing above the signpost can move, so nothing on the rail jumps when a tier
 * arrives.** The old rail held a blank slot for every tier still to come, which read
 * as a hole and was the thing it was meant to prevent. What replaces it keeps the
 * property by position rather than by matched heights: the met tiers run in chain
 * order, the one signpost row is always last, and a tier arriving turns the signpost
 * into a real row and appends a new signpost beneath it. Every row above stays where
 * it was, and the signpost is a full row tall so the rail does not shrink either.
 */
export function BuyRail({
  content,
  state,
  version,
  isUnlocked,
  onPurchase,
  onAppoint,
  copy,
}: BuyRailProps): ReactNode {
  const { quantity, setQuantity } = useBuyQuantity();

  const plan = useMemo(
    () => railPlan({ state, content, quantity, isUnlocked }),
    [state, content, quantity, isUnlocked, version],
  );

  const purchases = new Map<TierId, RailPurchase>();
  const appointments = new Map<TierId, RailAppointment>();
  for (const option of plan.options) {
    if (option.kind === 'purchase') purchases.set(option.tierId, option);
    else appointments.set(option.tierId, option);
  }

  // Content runs top of the chain down. The rail climbs, so the first rung a player
  // ever sees sits at the top and the tiers arrive underneath it in order.
  const rungs = [...content.tiers].reverse();
  const met = rungs.filter((tier) => isUnlocked(tier.id));
  const upcoming = rungs.find((tier) => !isUnlocked(tier.id));

  return (
    <Panel
      title={copy.rail.title}
      glyph="⚒"
      trailing={`${met.length}/${rungs.length}`}
      actions={<QuantityToggle quantity={quantity} onChange={setQuantity} copy={copy.rail} />}
    >
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
              appointment={appointments.get(tier.id) ?? null}
              emphasis={emphasis(tier.id, plan)}
              quantity={quantity}
              onPurchase={onPurchase}
              onAppoint={onAppoint}
              copy={copy}
            />
          );
        })}

        {upcoming !== undefined && (
          <UpcomingRow tier={upcoming} state={state} content={content} copy={copy} />
        )}
      </ul>
    </Panel>
  );
}

function emphasis(tierId: TierId, plan: RailPlan): RowEmphasis {
  if (plan.best?.tierId === tierId) return { kind: 'best', on: plan.best.kind };
  if (plan.saving?.tierId === tierId) return { kind: 'saving', on: plan.saving.kind };
  return { kind: 'none' };
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
