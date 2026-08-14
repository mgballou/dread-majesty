import Decimal from 'break_eternity.js';
import { beforeEach, describe, expect, it } from 'vitest';
import { CURRENT, CURRENT_ONBOARDING, v1Copy } from '@dm/content';
import type { DominionBeatId, OnboardingBeat, TierId } from '@dm/content';
import { createState, nextCost } from '@dm/engine';
import type { GameState } from '@dm/engine';
import {
  clearsBeat,
  forgetOnboarding,
  goadLine,
  hasSeenOnboarding,
  isBeatReady,
  isGatedOut,
  markOnboardingSeen,
  showingBeat,
} from './onboarding.ts';

const content = CURRENT;
const dominion = CURRENT_ONBOARDING.dominion;
const malice = CURRENT_ONBOARDING.malice;
const bandCount = v1Copy.smite.bands.length;

function fresh(): GameState {
  return createState(content);
}

function showing(
  state: GameState,
  consumed: readonly DominionBeatId[],
): OnboardingBeat<DominionBeatId> | null {
  return showingBeat({ track: dominion, consumed, state, content, bandCount });
}

function affordable(state: GameState, tierId: TierId): boolean {
  const cost = nextCost(state, content, tierId);
  return cost !== null && state.resources.evil.gte(cost);
}

describe('showingBeat', () => {
  it('opens on stir', () => {
    expect(showing(fresh(), [])?.id).toBe('stir');
  });

  it('shows nothing while the roused cycle is still running', () => {
    const state = fresh();
    state.gens.minion.running = true;
    expect(showing(state, ['stir'])).toBeNull();
  });

  it('shows orders once the cycle has paid out', () => {
    const state = fresh();
    state.gens.minion.lifetimeProduced = new Decimal(5);
    expect(showing(state, ['stir'])?.id).toBe('orders');
  });

  it('withholds muster until a Minion is affordable', () => {
    const state = fresh();
    state.gens.minion.lifetimeProduced = new Decimal(5);
    state.resources.evil = new Decimal(10);
    expect(showing(state, ['stir', 'orders'])).toBeNull();
  });

  it('shows muster once a Minion is affordable', () => {
    const state = fresh();
    state.resources.evil = new Decimal(160);
    expect(showing(state, ['stir', 'orders'])?.id).toBe('muster');
  });

  it('never shows a beat out of order', () => {
    const state = fresh();
    state.resources.evil = new Decimal(1e9);
    expect(showing(state, [])?.id).toBe('stir');
  });
});

describe('isBeatReady', () => {
  it('is ready once a tier is owned and idle', () => {
    const state = fresh();
    state.gens.minion.owned = new Decimal(1);
    expect(
      isBeatReady({
        ready: { kind: 'owned-and-idle', tierId: 'minion' },
        state,
        content,
        bandCount,
      }),
    ).toBe(true);
  });

  it('withholds owned-and-idle while the cycle runs', () => {
    const state = fresh();
    state.gens.minion.owned = new Decimal(1);
    state.gens.minion.running = true;
    expect(
      isBeatReady({
        ready: { kind: 'owned-and-idle', tierId: 'minion' },
        state,
        content,
        bandCount,
      }),
    ).toBe(false);
  });

  it('is ready once a tier has cycled', () => {
    const state = fresh();
    state.gens.minion.lifetimeProduced = new Decimal(1);
    expect(
      isBeatReady({ ready: { kind: 'cycled', tierId: 'minion' }, state, content, bandCount }),
    ).toBe(true);
  });

  it('withholds cycled before a tier has ever paid out', () => {
    const state = fresh();
    expect(
      isBeatReady({ ready: { kind: 'cycled', tierId: 'minion' }, state, content, bandCount }),
    ).toBe(false);
  });

  it('withholds can-afford-overseer until the post is affordable', () => {
    const state = fresh();
    state.resources.evil = new Decimal(1199);
    expect(
      isBeatReady({
        ready: { kind: 'can-afford-overseer', overseerId: 'minion-hand' },
        state,
        content,
        bandCount,
      }),
    ).toBe(false);
  });

  it('is ready once an overseer post is affordable', () => {
    const state = fresh();
    state.resources.evil = new Decimal(1200);
    expect(
      isBeatReady({
        ready: { kind: 'can-afford-overseer', overseerId: 'minion-hand' },
        state,
        content,
        bandCount,
      }),
    ).toBe(true);
  });

  it('withholds smites-at-least below the count', () => {
    const state = fresh();
    state.stats.smites = 2;
    expect(
      isBeatReady({ ready: { kind: 'smites-at-least', count: 3 }, state, content, bandCount }),
    ).toBe(false);
  });

  it('is ready at smites-at-least the count', () => {
    const state = fresh();
    state.stats.smites = 3;
    expect(
      isBeatReady({ ready: { kind: 'smites-at-least', count: 3 }, state, content, bandCount }),
    ).toBe(true);
  });

  it('withholds blow-ready-after-first before a first blow lands', () => {
    const state = fresh();
    expect(
      isBeatReady({ ready: { kind: 'blow-ready-after-first' }, state, content, bandCount }),
    ).toBe(false);
  });

  it('is ready for the next blow once the first has cleared its cooldown', () => {
    const state = fresh();
    state.stats.smites = 1;
    state.smiteActiveMs = 0;
    state.smiteCooldownMs = 0;
    expect(
      isBeatReady({ ready: { kind: 'blow-ready-after-first' }, state, content, bandCount }),
    ).toBe(true);
  });

  it('withholds band-at-least just under the band', () => {
    const state = fresh();
    state.smiteApathy = 1.999;
    expect(
      isBeatReady({ ready: { kind: 'band-at-least', band: 2 }, state, content, bandCount }),
    ).toBe(false);
  });

  it('is ready for band-at-least exactly at the band', () => {
    const state = fresh();
    state.smiteApathy = 2.0;
    expect(
      isBeatReady({ ready: { kind: 'band-at-least', band: 2 }, state, content, bandCount }),
    ).toBe(true);
  });

  it('stays ready for band-at-least at the cap', () => {
    const state = fresh();
    state.smiteApathy = 3.0;
    expect(
      isBeatReady({ ready: { kind: 'band-at-least', band: 2 }, state, content, bandCount }),
    ).toBe(true);
  });
});

