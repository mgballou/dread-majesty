import type { ReactNode } from 'react';
import type Decimal from 'break_eternity.js';
import type { SmiteCopy } from '@dm/content';
import { TierArt } from '../art/TierArt.tsx';
import { formatNumber } from '../format.ts';
import { useReducedMotion } from '../useReducedMotion.ts';
import { usePulse } from './usePulse.ts';
import type { Feed } from './TierNode.tsx';
import './EvilNode.css';

/** The manifest slot for the resource at the end of the chain. */
export const EVIL_ART = 'resource/evil';

/** Drawn larger than a rung. This is the end of the chain and the thing you press. */
const EVIL_ART_SIZE = 56;

interface EvilNodeProps {
  /** How much Evil is held. Always a `Decimal` (CLAUDE.md, engine rule 5). */
  total: Decimal;
  /** The resource's display name. */
  name: string;
  copy: SmiteCopy;
  /** What the last blow came to, or empty before one has been struck. */
  report: string;
  /** True while nothing on the rail is worth buying, which is when evoking is the move. */
  isTheAction: boolean;
  /** The evocation now under way, or null. */
  surge: number | null;
  /** Where the node falls in the wave — last, because the answer comes back to it. */
  surgeIndex: number;
  /** The Minion rung, so the node can mark a delivery landing. */
  feed: Feed | null;
  onSmite: () => void;
}

/**
 * The end of the chain, and the verb.
 *
 * **You evoke Evil in order to gain Evil.** Pressing this sends a call out along the
 * chain — every generator lights in the Evil tone in turn — and the answer runs back
 * down the runs to land here. That is the whole idea the chain exists to draw, and it
 * is why the control is the total itself rather than a button set beside it.
 *
 * Pinned outside the scrolling track, so the one thing a player presses can never be
 * scrolled off the screen however long the chain grows.
 *
 * The engine credits the blow the instant it is pressed — holding the intent back for
 * half a second to match the animation would make the control feel broken and would
 * drop taps. So the digits move immediately and the node marks the *arrival* when the
 * answer gets back, which puts the emphasis in the right place without lying about
 * when the state changed.
 */
export function EvilNode({
  total,
  name,
  copy,
  report,
  isTheAction,
  surge,
  surgeIndex,
  feed,
  onSmite,
}: EvilNodeProps): ReactNode {
  const reduced = useReducedMotion();
  const landing = usePulse(feed === null ? null : feed.produced, feed?.version ?? 0);
  const shown = formatNumber(total);

  return (
    <div className="evil-node" data-motion={reduced ? 'reduced' : 'full'}>
      <button
        type="button"
        className={
          isTheAction ? 'evil-node__strike evil-node__strike--lifted' : 'evil-node__strike'
        }
        onClick={onSmite}
        aria-label={copy.spoken(shown)}
        title={copy.hint}
      >
        <span className="evil-node__medallion">
          <TierArt slot={EVIL_ART} size={EVIL_ART_SIZE} decorative />

          {landing !== null && (
            <span className="evil-node__landing" key={`land-${landing.id}`} aria-hidden="true" />
          )}

          {surge !== null && (
            <span
              className="evil-node__answer"
              key={`answer-${surge}`}
              style={{ ['--surge-index' as string]: surgeIndex }}
              aria-hidden="true"
            />
          )}
        </span>

        <span className="evil-node__name">{name}</span>
        <span className="evil-node__total">{shown}</span>
        <span className="evil-node__verb">{copy.action}</span>
      </button>

      {/* Held open whether or not there is a report, so a blow never moves the chain. */}
      <p className="evil-node__report">{report}</p>
    </div>
  );
}
