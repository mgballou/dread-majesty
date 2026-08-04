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

function throughWarren(): (tierId: TierId) => boolean {
  return (tierId) => tierId === 'minion' || tierId === 'warren';
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
      needsHand={everything()}
      onRouse={() => {}}
      smiteIsTheAction={false}
      onSmite={() => {}}
      {...overrides}
    />
  );
}

/** A state mid-blow: the buff is what lights the chain, so the engine has to run it. */
function struck(): GameState {
  const state = tapped(1);
  apply(state, CURRENT, { kind: 'smite' });
  return state;
}

function rouseButtons(container: HTMLElement): NodeListOf<Element> {
  return container.querySelectorAll('.stage-node__tap');
}

function strike(): HTMLElement {
  return screen.getByRole('button', { name: /^Smite\./ });
}

describe('ChainStage', () => {
  it('draws every generator once every rung has been reached', () => {
    render(stage());

    expect(screen.getAllByRole('listitem')).toHaveLength(CURRENT.tiers.length);
  });

  it('draws the rungs reached and one above them, not the whole ladder', () => {
    render(stage({ isUnlocked: onlyMinions() }));

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('names itself as the chain rather than explaining the game', () => {
    render(stage());

    expect(screen.getByRole('region', { name: CURRENT_COPY.stage.chain })).toBeInTheDocument();
  });

  it('ends the chain at Evil', () => {
    render(stage());

    expect(screen.getByText(CURRENT_COPY.evil.name)).toBeInTheDocument();
  });

  it('keeps Evil out of the scrolling track, so it can never be scrolled away', () => {
    const { container } = render(stage());

    expect(container.querySelector('.stage__track .evil-node')).toBeNull();
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

  it('pours Evil-toned motes down the last run', () => {
    const { container } = render(stage());
    const links = container.querySelectorAll('.stage-link');
    const last = links[links.length - 1];

    expect(last).toHaveStyle({ '--node-tone': 'var(--tone-resource)' });
  });

  it('pours Minion-toned motes down the run that feeds Minions', () => {
    const { container } = render(stage({ isUnlocked: throughWarren() }));
    const warren = container.querySelector('[data-tier="warren"] .stage-link');

    expect(warren).toHaveStyle({ '--node-tone': 'var(--tone-tier-1)' });
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

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('marks the reduced-motion branch on every link', () => {
    setReducedMotion(true);

    const { container } = render(stage());

    expect(container.querySelectorAll('.stage-link[data-motion="reduced"]')).toHaveLength(
      CURRENT.tiers.length,
    );
  });

  it('offers the one tier the player owns as a dormant node', () => {
    const { container } = render(stage({ isUnlocked: onlyMinions() }));

    expect(rouseButtons(container)).toHaveLength(1);
  });

  it('rouses the tier whose node was pressed', async () => {
    const onRouse = vi.fn();
    render(stage({ isUnlocked: onlyMinions(), onRouse }));

    await userEvent.click(screen.getByRole('button', { name: /Rouse the Minions/ }));

    expect(onRouse).toHaveBeenCalledWith('minion');
  });

  it('offers no rung to rouse once every Overseer is appointed', () => {
    const { container } = render(
      stage({ state: tapped(1), isAppointed: everything(), isRousable: nothing() }),
    );

    expect(rouseButtons(container)).toHaveLength(0);
  });

  it('names the Overseer over a tier somebody runs', () => {
    render(stage({ state: tapped(1), isAppointed: everything(), isRousable: nothing() }));

    expect(screen.getByText(CURRENT_COPY.overseer.names['minion-hand'])).toBeInTheDocument();
  });

  it('makes Evil itself the verb', async () => {
    const onSmite = vi.fn();
    render(stage({ onSmite }));

    await userEvent.click(strike());

    expect(onSmite).toHaveBeenCalledOnce();
  });

  it('runs no evocation until one is struck', () => {
    const { container } = render(stage());

    expect(container.querySelector('.stage')).not.toHaveAttribute('data-surge');
  });

  it('lights the whole chain for as long as the blow lasts', () => {
    const { container } = render(stage({ state: struck() }));

    expect(container.querySelector('.stage')).toHaveAttribute('data-surge', 'lit');
  });

  it('suppresses completions along the chain while it burns', () => {
    const state = struck();
    const { container, rerender } = render(stage({ state, version: 1 }));

    state.gens.minion.lifetimeProduced = state.gens.minion.lifetimeProduced.add(1000);
    rerender(stage({ state, version: 2 }));

    expect(container.querySelectorAll('.stage-link__mote')).toHaveLength(0);
  });

  it('lets completions through again once the blow is spent', () => {
    const state = fresh();
    const { container, rerender } = render(stage({ state, version: 1 }));

    state.gens.minion.lifetimeProduced = state.gens.minion.lifetimeProduced.add(1000);
    rerender(stage({ state, version: 2 }));

    expect(container.querySelectorAll('.stage-link__mote').length).toBeGreaterThan(0);
  });

  it('orders the wave outward from Evil', () => {
    const { container } = render(stage({ state: struck() }));
    const rungs = [...container.querySelectorAll('.stage-node')];

    expect(rungs[rungs.length - 1]?.getAttribute('style')).toContain('--surge-index: 1');
  });

  it('tells the stylesheet how long the wave is', () => {
    const { container } = render(stage({ state: struck() }));

    expect(container.querySelector('.stage')?.getAttribute('style')).toContain('--surge-span: 10');
  });

  it('lights the chain under reduced motion too, so nothing goes missing', () => {
    setReducedMotion(true);
    const { container } = render(stage({ state: struck() }));

    expect(container.querySelector('.stage')).toHaveAttribute('data-surge', 'lit');
  });

  it("sweeps a quickened rung's ring against its halved cycle, not the raw one", () => {
    const state = fresh();
    state.overseers.minion = ['minion-goad'];
    state.gens.minion.progressMs = 1900;

    render(stage({ state, isUnlocked: onlyMinions() }));

    expect(screen.getByRole('progressbar', { name: 'Minions' })).toHaveAttribute(
      'aria-valuenow',
      '95',
    );
  });
});
