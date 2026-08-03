import Decimal from 'break_eternity.js';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { setReducedMotion } from '../../../test/setup.ts';
import { ChainLink, moteCount } from './ChainLink.tsx';

function motes(container: HTMLElement): NodeListOf<Element> {
  return container.querySelectorAll('.stage-link__mote');
}

describe('moteCount', () => {
  it('draws the floor of the range for a single unit', () => {
    expect(moteCount(new Decimal(1))).toBe(3);
  });

  it('draws the ceiling of the range for an amount past any counting', () => {
    expect(moteCount(new Decimal('1e40'))).toBe(9);
  });

  it('never draws more than the ceiling, whatever the magnitude', () => {
    expect(moteCount(new Decimal('1e300'))).toBeLessThanOrEqual(9);
  });

  it('never draws fewer than the floor for an amount below one', () => {
    expect(moteCount(new Decimal('0.001'))).toBe(3);
  });

  it('scales between the two across the decades', () => {
    expect(moteCount(new Decimal('1e12'))).toBe(6);
  });
});

describe('ChainLink', () => {
  it('carries nothing while the producer has produced nothing', () => {
    const { container } = render(
      <ChainLink produced={new Decimal(0)} version={0} tone="tier-2" surge={null} surgeIndex={0} />,
    );

    expect(motes(container)).toHaveLength(0);
  });

  it('pours motes down the link when a cycle completes', () => {
    const { container, rerender } = render(
      <ChainLink produced={new Decimal(0)} version={0} tone="tier-2" surge={null} surgeIndex={0} />,
    );

    rerender(
      <ChainLink
        produced={new Decimal(1500)}
        version={1}
        tone="tier-2"
        surge={null}
        surgeIndex={0}
      />,
    );

    expect(motes(container).length).toBeGreaterThan(0);
  });

  it('leads the string with a head', () => {
    const { container, rerender } = render(
      <ChainLink produced={new Decimal(0)} version={0} tone="tier-2" surge={null} surgeIndex={0} />,
    );

    rerender(
      <ChainLink
        produced={new Decimal(1500)}
        version={1}
        tone="tier-2"
        surge={null}
        surgeIndex={0}
      />,
    );

    expect(container.querySelectorAll('.stage-link__mote--head')).toHaveLength(1);
  });

  it('sets the head furthest along, so it leads whichever way the string is drawn', () => {
    const { container, rerender } = render(
      <ChainLink produced={new Decimal(0)} version={0} tone="tier-2" surge={null} surgeIndex={0} />,
    );

    rerender(
      <ChainLink
        produced={new Decimal(1500)}
        version={1}
        tone="tier-2"
        surge={null}
        surgeIndex={0}
      />,
    );

    expect(container.querySelector('.stage-link__mote--head')).toHaveStyle({
      'inset-inline-start': 'calc(var(--stage-link-spread) * 1)',
    });
  });

  it('lights the whole run when a cycle completes', () => {
    const { container, rerender } = render(
      <ChainLink produced={new Decimal(0)} version={0} tone="tier-2" surge={null} surgeIndex={0} />,
    );

    rerender(
      <ChainLink
        produced={new Decimal(1500)}
        version={1}
        tone="tier-2"
        surge={null}
        surgeIndex={0}
      />,
    );

    expect(container.querySelector('.stage-link__surge')).toBeInTheDocument();
  });

  it('still lights the run under reduced motion rather than dropping it', () => {
    setReducedMotion(true);

    const { container, rerender } = render(
      <ChainLink produced={new Decimal(0)} version={0} tone="tier-2" surge={null} surgeIndex={0} />,
    );

    rerender(
      <ChainLink
        produced={new Decimal(1500)}
        version={1}
        tone="tier-2"
        surge={null}
        surgeIndex={0}
      />,
    );

    expect(container.querySelector('.stage-link__surge')).toBeInTheDocument();
  });

  it('draws as many motes as the amount is worth', () => {
    const { container, rerender } = render(
      <ChainLink produced={new Decimal(0)} version={0} tone="tier-2" surge={null} surgeIndex={0} />,
    );

    rerender(
      <ChainLink
        produced={new Decimal('1e40')}
        version={1}
        tone="tier-2"
        surge={null}
        surgeIndex={0}
      />,
    );

    expect(motes(container)).toHaveLength(9);
  });

  it('stays still while the producer stands idle', () => {
    const produced = new Decimal(1500);
    const { container, rerender } = render(
      <ChainLink produced={produced} version={0} tone="tier-2" surge={null} surgeIndex={0} />,
    );

    rerender(
      <ChainLink produced={produced} version={1} tone="tier-2" surge={null} surgeIndex={0} />,
    );

    expect(motes(container)).toHaveLength(0);
  });

  it('takes its tone from the manifest, never the accent', () => {
    const { container } = render(
      <ChainLink produced={new Decimal(0)} version={0} tone="tier-3" surge={null} surgeIndex={0} />,
    );

    expect(container.querySelector('.stage-link')).toHaveStyle({ color: 'var(--tone-tier-3)' });
  });

  it('travels when motion is unrestricted', () => {
    const { container } = render(
      <ChainLink produced={new Decimal(0)} version={0} tone="tier-2" surge={null} surgeIndex={0} />,
    );

    expect(container.querySelector('.stage-link')).toHaveAttribute('data-motion', 'full');
  });

  it('stands in place when motion is reduced', () => {
    setReducedMotion(true);

    const { container } = render(
      <ChainLink produced={new Decimal(0)} version={0} tone="tier-2" surge={null} surgeIndex={0} />,
    );

    expect(container.querySelector('.stage-link')).toHaveAttribute('data-motion', 'reduced');
  });

  it('still shows the completion under reduced motion rather than dropping it', () => {
    setReducedMotion(true);

    const { container, rerender } = render(
      <ChainLink produced={new Decimal(0)} version={0} tone="tier-2" surge={null} surgeIndex={0} />,
    );

    rerender(
      <ChainLink
        produced={new Decimal(1500)}
        version={1}
        tone="tier-2"
        surge={null}
        surgeIndex={0}
      />,
    );

    expect(motes(container).length).toBeGreaterThan(0);
  });

  it('stays out of the accessibility tree, since the counts already carry the amounts', () => {
    const { container } = render(
      <ChainLink produced={new Decimal(0)} version={0} tone="tier-2" surge={null} surgeIndex={0} />,
    );

    expect(container.querySelector('.stage-link')).toHaveAttribute('aria-hidden', 'true');
  });
});
