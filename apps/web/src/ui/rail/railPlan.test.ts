import Decimal from 'break_eternity.js';
import { CURRENT } from '@dm/content';
import type { TierId } from '@dm/content';
import { createState, type GameState } from '@dm/engine';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  railPlan,
  resolveCount,
  type RailAppointment,
  type RailPlan,
  type RailPurchase,
} from './railPlan.ts';

const all = (): boolean => true;

let state: GameState;

beforeEach(() => {
  state = createState(CURRENT);
});

function plan(
  quantity: 1 | 10 | 100 | 'max' = 1,
  isUnlocked: (id: TierId) => boolean = all,
): RailPlan {
  return railPlan({ state, content: CURRENT, quantity, isUnlocked });
}

function purchases(from: RailPlan): RailPurchase[] {
  return from.options.filter((option): option is RailPurchase => option.kind === 'purchase');
}

function appointments(from: RailPlan): RailAppointment[] {
  return from.options.filter((option): option is RailAppointment => option.kind === 'appoint');
}

function appointAll(): void {
  for (const tier of CURRENT.tiers) {
    const automator = tier.overseers.find((post) => post.effect.kind === 'automate');
    if (automator) state.overseers[tier.id] = [automator.id];
  }
}

describe('railPlan', () => {
  it('lifts the purchase that returns most per Evil spent, not the dearest affordable one', () => {
    state.resources.evil = new Decimal(2600);

    expect(plan().best?.tierId).toBe('minion');
  });

  it('says which kind of spend it lifted, not only which tier', () => {
    state.resources.evil = new Decimal(2600);

    expect(plan().best?.kind).toBe('purchase');
  });

  it('values a Warren by what reaches the bottom of the chain, not by its own yield', () => {
    state.resources.evil = new Decimal(2600);

    const warren = purchases(plan()).find((option) => option.tierId === 'warren');

    expect(warren?.gain.gt(0)).toBe(true);
  });

  it('prefers the Warren once enough Minions make its Minions worth having', () => {
    appointAll();
    state.resources.evil = new Decimal('1e20');
    state.gens.minion.owned = new Decimal(400);
    state.gens.minion.purchased = new Decimal(400);

    expect(plan().best?.tierId).toBe('warren');
  });

  it('scores a buy that crosses a milestone above one that does not', () => {
    state.resources.evil = new Decimal('1e9');
    state.gens.minion.owned = new Decimal(24);
    const crossing = purchases(plan()).find((option) => option.tierId === 'minion');

    state.gens.minion.owned = new Decimal(23);
    const plain = purchases(plan()).find((option) => option.tierId === 'minion');

    expect(crossing?.score.gt(plain?.score ?? 0)).toBe(true);
  });

  it('accents nothing when the purse cannot reach any of it', () => {
    expect(plan().best).toBeNull();
  });

  it('names something to save toward when nothing is affordable', () => {
    expect(plan().saving?.tierId).toBe('minion');
  });

  it('names nothing to save toward while a purchase is available', () => {
    state.resources.evil = new Decimal(2600);

    expect(plan().saving).toBeNull();
  });

  it('leaves a tier the player has not met out of the options entirely', () => {
    state.resources.evil = new Decimal('1e12');

    const ids = plan(1, (id) => id === 'minion').options.map((option) => option.tierId);

    expect(new Set(ids)).toEqual(new Set(['minion']));
  });

  it('marks an option the player cannot afford as unaffordable rather than dropping it', () => {
    state.resources.evil = new Decimal(100);

    const warren = purchases(plan()).find((option) => option.tierId === 'warren');

    expect(warren?.affordable).toBe(false);
  });

  it('offers an appointment on every tier nobody oversees', () => {
    const ids = appointments(plan()).map((option) => option.tierId);

    expect(ids).toEqual(['throne', 'fortress', 'legion', 'warren', 'minion']);
  });

  it('offers no appointment on a post already filled', () => {
    state.overseers.minion = ['minion-hand'];

    const ids = appointments(plan()).map((option) => option.tierId);

    expect(ids).not.toContain('minion');
  });

  it('prices an appointment at the Overseer cost from the content', () => {
    const minion = appointments(plan()).find((option) => option.tierId === 'minion');

    expect(minion?.cost.eq(1000)).toBe(true);
  });

  it('values an appointment at the whole tier, because an idle tier makes nothing', () => {
    state.gens.minion.owned = new Decimal(100);

    const minion = appointments(plan()).find((option) => option.tierId === 'minion');
    const owned = purchases(plan()).find((option) => option.tierId === 'minion');

    expect(minion?.gain.gt(owned?.gain ?? 0)).toBe(true);
  });

  it('values an appointment at nothing while the tier holds nothing', () => {
    const warren = appointments(plan()).find((option) => option.tierId === 'warren');

    expect(warren?.gain.eq(0)).toBe(true);
  });

  it('lifts an appointment when hiring beats every purchase on the same measure', () => {
    state.gens.minion.owned = new Decimal(400);
    state.resources.evil = new Decimal(1000);

    expect(plan().best?.kind).toBe('appoint');
  });

  it('lifts the tier whose Overseer it means', () => {
    state.gens.minion.owned = new Decimal(400);
    state.resources.evil = new Decimal(1000);

    expect(plan().best?.tierId).toBe('minion');
  });

  it('marks an appointment the purse cannot reach as unaffordable', () => {
    const minion = appointments(plan()).find((option) => option.tierId === 'minion');

    expect(minion?.affordable).toBe(false);
  });

  it('resolves a max buy against the purse', () => {
    state.resources.evil = new Decimal(2000);

    const count = resolveCount({ state, content: CURRENT, tierId: 'minion', quantity: 'max' });

    expect(count).toBeGreaterThan(1);
  });

  it('resolves a max buy to one when nothing is affordable, so the price still shows', () => {
    const count = resolveCount({ state, content: CURRENT, tierId: 'minion', quantity: 'max' });

    expect(count).toBe(1);
  });
});
