import type { ReactElement, ReactNode } from 'react';

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
 * star. The malice is a fang.
 *
 * **The malice was a burst and the burst had to go, for a structural reason rather
 * than a matter of taste: it was radial, and so is the star.** Two marks built the same
 * way sat two tabs apart. At 48px the point counts told them apart; at 20px, which is
 * the only size that matters here, both collapsed to a spiky round thing. The fang is
 * the answer because it is the one mark in the deck with a curve in it — every other is
 * straight-edged — so it cannot be confused with any of them however small the tube gets.
 *
 * **The hammer's handle is centred on `x 24` and run up into the head's notch, and both
 * of those are load-bearing.** It used to sit at `x 21–27` against a head centred on
 * `x 20`, starting at `y 16` when the head's solid bar stopped at `y 12` — so it hung
 * right of centre and touched the head only by a one-unit sliver against the right leg.
 * A crossbar with a stem off its right side, floating clear of the middle, reads as a
 * question mark. It was never going to read as a hammer.
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
          <path d="M6 6 L42 6 L42 20 L30 20 L30 14 L18 14 L18 20 L6 20 Z" />
          <rect x="21" y="13" width="6" height="32" rx="1" />
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
    case 'malice':
      return (
        <path
          d="M10 5 C16 9 32 9 38 5 C37 20 32 34 24 46 C16 34 11 20 10 5 Z"
          fill="currentColor"
        />
      );
  }
}
