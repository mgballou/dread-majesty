import Decimal from 'break_eternity.js';
import { render } from '@testing-library/react';
import { CURRENT, CURRENT_COPY } from '@dm/content';
import { createState, type GameState } from '@dm/engine';
import { beforeEach, describe, expect, it } from 'vitest';
import { BuyRail } from './BuyRail.tsx';
import { Miscreants } from './Miscreants.tsx';
import { railPlan, type RailPlan } from './railPlan.ts';

let state: GameState;

beforeEach(() => {
  state = createState(CURRENT);
});

/**
 * Both panels the accent could land on, drawn against the same plan.
 *
 * The panels are separate components mounted in separate parts of the deck, and only
 * one of them is ever on screen at a time — but the plan itself is one ranking shared
 * by both, and `spendEmphasis` can only ever answer "best" once. Rendering both here
 * catches the case a single-panel test cannot: the plan naming a control that lives
 * in the panel nobody thought to check.
 */
function renderScreen(plan: RailPlan): Element[] {
  const { container: rail } = render(
    <BuyRail
      content={CURRENT}
      state={state}
      plan={plan}
      quantity={1}
      onQuantity={() => {}}
      isUnlocked={() => true}
      onPurchase={() => {}}
      copy={CURRENT_COPY}
    />,
  );
  const { container: miscreants } = render(
    <Miscreants
      content={CURRENT}
      state={state}
      plan={plan}
      onAppoint={() => {}}
      copy={CURRENT_COPY}
    />,
  );

  return [
    ...rail.querySelectorAll('.rail__row--best'),
    ...miscreants.querySelectorAll('.miscreant__post--best'),
  ];
}

function draw(quantity: 1 | 10 | 100 | 'max' = 1): RailPlan {
  return railPlan({ state, content: CURRENT, quantity, isUnlocked: () => true });
}

describe('exactly one control wears the accent, across both panels', () => {
  it('lands on the purchase the plan named, and nowhere in the miscreants panel', () => {
    state.resources.evil = new Decimal(2600);
    const plan = draw();

    const best = plan.best;
    if (best === null || best.kind !== 'purchase') throw new Error('expected a purchase to lead');

    const accented = renderScreen(plan);

    expect(accented).toHaveLength(1);
    expect(accented[0]).toHaveAttribute('data-tier', best.tierId);
  });

  it('lands on the automate post the plan named, and nowhere on the muster', () => {
    state.gens.minion.owned = new Decimal(400);
    state.resources.evil = new Decimal(1000);
    const plan = draw();

    const best = plan.best;
    if (best === null || best.kind !== 'appoint')
      throw new Error('expected an appointment to lead');
    expect(best.overseerId).toBe('minion-hand');

    const accented = renderScreen(plan);

    expect(accented).toHaveLength(1);
    expect(accented[0]).toHaveTextContent(CURRENT_COPY.overseer.names[best.overseerId]);
  });

  it('lands on a goad over an already-automated tier, not on the muster', () => {
    state.overseers.minion = ['minion-hand'];
    state.gens.minion.owned = new Decimal(2000);
    state.gens.minion.purchased = new Decimal(2000);
    state.resources.evil = new Decimal(2000);
    const plan = draw();

    const best = plan.best;
    if (best === null || best.kind !== 'appoint')
      throw new Error('expected an appointment to lead');
    expect(best.overseerId).toBe('minion-goad');

    const accented = renderScreen(plan);

    expect(accented).toHaveLength(1);
    expect(accented[0]).toHaveTextContent(CURRENT_COPY.overseer.names[best.overseerId]);
  });
});
