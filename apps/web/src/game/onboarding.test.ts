import Decimal from 'break_eternity.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CURRENT, CURRENT_ONBOARDING, v1Copy } from '@dm/content';
import type { DominionBeatId, MaliceBeatId, OnboardingBeat, TierId } from '@dm/content';
import { createState, nextCost } from '@dm/engine';
import type { GameState } from '@dm/engine';
import {
  clearsBeat,
  finishOnboarding,
  forgetOnboarding,
  herLine,
  isBeatReady,
  isGatedOut,
  latches,
  onboardingDecision,
  readOnboarding,
  shouldRetire,
  showingBeat,
  supersededBeat,
  urgingLine,
  waitingLine,
  writeOnboarding,
} from './onboarding.ts';
import type { ClearingAction } from './onboarding.ts';
import { spotlightFor } from './spotlight.ts';

const content = CURRENT;
const dominion = CURRENT_ONBOARDING.dominion;
const malice = CURRENT_ONBOARDING.malice;

function fresh(): GameState {
  return createState(content);
}

function showing(
  state: GameState,
  consumed: readonly DominionBeatId[],
  shownId: DominionBeatId | null = null,
): OnboardingBeat<DominionBeatId> | null {
  return showingBeat({ track: dominion, consumed, state, content, shownId });
}

/** A minimal beat for tests exercising generic track logic rather than shipped content. */
function testBeat(
  overrides: Partial<OnboardingBeat<string>> & { id: string },
): OnboardingBeat<string> {
  return {
    ready: { kind: 'always' },
    gate: { kind: 'none' },
    voice: 'narrator',
    clearedBy: 'dismiss',
    retireAfterMs: null,
    ...overrides,
  };
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
      isBeatReady({ ready: { kind: 'owned-and-idle', tierId: 'minion' }, state, content }),
    ).toBe(true);
  });

  it('withholds owned-and-idle while the cycle runs', () => {
    const state = fresh();
    state.gens.minion.owned = new Decimal(1);
    state.gens.minion.running = true;
    expect(
      isBeatReady({ ready: { kind: 'owned-and-idle', tierId: 'minion' }, state, content }),
    ).toBe(false);
  });

  it('is ready once a tier has cycled', () => {
    const state = fresh();
    state.gens.minion.lifetimeProduced = new Decimal(1);
    expect(isBeatReady({ ready: { kind: 'cycled', tierId: 'minion' }, state, content })).toBe(true);
  });

  it('withholds cycled before a tier has ever paid out', () => {
    const state = fresh();
    expect(isBeatReady({ ready: { kind: 'cycled', tierId: 'minion' }, state, content })).toBe(
      false,
    );
  });

  it('withholds can-afford-overseer until the post is affordable', () => {
    const state = fresh();
    state.resources.evil = new Decimal(1199);
    expect(
      isBeatReady({
        ready: { kind: 'can-afford-overseer', overseerId: 'minion-hand' },
        state,
        content,
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
      }),
    ).toBe(true);
  });

  it('withholds smites-at-least below the count', () => {
    const state = fresh();
    state.stats.smites = 2;
    expect(isBeatReady({ ready: { kind: 'smites-at-least', count: 3 }, state, content })).toBe(
      false,
    );
  });

  it('is ready at smites-at-least the count', () => {
    const state = fresh();
    state.stats.smites = 3;
    expect(isBeatReady({ ready: { kind: 'smites-at-least', count: 3 }, state, content })).toBe(
      true,
    );
  });

  it('withholds blow-ready-after-first before a first blow lands', () => {
    const state = fresh();
    expect(isBeatReady({ ready: { kind: 'blow-ready-after-first' }, state, content })).toBe(false);
  });

  it('is ready for the next blow once the first has cleared its cooldown', () => {
    const state = fresh();
    state.stats.smites = 1;
    state.smiteActiveMs = 0;
    state.smiteCooldownMs = 0;
    expect(isBeatReady({ ready: { kind: 'blow-ready-after-first' }, state, content })).toBe(true);
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

  it('never clears a superseded beat, for every action kind', () => {
    const her = testBeat({
      id: 'her',
      clearedBy: { kind: 'superseded', when: { kind: 'smites-at-least', count: 3 } },
    });
    const actions: readonly ClearingAction[] = [
      { kind: 'smite' },
      { kind: 'dismiss' },
      { kind: 'rouse', tierId: 'minion' },
      { kind: 'buy', tierId: 'minion' },
      { kind: 'appoint', overseerId: 'minion-hand' },
    ];
    for (const action of actions) {
      expect(clearsBeat(her, action)).toBe(false);
    }
  });
});

