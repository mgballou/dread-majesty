import Decimal from 'break_eternity.js';
import type { ReactNode } from 'react';
import type { Content, Copy, MilestoneCopy, TierDef, TierId } from '@dm/content';
import { milestoneProgress, type GameState } from '@dm/engine';
import { TierArt } from '../art/TierArt.tsx';
import { Banner } from '../Banner.tsx';
import { formatCount, formatDuration, formatNumber } from '../format.ts';
import { Meter } from '../Meter.tsx';
import { quantityLabel, type BuyQuantity } from './quantity.ts';
import type { RailAppointment, RailOptionKind, RailPurchase } from './railPlan.ts';

/** Matches `--rail-art` in BuyRail.css, so the signpost row is the height of a row. */
export const ROW_ART_SIZE = 40;

/** What the rail and everything it renders reads out of the copy module. */
export type RailScreenCopy = Pick<Copy, 'rail' | 'milestone' | 'overseer'>;

/**
 * Which of a row's two spends, if either, the plan lifted.
 *
 * A row now offers a purchase and an appointment, so knowing *that* the row won the
 * accent is no longer enough — the rail has to know which control to fill. Hence the
 * union rather than a third string.
 */
export type RowEmphasis =
  { kind: 'none' } | { kind: 'best'; on: RailOptionKind } | { kind: 'saving'; on: RailOptionKind };

interface TierRowProps {
  tier: TierDef;
  state: GameState;
  content: Content;
  purchase: RailPurchase;
  /** Null once the post is filled. There is nothing left to offer. */
  appointment: RailAppointment | null;
  emphasis: RowEmphasis;
  quantity: BuyQuantity;
  onPurchase: (tierId: TierId, quantity: BuyQuantity) => void;
  onAppoint: (tierId: TierId) => void;
  copy: RailScreenCopy;
}

/**
 * One generator, at secondary weight unless the plan lifted something on it.
 *
 * Everything the buy decision needs is on the row: what it makes and how often, how
 * far the cycle has run, how far the next milestone is, what this quantity costs, and
 * whether anybody is watching the place. Milestone distance is the reason the row is
 * not just arithmetic (spec §5.3).
 *
 * **Rousing is not here.** The verb that starts a manual tier sits on that tier's node
 * on the stage, on the thing it acts on (spec §6). The rail carries the standing
 * arrangement — hired or not hired — and nothing that has to be pressed again.
 */
export function TierRow({
  tier,
  state,
  content,
  purchase,
  appointment,
  emphasis,
  quantity,
  onPurchase,
  onAppoint,
  copy,
}: TierRowProps): ReactNode {
  const gen = state.gens[tier.id];
  const shortfall = purchase.cost.sub(state.resources[tier.costResource]);
  const overseer = copy.overseer.names[tier.id];
  const mark = flag(emphasis, copy);

  return (
    <li className={`rail__slot rail__row rail__row--${emphasis.kind}`}>
      <TierArt slot={tier.art} size={ROW_ART_SIZE} decorative />

      <div className="rail__body">
        <div className="rail__head">
          <Banner as="h3" weight="secondary" className="rail__name">
            {tier.plural}
          </Banner>
          {mark !== null && <span className="rail__flag">{mark}</span>}
          <span className="rail__owned">{copy.rail.held(formatCount(gen.owned))}</span>
        </div>

        <p className="rail__line">{produceLine(tier, content)}</p>

        <Meter
          className="rail__cycle"
          label={copy.rail.cycle(tier.name)}
          value={gen.progressMs}
          max={tier.cycleMs}
        />

        <p className="rail__line rail__line--milestone">
          {milestoneLine(state, content, tier, copy.milestone)}
        </p>

        <div className="rail__oversight" role="group" aria-label={copy.overseer.title}>
          {appointment === null ? (
            <div className="rail__filled">
              <p className="rail__line">{copy.overseer.appointed(overseer)}</p>
              <p className="rail__line rail__line--milestone">{copy.overseer.automatic}</p>
            </div>
          ) : (
            <>
              <p className="rail__line">{copy.overseer.manual}</p>
              <button
                type="button"
                className={`button rail__appoint${lifted(emphasis, 'appoint') ? ' button--primary' : ''}`}
                disabled={!appointment.affordable}
                onClick={() => onAppoint(tier.id)}
              >
                <span>{copy.overseer.appoint(overseer)}</span>
                {/* A whitespace-only child is never rendered as a flex item, so this
                    costs nothing on screen and buys a spoken name that reads as a
                    sentence rather than running the price into the title. */}{' '}
                <span className="rail__appoint-cost">
                  {copy.overseer.cost(formatNumber(appointment.cost))}
                </span>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="rail__buy">
        <button
          type="button"
          className={`button button--numeric${lifted(emphasis, 'purchase') ? ' button--primary' : ''}`}
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

function lifted(emphasis: RowEmphasis, on: RailOptionKind): boolean {
  return emphasis.kind === 'best' && emphasis.on === on;
}

/**
 * Colour never carries a state alone. The lifted row says so in words.
 *
 * When the accent sits on the appointment the mark names oversight rather than
 * repeating "advised", because the filled button beneath it already says the verb in
 * full — two readings of the same thing, and neither is only a tone.
 */
function flag(emphasis: RowEmphasis, copy: RailScreenCopy): string | null {
  if (emphasis.kind === 'none') return null;
  if (emphasis.on === 'appoint') return copy.overseer.title;
  return emphasis.kind === 'best' ? copy.rail.best : copy.rail.saving;
}

function produceLine(tier: TierDef, content: Content): string {
  const amount = new Decimal(tier.yield);
  const made = content.tiers.find((candidate) => candidate.id === tier.produces);
  const noun = made ? (amount.eq(1) ? made.name : made.plural) : 'Evil';

  return `${formatCount(amount)} ${noun} every ${formatDuration(tier.cycleMs)}, each`;
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
