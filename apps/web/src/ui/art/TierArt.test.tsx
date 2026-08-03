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

  it('resolves the tone to a semantic token, never a colour', () => {
    const { container } = render(<TierArt slot="tier/minion" />);

    expect(container.querySelector('svg')).toHaveStyle({ color: 'var(--tone-tier-1)' });
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
