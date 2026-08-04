import Decimal from 'break_eternity.js';
import { CURRENT } from '@dm/content';
import type { TierId } from '@dm/content';
import { createState, type GameState } from '@dm/engine';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  railPlan,
  resolveCount,
  type HeldKeys,
  type RailAppointment,
  type RailPlan,
  type RailPurchase,
} from './railPlan.ts';

const all = (): boolean => true;
const none: HeldKeys = { purchase: null, appoint: null };

const MINION_HAND_COST =
  CURRENT.tiers.find((tier) => tier.id === 'minion')?.overseers[0]?.cost ?? '0';

let state: GameState;

beforeEach(() => {
  state = createState(CURRENT);
});

function plan(
  quantity: 1 | 10 | 100 | 'max' = 1,
  isUnlocked: (id: TierId) => boolean = all,
  held: HeldKeys = none,
): RailPlan {
  return railPlan({ state, content: CURRENT, quantity, isUnlocked, held });
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
    state.gens.warren.owned = new Decimal(12);
    state.gens.warren.purchased = new Decimal(12);
    state.resources.evil = new Decimal(20000);

    expect(plan().best.purchase?.tierId).toBe('minion');
  });

  it('keeps the Minion the better buy while the Warrens that will retire it are still arriving', () => {
    state.gens.warren.owned = new Decimal(20);
    state.gens.warren.purchased = new Decimal(20);
    state.gens.minion.owned = new Decimal(100);
    state.gens.minion.purchased = new Decimal(100);
    state.resources.evil = new Decimal('1e6');

    const bestPurchase = purchases(plan()).reduce<RailPurchase | null>(
      (best, option) => (best === null || option.score.gt(best.score) ? option : best),
      null,
    );

    expect(bestPurchase?.tierId).toBe('minion');
  });

  it('lifts a purchase when nothing is owned to appoint anybody over', () => {
    state.resources.evil = new Decimal(2600);

    expect(plan().best.purchase?.kind).toBe('purchase');
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

    const bestPurchase = purchases(plan()).reduce<RailPurchase | null>(
      (best, option) => (best === null || option.score.gt(best.score) ? option : best),
      null,
    );

    expect(bestPurchase?.tierId).toBe('warren');
  });

  it('scores a buy that crosses a milestone above one that does not', () => {
    state.resources.evil = new Decimal('1e9');
    state.gens.minion.owned = new Decimal(24);
    const crossing = purchases(plan()).find((option) => option.tierId === 'minion');

    state.gens.minion.owned = new Decimal(23);
    const plain = purchases(plan()).find((option) => option.tierId === 'minion');

    expect(crossing?.score.gt(plain?.score ?? 0)).toBe(true);
  });

  it('accents no purchase when the purse cannot reach any of it', () => {
    expect(plan().best.purchase).toBeNull();
  });

  it('accents no appointment when the purse cannot reach any of it', () => {
    expect(plan().best.appoint).toBeNull();
  });

  it('names something to save toward when nothing is affordable', () => {
    state.gens.warren.owned = new Decimal(12);
    state.gens.warren.purchased = new Decimal(12);

    expect(plan().saving.purchase?.tierId).toBe('minion');
  });

  it('names nothing to save toward while a purchase is available', () => {
    state.resources.evil = new Decimal(2600);

    expect(plan().saving.purchase).toBeNull();
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

  it('offers all three posts on every tier nobody oversees', () => {
    const ids = appointments(plan()).map((option) => option.overseerId);

    expect(ids).toEqual([
      'throne-hand',
      'throne-goad',
      'throne-glut',
      'fortress-hand',
      'fortress-goad',
      'fortress-glut',
      'legion-hand',
      'legion-goad',
      'legion-glut',
      'warren-hand',
      'warren-goad',
      'warren-glut',
      'minion-hand',
      'minion-goad',
      'minion-glut',
    ]);
  });

  it('offers every unfilled post on a met tier', () => {
    appointAll();
    state.overseers.minion = [];

    const ids = appointments(plan())
      .filter((option) => option.tierId === 'minion')
      .map((option) => option.overseerId);

    expect(ids).toEqual(['minion-hand', 'minion-goad', 'minion-glut']);
  });

  it('drops a post once it is filled', () => {
    state.overseers.minion = ['minion-hand'];

    const ids = appointments(plan()).map((option) => option.overseerId);

    expect(ids).not.toContain('minion-hand');
  });

  it('prices an appointment at the Overseer cost from the content', () => {
    const minion = appointments(plan()).find((option) => option.tierId === 'minion');

    expect(minion?.cost.eq(MINION_HAND_COST)).toBe(true);
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

  it('lifts an appointment on its own panel when hiring beats every purchase', () => {
    state.gens.minion.owned = new Decimal(400);
    state.resources.evil = new Decimal(1000);

    expect(plan().best.appoint?.kind).toBe('appoint');
  });

  it('lifts the tier whose Overseer it means', () => {
    state.gens.minion.owned = new Decimal(400);
    state.resources.evil = new Decimal(1000);

    expect(plan().best.appoint?.tierId).toBe('minion');
  });

  it('marks an appointment the purse cannot reach as unaffordable', () => {
    const minion = appointments(plan()).find((option) => option.tierId === 'minion');

    expect(minion?.affordable).toBe(false);
  });

  it('values a goad on a tier that is already turning', () => {
    appointAll();
    state.gens.minion.owned = new Decimal(50);

    const goad = appointments(plan()).find((option) => option.overseerId === 'minion-goad');

    expect(goad?.gain.gt(0)).toBe(true);
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

describe('each panel gets its own best', () => {
  it('lifts a purchase even while an appointment outscores it', () => {
    state.gens.minion.owned = new Decimal(400);
    state.resources.evil = new Decimal(1000);

    expect(plan().best.purchase).not.toBeNull();
  });

  it('lifts the appointment at the same time', () => {
    state.gens.minion.owned = new Decimal(400);
    state.resources.evil = new Decimal(1000);

    expect(plan().best.appoint?.overseerId).toBe('minion-hand');
  });

  it('lifts nothing in a panel with nothing affordable', () => {
    state.resources.evil = new Decimal(0);

    expect(plan().best.purchase).toBeNull();
  });
});

describe('the accent holds still', () => {
  it('keeps the held purchase when a challenger only just beats it', () => {
    state.gens.warren.owned = new Decimal(1);
    state.gens.warren.purchased = new Decimal(1);
    state.resources.evil = new Decimal(2600);
    const held: HeldKeys = { purchase: 'minion', appoint: null };

    expect(plan(1, all, held).best.purchase?.tierId).toBe('minion');
  });

  it('hands over once a challenger clears the margin', () => {
    state.resources.evil = new Decimal(2600);
    const held: HeldKeys = { purchase: 'minion', appoint: null };

    expect(plan(1, all, held).best.purchase?.tierId).not.toBe('minion');
  });

  it('drops a held option that stopped being affordable', () => {
    state.resources.evil = new Decimal(0);
    const held: HeldKeys = { purchase: 'minion', appoint: null };

    expect(plan(1, all, held).best.purchase).toBeNull();
  });

  it('hands over when the held option has left a rail that still has spends on it', () => {
    state.resources.evil = new Decimal(2600);
    const held: HeldKeys = { purchase: 'legion', appoint: null };

    expect(plan(1, all, held).best.purchase?.tierId).toBe('warren');
  });
});

describe('the premise the per-panel tests rest on', () => {
  it('has the appointment outscoring every purchase once Minions are stacked', () => {
    state.gens.minion.owned = new Decimal(400);
    state.resources.evil = new Decimal(1000);
    const drawn = plan();

    expect(drawn.best.appoint?.score.gt(drawn.best.purchase?.score ?? new Decimal(0))).toBe(true);
  });

  it('has a purchase outscoring every appointment from a standing start', () => {
    state.resources.evil = new Decimal(2600);
    const drawn = plan();

    expect(drawn.best.purchase?.score.gt(drawn.best.appoint?.score ?? new Decimal(0))).toBe(true);
  });
});

describe('what a panel names to save toward', () => {
  it('never names a post on a tier that would produce nothing', () => {
    state.gens.minion.owned = new Decimal(400);
    state.overseers.minion = ['minion-hand', 'minion-goad', 'minion-glut'];
    state.resources.evil = new Decimal(50);

    expect(plan().saving.appoint).toBeNull();
  });

  it('still names the best purchase to save toward', () => {
    state.resources.evil = new Decimal(0);

    expect(plan().saving.purchase?.tierId).toBe('warren');
  });
});
