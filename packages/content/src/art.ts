/**
 * The art manifest.
 *
 * Every slot has a fallback that renders with no image file present, so the game
 * looks finished with zero assets. Adding real art is dropping files into
 * `apps/web/public/art/` and setting `src` here. Nothing in the build may ever
 * depend on the Draw Things lab being reachable — see
 * docs/reference/local-art-generation.md.
 */
export interface ArtSlot {
  /** Path under the web app's public root, or null while unfilled. */
  readonly src: string | null;
  /** Drives the generated SVG fallback. */
  readonly fallback: {
    /** Silhouette the fallback draws. */
    readonly shape: 'spire' | 'banner' | 'hovel' | 'figure' | 'sigil';
    /** Semantic token name. Never a raw colour. */
    readonly tone: 'tier-1' | 'tier-2' | 'tier-3' | 'tier-4' | 'resource';
  };
  /** Accessible name. Survives even when the label is hidden. */
  readonly alt: string;
}

export const ART: Readonly<Record<string, ArtSlot>> = {
  'tier/fortress': {
    src: null,
    fallback: { shape: 'spire', tone: 'tier-4' },
    alt: 'A black fortress of clustered spires',
  },
  'tier/legion': {
    src: null,
    fallback: { shape: 'banner', tone: 'tier-3' },
    alt: 'A dark legion beneath a torn banner',
  },
  'tier/slum': {
    src: null,
    fallback: { shape: 'hovel', tone: 'tier-2' },
    alt: 'A crooked slum of leaning roofs',
  },
  'tier/minion': {
    src: null,
    fallback: { shape: 'figure', tone: 'tier-1' },
    alt: 'A hunched minion',
  },
  'resource/evil': {
    src: null,
    fallback: { shape: 'sigil', tone: 'resource' },
    alt: 'The sigil of Evil',
  },
};
