import type { ReactNode } from 'react';
import type Decimal from 'break_eternity.js';
import type { Content, SmiteCopy } from '@dm/content';
import { TierArt } from '../art/TierArt.tsx';
import { formatNumber } from '../format.ts';
import { useReducedMotion } from '../useReducedMotion.ts';
import { usePulse } from './usePulse.ts';
import type { Feed } from './TierNode.tsx';
import './EvilNode.css';

/** What `smitePhase` reports. Restated rather than imported, so the props stay readable. */
type SmitePhase = { readonly kind: 'active' | 'cooling' | 'ready'; readonly share: number };

/** The manifest slot for the resource at the end of the chain. */
export const EVIL_ART = 'resource/evil';

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
  /** Whether the blow is running, cooling, or ready — and how far through. */
  phase: SmitePhase;
  /** Read only for the smite durations, so the node can say them in seconds. */
  content: Content;
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
  phase,
  content,
  feed,
  onSmite,
}: EvilNodeProps): ReactNode {
  const reduced = useReducedMotion();
  const landing = usePulse(feed === null ? null : feed.produced, feed?.version ?? 0);
  const shown = formatNumber(total);
  const ready = phase.kind === 'ready';

  return (
    <div className="evil-node" data-motion={reduced ? 'reduced' : 'full'} data-smite={phase.kind}>
      <button
        type="button"
        className={
          isTheAction && ready ? 'evil-node__strike evil-node__strike--lifted' : 'evil-node__strike'
        }
        onClick={onSmite}
        disabled={!ready}
        aria-label={copy.spoken(shown)}
        title={ready ? worth(copy, content) : copy.hint}
      >
        <span className="evil-node__medallion">
          <TierArt slot={EVIL_ART} decorative />

          {landing !== null && (
            <span className="evil-node__landing" key={`land-${landing.id}`} aria-hidden="true" />
          )}
        </span>

        <span className="evil-node__name">{name}</span>
        <span className="evil-node__total">{shown}</span>
        <span className="evil-node__verb">{verb(phase, copy, content)}</span>
      </button>

      {/* Held open whether or not there is a report, so a blow never moves the chain. */}
      <p className="evil-node__report">{report}</p>
    </div>
  );
}

/**
 * The verb, or what is happening instead of it.
 *
 * Counted down in whole seconds. A blow is a fifteen-second window inside a minute, and
 * a player deciding whether to wait needs a number, not a bar they have to estimate
 * from. The bar is there too, under the chip.
 */
function verb(phase: SmitePhase, copy: SmiteCopy, content: Content): string {
  if (phase.kind === 'active') {
    return copy.surging(seconds(phase.share * content.smite.durationMs));
  }
  if (phase.kind === 'cooling') {
    return copy.cooling(seconds(phase.share * content.smite.cooldownMs));
  }
  return copy.action;
}

function worth(copy: SmiteCopy, content: Content): string {
  return copy.worth({
    multiplier: `×${content.smite.multiplier}`,
    seconds: seconds(content.smite.durationMs),
  });
}

function seconds(ms: number): string {
  return `${Math.max(0, Math.ceil(ms / 1000))}s`;
}
