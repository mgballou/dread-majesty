import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Banner } from './Banner.tsx';

describe('Banner', () => {
  it('renders its children as the heading text', () => {
    render(
      <Banner as="h2" weight="primary">
        The Dread Ledger
      </Banner>,
    );

    expect(screen.getByRole('heading', { name: 'The Dread Ledger' })).toBeVisible();
  });

  it('renders the heading level the caller asked for', () => {
    render(
      <Banner as="h3" weight="secondary">
        Warrens
      </Banner>,
    );

    expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
  });

  it('renders a different level when asked for a different level', () => {
    render(
      <Banner as="h1" weight="primary">
        Dread Majesty
      </Banner>,
    );

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('marks a primary banner as primary', () => {
    render(
      <Banner as="h2" weight="primary">
        Legions
      </Banner>,
    );

    expect(screen.getByRole('heading')).toHaveClass('banner--primary');
  });

  it('marks a secondary banner as secondary', () => {
    render(
      <Banner as="h2" weight="secondary">
        Legions
      </Banner>,
    );

    expect(screen.getByRole('heading')).toHaveClass('banner--secondary');
  });

  it('keeps the glyph out of the accessible name', () => {
    render(
      <Banner as="h2" weight="primary" glyph="†">
        Legions
      </Banner>,
    );

    expect(screen.getByRole('heading', { name: 'Legions' })).toBeInTheDocument();
  });

  it('renders no glyph when none is given', () => {
    const { container } = render(
      <Banner as="h2" weight="primary">
        Legions
      </Banner>,
    );

    expect(container.querySelector('.banner__glyph')).toBeNull();
  });

  it('carries a layout class from the caller alongside its own', () => {
    render(
      <Banner as="h2" weight="primary" className="panel__title">
        Legions
      </Banner>,
    );

    expect(screen.getByRole('heading')).toHaveClass('panel__title');
  });
});