describe('the gate never strands the player', () => {
  it('shows nothing after appointing when the Warren is still out of reach', () => {
    const state = fresh();
    state.resources.evil = new Decimal(1800);
    state.overseers.minion = ['minion-hand'];
    const beat = showing(state, ['stir', 'orders', 'muster', 'appoint']);
    expect(beat).toBeNull();
  });

  it('shows the Warren beat once it is affordable', () => {
    const state = fresh();
    state.resources.evil = new Decimal(3000);
    state.overseers.minion = ['minion-hand'];
    const beat = showing(state, ['stir', 'orders', 'muster', 'appoint']);
    expect(beat?.id).toBe('warren');
  });

  it('never names a purchase the player cannot make', () => {
    const prefixes: readonly (readonly DominionBeatId[])[] = [
      ['stir', 'orders'],
      ['stir', 'orders', 'muster'],
      ['stir', 'orders', 'muster', 'appoint'],
    ];

    for (const consumed of prefixes) {
      for (const evil of [0, 1, 159, 160, 1199, 1200, 2999, 3000, 1e6]) {
        const state = fresh();
        state.resources.evil = new Decimal(evil);
        const beat = showing(state, consumed);
        if (beat?.gate.kind !== 'buy') continue;
        expect(affordable(state, beat.gate.tierId)).toBe(true);
      }
    }
  });

  it('gates every purchase on affording that same purchase, by construction', () => {
    for (const beat of [...dominion, ...malice]) {
      if (beat.gate.kind === 'buy') {
        expect(beat.ready).toEqual({ kind: 'can-afford-tier', tierId: beat.gate.tierId });
      }
      if (beat.gate.kind === 'appoint') {
        expect(beat.ready).toEqual({
          kind: 'can-afford-overseer',
          overseerId: beat.gate.overseerId,
        });
      }
    }
  });
});

describe('isGatedOut', () => {
  it('holds back a tier the gate does not name', () => {
    expect(isGatedOut({ kind: 'buy', tierId: 'minion' }, { kind: 'buy', tierId: 'warren' })).toBe(
      true,
    );
  });

  it('lets the named purchase through', () => {
    expect(isGatedOut({ kind: 'buy', tierId: 'minion' }, { kind: 'buy', tierId: 'minion' })).toBe(
      false,
    );
  });

  it('holds back a rouse while a purchase is named', () => {
    expect(isGatedOut({ kind: 'buy', tierId: 'minion' }, { kind: 'rouse', tierId: 'minion' })).toBe(
      true,
    );
  });

  it('gates nothing when the beat names nothing', () => {
    expect(isGatedOut({ kind: 'none' }, { kind: 'buy', tierId: 'warren' })).toBe(false);
  });
});

describe('clearsBeat', () => {
  const stir = dominion.find((beat) => beat.id === 'stir');
  const goad = malice.find((beat) => beat.id === 'goad');

  it('clears a gated beat on its own action', () => {
    expect(stir && clearsBeat(stir, { kind: 'rouse', tierId: 'minion' })).toBe(true);
  });

  it('leaves a gated beat alone on a different action', () => {
    expect(stir && clearsBeat(stir, { kind: 'buy', tierId: 'minion' })).toBe(false);
  });

  it('clears goad on a blow', () => {
    expect(goad && clearsBeat(goad, { kind: 'smite' })).toBe(true);
  });

  it('leaves goad alone on a purchase', () => {
    expect(goad && clearsBeat(goad, { kind: 'buy', tierId: 'minion' })).toBe(false);
  });
});

describe('goadLine', () => {
  const lines = v1Copy.onboarding.goad;

  it('flatters while the realm is still sore', () => {
    expect(goadLine(lines, 0.56)).toBe(lines[0]?.line);
  });

  it('reasons as the sting fades', () => {
    expect(goadLine(lines, 0.3)).toBe(lines[1]?.line);
  });

  it('feigns patience near the end', () => {
    expect(goadLine(lines, 0.1)).toBe(lines[2]?.line);
  });

  it('is finally correct at zero', () => {
    expect(goadLine(lines, 0)).toBe(lines[3]?.line);
  });

  it('takes the boundary as belonging to the line below it', () => {
    expect(goadLine(lines, 0.45)).toBe(lines[1]?.line);
  });

  it('takes the second boundary as belonging to the line below it too', () => {
    expect(goadLine(lines, 0.2)).toBe(lines[2]?.line);
  });
});

describe('the seen flag', () => {
  beforeEach(() => forgetOnboarding());

  it('starts unseen', () => {
    expect(hasSeenOnboarding()).toBe(false);
  });

  it('remembers once marked', () => {
    markOnboardingSeen();
    expect(hasSeenOnboarding()).toBe(true);
  });
});
