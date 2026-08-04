import type { ReactElement, ReactNode } from 'react';

/** One mark per panel of the deck. */
export type DeckGlyphKind = 'muster' | 'miscreants' | 'deeds' | 'ledger';

interface DeckGlyphProps {
  kind: DeckGlyphKind;
}

/**
 * The mark on a tab, drawn rather than typed.
 *
 * These were Unicode characters and the platform decided what they looked like: iOS
 * gives U+2692 emoji presentation, in colour, at its own weight, while every desktop
 * draws it as a monochrome glyph. One tab was a different species on a phone.
 *
 * Drawn in `currentColor` on the same `0 0 48 48` box every other mark in the game
 * uses, so a tab mark, a tier silhouette and the miscreants' diamond are one mechanism
 * and answer to the tab's own colour. Decorative throughout — every tab is already
 * named to assistive technology by `.deck__name`.
 */
export function DeckGlyph({ kind }: DeckGlyphProps): ReactNode {
  return (
    <svg
      className="deck__mark"
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
      role="presentation"
    >
      {shape(kind)}
    </svg>
  );
}

/**
 * Four marks, each readable by outline alone at 20px.
 *
 * The muster is a hammer, the thing that raises. The miscreants are a diamond, the
 * shape that already means "a post, not a generator" in that panel. The deeds are a
 * star. The ledger is a page with rules on it.
 *
 * **Returns `ReactElement`, not `ReactNode`, and that is the exhaustiveness check.**
 * A switch with no `default` does not on its own make a missing case a type error:
 * `ReactNode` includes `undefined`, so falling off the end returns a value the
 * signature already allows and the build stays green while the tab draws nothing.
 * `ReactElement` excludes `undefined`, so a fifth kind fails to compile — which is
 * what a `default` case would have hidden.
 */
function shape(kind: DeckGlyphKind): ReactElement {
  switch (kind) {
    case 'muster':
      return (
        <g fill="currentColor">
          <rect x="21" y="16" width="6" height="29" rx="1" />
          <path d="M6 6 L34 6 L34 18 L26 18 L26 12 L14 12 L14 18 L6 18 Z" />
        </g>
      );
    case 'miscreants':
      return <path d="M24 3 L45 24 L24 45 L3 24 Z" fill="currentColor" />;
    case 'deeds':
      return (
        <path
          d="M24 2 L29.5 17.5 L45 18.5 L33 28.5 L37 44 L24 35 L11 44 L15 28.5 L3 18.5 L18.5 17.5 Z"
          fill="currentColor"
        />
      );
    case 'ledger':
      return (
        <g fill="currentColor">
          <path d="M9 4 L33 4 L39 11 L39 44 L9 44 Z" opacity="0.85" />
          <rect x="15" y="17" width="18" height="3" className="art__void" />
          <rect x="15" y="25" width="18" height="3" className="art__void" />
          <rect x="15" y="33" width="11" height="3" className="art__void" />
        </g>
      );
  }
}
