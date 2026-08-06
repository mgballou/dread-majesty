import type { ReactNode } from 'react';
import type { PrestigeCopy } from '@dm/content';
import './PrestigeMarker.css';

interface PrestigeMarkerProps {
  copy: PrestigeCopy;
  onReveal: () => void;
}

/**
 * A line above the deck, the first time souls are owed.
 *
 * The panel is below a deck that holds a floor height, which on a phone is a long scroll
 * past the fold — so a player can be well past the reveal threshold, with the panel
 * rendering, and never find it. A panel nobody scrolls to is not on screen.
 *
 * **Not the accent.** The stage carries one and the open deck panel carries the other;
 * a third would leave no primary at all (ui-sensibility §3). This is a signpost, and a
 * signpost is not a verb.
 *
 * Shown only before the first reset. After that, nobody needs telling where the button
 * is — which is also why nothing about this has to be saved.
 */
export function PrestigeMarker({ copy, onReveal }: PrestigeMarkerProps): ReactNode {
  return (
    <p className="prestige-marker" role="status">
      <span className="prestige-marker__line">{copy.owed}</span>
      <button type="button" className="button" onClick={onReveal}>
        {copy.owedAction}
      </button>
    </p>
  );
}
