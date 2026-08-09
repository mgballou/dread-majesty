import Decimal from 'break_eternity.js';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CURRENT, CURRENT_COPY } from '@dm/content';
import { createState } from '@dm/engine';
import type { GameState } from '@dm/engine';
import { railPlan } from '../rail/railPlan.ts';
import { Malice } from './Malice.tsx';

function rich(): GameState {
  const state = createState(CURRENT);
  state.resources.evil = new Decimal('1e9');
  state.souls = new Decimal(2000);
  return state;
}

function show(state: GameState, onClimb = vi.fn(), onKeep = vi.fn()) {
  const plan = railPlan({
    state,
    content: CURRENT,
    quantity: 1,
    isUnlocked: () => true,
    held: { purchase: null, appoint: null, climb: null },
  });

  render(
    <Malice
      content={CURRENT}
      state={state}
      plan={plan}
      onClimb={onClimb}
      onKeep={onKeep}
      copy={CURRENT_COPY.malice}
    />,
  );

  return { onClimb, onKeep };
}

describe('the Malice panel', () => {
  it('shows a row for every ladder', () => {
    show(rich());

    expect(screen.getAllByRole('listitem')).toHaveLength(4);
  });

  it('names every ladder', () => {
    show(rich());

    expect(screen.getByText(CURRENT_COPY.malice.names.weight)).toBeInTheDocument();
  });

  it('climbs when the Evil action is pressed', async () => {
    const { onClimb } = show(rich());
    await userEvent.click(screen.getAllByRole('button', { name: /Climb/ })[0]!);

    expect(onClimb).toHaveBeenCalledTimes(1);
  });

  it('will not climb on an empty purse', () => {
    show(createState(CURRENT));

    expect(screen.getAllByRole('button', { name: /Climb/ })[0]!).toBeDisabled();
  });

  it('will not keep a rung that was never climbed', () => {
    show(rich());

    expect(screen.getAllByRole('button', { name: /Keep/ })[0]!).toBeDisabled();
  });

  it('keeps a rung once it is climbed and paid for', async () => {
    const state = rich();
    state.smiteRungs.weight = 1;
    const { onKeep } = show(state);

    const keeps = screen.getAllByRole('button', { name: /Keep/ });
    await userEvent.click(keeps.find((button) => !button.hasAttribute('disabled'))!);

    expect(onKeep).toHaveBeenCalledTimes(1);
  });

  it('lifts exactly one row', () => {
    show(rich());

    expect(screen.getAllByText(CURRENT_COPY.malice.lifted)).toHaveLength(1);
  });

  it('says a mastered ladder is mastered', () => {
    const state = rich();
    for (const upgrade of CURRENT.smite.upgrades) {
      state.smiteRungs[upgrade.id] = upgrade.rungs.length;
    }
    show(state);

    expect(screen.getAllByText(CURRENT_COPY.malice.maxed)).toHaveLength(4);
  });

  it('does not say mastered twice for a ladder that is fully kept as well', () => {
    const state = rich();
    for (const upgrade of CURRENT.smite.upgrades) {
      state.smiteRungs[upgrade.id] = upgrade.rungs.length;
      state.smiteKept[upgrade.id] = upgrade.rungs.length;
    }
    show(state);

    expect(screen.getAllByText(CURRENT_COPY.malice.maxed)).toHaveLength(4);
  });

  it('tells the ladders apart by name', () => {
    show(rich());

    expect(
      screen.getByRole('button', {
        name: new RegExp(`^Climb.*${CURRENT_COPY.malice.names.weight}`),
      }),
    ).toBeInTheDocument();
  });
});
