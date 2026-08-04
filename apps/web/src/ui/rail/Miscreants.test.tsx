import Decimal from 'break_eternity.js';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CURRENT, CURRENT_COPY } from '@dm/content';
import type { TierId } from '@dm/content';
import { createState, type GameState } from '@dm/engine';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatNumber } from '../format.ts';
import { Miscreants } from './Miscreants.tsx';
import { railPlan } from './railPlan.ts';

let state: GameState;

const OVERSEER = CURRENT_COPY.overseer;

const MINION_HAND_COST =
  CURRENT.tiers.find((tier) => tier.id === 'minion')?.overseers[0]?.cost ?? '0';

beforeEach(() => {
  state = createState(CURRENT);
});

function draw(isUnlocked: (id: TierId) => boolean = () => true) {
  const plan = railPlan({ state, content: CURRENT, quantity: 1, isUnlocked });
  const onAppoint = vi.fn();

  return {
    onAppoint,
    ...render(
      <Miscreants
        content={CURRENT}
        state={state}
        plan={plan}
        onAppoint={onAppoint}
        copy={CURRENT_COPY}
      />,
    ),
    user: userEvent.setup(),
  };
}

const TOTAL_POSTS = CURRENT.tiers.reduce((total, tier) => total + tier.overseers.length, 0);

describe('Miscreants', () => {
  it('lists every post on every tier', () => {
    draw();

    expect(screen.getAllByRole('listitem')).toHaveLength(TOTAL_POSTS);
  });

  it('groups the posts under their tier', () => {
    draw();

    expect(screen.getByRole('group', { name: 'Minions' })).toBeInTheDocument();
  });

  it('reports which post was chosen', async () => {
    state.resources.evil = new Decimal(1000);

    const { onAppoint, user } = draw();
    await user.click(
      screen.getByRole('button', { name: new RegExp(OVERSEER.names['minion-hand']) }),
    );
    await user.click(screen.getByRole('button', { name: OVERSEER.confirmAction }));

    expect(onAppoint).toHaveBeenCalledWith('minion-hand');
  });

  it('names the Overseer of each post', () => {
    draw();

    expect(screen.getByText(OVERSEER.names['minion-hand'])).toBeInTheDocument();
  });

  it('finally says who the holder is', () => {
    draw();

    expect(screen.getByText(OVERSEER.notes['minion-hand'])).toBeInTheDocument();
  });

  it('marks a post with a diamond, never a circle', () => {
    const { container } = draw();

    expect(container.querySelectorAll('circle')).toHaveLength(0);
  });

  it('draws one mark per post', () => {
    const { container } = draw();

    expect(container.querySelectorAll('.miscreant__mark')).toHaveLength(TOTAL_POSTS);
  });

  it('says outright that a post is beyond the purse', () => {
    draw();

    expect(screen.getAllByText(OVERSEER.beyond)).toHaveLength(TOTAL_POSTS);
  });

  it('will not open a post the purse cannot reach', () => {
    draw();

    expect(
      screen.getByRole('button', { name: new RegExp(OVERSEER.names['minion-hand']) }),
    ).toBeDisabled();
  });

  it('says what a post costs before it is opened', () => {
    draw();

    const cost = OVERSEER.cost(formatNumber(new Decimal(MINION_HAND_COST)));

    expect(screen.getByText(cost)).toBeInTheDocument();
  });

  it('opens a post the purse can reach', async () => {
    state.resources.evil = new Decimal(1000);

    const { user } = draw();
    await user.click(
      screen.getByRole('button', { name: new RegExp(OVERSEER.names['minion-hand']) }),
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('asks before it spends', async () => {
    state.resources.evil = new Decimal(1000);

    const { onAppoint, user } = draw();

    await user.click(
      screen.getByRole('button', { name: new RegExp(OVERSEER.names['minion-hand']) }),
    );

    expect(onAppoint).not.toHaveBeenCalled();
  });

  it('heads the question with the Overseer it means', async () => {
    state.resources.evil = new Decimal(1000);

    const { user } = draw();
    await user.click(
      screen.getByRole('button', { name: new RegExp(OVERSEER.names['minion-hand']) }),
    );

    expect(
      screen.getByText(OVERSEER.confirmTitle(OVERSEER.names['minion-hand'])),
    ).toBeInTheDocument();
  });

  it('appoints nobody when the question is refused', async () => {
    state.resources.evil = new Decimal(1000);

    const { onAppoint, user } = draw();
    await user.click(
      screen.getByRole('button', { name: new RegExp(OVERSEER.names['minion-hand']) }),
    );

    await user.click(screen.getByRole('button', { name: OVERSEER.cancel }));

    expect(onAppoint).not.toHaveBeenCalled();
  });

  it('puts the question away once it is answered', async () => {
    state.resources.evil = new Decimal(1000);

    const { user } = draw();
    await user.click(
      screen.getByRole('button', { name: new RegExp(OVERSEER.names['minion-hand']) }),
    );

    await user.click(screen.getByRole('button', { name: OVERSEER.cancel }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('says outright that a post is filled', () => {
    state.overseers.minion = ['minion-hand'];

    draw();

    expect(screen.getByText(OVERSEER.filled)).toBeInTheDocument();
  });

  it('will not reopen a post already filled', () => {
    state.overseers.minion = ['minion-hand'];

    draw();

    expect(
      screen.getByRole('button', { name: new RegExp(OVERSEER.names['minion-hand']) }),
    ).toBeDisabled();
  });

  it('still shows a post for a rung the player has not reached', () => {
    draw((id) => id === 'minion');

    expect(screen.getByText(OVERSEER.names['fortress-hand'])).toBeInTheDocument();
  });

  it('lifts the appointment when it is the best spend going', () => {
    state.gens.minion.owned = new Decimal(400);
    state.resources.evil = new Decimal(1000);

    const { container } = draw();

    expect(container.querySelectorAll('.miscreant__post--best')).toHaveLength(1);
  });

  it('says in words that the lifted post is the advised spend, never tone alone', () => {
    state.gens.minion.owned = new Decimal(400);
    state.resources.evil = new Decimal(1000);

    draw();

    expect(screen.getByText(CURRENT_COPY.rail.best)).toBeInTheDocument();
  });

  it('lifts nothing when the best spend is a purchase', () => {
    state.resources.evil = new Decimal(2600);

    const { container } = draw();

    expect(container.querySelectorAll('.miscreant__post--best')).toHaveLength(0);
  });

  it('states what a post does on its row', () => {
    draw();

    expect(
      screen.getByRole('button', { name: new RegExp(OVERSEER.names['minion-hand']) }).textContent,
    ).toContain(OVERSEER.effect.automate);
  });

  it('states the factor on a quickening post\'s row', () => {
    draw();

    expect(
      screen.getByRole('button', { name: new RegExp(OVERSEER.names['minion-goad']) }).textContent,
    ).toContain(OVERSEER.effect.quicken('2'));
  });

  it('states what a post does in the confirmation sheet too', async () => {
    state.resources.evil = new Decimal(1000);

    const { user } = draw();
    await user.click(
      screen.getByRole('button', { name: new RegExp(OVERSEER.names['minion-hand']) }),
    );

    expect(
      screen.getByRole('dialog').textContent?.includes(OVERSEER.effect.automate),
    ).toBe(true);
  });
});
