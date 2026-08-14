import type { ReactElement } from 'react';

/**
 * The hammer, drawn once.
 *
 * Two places want it — the muster's tab mark and the game's own title mark — and for a
 * while they each had their own, on the same `0 0 48 48` grid, differing in the one
 * detail that matters. Shared rather than copied, because a copy is what let them drift
 * in the first place and fixing the coordinates alone would leave that cause in place.
 *
 * **The handle is centred on `x 24` and runs up into the head's notch, and both of those
 * are load-bearing.** An earlier version sat right of centre and met the head by a
 * one-unit sliver: a crossbar with a stem off its right side, floating clear of the
 * middle, reads as a question mark. A second version abutted the head at `y 20` instead
 * of entering it, which is the same fault in milder form — the join is what says the two
 * parts are one tool.
 *
 * Flat and single-weight, unlike the tier silhouettes, because it has to survive 20px on
 * a tab. It is drawn the same at 72px on the title screen: one mark, not two that happen
 * to resemble each other.
 */
export function hammerMark(): ReactElement {
  return (
    <g fill="currentColor">
      <path d="M6 6 L42 6 L42 20 L30 20 L30 14 L18 14 L18 20 L6 20 Z" />
      <rect x="21" y="13" width="6" height="32" rx="1" />
    </g>
  );
}
