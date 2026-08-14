import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
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
  /**
   * Set when this panel holds something the player can afford right now.
   *
   * Drawn as a dot on the tab, and **never as the accent.** The accent is spent on
   * doing, never on going, and a tab is navigation — so the dot says "something here"
   * without claiming to be the thing worth pressing.
   *
   * One object rather than two optionals, so a mark without its spoken label cannot be
   * written. A dot hidden from assistive tech is a signal only sighted players get.
   */
  mark?: { readonly label: string };
  panel: ReactNode;
}

interface DeckProps {
  tabs: readonly DeckTab[];
  /**
   * A tab to bring forward, named by id.
   *
   * The first-run tutorial uses it: a beat that points at a control inside a shut panel
   * would otherwise be pointing at something with no size on screen. Opening happens when
   * this *changes*, not on every render — so the player can still move to another tab
   * afterwards and the deck will not drag them back.
   *
   * Absent means the deck chooses for itself, which is every state after the first run.
   */
  requestOpen?: string;
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
export function Deck({ tabs, requestOpen }: DeckProps): ReactNode {
  const base = useId();
  const [chosen, setChosen] = useState(0);
  const strip = useRef<HTMLDivElement>(null);

  // Clamped rather than reset, so a shrinking set of tabs keeps roughly its place.
  const open = Math.min(chosen, tabs.length - 1);

  // Fires only when requestOpen changes, never on every render, so the player keeps
  // the ability to move to another tab while a beat still names this one. Does not
  // call move(): a request from the tutorial must not steal keyboard focus.
  useEffect(() => {
    if (requestOpen === undefined) {
      return;
    }

    const index = tabs.findIndex((tab) => tab.id === requestOpen);

    if (index !== -1) {
      setChosen(index);
    }
  }, [requestOpen]);

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
        {tabs.map((tab, index) => {
          const mark = shownMark(tab, index === open);

          return (
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
                  {mark !== null && <span className="deck__mark" aria-hidden="true" />}
                  {/* Every tab is named to assistive technology and none of them is
                      named on screen. The tube carries icons; the name of the open one
                      sits on its own line beneath it.

                      A dash rather than a full stop, because the label is a phrase and
                      a full stop in front of one reads out as a sentence that starts
                      in lower case. */}
                  <span className="deck__name">
                    {tab.title}
                    {mark === null ? '' : ` — ${mark.label}`}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
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

/**
 * The mark this tab should wear, or null for none.
 *
 * Never the open one. Its panel is on screen, so the dot would be saying what the
 * player is already looking at.
 */
function shownMark(tab: DeckTab, isOpen: boolean): { readonly label: string } | null {
  return tab.mark !== undefined && !isOpen ? tab.mark : null;
}

function tabId(base: string, id: string): string {
  return `${base}-${id}-tab`;
}

function panelId(base: string, id: string): string {
  return `${base}-${id}-panel`;
}
