import type { ReactNode } from 'react';
import type { SmiteCopy } from '@dm/content';
import { CYCLE_SEGMENTS } from '../segments.ts';
import './ApathyTicks.css';

interface ApathyTicksProps {
  /** How tired the realm is, 0 to `cap`. */
  apathy: number;
  cap: number;
  copy: Pick<SmiteCopy, 'apathy' | 'bands'>;
}

/**
 * The realm's patience, in ticks.
 *
 * **A share of the cap, never a count of it.** There are always `CYCLE_SEGMENTS` ticks
 * and the cap decides only how far along them a point of Apathy carries you. Raising
 * the cap from three to six later is then a content edit and nothing here moves — which
 * is the whole reason this is not one pill per point.
 *
 * **Always mounted and empty at rest**, so nothing moves when it fills — the same rule
 * the report line beneath it already follows. A gauge that appeared on the first blow
 * would shove the whole chain down once a session.
 *
 * **It prints no number.** It used to sit beside "Next ×1.75", which asked the player to
 * hold two figures in their head and subtract. The multiplier now appears on the control
 * itself while a blow runs, where it is the thing actually happening; these say how much
 * of the realm's patience is spent, and the label says what that means in words.
 *
 * It is a `meter` in spirit but an `img` in the accessibility tree, deliberately: the
 * useful thing to announce is not "3 of 5" but which of three sentences the realm is
 * currently living in, and a label carries that where a value cannot.
 *
 * **Reduced motion needs no special case here**, unlike the bar this replaces. Ticks are
 * discrete, so there is no sweep to strip — a tick lights or it does not, at every
 * motion setting.
 */
export function ApathyTicks({ apathy, cap, copy }: ApathyTicksProps): ReactNode {
  const share = cap > 0 ? Math.min(1, Math.max(0, apathy / cap)) : 0;
  // Upward bound, and **deliberately the opposite of the flooring `quantise` does for
  // the cycle rings.** A ring measures how much of a cycle has elapsed, so it must not
  // claim progress that has not happened — floor. This measures where a level stands,
  // so a tick owns the band beneath it and stays lit until the value drops clear of it.
  //
  // Flooring here made the top tick unreachable in practice. Apathy is capped at exactly
  // `cap`, so `share === 1` held for the single 100ms slice after a blow landed on the
  // cap and `step` immediately bled it below — the fifth tick flashed for one frame a
  // minute and never sat still. A player hammering on cooldown holds Apathy between
  // 2.56 and 3.0 of 3 forever and saw four.
  const lit = Math.ceil(share * CYCLE_SEGMENTS);

  return (
    <div className="apathy" role="img" aria-label={`${copy.apathy}. ${band(share, copy.bands)}`}>
      {Array.from({ length: CYCLE_SEGMENTS }, (_, index) => (
        <span
          key={index}
          className={index < lit ? 'apathy__tick apathy__tick--lit' : 'apathy__tick'}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

/**
 * Which of the three sentences the realm is living in.
 *
 * Thirds, and the top band is reached only at the very top — `Math.min` rather than a
 * `Math.floor` that would put a full gauge in a fourth band that does not exist.
 */
function band(share: number, bands: SmiteCopy['bands']): string {
  const index = Math.min(bands.length - 1, Math.floor(share * bands.length));
  return bands[index] ?? bands[0];
}
