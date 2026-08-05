import Decimal from 'break_eternity.js';
import { describe, expect, it } from 'vitest';
import { apply } from '../src/intents.ts';
import { canSmite, smitePhase } from '../src/selectors.ts';
import { nextBlowMultiplier, smiteBleedMs, smiteDurationMs } from '../src/smite.ts';
import { createState } from '../src/state.ts';
import { globalMultiplier, step } from '../src/step.ts';
import type { GameState } from '../src/types.ts';
import { fixture } from './fixtures/content.ts';

const cooldownMs = fixture.smite.cooldownMs;

function running(): GameState {
  const state = createState(fixture);
  for (const tier of fixture.tiers) {
    state.gens[tier.id].owned = new Decimal(10);
    const automator = tier.overseers.find((post) => post.effect.kind === 'automate');
    state.overseers[tier.id] = automator ? [automator.id] : [];
  }
  return state;
}

function smite(state: GameState) {
  return apply(state, fixture, { kind: 'smite' });
}

describe('smite', () => {
  it('is ready on a fresh state', () => {
    expect(canSmite(createState(fixture))).toBe(true);
  });

  it('pays nothing at once — a blow is the buff and nothing else', () => {
    const state = createState(fixture);
    smite(state);

    expect(state.resources.evil.eq(0)).toBe(true);
  });

  it('is worth striking before anything runs, because it covers the cycles you start', () => {
    const state = createState(fixture);
    smite(state);
    apply(state, fixture, { kind: 'rouse', tierId: 'minion' });
    step(state, fixture, 24_000);

    expect(state.resources.evil.gt(0)).toBe(true);
  });

  it('starts the buff', () => {
    const state = running();
    smite(state);

    expect(state.smiteActiveMs).toBe(48_000);
  });

  it('starts the cooldown', () => {
    const state = running();
    smite(state);

    expect(state.smiteCooldownMs).toBe(cooldownMs);
  });

  it('raises the global multiplier while it runs', () => {
    const state = running();
    const before = globalMultiplier(state, fixture);
    smite(state);

    expect(globalMultiplier(state, fixture).div(before).toNumber()).toBe(2);
  });

  it('drops the multiplier back when the buff runs out', () => {
    const state = running();
    smite(state);
    step(state, fixture, smiteDurationMs(state, fixture));

    expect(globalMultiplier(state, fixture).toNumber()).toBe(1);
  });

  it('refuses a second blow while cooling', () => {
    const state = running();
    smite(state);

    expect(smite(state).ok).toBe(false);
  });

  it('says why it refused', () => {
    const state = running();
    smite(state);
    const result = smite(state);

    expect(result.ok === false && result.reason).toBe('smite-cooling');
  });

  it('allows another once the cooldown is spent', () => {
    const state = running();
    smite(state);
    step(state, fixture, cooldownMs);

    expect(canSmite(state)).toBe(true);
  });

  it('does not stack when struck again', () => {
    const state = running();
    smite(state);
    step(state, fixture, cooldownMs);
    smite(state);

    expect(state.smiteActiveMs).toBe(smiteDurationMs(state, fixture));
  });

  it('counts the blow whether or not anything was running', () => {
    const state = createState(fixture);
    smite(state);

    expect(state.stats.smites).toBe(1);
  });

  it('produces exactly twice as much across a buffed slice', () => {
    const plain = running();
    const buffed = running();
    smite(buffed);
    buffed.resources.evil = new Decimal(0);
    plain.resources.evil = new Decimal(0);

    step(plain, fixture, 24_000);
    step(buffed, fixture, 24_000);

    expect(buffed.resources.evil.div(plain.resources.evil).toNumber()).toBe(2);
  });

  it('spends the buff during offline catch-up like any other slice', () => {
    const state = running();
    const duration = smiteDurationMs(state, fixture);
    smite(state);
    step(state, fixture, duration * 2);

    expect(state.smiteActiveMs).toBe(0);
  });

  it('reports the buff while it runs', () => {
    const state = running();
    smite(state);

    expect(smitePhase(state, fixture).kind).toBe('active');
  });

  it('reports the cooldown once the buff is spent', () => {
    const state = running();
    smite(state);
    step(state, fixture, smiteDurationMs(state, fixture));

    expect(smitePhase(state, fixture).kind).toBe('cooling');
  });

  it('reports ready when it is neither', () => {
    expect(smitePhase(createState(fixture), fixture).kind).toBe('ready');
  });

  it('reports the share left on the buff', () => {
    const state = running();
    const duration = smiteDurationMs(state, fixture);
    smite(state);
    step(state, fixture, duration / 2);

    expect(smitePhase(state, fixture).share).toBeCloseTo(0.5);
  });

  it('clears the buff on a reset but keeps the cooldown', () => {
    const state = running();
    state.lifetimeEvil = new Decimal('1e30');
    smite(state);
    apply(state, fixture, { kind: 'prestige' });

    expect(state.smiteActiveMs).toBe(0);
  });

  it('keeps the cooldown across a reset, so a reset is not a free blow', () => {
    const state = running();
    state.lifetimeEvil = new Decimal('1e30');
    smite(state);
    apply(state, fixture, { kind: 'prestige' });

    expect(state.smiteCooldownMs).toBe(cooldownMs);
  });
});

