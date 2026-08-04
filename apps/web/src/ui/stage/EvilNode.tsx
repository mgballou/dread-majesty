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
 * **Gold whenever the blow is ready, and never conditionally.** The stage is its own
 * region and this is its one action; the deck's open panel carries the other. Two fixed
 * places beats one moving place — the accent used to hop here whenever the rail had
 * nothing worth buying, which meant the one verb the game is named for was findable
 * only by looking for it. See the spec's §2.2.
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
        className={ready ? 'evil-node__strike evil-node__strike--lifted' : 'evil-node__strike'}
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
        <span className="evil-node__verb">{verb(phase, copy)}</span>
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
/**
 * The verb, in one of three faces of the same width.
 *
 * No number goes on the button. A label that changes length moves everything beside it
 * — the report line, the chain, the whole column — and this one changes three times a
 * minute. The count lives on the status line instead, which has nothing to its right.
 */
function verb(phase: SmitePhase, copy: SmiteCopy): string {
  if (phase.kind === 'active') return copy.surging;
  if (phase.kind === 'cooling') return copy.cooling;
  return copy.action;
}

function worth(copy: SmiteCopy, content: Content): string {
  return copy.worth({
    multiplier: `×${content.smite.multiplier}`,
    seconds: `${Math.round(content.smite.durationMs / 1000)}s`,
  });
}
