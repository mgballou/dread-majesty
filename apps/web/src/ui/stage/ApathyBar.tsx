import type { ReactNode } from 'react';
import type { SmiteCopy } from '@dm/content';
import './ApathyBar.css';

interface ApathyBarProps {
  /** How tired the realm is, 0 to `cap`. */
  apathy: number;
  cap: number;
  /** What the next blow would multiply by. */
  blow: number;
  copy: Pick<SmiteCopy, 'apathy' | 'bands' | 'blow'>;
}

/**
 * The realm's patience, and what is left of the next blow.
 *
 * **Always mounted and empty at rest**, so nothing moves when it fills — the same rule
 * the report line beneath it already follows. A gauge that appeared on the first blow
 * would shove the whole chain down once a session.
 *
 * It is a `meter` in spirit but an `img` in the accessibility tree, deliberately: the
 * useful thing to announce is not "1 of 3" but which of three sentences the realm is
 * currently living in, and a label carries that where a value cannot.
 *
 * The number beside it is what the *next* blow is worth. That is the actionable figure
 * and it belongs next to the thing that causes it; the verb on the button stays
 * width-locked and numberless, because a label that changes length drags the chain.
 */
export function ApathyBar({ apathy, cap, blow, copy }: ApathyBarProps): ReactNode {
  const share = cap > 0 ? Math.min(1, Math.max(0, apathy / cap)) : 0;

  return (
    <div className="apathy">
      <div
        className="apathy__track"
        role="img"
        aria-label={`${copy.apathy}. ${band(share, copy.bands)}`}
        style={{ ['--apathy-share' as string]: share }}
      >
        <div className="apathy__fill" />
      </div>

      <span className="apathy__blow">{copy.blow(`×${blow.toFixed(2)}`)}</span>
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
