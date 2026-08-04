import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { DeckGlyph, type DeckGlyphKind } from './DeckGlyph.tsx';
import './Deck.css';

export interface DeckTab {
  /** Stable across renders. Keys the panel and builds both ids. */
  id: string;
  title: string;
  /** Decorative mark set at the leading edge. Hidden from assistive tech. */
  glyph?: DeckGlyphKind;
  /** Count or state, set to the trailing edge. */
  trailing?: ReactNode;
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
 * doing, never on going (§3). Every panel carries its own accent now, so a shut tab has
 * nothing to announce: opening one always puts an accented control on screen.
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
                    <DeckGlyph kind={tab.glyph} />
                  </span>
                )}
                {/* Every tab is named to assistive technology and none of them is
                    named on screen. The tube carries icons; the name of the open one
                    sits on its own line beneath it. */}
                <span className="deck__name">{tab.title}</span>
              </span>
            </span>
          </button>
        ))}
      </div>

      {/*
        The name of the open panel, under the tube rather than inside it.
        Four names abreast do not fit a phone at any weight, and shrinking them until
        they do is how "Miscreants" becomes "THE MIS…". So the tube carries icons, which
        are the same width at every viewport, and the name gets a line of its own where
        it has the whole width to itself and nothing shifts when it changes.
      */}
      <div className="deck__head">
        <h2 className="deck__heading">{tabs[open]?.title}</h2>
        {tabs[open]?.trailing !== undefined && (
          <span className="deck__count">{tabs[open]?.trailing}</span>
        )}
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
