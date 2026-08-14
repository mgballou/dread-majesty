import Decimal from 'break_eternity.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CURRENT, CURRENT_ONBOARDING, v1Copy } from '@dm/content';
import type { DominionBeatId, OnboardingBeat, TierId } from '@dm/content';
import { createState, nextCost } from '@dm/engine';
import type { GameState } from '@dm/engine';
import {
  clearsBeat,
  finishOnboarding,
  forgetOnboarding,
  goadLine,
  isBeatReady,
  isGatedOut,
  onboardingDecision,
  readOnboarding,
  shouldRetire,
  showingBeat,
  supersededBeat,
  writeOnboarding,
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

  it('no longer clears goad on a blow', () => {
    expect(goad && clearsBeat(goad, { kind: 'smite' })).toBe(false);
  });

  it('leaves goad alone on a purchase', () => {
    expect(goad && clearsBeat(goad, { kind: 'buy', tierId: 'minion' })).toBe(false);
  });

  it('leaves goad alone on a dismissal', () => {
    expect(goad && clearsBeat(goad, { kind: 'dismiss' })).toBe(false);
  });
});

describe('shouldRetire', () => {
  const stir = dominion.find((beat) => beat.id === 'stir');
  const goad = malice.find((beat) => beat.id === 'goad');

  it('never retires a beat with no window', () => {
    expect(stir && shouldRetire({ beat: stir, shownAtMs: 0, playTimeMs: 9e9 })).toBe(false);
  });

  it('holds a beat inside its window', () => {
    expect(goad && shouldRetire({ beat: goad, shownAtMs: 0, playTimeMs: 119_999 })).toBe(false);
  });

  it('retires a beat on the millisecond its window closes', () => {
    expect(goad && shouldRetire({ beat: goad, shownAtMs: 0, playTimeMs: 120_000 })).toBe(true);
  });

  it('measures the window from when the beat was shown', () => {
    expect(goad && shouldRetire({ beat: goad, shownAtMs: 500_000, playTimeMs: 506_000 })).toBe(
      false,
    );
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

describe('what is written down', () => {
  beforeEach(() => forgetOnboarding());

  afterEach(() => {
    forgetOnboarding();
    vi.restoreAllMocks();
  });

  it('finds nothing before the first visit', () => {
    expect(readOnboarding()).toBeNull();
  });

  it('reads back the beats that were consumed', () => {
    writeOnboarding({ dominion: ['stir', 'orders'], malice: [], done: false });
    expect(readOnboarding()?.dominion).toEqual(['stir', 'orders']);
  });

  it('reads back the Malice track too', () => {
    writeOnboarding({ dominion: [], malice: ['first-blow'], done: false });
    expect(readOnboarding()?.malice).toEqual(['first-blow']);
  });

  it('reads back an unfinished walk as unfinished', () => {
    writeOnboarding({ dominion: ['stir'], malice: [], done: false });
    expect(readOnboarding()?.done).toBe(false);
  });

  it('reads back a finished walk as finished', () => {
    finishOnboarding();
    expect(readOnboarding()?.done).toBe(true);
  });

  it('treats the legacy flag as finished', () => {
    localStorage.setItem('dread-majesty:onboarding-seen', '1');
    expect(readOnboarding()?.done).toBe(true);
  });

  it('treats unreadable data as finished', () => {
    localStorage.setItem('dread-majesty:onboarding-seen', 'not json');
    expect(readOnboarding()?.done).toBe(true);
  });

  it('drops an id no track owns', () => {
    localStorage.setItem(
      'dread-majesty:onboarding-seen',
      JSON.stringify({ dominion: ['stir', 'renamed'], malice: [], done: false }),
    );
    expect(readOnboarding()?.dominion).toEqual(['stir']);
  });

  it('treats a store that refuses to be read as finished', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readOnboarding()?.done).toBe(true);
  });

  it('says nothing when a store that refuses to be written is written to', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => finishOnboarding()).not.toThrow();
  });
});

describe('onboardingDecision', () => {
  const midway = { dominion: ['stir', 'orders'], malice: [], done: false } as const;

  it('starts a player with no save and nothing written down', () => {
    expect(onboardingDecision({ stored: null, fresh: true }).kind).toBe('run');
  });

  it('starts that player at the top of the track', () => {
    const decision = onboardingDecision({ stored: null, fresh: true });
    expect(decision.kind === 'run' && decision.progress.dominion).toEqual([]);
  });

  it('writes off a player who has a save and predates onboarding', () => {
    expect(onboardingDecision({ stored: null, fresh: false }).kind).toBe('retire');
  });

  it('resumes a walk that was interrupted, save or no save', () => {
    const decision = onboardingDecision({ stored: midway, fresh: false });
    expect(decision.kind === 'run' && decision.progress.dominion).toEqual(['stir', 'orders']);
  });

  it('says nothing to a player who finished or skipped', () => {
    expect(
      onboardingDecision({ stored: { dominion: [], malice: [], done: true }, fresh: false }).kind,
    ).toBe('nothing');
  });

  it('says nothing to a finished player even on a save-less visit', () => {
    expect(
      onboardingDecision({ stored: { dominion: [], malice: [], done: true }, fresh: true }).kind,
    ).toBe('nothing');
  });

  it('resumes at the beat the player was on', () => {
    const state = fresh();
    state.resources.evil = new Decimal(160);
    const decision = onboardingDecision({ stored: midway, fresh: false });
    const consumed = decision.kind === 'run' ? decision.progress.dominion : [];
    expect(showing(state, consumed)?.id).toBe('muster');
  });
});

describe('supersededBeat', () => {
  const bandCount = v1Copy.smite.bands.length;

  function superseded(state: GameState, consumed: readonly string[]) {
    return supersededBeat({
      track: malice,
      consumed: consumed as readonly (typeof malice)[number]['id'][],
      state,
      content,
      bandCount,
    });
  }

  function struck(apathy: number): GameState {
    const state = fresh();
    state.stats.smites = 1;
    state.smiteApathy = apathy;
    return state;
  }

  it('leaves her talking while the realm still flinches', () => {
    expect(superseded(struck(1.5), ['first-blow'])).toBeNull();
  });

  it('hands over once the realm has stopped looking', () => {
    expect(superseded(struck(2.1), ['first-blow'])).toBe('goad');
  });

  it('takes the boundary as belonging to the narrator', () => {
    expect(superseded(struck(2), ['first-blow'])).toBe('goad');
  });

  it('supersedes nothing when the showing beat waits on the player', () => {
    expect(superseded(struck(2.1), [])).toBeNull();
  });

  it('supersedes nothing once she is already consumed', () => {
    expect(superseded(struck(2.1), ['first-blow', 'goad'])).toBeNull();
  });

  it('supersedes nothing when no beat is showing', () => {
    expect(superseded(fresh(), ['first-blow', 'goad', 'apathy'])).toBeNull();
  });

  it('hands over even while she is hidden by her own cooldown', () => {
    const state = struck(2.1);
    state.smiteCooldownMs = 20_000;
    state.smiteActiveMs = 15_000;
    expect(superseded(state, ['first-blow'])).toBe('goad');
  });
});