describe('apathy', () => {
  it('starts at nothing', () => {
    expect(createState(fixture).smiteApathy).toBe(0);
  });

  it('prices the first blow of a run at full weight', () => {
    const state = running();

    expect(nextBlowMultiplier(state, fixture)).toBe(2);
  });

  it('rises by one with a blow', () => {
    const state = running();
    smite(state);

    expect(state.smiteApathy).toBe(1);
  });

  it('prices a blow by the apathy it found, not the apathy it caused', () => {
    const state = running();
    smite(state);

    expect(state.smiteBlow).toBe(2);
  });

  it('prices a blow at part-bled apathy', () => {
    const state = running();
    smite(state);
    step(state, fixture, smiteBleedMs(state, fixture) / 2);

    expect(nextBlowMultiplier(state, fixture)).toBeCloseTo(1.75);
  });

  it('prices the second blow lower', () => {
    const state = running();
    smite(state);

    expect(nextBlowMultiplier(state, fixture)).toBe(1.5);
  });

  it('bleeds a whole point over the forgetting time', () => {
    const state = running();
    smite(state);
    step(state, fixture, smiteBleedMs(state, fixture));

    expect(state.smiteApathy).toBe(0);
  });

  it('bleeds by exactly the share of the slice', () => {
    const state = running();
    smite(state);
    step(state, fixture, smiteBleedMs(state, fixture) / 4);

    expect(state.smiteApathy).toBeCloseTo(0.75);
  });

  it('never bleeds below nothing', () => {
    const state = running();
    smite(state);
    step(state, fixture, smiteBleedMs(state, fixture) * 10);

    expect(state.smiteApathy).toBe(0);
  });

  it('caps rather than spiralling', () => {
    const state = running();
    for (let blow = 0; blow < 20; blow += 1) {
      state.smiteCooldownMs = 0;
      smite(state);
    }

    expect(state.smiteApathy).toBe(fixture.smite.apathy.cap);
  });

  it('floors a blow at one, so a blow is never a penalty', () => {
    const state = running();
    state.smiteApathy = fixture.smite.apathy.cap;

    expect(nextBlowMultiplier(state, fixture)).toBe(1);
  });

  it('agrees on apathy whichever way the slice is cut', () => {
    const once = running();
    const twice = running();
    smite(once);
    smite(twice);
    step(once, fixture, 20_000);
    step(twice, fixture, 10_000);
    step(twice, fixture, 10_000);

    expect(once.smiteApathy).toBeCloseTo(twice.smiteApathy);
  });

  it('holds the running blow at what it was struck for', () => {
    const state = running();
    smite(state);
    state.smiteRungs.weight = 2;

    expect(globalMultiplier(state, fixture).toNumber()).toBe(2);
  });

  it('gives the blow back its worth once it runs out', () => {
    const state = running();
    smite(state);
    step(state, fixture, smiteDurationMs(state, fixture));

    expect(state.smiteBlow).toBe(1);
  });

  it('keeps the apathy through a reset, so a reset does not clear the debt', () => {
    const state = running();
    state.lifetimeEvil = new Decimal('1e30');
    smite(state);
    apply(state, fixture, { kind: 'prestige' });

    expect(state.smiteApathy).toBe(1);
  });

  it('clears the running blow on a reset', () => {
    const state = running();
    state.lifetimeEvil = new Decimal('1e30');
    smite(state);
    apply(state, fixture, { kind: 'prestige' });

    expect(state.smiteBlow).toBe(1);
  });
});
