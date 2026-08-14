import Decimal from 'break_eternity.js';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CURRENT, CURRENT_COPY } from '@dm/content';
import type { TierId } from '@dm/content';
import { bulkCost, createState, type GameState } from '@dm/engine';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GatedControl } from '../../game/onboarding.ts';
import { setReducedMotion } from '../../../test/setup.ts';
import { formatNumber } from '../format.ts';
import { BuyRail } from './BuyRail.tsx';
import { railPlan } from './railPlan.ts';
import type { BuyQuantity } from './quantity.ts';

let state: GameState;

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

/**
 * Matches a buy label whether or not it carries the lifted row's trailing words.
 *
 * `buyName` gives the sentence a row says by default. The lifted row says more —
 * `copy.rail.lifted` on the end — so a test that does not care which row is lifted
 * matches on the start of the name rather than all of it.
 */
function buyNameStart(tierId: TierId, count: number): RegExp {
  return new RegExp(`^${buyName(tierId, count).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
}

function draw(
  isUnlocked: (id: TierId) => boolean = () => true,
  quantity: BuyQuantity = 1,
  isGated?: (control: GatedControl) => boolean,
) {
  const plan = railPlan({
    state,
    content: CURRENT,
    quantity,
    isUnlocked,
    held: { purchase: null, appoint: null, climb: null },
  });
  const onPurchase = vi.fn();
  const onQuantity = vi.fn();

  return {
    onPurchase,
    onQuantity,
    ...render(
      <BuyRail
        content={CURRENT}
        state={state}
        plan={plan}
        quantity={quantity}
        onQuantity={onQuantity}
        isUnlocked={isUnlocked}
        {...(isGated === undefined ? {} : { isGated })}
        onPurchase={onPurchase}
        copy={CURRENT_COPY}
      />,
    ),
  };
}

describe('BuyRail', () => {
  it('names the run of generators', () => {
    draw();

    expect(screen.getByRole('list', { name: CURRENT_COPY.rail.list })).toBeInTheDocument();
  });

  it('says how many of a tier are held', () => {
    draw();

    expect(screen.getByText(CURRENT_COPY.rail.held('1'))).toBeInTheDocument();
  });

  it('enables an affordable row without saying so in words', () => {
    state.resources.evil = new Decimal(5200);

    draw();

    expect(screen.getByRole('button', { name: buyNameStart('minion', 1) })).not.toBeDisabled();
  });

  it('leaves the shortfall silent once a row is affordable', () => {
    state.resources.evil = new Decimal(5200);

    const { container } = draw();

    expect(container.querySelector('[data-tier="minion"] .rail__shortfall')).toHaveTextContent('');
  });

  it('lifts exactly one spend to the accent', () => {
    state.resources.evil = new Decimal(5200);

    const { container } = draw();

    expect(container.querySelectorAll('.button--primary')).toHaveLength(1);
  });

  it('accents nothing when the purse cannot reach any of it', () => {
    const { container } = draw();

    expect(container.querySelectorAll('.button--primary')).toHaveLength(0);
  });

  it('names the lifted row as lifted, for anyone reading by ear', () => {
    state.resources.evil = new Decimal(5200);

    draw();

    expect(
      screen.getByRole('button', { name: new RegExp(CURRENT_COPY.rail.lifted) }),
    ).toBeInTheDocument();
  });

  it('names what to save toward when nothing is affordable', () => {
    draw();

    expect(screen.getByText(CURRENT_COPY.rail.saving)).toBeInTheDocument();
  });

  it('disables a row the player cannot afford', () => {
    state.resources.evil = new Decimal(200);

    draw();

    expect(screen.getByRole('button', { name: buyName('warren', 1) })).toBeDisabled();
  });

  it('says how far short an unaffordable row is', () => {
    state.resources.evil = new Decimal(200);

    draw();

    const short = formatNumber(
      (bulkCost(state, CURRENT, 'warren', 1) ?? new Decimal(0)).sub(state.resources.evil),
    );

    expect(screen.getByText(CURRENT_COPY.rail.shortfall(short))).toBeInTheDocument();
  });

  it('keeps every other control on the rail at secondary weight', () => {
    state.resources.evil = new Decimal(5200);

    const { container } = draw();

    expect(container.querySelectorAll('.button:not(.button--primary)')).toHaveLength(4);
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
    const label = CURRENT_COPY.milestone.bar({
      remaining: '24',
      plural: minion.plural,
      multiplier: '×2',
      threshold: '25',
    });

    expect(screen.getByRole('progressbar', { name: label })).toBeInTheDocument();
  });

  it('says so in its own words when a tier is past every milestone', () => {
    state.gens.minion.owned = new Decimal('1e25');

    draw();

    const minion = CURRENT.tiers.find((tier) => tier.id === 'minion')!;

    expect(
      screen.getByRole('progressbar', { name: CURRENT_COPY.milestone.barDone(minion.plural) }),
    ).toBeInTheDocument();
  });

  it('fills the bar with progress through the current milestone band', () => {
    state.gens.minion.owned = new Decimal(30);
    draw();

    const bar = screen.getByRole('progressbar', { name: /more Minions for/ });

    expect(bar).toHaveAttribute('aria-valuenow', '20');
  });

  it('fills the bar past the last milestone, where there is no band left', () => {
    state.gens.minion.owned = new Decimal('1e25');

    draw();

    const minion = CURRENT.tiers.find((tier) => tier.id === 'minion')!;
    const bar = screen.getByRole('progressbar', {
      name: CURRENT_COPY.milestone.barDone(minion.plural),
    });

    expect(bar).toHaveAttribute('aria-valuenow', '100');
  });

  it('fires the purchase callback with the tier and the chosen quantity', async () => {
    state.resources.evil = new Decimal(5200);

    const { onPurchase } = draw();
    await userEvent.click(screen.getByRole('button', { name: buyNameStart('minion', 1) }));

    expect(onPurchase).toHaveBeenCalledWith('minion', 1);
  });

  it('carries the chosen quantity into the callback', async () => {
    state.resources.evil = new Decimal(5200);

    const { onPurchase } = draw(() => true, 10);
    await userEvent.click(screen.getByRole('button', { name: buyNameStart('minion', 10) }));

    expect(onPurchase).toHaveBeenCalledWith('minion', 10);
  });

  it('hands the chosen quantity up rather than keeping it', async () => {
    const { onQuantity } = draw();

    await userEvent.click(
      screen.getByRole('button', { name: new RegExp(`^${CURRENT_COPY.rail.quantity}`) }),
    );

    expect(onQuantity).toHaveBeenCalledWith(10);
  });

  it('never spends the accent on the quantity setting', async () => {
    state.resources.evil = new Decimal(5200);

    const { container } = draw();
    await userEvent.click(
      screen.getByRole('button', { name: new RegExp(`^${CURRENT_COPY.rail.quantity}`) }),
    );

    expect(container.querySelectorAll('.button--primary')).toHaveLength(1);
  });

  it('names the quantity setting where it sits, at the head of the list it governs', () => {
    draw();

    expect(screen.getByText(CURRENT_COPY.rail.quantity)).toBeInTheDocument();
  });

  it('sweeps the milestone bar between slices under normal motion', () => {
    draw();

    expect(screen.getAllByRole('progressbar')[0]).toHaveAttribute('data-motion', 'full');
  });

  it('jumps the milestone bar slice to slice under reduced motion', () => {
    setReducedMotion(true);

    draw();

    expect(screen.getAllByRole('progressbar')[0]).toHaveAttribute('data-motion', 'reduced');
  });

  it('still shows the milestone bar under reduced motion', () => {
    setReducedMotion(true);

    draw();

    expect(screen.getAllByRole('progressbar')).toHaveLength(5);
  });

  it('no longer says a word about nobody watching the place', () => {
    draw();

    expect(screen.queryByText(CURRENT_COPY.overseer.manual)).not.toBeInTheDocument();
  });

  it('offers no appointment, because appointments are not the muster', () => {
    state.resources.evil = new Decimal(5200);

    draw();

    const appoint = CURRENT_COPY.overseer.appoint(CURRENT_COPY.overseer.names['minion-hand']);

    expect(screen.queryByRole('button', { name: new RegExp(appoint) })).not.toBeInTheDocument();
  });

  it('does not flag a tier as appointed on its row', () => {
    state.gens.minion.owned = new Decimal(30);
    state.overseers.minion = ['minion-hand'];
    draw();

    expect(screen.queryByText(CURRENT_COPY.overseer.filled)).toBeNull();
  });

  it('still lifts its own best purchase even while an appointment scores higher', () => {
    state.gens.minion.owned = new Decimal(400);
    state.resources.evil = new Decimal(2000);

    const { container } = draw();

    expect(container.querySelectorAll('.button--primary')).toHaveLength(1);
  });

  it('still marks its own row as lifted even while an appointment scores higher', () => {
    state.gens.minion.owned = new Decimal(400);
    state.resources.evil = new Decimal(2000);

    const { container } = draw();

    expect(container.querySelectorAll('.rail__row--best')).toHaveLength(1);
  });

  it('says how many of a tier were bought when the cascade has made more', () => {
    state.gens.minion.purchased = new Decimal(12);
    state.gens.minion.owned = new Decimal(4000);

    draw();

    expect(screen.getByText(/12 bought/)).toBeInTheDocument();
  });

  it('says nothing about purchases when every unit was bought', () => {
    state.gens.minion.purchased = new Decimal(12);
    state.gens.minion.owned = new Decimal(12);

    draw();

    expect(screen.queryByText(/bought/)).not.toBeInTheDocument();
  });

  it('says which count the price follows when bred units outnumber bought ones', () => {
    state.gens.minion.owned = new Decimal(30);
    state.gens.minion.purchased = new Decimal(10);
    draw();

    expect(screen.getByText(CURRENT_COPY.rail.bought('10'))).toBeInTheDocument();
  });

  it("states a swollen row's doubled yield, not the raw one", () => {
    state.overseers.minion = ['minion-glut'];

    const { container } = draw();

    const row = container.querySelector('[data-tier="minion"] .rail__line');

    expect(row).toHaveTextContent(/^10 Evil every/);
  });

  it('draws what the tier makes rather than naming it twice', () => {
    const { container } = draw();

    const row = container.querySelector('[data-tier="minion"] .rail__line');

    expect(row?.querySelector('.art')).not.toBeNull();
  });

  it('keeps the noun for anyone reading by ear', () => {
    const { container } = draw();

    const row = container.querySelector('[data-tier="minion"] .rail__line');

    expect(row).toHaveTextContent(/Evil/);
  });

  it('leaves the noun in the accessibility tree rather than hiding it from it', () => {
    const { container } = draw();

    const noun = container.querySelector('[data-tier="minion"] .rail__made');

    expect(noun).not.toHaveAttribute('aria-hidden');
  });

  describe('the onboarding gate', () => {
    function gateAllButMinionBuy(control: GatedControl): boolean {
      return !(control.kind === 'buy' && control.tierId === 'minion');
    }

    it('leaves the named row live', () => {
      state.resources.evil = new Decimal(5200);

      draw(() => true, 1, gateAllButMinionBuy);

      expect(screen.getByRole('button', { name: buyNameStart('minion', 1) })).not.toBeDisabled();
    });

    it('disables a row the gate does not name', () => {
      state.resources.evil = new Decimal(5200);

      draw(() => true, 1, gateAllButMinionBuy);

      expect(screen.getByRole('button', { name: buyNameStart('warren', 1) })).toBeDisabled();
    });

    it('leaves every row live when nothing is gated', () => {
      state.resources.evil = new Decimal(5200);

      draw();

      expect(screen.getByRole('button', { name: buyNameStart('warren', 1) })).not.toBeDisabled();
    });
  });
});
