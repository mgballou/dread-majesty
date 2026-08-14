import type { ReactElement, ReactNode } from 'react';
import { hammerMark } from './art/hammer.tsx';

/** One mark per panel of the deck. */
export type DeckGlyphKind = 'muster' | 'miscreants' | 'deeds' | 'malice';

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
      className="deck__shape"
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
 * star. The malice is a fang.
 *
 * **The malice was a burst and the burst had to go, for a structural reason rather
 * than a matter of taste: it was radial, and so is the star.** Two marks built the same
 * way sat two tabs apart. At 48px the point counts told them apart; at 20px, which is
 * the only size that matters here, both collapsed to a spiky round thing. The fang is
 * the answer because it is the one mark in the deck with a curve in it — every other is
 * straight-edged — so it cannot be confused with any of them however small the tube gets.
 *
 * **The hammer now lives in `art/hammer.tsx`, shared with the title mark**, and the note
 * on why its handle runs up into the head's notch lives with it. It was drawn twice for
 * a while — once here, once for the title screen — on this same grid and differing in
 * exactly that join, which is the argument for one copy rather than two.
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
      return hammerMark();
    case 'miscreants':
      return <path d="M24 3 L45 24 L24 45 L3 24 Z" fill="currentColor" />;
    case 'deeds':
      return (
        <path
          d="M24 2 L29.5 17.5 L45 18.5 L33 28.5 L37 44 L24 35 L11 44 L15 28.5 L3 18.5 L18.5 17.5 Z"
          fill="currentColor"
        />
      );
    case 'malice':
      return (
        <path
          d="M10 5 C16 9 32 9 38 5 C37 20 32 34 24 46 C16 34 11 20 10 5 Z"
          fill="currentColor"
        />
      );
  }
}