describe('latches', () => {
  it('is true for a dismiss-only beat that gates nothing', () => {
    expect(latches(testBeat({ id: 'a', gate: { kind: 'none' }, clearedBy: 'dismiss' }))).toBe(true);
  });

  it('is false for a gated beat', () => {
    expect(
      latches(
        testBeat({
          id: 'b',
          gate: { kind: 'rouse', tierId: 'minion' },
          clearedBy: 'gated-action',
        }),
      ),
    ).toBe(false);
  });
});

describe('showingBeat latching', () => {
  it('keeps a latching beat showing once its ready no longer holds', () => {
    const state = fresh();
    const stuck = testBeat({
      id: 'stuck',
      ready: { kind: 'smites-at-least', count: 99 },
      gate: { kind: 'none' },
      clearedBy: 'dismiss',
    });
    expect(showingBeat({ track: [stuck], consumed: [], state, content, shownId: stuck.id })).toBe(
      stuck,
    );
  });

  it('shows nothing for the same beat when it was not the one on screen', () => {
    const state = fresh();
    const stuck = testBeat({
      id: 'stuck',
      ready: { kind: 'smites-at-least', count: 99 },
      gate: { kind: 'none' },
      clearedBy: 'dismiss',
    });
    expect(showingBeat({ track: [stuck], consumed: [], state, content, shownId: null })).toBeNull();
  });

  it('does not let latching reach a gated beat', () => {
    const state = fresh();
    const gated = testBeat({
      id: 'gated',
      ready: { kind: 'smites-at-least', count: 99 },
      gate: { kind: 'rouse', tierId: 'minion' },
      clearedBy: 'gated-action',
    });
    expect(
      showingBeat({ track: [gated], consumed: [], state, content, shownId: gated.id }),
    ).toBeNull();
  });
});

describe('shouldRetire', () => {
  const stir = dominion.find((beat) => beat.id === 'stir');
  const goad = malice.find((beat) => beat.id === 'goad');

  it('never retires a beat with no window', () => {
    expect(stir && shouldRetire({ beat: stir, shownAtMs: 0, playTimeMs: 9e9 })).toBe(false);
  });

  it('holds a beat inside its window', () => {
    expect(goad && shouldRetire({ beat: goad, shownAtMs: 0, playTimeMs: 74_999 })).toBe(false);
  });

  it('retires a beat on the millisecond its window closes', () => {
    expect(goad && shouldRetire({ beat: goad, shownAtMs: 0, playTimeMs: 75_000 })).toBe(true);
  });

  it('measures the window from when the beat was shown', () => {
    expect(goad && shouldRetire({ beat: goad, shownAtMs: 500_000, playTimeMs: 506_000 })).toBe(
      false,
    );
  });
});

describe('urgingLine', () => {
  const lines = v1Copy.onboarding.urging;

  it('is on the first line after the first blow', () => {
    expect(urgingLine(lines, 1)).toBe(lines[0]);
  });

  it('is on the second line after the second blow', () => {
    expect(urgingLine(lines, 2)).toBe(lines[1]);
  });

  it('clamps to the last line however many blows have landed', () => {
    expect(urgingLine(lines, 9)).toBe(lines[lines.length - 1]);
  });

  it('reads the first line rather than nothing before any blow has landed', () => {
    expect(urgingLine(lines, 0)).toBe(lines[0]);
  });
});

describe('waitingLine', () => {
  const lines = v1Copy.onboarding.waiting;

  it('picks the first line whose threshold Apathy exceeds', () => {
    expect(waitingLine(lines, 0.5)).toBe(lines[0]?.line);
  });

  it('takes the calmer line when Apathy sits exactly on the boundary', () => {
    expect(waitingLine(lines, 0.35)).toBe(lines[1]?.line);
  });
});

