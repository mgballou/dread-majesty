import { useId, type ReactNode } from 'react';
import type Decimal from 'break_eternity.js';
import type { ArtSlot, OverseerCopy, StageCopy } from '@dm/content';
import { TierArt } from '../art/TierArt.tsx';
import { formatCount } from '../format.ts';
import { useReducedMotion } from '../useReducedMotion.ts';
import { CycleRing } from './CycleRing.tsx';
import { usePulse } from './usePulse.ts';
import './TierNode.css';

interface Cycle {
  progressMs: number;
  cycleMs: number;
}

/** What feeds this rung, so it can react when a delivery lands. */
export interface Feed {
  /** The producing tier's `lifetimeProduced`. Growth in it is a completion. */
  produced: Decimal;
  version: number;
}

/**
 * The manual layer (spec §5.6), as far as one node needs it.
 *
 * Predicates rather than state fields, in the same style as `isUnlocked`, so the node
 * never learns the shape of the bookkeeping behind them.
 */
interface Oversight {
  /** True once this tier's Overseer is hired. It then turns for ever. */
  isAppointed: boolean;
  /** True when rousing now would start a cycle. */
  isRousable: boolean;
  /** The Overseer's title. Shown once appointed and never before. */
  overseer: string;
  /** The manual layer's writing. `copy.overseer` at the call site. */
  copy: OverseerCopy;
  onRouse: () => void;
}

/** The three states a manual tier can be in, plus the one where there is nothing yet. */
type NodeState = 'overseen' | 'dormant' | 'turning' | 'idle';

interface TierNodeProps {
  /** Plural display name — the noun the player reasons in. */
  name: string;
  /** Key into the art manifest. */
  art: string;
  /** How many of the thing exist. Always a `Decimal` (CLAUDE.md, engine rule 5). */
  count: Decimal;
  /** The cycle to sweep, or null for the resource at the foot of the chain. */
  cycle: Cycle | null;
  /** Semantic tone, from the art manifest. Null leaves the tone inherited. */
  tone: ArtSlot['fallback']['tone'] | null;
  /** False while the player has not reached this rung. */
  isUnlocked: boolean;
  /** The stage's writing. `copy.stage` at the call site. */
  copy: StageCopy;
  /** The manual layer. Null for the resource, which nobody oversees. */
  oversight: Oversight | null;
  /** The rung above. Null for the head of the chain, which nothing feeds. */
  feed: Feed | null;
  /**
   * Where this rung falls in the wave, counted from the Evil end.
   *
   * The chain sets it; the stylesheet turns it into a delay. It lives here rather than
   * in the CSS because the order of the wave depends on how many rungs there are, and
   * only the chain knows that.
   */
  surgeIndex: number;
}

/**
 * One rung of the chain: its picture, its name, its count, its cycle ring — and, until
 * its Overseer is appointed, the control that makes it run.
 *
 * **The node is the tap target.** The verb belongs on the thing it acts on, not on a
 * button somewhere else (spec §6). A dormant tier is the clearest call to action the
 * stage has: the medallion lifts onto the raised surface, takes an edge in its own
 * tone, and says outright what pressing it does. A turning tier keeps the button —
 * losing it would drop focus out from under anyone holding it — and marks itself
 * `aria-disabled`, because there is nothing to rouse while it is already turning. An
 * appointed tier is no button at all; it names the Overseer who runs it instead.
 *
 * Colour is never the only carrier. Each of those three states writes a line of its
 * own, and that line is the button's accessible name.
 *
 * A rung the player has not reached renders as a placeholder **in place** — the same
 * boxes at the same sizes, holding nothing. Every measurement lives on the container,
 * so the node cannot move or resize on the frame the real thing lands (ui-sensibility
 * §9). It is never absent and it is never a spinner.
 *
 * Tone rides with the data. The node sets `currentColor` from the manifest's slot and
 * the ring, the art and the arrival mark all inherit it, so no screen decides what
 * colour a tier is — and the accent, which means *act*, is never spent here. The one
 * gold on the stage is the focus ring, which every focusable thing in the app wears.
 */
