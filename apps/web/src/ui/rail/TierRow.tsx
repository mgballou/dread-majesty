import Decimal from 'break_eternity.js';
import type { ReactNode } from 'react';
import type { Content, Copy, MilestoneCopy, TierDef, TierId } from '@dm/content';
import {
  effectiveCycleMs,
  effectiveYield,
  milestoneProgress,
  type GameState,
  type MilestoneProgress,
} from '@dm/engine';
import { TierArt } from '../art/TierArt.tsx';
import { Banner } from '../Banner.tsx';
import { formatNumber, formatWhole, formatDuration } from '../format.ts';
import { Meter } from '../Meter.tsx';
import { EVIL_ART } from '../stage/EvilNode.tsx';
import { quantityLabel, type BuyQuantity } from './quantity.ts';
import type { RailPurchase, SpendEmphasis } from './railPlan.ts';

/** Matches `--rail-art` in BuyRail.css, so the signpost row is the height of a row. */
export const ROW_ART_SIZE = 40;

/** Big enough to tell apart, small enough to sit in a line. */
const LINE_MARK_SIZE = 16;

/** What the rail and everything it renders reads out of the copy module. */
export type RailScreenCopy = Pick<Copy, 'rail' | 'milestone'>;

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
 * far the next milestone is, and what this quantity costs. Milestone distance is the
 * reason the row is not just arithmetic (spec §5.3).
 *
 * **Neither rousing nor appointing is here.** The verb that starts a manual tier sits
 * on that tier's node on the stage, on the thing it acts on (spec §6) — and that node
 * already says whether a tier is running. Hiring somebody so it never stops is a post,
 * filled once and for ever, and it lives with the other posts in the miscreants panel.
 * The row carries the buy decision, and nothing else.
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
  const progress = milestoneProgress(state, content, tier.id);
  const label = milestoneLabel({ progress, plural: tier.plural, copy: copy.milestone });

  return (
    <li className={`rail__slot rail__row rail__row--${emphasis}`} data-tier={tier.id}>
      <TierArt slot={tier.art} size={ROW_ART_SIZE} decorative />

      <div className="rail__body">
        <div className="rail__head">
          <Banner as="h3" weight="secondary" className="rail__name">
            {tier.plural}
          </Banner>
          {emphasis === 'saving' && <span className="rail__flag">{copy.rail.saving}</span>}
          <span className="rail__owned">{copy.rail.held(formatWhole(gen.owned))}</span>
        </div>

        {/* Always mounted, even with nothing to say. The cascade crosses the
            purchased count without warning, and a line that mounts on that
            crossing would move the price and the bar under it. */}
        <p className="rail__bought">
          {gen.purchased.lt(gen.owned) && copy.rail.bought(formatWhole(gen.purchased))}
        </p>

        <p className="rail__line">
          <ProduceLine state={state} tier={tier} content={content} />
        </p>

        <Meter
          className="rail__milestone"
          label={label}
          title={label}
          value={milestoneShare(progress)}
          max={1}
        />
      </div>

      <div className="rail__buy">
        <button
          type="button"
          className={`button button--numeric${emphasis === 'best' ? ' button--primary' : ''}`}
          disabled={!purchase.affordable}
          aria-label={buyLabel({ tier, purchase, emphasis, copy })}
          onClick={() => onPurchase(tier.id, quantity)}
        >
          <span aria-hidden="true">{quantityLabel(quantity)}</span>
          <span aria-hidden="true">{formatWhole(purchase.cost)}</span>
        </button>

        <span className="rail__shortfall">
          {purchase.affordable ? '' : copy.rail.shortfall(formatWhole(shortfall))}
        </span>
      </div>
    </li>
  );
}

interface BuyLabelInput {
  tier: TierDef;
  purchase: RailPurchase;
  emphasis: SpendEmphasis;
  copy: RailScreenCopy;
}

/**
 * The buy button, spoken in full — and, on the lifted row, saying that it is lifted.
 *
 * The word used to sit beside the tier's name on screen. It comes off because the row
 * says the same thing by weight, and a filled control among outlined ones survives
 * greyscale. It stays here because weight is not available to anyone reading by ear.
 */
function buyLabel({ tier, purchase, emphasis, copy }: BuyLabelInput): string {
  const said = copy.rail.buy({
    count: String(purchase.count),
    tier: plural(tier, purchase.count),
    cost: copy.rail.cost(formatWhole(purchase.cost)),
  });

  return emphasis === 'best' ? `${said} — ${copy.rail.lifted}` : said;
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
      {formatWhole(amount)}{' '}
      <TierArt slot={made ? made.art : EVIL_ART} size={LINE_MARK_SIZE} decorative />
      <span className="rail__made">{noun}</span> every{' '}
      {formatDuration(effectiveCycleMs(state, tier))}, each
    </>
  );
}

/**
 * How far through the current band, as a fraction.
 *
 * Both ends are `Decimal` and only the fraction is converted: owned counts run past
 * `Number.MAX_SAFE_INTEGER` and the ratio never does. Past the last threshold there is
 * no band left, and a full bar is the honest drawing of that.
 */
function milestoneShare(progress: MilestoneProgress): number {
  const { next, previous, owned } = progress;
  if (next === null) return 1;

  const span = new Decimal(next).sub(previous);
  if (span.lte(0)) return 1;

  return Decimal.min(1, Decimal.max(0, owned.sub(previous).div(span))).toNumber();
}

interface MilestoneLabelInput {
  progress: MilestoneProgress;
  plural: string;
  copy: MilestoneCopy;
}

/**
 * What the bar is called, and the figures the printed line used to carry.
 *
 * The line came off the row: the bar says the same thing in less space, and a rail row
 * carrying five lines of text was reading as a paragraph. Nothing is lost — this string
 * reaches a pointer through `title` and a screen reader through `aria-label`.
 */
function milestoneLabel({ progress, plural, copy }: MilestoneLabelInput): string {
  const { next, remaining, multiplier } = progress;

  if (next === null || remaining === null || multiplier === null) {
    return copy.barDone(plural);
  }

  return copy.bar({
    remaining: formatWhole(remaining),
    plural,
    multiplier: `×${formatNumber(new Decimal(multiplier))}`,
    threshold: formatWhole(new Decimal(next)),
  });
}

function plural(tier: TierDef, count: number): string {
  return count === 1 ? tier.name : tier.plural;
}
