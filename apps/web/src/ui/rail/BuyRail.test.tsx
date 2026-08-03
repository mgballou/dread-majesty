import Decimal from 'break_eternity.js';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CURRENT, CURRENT_COPY } from '@dm/content';
import type { TierId } from '@dm/content';
import { bulkCost, createState, overseerCost, type GameState } from '@dm/engine';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setReducedMotion } from '../../../test/setup.ts';
import { formatNumber } from '../format.ts';
import { BuyRail } from './BuyRail.tsx';

let state: GameState;

const TEN_AT_A_TIME = CURRENT_COPY.rail.quantityOption('10');

beforeEach(() => {
  localStorage.clear();
  state = createState(CURRENT);
});

function buyName(tierId: TierId, count: number): string {
  const tier = CURRENT.tiers.find((candidate) => candidate.id === tierId)!;
  const cost = bulkCost(state, CURRENT, tierId, count) ?? new Decimal(0);

  return CURRENT_COPY.rail.buy({
    count: String(count),
    tier: count === 1 ? tier.name : tier.plural,
    cost: CURRENT_COPY.rail.cost(formatNumber(cost)),
  });
}

function appointName(tierId: TierId): string {
  const name = CURRENT_COPY.overseer.appoint(CURRENT_COPY.overseer.names[tierId]);
  const cost = CURRENT_COPY.overseer.cost(formatNumber(overseerCost(CURRENT, tierId)!));

  return `${name} ${cost}`;
}

function draw(
  isUnlocked: (id: TierId) => boolean = () => true,
  onPurchase = vi.fn(),
  onAppoint = vi.fn(),
) {
  return {
    onPurchase,
    onAppoint,
    ...render(
      <BuyRail
        content={CURRENT}
        state={state}
        version={1}
        isUnlocked={isUnlocked}
        onPurchase={onPurchase}
        onAppoint={onAppoint}
        copy={CURRENT_COPY}
      />,
    ),
  };
}