export function TierNode({
  name,
  art,
  count,
  cycle,
  tone,
  isUnlocked,
  copy,
  oversight,
  feed,
  surgeIndex,
}: TierNodeProps): ReactNode {
  const reduced = useReducedMotion();
  const landing = usePulse(feed === null ? null : feed.produced, feed?.version ?? 0);
  const stateId = useId();

  // Set as a custom property, not as `color`. The chain takes every rung's colour over
  // while an evocation runs, and an inline `color` would beat any rule that tried.
  const tint =
    isUnlocked && tone !== null ? { ['--node-tone' as string]: `var(--tone-${tone})` } : undefined;

  const state = isUnlocked && oversight !== null ? nodeState(oversight, count) : 'idle';
  const line = state === 'idle' || oversight === null ? '' : stateLine(state, oversight, name);
  const isTappable = state === 'dormant' || state === 'turning';

  return (
    <article
      className={isUnlocked ? 'stage-node' : 'stage-node stage-node--sealed'}
      aria-label={isUnlocked ? undefined : copy.sealed}
      data-motion={reduced ? 'reduced' : 'full'}
      data-oversight={state}
      style={{ ...tint, ['--surge-index' as string]: surgeIndex }}
    >
      <div className="stage-node__medallion">
        {cycle !== null &&
          (isUnlocked ? (
            <CycleRing
              progressMs={cycle.progressMs}
              cycleMs={cycle.cycleMs}
              label={name}
              copy={copy}
            />
          ) : (
            <span className="stage-node__socket" aria-hidden="true" />
          ))}

        <div className="stage-node__art">
          {isUnlocked ? (
            <TierArt slot={art} decorative />
          ) : (
            <span className="stage-node__blank" aria-hidden="true" />
          )}
        </div>

        {landing !== null && (
          /* Re-keying on the arrival id restarts the mark. Same trick as the link's
             motes, and for the same reason: no timer, nothing to clean up. */
          <span className="stage-node__landing" key={landing.id} aria-hidden="true" />
        )}

        {isTappable && oversight !== null && (
          <button
            type="button"
            className="stage-node__tap"
            aria-labelledby={stateId}
            aria-disabled={state === 'turning'}
            onClick={() => {
              if (state === 'dormant') oversight.onRouse();
            }}
          />
        )}
      </div>

      {/* A rung the player has not reached still says what it is. A blank disc over a
          blank bar is a hole; a named one is the next thing to climb toward. Only the
          count is withheld, because there is genuinely nothing to count yet. */}
      <p className="stage-node__name">{name}</p>

      <p className="stage-node__count">
        {isUnlocked ? (
          formatCount(count)
        ) : (
          <span className="stage-node__bar stage-node__bar--short" aria-hidden="true" />
        )}
      </p>

      {oversight !== null && (
        <p className="stage-node__state" id={stateId}>
          {line}
        </p>
      )}
    </article>
  );
}

/**
 * Which of the three states this rung is in.
 *
 * A tier the player owns none of is `idle`: it is manual, but there is nothing there
 * to rouse, so it offers no control and says nothing. An absent judgement is not a
 * status (ui-sensibility §12).
 */
function nodeState(oversight: Oversight, count: Decimal): NodeState {
  if (oversight.isAppointed) return 'overseen';
  if (count.lte(0)) return 'idle';
  return oversight.isRousable ? 'dormant' : 'turning';
}

/** The one visible line naming the state, and the button's accessible name with it. */
function stateLine(state: NodeState, oversight: Oversight, name: string): string {
  switch (state) {
    case 'overseen':
      return oversight.overseer;
    case 'dormant':
      return oversight.copy.rouse(name);
    case 'turning':
      return oversight.copy.running(name);
    case 'idle':
      return '';
  }
}
