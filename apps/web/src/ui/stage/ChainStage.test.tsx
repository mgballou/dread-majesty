import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CURRENT, CURRENT_COPY } from '@dm/content';
import type { TierId } from '@dm/content';
import { apply, createState, step } from '@dm/engine';
import type { GameState } from '@dm/engine';
import { describe, expect, it, vi } from 'vitest';
import { setReducedMotion } from '../../../test/setup.ts';
import { ChainStage } from './ChainStage.tsx';

function everything(): (tierId: TierId) => boolean {
  return () => true;
}

function onlyMinions(): (tierId: TierId) => boolean {
  return (tierId) => tierId === 'minion';
}

function nothing(): (tierId: TierId) => boolean {
  return () => false;
}

function fresh(): GameState {
  return createState(CURRENT);
}

/**
 * A state built the way the game is actually played now: a manual tier accrues no
 * progress at all until somebody rouses it, so simply stepping a fresh state forward
 * produces nothing whatever.
 */
function tapped(cycles: number): GameState {
  const state = createState(CURRENT);
  for (let index = 0; index < cycles; index += 1) {
    apply(state, CURRENT, { kind: 'rouse', tierId: 'minion' });
    step(state, CURRENT, 4_000);
  }
  return state;
}

function stage(overrides: Partial<Parameters<typeof ChainStage>[0]> = {}): ReactElement {
  return (
    <ChainStage
      content={CURRENT}
      copy={CURRENT_COPY}
      state={fresh()}
      version={0}
      isUnlocked={everything()}
      isAppointed={nothing()}
      isRousable={everything()}
      onRouse={() => {}}
      {...overrides}
    />
  );
}

describe('ChainStage', () => {
  it('draws the whole chain once every rung has been reached', () => {
    render(stage());

    expect(screen.getAllByRole('listitem')).toHaveLength(5);
  });

  it('draws the rungs reached and one above them, not the whole ladder', () => {
    render(stage({ isUnlocked: onlyMinions() }));

    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('names itself as the chain rather than explaining the game', () => {
    render(stage());

    expect(screen.getByRole('list', { name: CURRENT_COPY.stage.chain })).toBeInTheDocument();
  });

  it('ends the chain at Evil', () => {
    render(stage());

    expect(screen.getByText(CURRENT_COPY.evil.name)).toBeInTheDocument();
  });

  it('puts every count through the one formatter', () => {
    render(stage({ state: tapped(600), version: 1 }));

    expect(screen.getByText('1.5K')).toBeInTheDocument();
  });

  it('holds exactly one rung the player has not reached, as the next goal', () => {
    render(stage({ isUnlocked: onlyMinions() }));

    expect(screen.getAllByLabelText(CURRENT_COPY.stage.sealed)).toHaveLength(1);
  });

  it('names that rung rather than leaving it blank', () => {
    render(stage({ isUnlocked: onlyMinions() }));

    expect(screen.getByText('Warrens')).toBeInTheDocument();
  });

  it('sweeps a ring for every generator the player has reached', () => {
    render(stage());

    expect(screen.getAllByRole('progressbar')).toHaveLength(CURRENT.tiers.length);
  });

  it('gives the ring a text alternative naming the tier', () => {
    render(stage({ isUnlocked: onlyMinions() }));

    expect(screen.getByRole('progressbar', { name: 'Minions' })).toHaveAttribute('aria-valuetext');
  });

  it('claims no progress for a rung the player has not reached', () => {
    render(stage({ isUnlocked: onlyMinions() }));

    expect(screen.getAllByRole('progressbar')).toHaveLength(1);
  });

  it('runs a link out of every generator', () => {
    const { container } = render(stage());

    expect(container.querySelectorAll('.stage-link')).toHaveLength(CURRENT.tiers.length);
  });

  it('never spends the accent, because the one action here is not the screen action', () => {
    const { container } = render(stage());

    expect(container.innerHTML).not.toContain('--accent');
  });

  it('treats the state as read-only', () => {
    const state = fresh();
    const before = state.gens.minion.owned.toString();

    render(stage({ state }));

    expect(state.gens.minion.owned.toString()).toBe(before);
  });

  it('draws every rung when motion is reduced, none of it missing', () => {
    setReducedMotion(true);

    render(stage({ isUnlocked: onlyMinions() }));

    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('marks the reduced-motion branch on every link', () => {
    setReducedMotion(true);

    const { container } = render(stage());

    expect(container.querySelectorAll('.stage-link[data-motion="reduced"]')).toHaveLength(
      CURRENT.tiers.length,
    );
  });

  it('offers the one tier the player owns as a dormant node', () => {
    render(stage({ isUnlocked: onlyMinions() }));

    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('rouses the tier whose node was pressed', async () => {
    const onRouse = vi.fn();
    render(stage({ isUnlocked: onlyMinions(), onRouse }));

    await userEvent.click(screen.getByRole('button'));

    expect(onRouse).toHaveBeenCalledWith('minion');
  });

  it('offers no node at all once every Overseer is appointed', () => {
    render(stage({ state: tapped(1), isAppointed: everything(), isRousable: nothing() }));

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('names the Overseer over a tier somebody runs', () => {
    render(stage({ state: tapped(1), isAppointed: everything(), isRousable: nothing() }));

    expect(screen.getByText(CURRENT_COPY.overseer.names.minion)).toBeInTheDocument();
  });

  it('never offers Evil as a tap target, since it is a resource and not a tier', () => {
    const { container } = render(stage({ state: tapped(600), version: 1 }));
    const rungs = container.querySelectorAll('.stage__rung');

    expect(rungs[rungs.length - 1]?.querySelector('button')).toBeNull();
  });
});
