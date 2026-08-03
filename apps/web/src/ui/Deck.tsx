import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import './Deck.css';

export interface DeckTab {
  /** Stable across renders. Keys the panel and builds both ids. */
  id: string;
  title: string;
  /** Decorative mark set at the leading edge. Hidden from assistive tech. */
  glyph?: string;
  /** Count or state, set to the trailing edge. */
  trailing?: ReactNode;
  /**
   * Says there is something to act on behind this tab.
   *
   * A word, never a tone, and shown only while the tab is shut — once it is open the
   * panel itself says which row it means, in the same word.
   */
  mark?: string;
  panel: ReactNode;
}

interface DeckProps {
  tabs: readonly DeckTab[];
}

/**
 * Four panels, one region, one of them open.
 *
 * The chevron tabs are the region's heading band: the title takes its weight from
 * structure rather than size (ui-sensibility §6), so a panel does not carry a second
 * plaque of its own beneath the one that named it.
 *
 * **Tabs are navigation, so no tab ever wears the accent.** The accent is spent on
 * doing, never on going (§3). A tab with something to act on behind it says so in a
 * word instead, and the accented control is on screen the moment it is opened.
 *
 * Every panel stays mounted and the shut ones are `hidden`, which takes them out of
 * the traversal order and out of the accessibility tree without unmounting anything.
 * That is what keeps a half-typed save blob and a scroll position alive across a tab
 * change (§2.7), and what stops a panel rebuilding to show it arrived (§9). The body
 * holds a floor height for the same reason: changing tab must not resize the page.
 */
export function Deck({ tabs }: DeckProps): ReactNode {
  const base = useId();
  const [chosen, setChosen] = useState(0);
  const strip = useRef<HTMLDivElement>(null);

  // Clamped rather than reset, so a shrinking set of tabs keeps roughly its place.
  const open = Math.min(chosen, tabs.length - 1);

  const move = (index: number): void => {
    setChosen(index);
    strip.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[index]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const last = tabs.length - 1;
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];

    if (step !== undefined) {
      event.preventDefault();
      move((open + step + tabs.length) % tabs.length);
    } else if (event.key === 'Home') {
      event.preventDefault();
      move(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      move(last);
    }
  };

  return (
    <section className="deck">
      <div className="deck__strip" role="tablist" ref={strip} onKeyDown={onKeyDown}>
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={tabId(base, tab.id)}
            className="deck__tab"
            aria-selected={index === open}
            aria-controls={panelId(base, tab.id)}
            tabIndex={index === open ? 0 : -1}
            onClick={() => setChosen(index)}
          >
            <span className="deck__edge">
              <span className="deck__field">
                {tab.glyph !== undefined && (
                  <span className="deck__glyph" aria-hidden="true">
                    {tab.glyph}
                  </span>
                )}
                <span className="deck__title">{tab.title}</span>
                {tab.trailing !== undefined && (
                  <span className="deck__trailing">{tab.trailing}</span>
                )}
                {tab.mark !== undefined && index !== open && (
                  <span className="deck__mark">{tab.mark}</span>
                )}
              </span>
            </span>
          </button>
        ))}
      </div>

      <div className="deck__body">
        {tabs.map((tab, index) => (
          <div
            key={tab.id}
            role="tabpanel"
            id={panelId(base, tab.id)}
            className="deck__panel"
            aria-labelledby={tabId(base, tab.id)}
            hidden={index !== open}
            /* The panel is its own scroller, and the deeds hold nothing focusable at
               all, so without this there is no way to reach the bottom of that list
               without a pointer. */
            tabIndex={0}
          >
            {tab.panel}
          </div>
        ))}
      </div>
    </section>
  );
}

function tabId(base: string, id: string): string {
  return `${base}-${id}-tab`;
}

function panelId(base: string, id: string): string {
  return `${base}-${id}-panel`;
}
