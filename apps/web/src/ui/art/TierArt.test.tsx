import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { ART } from '@dm/content';
import { describe, expect, it } from 'vitest';
import { TierArt } from './TierArt.tsx';

describe('TierArt', () => {
  it('draws something for every slot in the manifest', () => {
    for (const slot of Object.keys(ART)) {
      const { container, unmount } = render(<TierArt slot={slot} />);

      expect(container.querySelector('svg, img')).not.toBeNull();
      unmount();
    }
  });

  it('carries the slot alt text as its accessible name', () => {
    render(<TierArt slot="tier/warren" />);

    expect(screen.getByLabelText(ART['tier/warren']?.alt ?? '')).toBeInTheDocument();
  });

  it('hides itself from assistive tech when a label already names the thing', () => {
    const { container } = render(<TierArt slot="tier/warren" decorative />);

    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('carries the hammer mark alt text as its accessible name', () => {
    render(<TierArt slot="mark/dread-majesty" />);

    expect(screen.getByLabelText(ART['mark/dread-majesty']?.alt ?? '')).toBeInTheDocument();
  });

  it('hides the hammer mark from assistive tech when decorative', () => {
    const { container } = render(<TierArt slot="mark/dread-majesty" decorative />);

    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('resolves the tone to a semantic token, never a colour', () => {
    const { container } = render(<TierArt slot="tier/minion" />);

    expect(container.querySelector('svg')?.getAttribute('style')).toContain(
      '--art-tone: var(--tone-tier-1)',
    );
  });

  it('renders nothing for a slot the manifest does not carry', () => {
    const { container } = render(<TierArt slot="tier/nonexistent" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('draws every tier at a different silhouette, so none reads as another', () => {
    const drawn = new Set(
      Object.keys(ART).map((slot) => {
        const { container, unmount } = render(<TierArt slot={slot} />);
        const markup = container.querySelector('svg')?.innerHTML ?? '';
        unmount();
        return markup;
      }),
    );

    expect(drawn.size).toBe(Object.keys(ART).length);
  });

  it('draws the stage larger than the rail when asked to', () => {
    const { container } = render(<TierArt slot="tier/fortress" size={48} />);

    expect(container.querySelector('svg')).toHaveStyle({ width: '48px' });
  });

  it('keeps every silhouette in the slot tone, never a second colour', () => {
    const { container } = render(<TierArt slot="tier/legion" />);

    expect(
      container.querySelector('[fill]:not([fill="currentColor"]):not([fill="none"])'),
    ).toBeNull();
  });
});

/**
 * Walks up from the working directory rather than reading `import.meta.url`, which
 * under jsdom is an http URL and cannot be turned into a path. Mirrors `tokens.test.ts`.
 */
function locate(relative: string): string {
  let dir = process.cwd();
  while (!existsSync(join(dir, relative))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`Could not find ${relative} above ${process.cwd()}`);
    dir = parent;
  }
  return join(dir, relative);
}

/** Every `d` attribute in a piece of SVG markup, in no particular order. */
function outlines(markup: string): Set<string> {
  return new Set(Array.from(markup.matchAll(/\sd="([^"]+)"/g), (match) => match[1] ?? ''));
}

function drawn(slot: string): Set<string> {
  const { container, unmount } = render(<TierArt slot={slot} />);
  const markup = container.querySelector('svg')?.innerHTML ?? '';
  unmount();
  return outlines(markup);
}

function committed(file: string): Set<string> {
  return outlines(readFileSync(locate(join('docs', 'assets', file)), 'utf8'));
}

/*
 * The README's copies of the art.
 *
 * GitHub strips inline `<svg>` out of markdown, so the marks the README shows have to be
 * committed files rather than the components themselves. That is a second copy of every
 * silhouette, and a second copy is how the muster's hammer and the title screen's drifted
 * apart in the first place — the fix there was to share one drawing, which is not
 * available across a directory GitHub reads and a bundle it does not.
 *
 * So the drawings are pinned instead. Each committed file must carry exactly the outlines
 * its component draws: edit a tier's shape and the README's copy fails here until it is
 * brought along. Only `d` attributes are compared — the standalone files differ on purpose
 * in what surrounds them, punching their voids through a `<mask>` so they sit on GitHub's
 * own background instead of the game's, and naming a tone where the component names a token.
 */
describe('the marks the README draws', () => {
  const copies: ReadonlyArray<readonly [string, string]> = [
    ['tier/throne', 'icon-throne.svg'],
    ['tier/fortress', 'icon-fortress.svg'],
    ['tier/legion', 'icon-legion.svg'],
    ['tier/warren', 'icon-warren.svg'],
    ['tier/minion', 'icon-minion.svg'],
    ['resource/evil', 'icon-evil.svg'],
    ['mark/dread-majesty', 'mark.svg'],
  ];

  it.each(copies)('draws %s the same as %s', (slot, file) => {
    expect(committed(file)).toStrictEqual(drawn(slot));
  });

  it('has a committed copy for every slot in the manifest', () => {
    expect(copies.map(([slot]) => slot).sort()).toStrictEqual(Object.keys(ART).sort());
  });
});
