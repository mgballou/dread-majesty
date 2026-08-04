import Decimal from 'break_eternity.js';
import type { ReactNode } from 'react';
import type { Content, Copy, MilestoneCopy, TierDef, TierId } from '@dm/content';
import {
  effectiveCycleMs,
  effectiveYield,
  isAppointed,
  milestoneProgress,
  type GameState,
} from '@dm/engine';
import { TierArt } from '../art/TierArt.tsx';
import { Banner } from '../Banner.tsx';
import { formatCount, formatDuration, formatNumber } from '../format.ts';
import { Meter } from '../Meter.tsx';
import { EVIL_ART } from '../stage/EvilNode.tsx';
import { quantityLabel, type BuyQuantity } from './quantity.ts';
import type { RailPurchase, SpendEmphasis } from './railPlan.ts';

/** Matches `--rail-art` in BuyRail.css, so the signpost row is the height of a row. */
export const ROW_ART_SIZE = 40;

/** Big enough to tell apart, small enough to sit in a line. */
const LINE_MARK_SIZE = 16;

/** What the rail and everything it renders reads out of the copy module. */
export type RailScreenCopy = Pick<Copy, 'rail' | 'milestone' | 'overseer'>;

interface TierRowProps {
  tier: TierDef;
  state: GameState;
  content: Content;
  purchase: RailPurchase;
  emphasis: SpendEmphasis;
  quantity: BuyQuantity;
  onPurchase: (tierId: TierId, quantity: BuyQuantity) => void;
  copy: RailScreenCopy;
}

/**
 * One generator, at secondary weight unless the plan lifted this row.
 *
 * Everything the buy decision needs is on the row: what it makes and how often, how
 * far the cycle has run, how far the next milestone is, and what this quantity costs.
 * Milestone distance is the reason the row is not just arithmetic (spec §5.3).
 *
 * **Neither rousing nor appointing is here.** The verb that starts a manual tier sits
 * on that tier's node on the stage, on the thing it acts on (spec §6). Hiring somebody
 * so it never stops is a post, filled once and for ever, and it lives with the other
 * posts in the miscreants panel. What is left on the row is one word saying whether
 * anybody holds this one — the standing arrangement, and nothing to press.
 */
export function TierRow({
  tier,
  state,
  content,
  purchase,
  emphasis,
  quantity,
  onPurchase,
  copy,
}: TierRowProps): ReactNode {
  const gen = state.gens[tier.id];
  const shortfall = purchase.cost.sub(state.resources[tier.costResource]);
  const mark = flag(emphasis, copy);

  return (
    <li className={`rail__slot rail__row rail__row--${emphasis}`} data-tier={tier.id}>
      <TierArt slot={tier.art} size={ROW_ART_SIZE} decorative />

      <div className="rail__body">
        <div className="rail__head">
          <Banner as="h3" weight="secondary" className="rail__name">
            {tier.plural}
          </Banner>
          {mark !== null && <span className="rail__flag">{mark}</span>}
          {isAppointed(state, content, tier.id) && (
            <span className="rail__flag rail__flag--overseen">{copy.overseer.filled}</span>
          )}
          <span className="rail__owned">{copy.rail.held(formatCount(gen.owned))}</span>
        </div>

        {/* Always mounted, even with nothing to say. The cascade crosses the
            purchased count without warning, and a line that mounts on that
            crossing would move the price and the milestone line under it. */}
        <p className="rail__bought">
          {gen.purchased.lt(gen.owned) && copy.rail.bought(formatCount(gen.purchased))}
        </p>

        <p className="rail__line">
          <ProduceLine state={state} tier={tier} content={content} />
        </p>

        <Meter
          className="rail__cycle"
          label={copy.rail.cycle(tier.name)}
          value={gen.progressMs}
          max={effectiveCycleMs(state, tier)}
        />

        <p className="rail__line rail__line--milestone">
          {milestoneLine(state, content, tier, copy.milestone)}
        </p>
      </div>

      <div className="rail__buy">
        <button
          type="button"
          className={`button button--numeric${emphasis === 'best' ? ' button--primary' : ''}`}
          disabled={!purchase.affordable}
          aria-label={copy.rail.buy({
            count: String(purchase.count),
            tier: plural(tier, purchase.count),
            cost: copy.rail.cost(formatNumber(purchase.cost)),
          })}
          onClick={() => onPurchase(tier.id, quantity)}
        >
          <span aria-hidden="true">{quantityLabel(quantity)}</span>
          <span aria-hidden="true">{formatNumber(purchase.cost)}</span>
        </button>

        <span className="rail__shortfall">
          {purchase.affordable
            ? copy.rail.affordable
            : copy.rail.shortfall(formatNumber(shortfall))}
        </span>
      </div>
    </li>
  );
}

/** Colour never carries a state alone. The lifted row says so in words. */
function flag(emphasis: SpendEmphasis, copy: RailScreenCopy): string | null {
  if (emphasis === 'none') return null;
  return emphasis === 'best' ? copy.rail.best : copy.rail.saving;
}

interface ProduceLineProps {
  state: GameState;
  tier: TierDef;
  content: Content;
}

/**
 * What one unit of this tier makes, and how often.
 *
 * The mark rather than the noun: the row is already titled with this tier's name and
 * sits in a list of them, so the noun was the one word on the line carrying nothing.
 * What the row *makes* is the fact worth having, and at this size a silhouette says it
 * faster than a word does.
 *
 * The noun stays, spoken. Nothing here is available only by looking.
 */
function ProduceLine({ state, tier, content }: ProduceLineProps): ReactNode {
  const amount = effectiveYield(state, tier);
  const made = content.tiers.find((candidate) => candidate.id === tier.produces);
  const noun = made ? (amount.eq(1) ? made.name : made.plural) : 'Evil';

  return (
    <>
      {formatCount(amount)}{' '}
      <TierArt slot={made ? made.art : EVIL_ART} size={LINE_MARK_SIZE} decorative />
      <span className="rail__made">{noun}</span> every{' '}
      {formatDuration(effectiveCycleMs(state, tier))}, each
    </>
  );
}

function milestoneLine(
  state: GameState,
  content: Content,
  tier: TierDef,
  copy: MilestoneCopy,
): string {
  const { next, remaining, multiplier } = milestoneProgress(state, content, tier.id);

  if (next === null || remaining === null || multiplier === null) {
    return `${copy.done} ${copy.noMore}`;
  }

  return copy.next({
    remaining: formatCount(remaining),
    plural: tier.plural,
    multiplier: `×${formatNumber(new Decimal(multiplier))}`,
    threshold: formatCount(new Decimal(next)),
  });
}

function plural(tier: TierDef, count: number): string {
  return count === 1 ? tier.name : tier.plural;
}
