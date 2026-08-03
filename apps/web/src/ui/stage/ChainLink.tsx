import { Fragment, type ReactNode } from 'react';
import type Decimal from 'break_eternity.js';
import type { ArtSlot } from '@dm/content';
import { useReducedMotion } from '../useReducedMotion.ts';
import { usePulse } from './usePulse.ts';
import './ChainLink.css';

/**
 * How many motes a completion may draw, and over how many decades that range is
 * spread.
 *
 * A mote is a display decision, never a headcount: a Warren deep into a run pours
 * 10^40 minions down this link and cannot be drawn one dot at a time. Three reads as
 * "something happened", nine reads as "a lot happened", and anything past nine is
 * mush at this size. The amount is mapped by its order of magnitude, one extra mote
 * per four decades, saturating at the top — so the early game and the late game both
 * land inside a range the eye can count.
 */
const MOTE_MIN = 3;
const MOTE_MAX = 9;
const MOTE_DECADES = 24;

interface ChainLinkProps {
  /**
   * The producing tier's `lifetimeProduced`. Growth in this is exactly a cycle
   * completion, so the link needs nothing else to know it should fire.
   */
  produced: Decimal;
  /** Bumps whenever the state moved. The link compares against it, never a clock. */
  version: number;
  /** Semantic tone the motes carry, from the art manifest. Null leaves them inherited. */
  tone: ArtSlot['fallback']['tone'] | null;
  /** The evocation now under way, or null. Re-keying on the id restarts the reply. */
  surge: number | null;
  /** Where this run sits in the chain, which is what staggers the reply into a wave. */
  surgeIndex: number;
}

/**
 * The run between one node and the node it feeds.
 *
 * A hairline at rest. On a completion the whole run **lights** and a string of motes
 * travels it, led by a head that is twice the size of its trail. That is the whole
 * reason the diagram beats a list: when a Warren fires you see minions pour into the
 * Minion node rather than watching a number change.
 *
 * The string is laid out once, head deepest, and moves as one body. Its position on
 * the run is set from `--stage-link-spread`, so the travel keyframe and the layout
 * cannot drift apart — the only thing this file decides is which mote is which.
 *
 * Decorative to assistive tech — the relationship is already in the chain's order and
 * the amounts are already in the counts. A stream of dots would add nothing but
 * noise.
 */
export function ChainLink({
  produced,
  version,
  tone,
  surge,
  surgeIndex,
}: ChainLinkProps): ReactNode {
  const reduced = useReducedMotion();
  const pulse = usePulse(produced, version);
  const motes = pulse === null ? 0 : moteCount(pulse.amount);

  return (
    <div
      className="stage-link"
      data-motion={reduced ? 'reduced' : 'full'}
      aria-hidden="true"
      style={tone === null ? undefined : { color: `var(--tone-${tone})` }}
    >
      {pulse !== null && (
        <Fragment key={pulse.id}>
          <span className="stage-link__surge" />
          <span className="stage-link__motes">
            {Array.from({ length: motes }, (_, index) => (
              <span
                className={
                  index === 0 ? 'stage-link__mote stage-link__mote--head' : 'stage-link__mote'
                }
                key={index}
                style={{
                  insetInlineStart: `calc(var(--stage-link-spread) * ${share(index, motes)})`,
                }}
              />
            ))}
          </span>
        </Fragment>
      )}

      {surge !== null && (
        <span
          className="stage-link__evoke"
          key={`evoke-${surge}`}
          style={{ ['--surge-index' as string]: surgeIndex }}
        />
      )}
    </div>
  );
}

/**
 * Where a mote sits in the string, as a share of the spread.
 *
 * Index zero is the head and sits deepest, so it leads whichever way the string is
 * drawn — travelling under full motion, standing still under reduced motion.
 */
function share(index: number, motes: number): number {
  if (motes < 2) return 1;
  return (motes - 1 - index) / (motes - 1);
}

/**
 * How many motes one completion is worth.
 *
 * The `Decimal` becomes a JS number here on purpose, and only here: the result picks
 * how many dots to draw and never re-enters the simulation, so the precision loss
 * costs nothing. Nothing else in this file does arithmetic on a count.
 */
export function moteCount(amount: Decimal): number {
  const decades = amount.log10().toNumber();
  if (!Number.isFinite(decades)) return MOTE_MIN;

  const capped = Math.min(1, Math.max(0, decades / MOTE_DECADES));
  return MOTE_MIN + Math.round((MOTE_MAX - MOTE_MIN) * capped);
}
