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
 * The panels are separate components mounted in separate parts of the deck, and each
 * now keeps its own lifted spend, so a test against one panel alone cannot show what
 * the other is doing at the same time. Rendering both here catches that: a purchase
 * lifted on the muster and an appointment lifted in the miscreants, together, from one
 * plan.
 */
function renderScreen(plan: RailPlan): { rail: Element; miscreants: Element } {
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

  return { rail, miscreants };
}

function draw(): RailPlan {
  return railPlan({
    state,
    content: CURRENT,
    quantity: 1,
    isUnlocked: () => true,
    held: { purchase: null, appoint: null, climb: null },
  });
}

describe('each panel wears exactly one accent, and never the other panel', () => {
  it('lifts one purchase on the muster', () => {
    state.resources.evil = new Decimal(5200);
    const { rail } = renderScreen(draw());
    expect(rail.querySelectorAll('.rail__row--best')).toHaveLength(1);
  });

  it('lifts one post in the miscreants at the same time', () => {
    state.gens.minion.owned = new Decimal(400);
    state.resources.evil = new Decimal(2000);
    const { miscreants } = renderScreen(draw());
    expect(miscreants.querySelectorAll('.miscreant__post--best')).toHaveLength(1);
  });

  it('lifts a purchase even while an appointment outscores it', () => {
    state.gens.minion.owned = new Decimal(400);
    state.resources.evil = new Decimal(2000);
    const { rail } = renderScreen(draw());
    expect(rail.querySelectorAll('.rail__row--best')).toHaveLength(1);
  });

  it('lifts nothing on the muster with an empty purse', () => {
    state.resources.evil = new Decimal(0);
    const { rail } = renderScreen(draw());
    expect(rail.querySelectorAll('.rail__row--best')).toHaveLength(0);
  });

  it('names the lifted purchase as lifted, for anyone reading by ear', () => {
    state.resources.evil = new Decimal(5200);
    const { rail } = renderScreen(draw());
    const lifted = rail.querySelector('.rail__row--best button');
    expect(lifted?.getAttribute('aria-label')).toContain(CURRENT_COPY.rail.lifted);
  });

  it('puts no flag beside the name of the lifted row', () => {
    state.resources.evil = new Decimal(5200);
    const { rail } = renderScreen(draw());
    expect(rail.querySelector('.rail__row--best .rail__flag')).toBeNull();
  });

  it('puts no flag beside the name of the lifted post', () => {
    state.gens.minion.owned = new Decimal(400);
    state.resources.evil = new Decimal(2000);
    const { miscreants } = renderScreen(draw());
    expect(miscreants.querySelector('.miscreant__post--best .miscreant__flag')).toBeNull();
  });
});
