import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DeckGlyph, type DeckGlyphKind } from './DeckGlyph.tsx';

const kinds: DeckGlyphKind[] = ['muster', 'miscreants', 'deeds', 'ledger'];

describe('every tab has a drawing of its own', () => {
  it.each(kinds)('draws %s', (kind) => {
    const { container } = render(<DeckGlyph kind={kind} />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it.each(kinds)('hides %s from assistive tech', (kind) => {
    const { container } = render(<DeckGlyph kind={kind} />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('gives each tab a different drawing', () => {
    const drawn = kinds.map((kind) => render(<DeckGlyph kind={kind} />).container.innerHTML);
    expect(new Set(drawn).size).toBe(kinds.length);
  });
});