describe('herLine', () => {
  const urging = v1Copy.onboarding.urging;
  const waiting = v1Copy.onboarding.waiting;

  it('urges while the cooldown still runs', () => {
    const state = fresh();
    state.smiteCooldownMs = 1;
    state.stats.smites = 1;
    expect(herLine({ urging, waiting, state })).toBe(urging[0]);
  });

  it('waits once the cooldown has cleared', () => {
    const state = fresh();
    state.smiteCooldownMs = 0;
    state.smiteApathy = 0.5;
    expect(herLine({ urging, waiting, state })).toBe(waiting[0]?.line);
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
    writeOnboarding({ dominion: ['stir', 'orders'], malice: [], done: false, caved: false });
    expect(readOnboarding()?.dominion).toEqual(['stir', 'orders']);
  });

  it('reads back the Malice track too', () => {
    writeOnboarding({ dominion: [], malice: ['first-blow'], done: false, caved: false });
    expect(readOnboarding()?.malice).toEqual(['first-blow']);
  });

  it('reads back an unfinished walk as unfinished', () => {
    writeOnboarding({ dominion: ['stir'], malice: [], done: false, caved: false });
    expect(readOnboarding()?.done).toBe(false);
  });

  it('round-trips caved', () => {
    writeOnboarding({ dominion: [], malice: [], done: false, caved: true });
    expect(readOnboarding()?.caved).toBe(true);
  });

  it('reads a stored object with no caved key as caved: false', () => {
    localStorage.setItem(
      'dread-majesty:onboarding-seen',
      JSON.stringify({ dominion: [], malice: [], done: false }),
    );
    expect(readOnboarding()?.caved).toBe(false);
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
  const midway = { dominion: ['stir', 'orders'], malice: [], done: false, caved: false } as const;

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
      onboardingDecision({
        stored: { dominion: [], malice: [], done: true, caved: false },
        fresh: false,
      }).kind,
    ).toBe('nothing');
  });

  it('says nothing to a finished player even on a save-less visit', () => {
    expect(
      onboardingDecision({
        stored: { dominion: [], malice: [], done: true, caved: false },
        fresh: true,
      }).kind,
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
  function superseded(state: GameState, consumed: readonly MaliceBeatId[]) {
    return supersededBeat({ track: malice, consumed, state, content });
  }

  function struckTimes(smites: number): GameState {
    const state = fresh();
    state.stats.smites = smites;
    return state;
  }

  it('leaves her talking before the third blow', () => {
    expect(superseded(struckTimes(2), ['first-blow'])).toBeNull();
  });

  it('hands over once the third blow lands', () => {
    expect(superseded(struckTimes(3), ['first-blow'])).toBe('goad');
  });

  it('supersedes nothing when the showing beat waits on the player', () => {
    expect(superseded(struckTimes(3), [])).toBeNull();
  });

  it('supersedes nothing once she is already consumed', () => {
    expect(superseded(struckTimes(3), ['first-blow', 'goad'])).toBeNull();
  });

  it('supersedes nothing when no beat is showing', () => {
    expect(superseded(fresh(), ['first-blow', 'goad', 'verdict'])).toBeNull();
  });

  it('hands over even while she is hidden by her own cooldown', () => {
    const state = struckTimes(3);
    state.smiteCooldownMs = 20_000;
    state.smiteActiveMs = 15_000;
    expect(superseded(state, ['first-blow'])).toBe('goad');
  });

  it('reports the showing beat even while its own readiness is false — the deadlock guard', () => {
    const state = fresh();
    state.stats.smites = 3;
    const her = testBeat({
      id: 'her',
      ready: { kind: 'smites-at-least', count: 99 },
      clearedBy: { kind: 'superseded', when: { kind: 'smites-at-least', count: 3 } },
    });
    expect(supersededBeat({ track: [her], consumed: [], state, content })).toBe('her');
  });
});

describe('spotlightFor', () => {
  it('points at the strike itself for a beat whose points is smite', () => {
    const goad = malice.find((beat) => beat.id === 'goad');
    expect(goad && spotlightFor(goad).target).toBe('.evil-node');
  });

  it('falls back to the gate for a beat with no points', () => {
    const muster = dominion.find((beat) => beat.id === 'muster');
    expect(muster && spotlightFor(muster)).toEqual({
      target: '.rail__row[data-tier="minion"]',
      panel: 'muster',
    });
  });
});
