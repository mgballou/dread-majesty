import type { ReactElement } from 'react';
import Decimal from 'break_eternity.js';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CURRENT_COPY } from '@dm/content';
import { describe, expect, it, vi } from 'vitest';
import { setReducedMotion } from '../../../test/setup.ts';
import { TierNode } from './TierNode.tsx';

const CYCLE = { progressMs: 12_000, cycleMs: 24_000 };

const OVERSIGHT = {
  isAppointed: false,
  isRousable: true,
  isGated: false,
  overseer: CURRENT_COPY.overseer.names['warren-hand'],
  copy: CURRENT_COPY.overseer,
  onRouse: (): void => {},
};

function node(overrides: Partial<Parameters<typeof TierNode>[0]> = {}): ReactElement {
  return (
    <TierNode
      name="Warrens"
      art="tier/warren"
      count={new Decimal(3)}
      cycle={CYCLE}
      tone="tier-2"
      isUnlocked
      copy={CURRENT_COPY.stage}
      oversight={OVERSIGHT}
      feed={null}
      produced={new Decimal(0)}
      version={0}
      surgeIndex={0}
      {...overrides}
    />
  );
}

describe('TierNode', () => {
  it('names the thing it stands for', () => {
    render(node());

    expect(screen.getByText('Warrens')).toBeInTheDocument();
  });

  it('puts the count through the one formatter', () => {
    render(node({ count: new Decimal(1500) }));

    expect(screen.getByText('1.5K')).toBeInTheDocument();
  });

  it('sweeps a ring for a tier that cycles', () => {
    render(node());

    expect(screen.getByRole('progressbar', { name: 'Warrens' })).toBeInTheDocument();
  });

  it('sweeps nothing for the resource at the foot of the chain', () => {
    render(node({ name: 'Evil', art: 'resource/evil', cycle: null, oversight: null }));

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('takes its tone from the manifest, never the accent', () => {
    const { container } = render(node());

    expect(container.querySelector('.stage-node')).toHaveAttribute(
      'style',
      expect.stringContaining('--node-tone: var(--tone-tier-2)'),
    );
  });

  it('stays on the stage as a placeholder when the rung is not yet reached', () => {
    render(node({ count: new Decimal(0), isUnlocked: false }));

    expect(screen.getByLabelText(CURRENT_COPY.stage.sealed)).toBeInTheDocument();
  });

  it('names a rung not yet reached, so it reads as a goal', () => {
    render(node({ count: new Decimal(0), isUnlocked: false }));

    expect(screen.getByText('Warrens')).toBeInTheDocument();
  });

  it('withholds the count of a rung not yet reached', () => {
    const { container } = render(node({ count: new Decimal(0), isUnlocked: false }));

    expect(container.querySelector('.stage-node__bar--short')).toBeInTheDocument();
  });

  it('holds the art box open at its full size while the rung is sealed', () => {
    const { container } = render(node({ count: new Decimal(0), isUnlocked: false }));

    expect(container.querySelector('.stage-node__blank')).toBeInTheDocument();
  });

  it('holds the ring open as an empty socket rather than claiming progress', () => {
    const { container } = render(node({ count: new Decimal(0), isUnlocked: false }));

    expect(container.querySelector('.stage-node__socket')).toBeInTheDocument();
  });

  it('lays out a sealed rung with the same boxes as a reached one', () => {
    const sealed = render(node({ count: new Decimal(0), isUnlocked: false }));
    const reached = render(node({ count: new Decimal(0) }));

    expect(structure(sealed.container)).toEqual(structure(reached.container));
  });

  it('keeps the count legible when motion is reduced', () => {
    setReducedMotion(true);

    render(node({ count: new Decimal(1500) }));

    expect(screen.getByText('1.5K')).toBeInTheDocument();
  });

  it('offers a dormant tier as a button', () => {
    render(node());

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('names that button with the verb pressing it performs', () => {
    render(node());

    expect(
      screen.getByRole('button', { name: CURRENT_COPY.overseer.rouse('Warrens') }),
    ).toBeInTheDocument();
  });

  it('rouses the tier when the node is pressed', async () => {
    const onRouse = vi.fn();
    render(node({ oversight: { ...OVERSIGHT, onRouse } }));

    await userEvent.click(screen.getByRole('button'));

    expect(onRouse).toHaveBeenCalledTimes(1);
  });

  it('says in words that a dormant tier is waiting, never in colour alone', () => {
    render(node());

    expect(screen.getByText(CURRENT_COPY.overseer.rouse('Warrens'))).toBeInTheDocument();
  });

  it('keeps a turning tier focusable rather than dropping it out from under you', () => {
    render(node({ oversight: { ...OVERSIGHT, isRousable: false } }));

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('marks a turning tier as offering nothing to press', () => {
    render(node({ oversight: { ...OVERSIGHT, isRousable: false } }));

    expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true');
  });

  it('rouses nothing while the tier is already turning', async () => {
    const onRouse = vi.fn();
    render(node({ oversight: { ...OVERSIGHT, isRousable: false, onRouse } }));

    await userEvent.click(screen.getByRole('button'));

    expect(onRouse).not.toHaveBeenCalled();
  });

  it('says in words that a turning tier is at work', () => {
    render(node({ oversight: { ...OVERSIGHT, isRousable: false } }));

    expect(screen.getByText(CURRENT_COPY.overseer.running('Warrens'))).toBeInTheDocument();
  });

  it('marks a dormant but gated tier as offering nothing to press', () => {
    render(node({ oversight: { ...OVERSIGHT, isGated: true } }));

    expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true');
  });

  it('rouses nothing while the tier is gated', async () => {
    const onRouse = vi.fn();
    render(node({ oversight: { ...OVERSIGHT, isGated: true, onRouse } }));

    await userEvent.click(screen.getByRole('button'));

    expect(onRouse).not.toHaveBeenCalled();
  });

  it('still says a gated tier is waiting to be roused, not that it is running', () => {
    render(node({ oversight: { ...OVERSIGHT, isGated: true } }));

    expect(screen.getByText(CURRENT_COPY.overseer.rouse('Warrens'))).toBeInTheDocument();
  });

  it('offers no button once an Overseer is appointed', () => {
    render(node({ oversight: { ...OVERSIGHT, isAppointed: true, isRousable: false } }));

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('names the Overseer who runs an appointed tier', () => {
    render(node({ oversight: { ...OVERSIGHT, isAppointed: true, isRousable: false } }));

    expect(screen.getByText(CURRENT_COPY.overseer.names['warren-hand'])).toBeInTheDocument();
  });

  it('offers no button for a tier the player owns none of', () => {
    render(node({ count: new Decimal(0), oversight: { ...OVERSIGHT, isRousable: false } }));

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('offers no button on a rung the player has not reached', () => {
    render(node({ isUnlocked: false }));

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('never a button for the resource at the foot of the chain', () => {
    render(node({ name: 'Evil', art: 'resource/evil', cycle: null, oversight: null }));

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('marks nothing on a rung nothing feeds', () => {
    const { container } = render(node());

    expect(container.querySelector('.stage-node__landing')).not.toBeInTheDocument();
  });

  it('marks the arrival when the rung above delivers', () => {
    const { container, rerender } = render(
      node({ feed: { produced: new Decimal(0), version: 0 } }),
    );

    rerender(node({ feed: { produced: new Decimal(12), version: 1 } }));

    expect(container.querySelector('.stage-node__landing')).toBeInTheDocument();
  });

  it('still marks the arrival under reduced motion rather than dropping it', () => {
    setReducedMotion(true);

    const { container, rerender } = render(
      node({ feed: { produced: new Decimal(0), version: 0 } }),
    );

    rerender(node({ feed: { produced: new Decimal(12), version: 1 } }));

    expect(container.querySelector('.stage-node__landing')).toBeInTheDocument();
  });

  it('marks nothing while the rung above stands idle', () => {
    const produced = new Decimal(12);
    const { container, rerender } = render(node({ feed: { produced, version: 0 } }));

    rerender(node({ feed: { produced, version: 1 } }));

    expect(container.querySelector('.stage-node__landing')).not.toBeInTheDocument();
  });

  it('marks its own completion when its lifetime output grows', () => {
    const { container, rerender } = render(node({ produced: new Decimal(10) }));

    rerender(node({ produced: new Decimal(14) }));

    expect(container.querySelector('.stage-node__fired')).toBeInTheDocument();
  });

  it('marks nothing while its output stands still', () => {
    const { container, rerender } = render(node({ produced: new Decimal(10) }));

    rerender(node({ produced: new Decimal(10) }));

    expect(container.querySelector('.stage-node__fired')).not.toBeInTheDocument();
  });

  it('says which motion branch it drew', () => {
    setReducedMotion(true);

    const { container } = render(node());

    expect(container.querySelector('.stage-node')).toHaveAttribute('data-motion', 'reduced');
  });
});

function structure(container: HTMLElement): string[] {
  return [
    '.stage-node__medallion',
    '.stage-node__art',
    '.stage-node__name',
    '.stage-node__count',
    '.stage-node__state',
  ].map((selector) => (container.querySelector(selector) === null ? 'missing' : 'present'));
}
