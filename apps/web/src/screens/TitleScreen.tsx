import { useEffect, useRef, type ReactNode } from 'react';
import type { StartCopy } from '@dm/content';
import { TierArt } from '../ui/art/TierArt.tsx';
import './TitleScreen.css';

interface TitleScreenProps {
  /** The game's name, from `Copy['title']` — never restated here. */
  title: string;
  copy: StartCopy;
  onStart: () => void;
}

/**
 * The screen before the first frame of play.
 *
 * The same shape as `OfflineSummary`, which is the game's other full-screen take-over: a modal
 * dialog, a sheet, and exactly one action which is the way out. Two screens that take the whole
 * screen should not disagree about how.
 *
 * It carries the premise so the first tutorial beat does not have to. That beat used to open on
 * three nouns and then say "it", and the nearest antecedent was the wrong one.
 *
 * Focus moves to the one action on mount. This is the entry point to the game and has a single
 * control, which is the case where taking focus helps rather than steals.
 *
 * **It decides nothing about when it is shown.** `App` owns that; see the spec §2.1.
 */
export function TitleScreen({ title, copy, onStart }: TitleScreenProps): ReactNode {
  const start = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    start.current?.focus();
  }, []);

  return (
    <div className="title" role="dialog" aria-modal="true" aria-labelledby="title-name">
      <div className="title__sheet">
        <span className="title__mark">
          <TierArt slot="mark/dread-majesty" decorative />
        </span>

        <h1 className="title__name" id="title-name">
          {title}
        </h1>

        <p className="title__lede">{copy.lede}</p>
        <p className="title__premise">{copy.premise}</p>

        <button
          type="button"
          ref={start}
          className="button button--primary title__start"
          onClick={onStart}
        >
          {copy.begin}
        </button>
      </div>
    </div>
  );
}
