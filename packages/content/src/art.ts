/**
 * The art manifest.
 *
 * Every slot has a fallback that renders with no image file present, so the game
 * looks finished with zero assets. Adding real art is dropping files into
 * `apps/web/public/art/` and setting `src` here. Art is generated out of band and
 * committed: nothing in the build may ever depend on an art tool being reachable.
 */
export interface ArtSlot {
  /** Path under the web app's public root, or null while unfilled. */
  readonly src: string | null;
  /** Drives the generated SVG fallback. */
  readonly fallback: {
    /** Silhouette the fallback draws. */
    readonly shape: 'spire' | 'banner' | 'hovel' | 'figure' | 'sigil' | 'throne' | 'hammer';
    /** Semantic token name. Never a raw colour. */
    readonly tone: 'tier-1' | 'tier-2' | 'tier-3' | 'tier-4' | 'tier-5' | 'resource';
  };
  /** Accessible name. Survives even when the label is hidden. */
  readonly alt: string;
}

export const ART: Readonly<Record<string, ArtSlot>> = {
  'tier/throne': {
    src: null,
    fallback: { shape: 'throne', tone: 'tier-5' },
    alt: 'A high black throne under a broken arch',
  },
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
  'tier/warren': {
    src: null,
    fallback: { shape: 'hovel', tone: 'tier-2' },
    alt: 'A crooked warren of leaning roofs',
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
  /**
   * The game's own mark, and the only slot that is not a tier or a resource.
   *
   * Drawn in the resource tone rather than any tier's: the hammer stands for the game, and
   * borrowing a rung's color would say it stood for that rung.
   */
  'mark/dread-majesty': {
    src: null,
    fallback: { shape: 'hammer', tone: 'resource' },
    alt: 'A black war hammer',
  },
};