describe('BuyRail', () => {
  it('names the panel out of the copy module', () => {
    draw();

    expect(screen.getByText(CURRENT_COPY.rail.title)).toBeInTheDocument();
  });

  it('names the run of generators', () => {
    draw();

    expect(screen.getByRole('list', { name: CURRENT_COPY.rail.list })).toBeInTheDocument();
  });

  it('says how many of a tier are held', () => {
    draw();

    expect(screen.getByText(CURRENT_COPY.rail.held('1'))).toBeInTheDocument();
  });

  it('names the cycle bar after the tier it belongs to', () => {
    draw();

    const minion = CURRENT.tiers.find((tier) => tier.id === 'minion')!;

    expect(
      screen.getByRole('progressbar', { name: CURRENT_COPY.rail.cycle(minion.name) }),
    ).toBeInTheDocument();
  });

  it('says outright that a row is affordable, never tone alone', () => {
    state.resources.evil = new Decimal(2600);

    draw();

    expect(screen.getAllByText(CURRENT_COPY.rail.affordable).length).toBeGreaterThan(0);
  });

  it('lifts exactly one spend to the accent', () => {
    state.resources.evil = new Decimal(2600);

    const { container } = draw();

    expect(container.querySelectorAll('.button--primary')).toHaveLength(1);
  });

  it('accents nothing when the purse cannot reach any of it', () => {
    const { container } = draw();

    expect(container.querySelectorAll('.button--primary')).toHaveLength(0);
  });

  it('says in words which row is the best value, never tone alone', () => {
    state.resources.evil = new Decimal(2600);

    draw();

    expect(screen.getByText(CURRENT_COPY.rail.best)).toBeInTheDocument();
  });

  it('names what to save toward when nothing is affordable', () => {
    draw();

    expect(screen.getByText(CURRENT_COPY.rail.saving)).toBeInTheDocument();
  });

  it('disables a row the player cannot afford', () => {
    state.resources.evil = new Decimal(100);

    draw();

    expect(screen.getByRole('button', { name: buyName('warren', 1) })).toBeDisabled();
  });

  it('says how far short an unaffordable row is', () => {
    state.resources.evil = new Decimal(100);

    draw();

    expect(screen.getByText(CURRENT_COPY.rail.shortfall('2.4K'))).toBeInTheDocument();
  });

  it('keeps every other control on the rail at secondary weight', () => {
    state.resources.evil = new Decimal(2600);

    const { container } = draw();

    expect(container.querySelectorAll('.button:not(.button--primary)')).toHaveLength(7);
  });

  it('shows only the tiers the player has met, and one row beyond them', () => {
    draw((id) => id === 'minion');

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('names the tier beyond the last one met', () => {
    draw((id) => id === 'minion');

    expect(screen.getByText(CURRENT_COPY.rail.upcomingTitle)).toBeInTheDocument();
  });

  it('says what the tier beyond the last one met costs', () => {
    draw((id) => id === 'minion');

    const warren = CURRENT.tiers.find((tier) => tier.id === 'warren')!;
    const line = CURRENT_COPY.rail.upcoming({
      tier: warren.plural,
      cost: CURRENT_COPY.rail.cost(formatNumber(new Decimal(warren.baseCost))),
    });

    expect(screen.getByText(line)).toBeInTheDocument();
  });

  it('offers nothing to buy on the row beyond the last tier met', () => {
    state.resources.evil = new Decimal('1e12');

    draw((id) => id === 'minion');

    expect(screen.queryByRole('button', { name: buyName('warren', 1) })).not.toBeInTheDocument();
  });

  it('leaves no blank slots for the tiers further up the chain', () => {
    draw((id) => id === 'minion');

    expect(screen.queryByText(CURRENT_COPY.rail.locked)).not.toBeInTheDocument();
  });

  it('puts the next milestone and its distance on every row', () => {
    draw();

    const minion = CURRENT.tiers.find((tier) => tier.id === 'minion')!;
    const distance = CURRENT_COPY.milestone.next({
      remaining: '24',
      plural: minion.plural,
      multiplier: '×2',
      threshold: '25',
    });

    expect(screen.getByText(distance)).toBeInTheDocument();
  });

  it('says so in its own words when a tier is past every milestone', () => {
    state.gens.minion.owned = new Decimal('1e25');

    draw();

    expect(screen.getByText(new RegExp(CURRENT_COPY.milestone.done))).toBeInTheDocument();
  });

  it('fires the purchase callback with the tier and the chosen quantity', async () => {
    state.resources.evil = new Decimal(2600);

    const { onPurchase } = draw();
    await userEvent.click(screen.getByRole('button', { name: buyName('minion', 1) }));

    expect(onPurchase).toHaveBeenCalledWith('minion', 1);
  });

  it('carries the chosen quantity into the callback', async () => {
    state.resources.evil = new Decimal(2600);

    const { onPurchase } = draw();
    await userEvent.click(screen.getByRole('radio', { name: TEN_AT_A_TIME }));
    await userEvent.click(screen.getByRole('button', { name: buyName('minion', 10) }));

    expect(onPurchase).toHaveBeenCalledWith('minion', 10);
  });

  it('changes the price on the row when the quantity changes', async () => {
    state.resources.evil = new Decimal(2600);
    const ten = buyName('minion', 10);

    draw();
    await userEvent.click(screen.getByRole('radio', { name: TEN_AT_A_TIME }));

    expect(screen.getByRole('button', { name: ten })).toBeInTheDocument();
  });

  it('remembers the quantity across a remount', async () => {
    const hundred = CURRENT_COPY.rail.quantityOption('100');
    const first = draw();
    await userEvent.click(screen.getByRole('radio', { name: hundred }));
    first.unmount();

    draw();

    expect(screen.getByRole('radio', { name: hundred })).toBeChecked();
  });

  it('never spends the accent on the quantity setting', async () => {
    state.resources.evil = new Decimal(2600);

    const { container } = draw();
    await userEvent.click(screen.getByRole('radio', { name: TEN_AT_A_TIME }));

    expect(container.querySelectorAll('.button--primary')).toHaveLength(1);
  });

  it('sweeps the cycle between slices under normal motion', () => {
    draw();

    expect(screen.getAllByRole('progressbar')[0]).toHaveAttribute('data-motion', 'full');
  });

  it('jumps the cycle slice to slice under reduced motion', () => {
    setReducedMotion(true);

    draw();

    expect(screen.getAllByRole('progressbar')[0]).toHaveAttribute('data-motion', 'reduced');
  });

  it('still shows the cycle under reduced motion', () => {
    setReducedMotion(true);

    draw();

    expect(screen.getAllByRole('progressbar')).toHaveLength(4);
  });

  it('says outright that nobody oversees a tier', () => {
    draw();

    expect(screen.getAllByText(CURRENT_COPY.overseer.manual)).toHaveLength(4);
  });

  it('offers the appointment on a tier nobody oversees', () => {
    draw();

    expect(screen.getByRole('button', { name: appointName('minion') })).toBeInTheDocument();
  });

  it('disables an appointment the purse cannot reach', () => {
    draw();

    expect(screen.getByRole('button', { name: appointName('minion') })).toBeDisabled();
  });

  it('fires the appointment callback with the tier', async () => {
    state.resources.evil = new Decimal(2600);

    const { onAppoint } = draw();
    await userEvent.click(screen.getByRole('button', { name: appointName('minion') }));

    expect(onAppoint).toHaveBeenCalledWith('minion');
  });

  it('offers no appointment once the post is filled', () => {
    state.overseers.minion = true;

    draw();

    expect(screen.queryByRole('button', { name: appointName('minion') })).not.toBeInTheDocument();
  });

  it('names the Overseer already in post', () => {
    state.overseers.minion = true;

    draw();

    expect(
      screen.getByText(CURRENT_COPY.overseer.appointed(CURRENT_COPY.overseer.names.minion)),
    ).toBeInTheDocument();
  });

  it('says outright that an overseen tier runs without the player', () => {
    state.overseers.minion = true;

    draw();

    expect(screen.getByText(CURRENT_COPY.overseer.automatic)).toBeInTheDocument();
  });

  it('lets an appointment take the accent when it is the best spend going', () => {
    state.gens.minion.owned = new Decimal(400);
    state.resources.evil = new Decimal(1000);

    draw();

    expect(screen.getByRole('button', { name: appointName('minion') })).toHaveClass(
      'button--primary',
    );
  });

  it('still lifts exactly one spend when that spend is an appointment', () => {
    state.gens.minion.owned = new Decimal(400);
    state.resources.evil = new Decimal(1000);

    const { container } = draw();

    expect(container.querySelectorAll('.button--primary')).toHaveLength(1);
  });

  it('says in words that the lifted spend is the appointment, never tone alone', () => {
    state.gens.minion.owned = new Decimal(400);
    state.resources.evil = new Decimal(1000);

    draw();

    expect(screen.getByText(CURRENT_COPY.overseer.title)).toBeInTheDocument();
  });
});
